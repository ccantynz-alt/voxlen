import { describe, it, expect, beforeEach, vi } from "vitest";
import { useClauseStore } from "./clauses";
import type { Clause } from "./clauses";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    save: vi.fn(),
  }),
}));

function makeClause(overrides: Partial<Clause> = {}): Clause {
  return {
    id: `custom-${Math.random().toString(36).slice(2)}`,
    title: "Test Clause",
    category: "general",
    voiceTrigger: "insert test clause",
    text: "This is a test clause.",
    tags: ["test"],
    ...overrides,
  };
}

describe("useClauseStore", () => {
  beforeEach(() => {
    useClauseStore.setState({
      clauses: [],
      customClauseIds: [],
      recentlyUsed: [],
    });
  });

  describe("addClause", () => {
    it("adds a clause and tracks it as custom", () => {
      const clause = makeClause({ id: "c1" });
      useClauseStore.getState().addClause(clause);
      const { clauses, customClauseIds } = useClauseStore.getState();
      expect(clauses).toHaveLength(1);
      expect(clauses[0].id).toBe("c1");
      expect(customClauseIds).toContain("c1");
    });

    it("accumulates multiple clauses", () => {
      useClauseStore.getState().addClause(makeClause({ id: "a" }));
      useClauseStore.getState().addClause(makeClause({ id: "b" }));
      expect(useClauseStore.getState().clauses).toHaveLength(2);
    });
  });

  describe("removeClause", () => {
    it("removes clause by id", () => {
      useClauseStore.getState().addClause(makeClause({ id: "keep" }));
      useClauseStore.getState().addClause(makeClause({ id: "del" }));
      useClauseStore.getState().removeClause("del");
      const { clauses, customClauseIds } = useClauseStore.getState();
      expect(clauses).toHaveLength(1);
      expect(clauses[0].id).toBe("keep");
      expect(customClauseIds).not.toContain("del");
    });

    it("is a no-op for unknown id", () => {
      useClauseStore.getState().addClause(makeClause({ id: "c1" }));
      useClauseStore.getState().removeClause("no-such-id");
      expect(useClauseStore.getState().clauses).toHaveLength(1);
    });
  });

  describe("updateClause", () => {
    it("patches specific fields without touching other clauses", () => {
      useClauseStore.getState().addClause(makeClause({ id: "c1", title: "Old" }));
      useClauseStore.getState().addClause(makeClause({ id: "c2", title: "Other" }));
      useClauseStore.getState().updateClause("c1", { title: "New" });
      const { clauses } = useClauseStore.getState();
      expect(clauses.find((c) => c.id === "c1")?.title).toBe("New");
      expect(clauses.find((c) => c.id === "c2")?.title).toBe("Other");
    });
  });

  describe("markUsed", () => {
    it("prepends id to recentlyUsed", () => {
      useClauseStore.getState().markUsed("c1");
      useClauseStore.getState().markUsed("c2");
      expect(useClauseStore.getState().recentlyUsed[0]).toBe("c2");
    });

    it("deduplicates: moves existing id to front", () => {
      useClauseStore.getState().markUsed("c1");
      useClauseStore.getState().markUsed("c2");
      useClauseStore.getState().markUsed("c1");
      const { recentlyUsed } = useClauseStore.getState();
      expect(recentlyUsed[0]).toBe("c1");
      expect(recentlyUsed.filter((x) => x === "c1")).toHaveLength(1);
    });

    it("caps recentlyUsed at 10", () => {
      for (let i = 0; i < 12; i++) {
        useClauseStore.getState().markUsed(`c${i}`);
      }
      expect(useClauseStore.getState().recentlyUsed).toHaveLength(10);
    });
  });

  describe("findByTrigger", () => {
    it("returns clause when trigger is contained in text", () => {
      const clause = makeClause({ id: "c1", voiceTrigger: "insert indemnity" });
      useClauseStore.getState().addClause(clause);
      const found = useClauseStore.getState().findByTrigger("please insert indemnity now");
      expect(found?.id).toBe("c1");
    });

    it("matches exact trigger", () => {
      const clause = makeClause({ id: "c1", voiceTrigger: "insert nda" });
      useClauseStore.getState().addClause(clause);
      const found = useClauseStore.getState().findByTrigger("insert nda");
      expect(found?.id).toBe("c1");
    });

    it("is case-insensitive", () => {
      const clause = makeClause({ id: "c1", voiceTrigger: "Insert NDA" });
      useClauseStore.getState().addClause(clause);
      const found = useClauseStore.getState().findByTrigger("insert nda");
      expect(found?.id).toBe("c1");
    });

    it("returns undefined for no match", () => {
      const found = useClauseStore.getState().findByTrigger("something else");
      expect(found).toBeUndefined();
    });
  });
});
