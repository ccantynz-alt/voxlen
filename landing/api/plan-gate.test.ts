// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import grammarHandler from "./grammar.js";
import translateHandler from "./translate.js";
import vocabularyHandler from "./vocabulary.js";
import { mintDesktopToken } from "./_auth.js";

const ADMIN_EMAIL = "ccantynz@gmail.com";

beforeAll(() => {
  process.env.VOXLEN_TOKEN_SECRET = "test-secret-for-plan-gate";
  // No KV configured => lookupPlan() resolves to null, so the token's own plan
  // claim decides — the same path production takes during a KV outage.
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeRes() {
  const state = { statusCode: 0, body: undefined as any };
  const res: any = {
    headersSent: false,
    setHeader: () => {},
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: any) {
      state.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return { res, state };
}

async function post(
  handler: (req: any, res: any) => Promise<unknown>,
  bearer: string,
  body: Record<string, unknown>,
) {
  const { res, state } = fakeRes();
  await handler({ method: "POST", headers: { authorization: `Bearer ${bearer}` }, body }, res);
  return state;
}

const ENDPOINTS: Array<{
  name: string;
  handler: (req: any, res: any) => Promise<unknown>;
  body: Record<string, unknown>;
}> = [
  { name: "/api/grammar", handler: grammarHandler, body: { text: "helo world" } },
  { name: "/api/translate", handler: translateHandler, body: { text: "hello", target_language: "fr" } },
  { name: "/api/vocabulary", handler: vocabularyHandler, body: { name: "legal", terms: ["voir dire"] } },
];

describe("paid-plan gate on Voxlen-funded AI endpoints", () => {
  for (const { name, handler, body } of ENDPOINTS) {
    it(`${name} rejects a free-plan desktop token with 403`, async () => {
      const { token } = await mintDesktopToken(
        { sub: "u-free", email: "free@example.com", name: "Free User" },
        { plan: "free" },
      );
      const state = await post(handler, token, body);
      expect(state.statusCode).toBe(403);
      expect(String(state.body.error)).toMatch(/paid Voxlen plan/);
    });

    it(`${name} rejects a bare Google access token with 403`, async () => {
      // A Google access token minted by ANY OAuth client passes Google's
      // userinfo check, so authentication alone must not grant access.
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(
            JSON.stringify({ sub: "g-1", email: "stranger@gmail.com", name: "Stranger", picture: "" }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      );
      const state = await post(handler, "ya29.some-google-access-token", body);
      expect(state.statusCode).toBe(403);
      expect(String(state.body.error)).toMatch(/paid Voxlen plan/);
    });

    it(`${name} lets a paid plan through the gate`, async () => {
      const { token } = await mintDesktopToken(
        { sub: "u-pro", email: "pro@example.com", name: "Pro User" },
        { plan: "professional" },
      );
      const state = await post(handler, token, body);
      // Past the gate the handler proceeds to its provider call; with no
      // provider key configured in tests that surfaces as 503, never 403/401.
      expect(state.statusCode).not.toBe(403);
      expect(state.statusCode).not.toBe(401);
    });

    it(`${name} lets the admin account through the gate`, async () => {
      const { token } = await mintDesktopToken(
        { sub: "u-admin", email: ADMIN_EMAIL, name: "Craig" },
        { plan: "admin" },
      );
      const state = await post(handler, token, body);
      expect(state.statusCode).not.toBe(403);
      expect(state.statusCode).not.toBe(401);
    });

    it(`${name} still rejects a missing Authorization header with 401`, async () => {
      const { res, state } = fakeRes();
      await handler({ method: "POST", headers: {}, body }, res);
      expect(state.statusCode).toBe(401);
    });
  }
});
