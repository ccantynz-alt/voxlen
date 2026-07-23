import { describe, it, expect } from "vitest";
import { suggestClient, suggestOverActive } from "./matterMatch";
import type { Client } from "@/stores/clients";

function client(overrides: Partial<Client>): Client {
  return {
    id: "c1",
    name: "Acme Corp",
    billableRate: 400,
    color: "#fff",
    archived: false,
    createdAt: 0,
    ...overrides,
  };
}

describe("suggestClient", () => {
  it("matches a client name as a whole phrase (+3, meets threshold)", () => {
    const s = suggestClient("Letter to Acme Corp regarding the merger", [client({})]);
    expect(s?.clientId).toBe("c1");
    expect(s?.score).toBe(3);
    expect(s?.matchedOn).toContain("name");
  });

  it("does not match partial words", () => {
    const s = suggestClient("The acmecorporation merger", [client({})]);
    expect(s).toBeNull();
  });

  it("matter number match scores +4", () => {
    const s = suggestClient(
      "Refer to file 2024-001 for details",
      [client({ name: "Zed Ltd", matterNumber: "2024-001" })]
    );
    expect(s?.score).toBe(4);
  });

  it("vocabulary hits add +1 each, capped at 3", () => {
    const s = suggestClient(
      "estoppel doctrine, res judicata, laches, and waiver all apply",
      [client({ name: "Zed Ltd", vocabulary: ["estoppel", "res judicata", "laches", "waiver"] })]
    );
    expect(s?.score).toBe(3); // capped
  });

  it("returns null below threshold", () => {
    const s = suggestClient(
      "mentions estoppel once",
      [client({ name: "Zed Ltd", vocabulary: ["estoppel"] })]
    );
    expect(s).toBeNull();
  });

  it("picks the highest-scoring client", () => {
    const a = client({ id: "a", name: "Acme Corp" });
    const b = client({ id: "b", name: "Beta LLC", matterNumber: "M-9" });
    const s = suggestClient("Acme Corp letter regarding matter M-9 for Beta LLC", [a, b]);
    expect(s?.clientId).toBe("b"); // 3 (name) + 4 (matter#) = 7 vs 3
  });

  it("skips archived clients and the excluded (active) client", () => {
    const archived = client({ id: "a", name: "Acme Corp", archived: true });
    expect(suggestClient("Acme Corp letter", [archived])).toBeNull();
    const active = client({ id: "b", name: "Beta LLC" });
    expect(suggestClient("Beta LLC letter", [active], "b")).toBeNull();
  });

  it("escapes regex metacharacters in names", () => {
    const c = client({ name: "Smith (Holdings) Ltd." });
    const s = suggestClient("Advice for Smith (Holdings) Ltd. on tax", [c]);
    expect(s?.clientId).toBe("c1");
  });

  it("word-boundary safety: short vocab like 'form' does not hit 'format'", () => {
    const c = client({ name: "Zed", vocabulary: ["form", "tort", "lien"] });
    const s = suggestClient("formatting tortious liens", [c]);
    expect(s).toBeNull();
  });
});

describe("suggestOverActive", () => {
  it("requires a decisive score to challenge the active client", () => {
    const other = client({ id: "b", name: "Beta LLC", matterNumber: "M-9" });
    // name only (3) — not decisive vs threshold*2 = 6
    expect(suggestOverActive("Beta LLC mentioned in passing", [other], "a")).toBeNull();
    // name + matter number (7) — decisive
    const s = suggestOverActive("Beta LLC letter re matter M-9", [other], "a");
    expect(s?.clientId).toBe("b");
  });
});
