// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import handler from "./generate-key.js";
import { mintDesktopToken } from "./_auth.js";

const ADMIN_EMAIL = "ccantynz@gmail.com";

beforeAll(() => {
  process.env.VOXLEN_TOKEN_SECRET = "test-secret-for-generate-key";
  // No KV configured => lookupPlan() resolves to null for every email.
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

function fakeRes() {
  const state = { statusCode: 0, body: undefined as any };
  const res: any = {
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

function planOf(token: string): string {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).plan;
}

async function post(bearer: string, body: Record<string, unknown>) {
  const { res, state } = fakeRes();
  await handler(
    { method: "POST", headers: { authorization: `Bearer ${bearer}` }, body } as any,
    res,
  );
  return state;
}

async function adminBearer() {
  const { token } = await mintDesktopToken(
    { sub: "google-sub-admin", email: ADMIN_EMAIL, name: "Admin" },
    { plan: "admin" },
  );
  return token;
}

describe("generate-key plan selection", () => {
  it("does not mint an admin-plan key when an admin issues for a third party without a plan", async () => {
    const state = await post(await adminBearer(), { targetEmail: "eve@example.com" });

    expect(state.statusCode).toBe(200);
    expect(state.body.email).toBe("eve@example.com");
    expect(state.body.plan).toBe("free");
    expect(planOf(state.body.token)).toBe("free");
  });

  it("a key issued that way cannot mint further admin keys", async () => {
    const issued = await post(await adminBearer(), { targetEmail: "eve@example.com" });
    const eveState = await post(issued.body.token, { targetEmail: "mallory@evil.com" });

    expect(eveState.statusCode).toBe(403);
  });

  it("still honours an explicit plan from an admin", async () => {
    const state = await post(await adminBearer(), { targetEmail: "pro@example.com", plan: "professional" });

    expect(state.statusCode).toBe(200);
    expect(state.body.plan).toBe("professional");
    expect(planOf(state.body.token)).toBe("professional");
  });

  it("still gives the admin an admin key when issuing for themselves", async () => {
    const state = await post(await adminBearer(), {});

    expect(state.statusCode).toBe(200);
    expect(state.body.email).toBe(ADMIN_EMAIL);
    expect(state.body.plan).toBe("admin");
    expect(planOf(state.body.token)).toBe("admin");
  });
});
