import { describe, it, expect } from "vitest";
import {
  legalTermsForJurisdiction,
  mergeVocabulary,
  KEYTERM_CAP,
} from "./legalVocab";

describe("legalTermsForJurisdiction", () => {
  it("always includes the common-law core", () => {
    for (const j of ["uk", "us", "australia", "canada", "nz", "global"] as const) {
      const terms = legalTermsForJurisdiction(j);
      expect(terms).toContain("estoppel");
      expect(terms).toContain("res ipsa loquitur");
      expect(terms).toContain("voir dire");
    }
  });

  it("adds jurisdiction-specific terms", () => {
    expect(legalTermsForJurisdiction("uk")).toContain("CPR Part 36");
    expect(legalTermsForJurisdiction("us")).toContain("Rule 12(b)(6)");
    expect(legalTermsForJurisdiction("nz")).toContain(
      "the High Court of New Zealand"
    );
    expect(legalTermsForJurisdiction("australia")).toContain("Calderbank offer");
    expect(legalTermsForJurisdiction("canada")).toContain("factum");
  });

  it("does not leak one jurisdiction's terms into another", () => {
    expect(legalTermsForJurisdiction("us")).not.toContain("CPR Part 36");
    expect(legalTermsForJurisdiction("uk")).not.toContain("Rule 12(b)(6)");
  });

  it("stays within the keyterm cap on its own", () => {
    for (const j of ["uk", "us", "australia", "canada", "nz", "global"] as const) {
      expect(legalTermsForJurisdiction(j).length).toBeLessThanOrEqual(KEYTERM_CAP);
    }
  });

  it("has no duplicate terms within a pack", () => {
    for (const j of ["uk", "us", "australia", "canada", "nz"] as const) {
      const terms = legalTermsForJurisdiction(j).map((t) => t.toLowerCase());
      expect(new Set(terms).size).toBe(terms.length);
    }
  });
});

describe("mergeVocabulary", () => {
  it("preserves priority order and dedupes case-insensitively", () => {
    const out = mergeVocabulary([
      ["Estoppel", "EBITDA"],
      ["estoppel", "amortisation"],
      ["ebitda", "voir dire"],
    ]);
    expect(out).toEqual(["Estoppel", "EBITDA", "amortisation", "voir dire"]);
  });

  it("earlier sources win the budget when the cap is hit", () => {
    const user = Array.from({ length: 98 }, (_, i) => `user${i}`);
    const pack = ["packA", "packB", "packC"];
    const out = mergeVocabulary([user, pack], 100);
    expect(out).toHaveLength(100);
    expect(out.slice(0, 98)).toEqual(user);
    expect(out).toContain("packA");
    expect(out).toContain("packB");
    expect(out).not.toContain("packC");
  });

  it("skips blank and whitespace-only entries without spending budget", () => {
    const out = mergeVocabulary([["", "  ", "estoppel"]], 2);
    expect(out).toEqual(["estoppel"]);
  });

  it("defaults to the keyterm cap", () => {
    const many = Array.from({ length: 300 }, (_, i) => `term${i}`);
    expect(mergeVocabulary([many])).toHaveLength(KEYTERM_CAP);
  });
});
