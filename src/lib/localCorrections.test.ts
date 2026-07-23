import { describe, it, expect } from "vitest";
import { applyLearnedCorrections } from "./localCorrections";
import type { CorrectionPattern } from "@/stores/flywheel";

function pattern(overrides: Partial<CorrectionPattern>): CorrectionPattern {
  return {
    original: "should of",
    corrected: "should have",
    category: "grammar",
    occurrences: 5,
    lastSeen: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("applyLearnedCorrections", () => {
  it("applies a learned pattern with word boundaries", () => {
    const r = applyLearnedCorrections("We should of filed earlier", [pattern({})]);
    expect(r.text).toBe("We should have filed earlier");
    expect(r.applied).toBe(1);
  });

  it("word-boundary safety: 'form'→'from' must not hit 'format'", () => {
    const r = applyLearnedCorrections(
      "format the form correctly",
      [pattern({ original: "form", corrected: "from", category: "spelling" })]
    );
    expect(r.text).toBe("format the from correctly");
  });

  it("skips patterns below the occurrence threshold", () => {
    const r = applyLearnedCorrections("should of", [pattern({ occurrences: 2 })]);
    expect(r.text).toBe("should of");
    expect(r.applied).toBe(0);
  });

  it("skips punctuation and style categories", () => {
    const r = applyLearnedCorrections("should of", [
      pattern({ category: "punctuation" }),
      pattern({ category: "style" }),
    ]);
    expect(r.applied).toBe(0);
  });

  it("preserves leading capitalization of the matched text", () => {
    const r = applyLearnedCorrections(
      "Statue of limitations applies",
      [pattern({ original: "statue of limitations", corrected: "statute of limitations", category: "spelling" })]
    );
    expect(r.text).toBe("Statute of limitations applies");
  });

  it("applies longest patterns first", () => {
    const r = applyLearnedCorrections("should of been", [
      pattern({ original: "should of been", corrected: "should have been" }),
      pattern({ original: "should of", corrected: "should have" }),
    ]);
    expect(r.text).toBe("should have been");
  });

  it("ignores case-only differences (avoids loops with casing rules)", () => {
    const r = applyLearnedCorrections("acme", [
      pattern({ original: "acme", corrected: "Acme", category: "spelling" }),
    ]);
    expect(r.applied).toBe(0);
  });
});
