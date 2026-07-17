import { describe, expect, it } from "vitest";
import { mergeVocabulary, parseVocabularyFile } from "./vocabImport";

describe("parseVocabularyFile", () => {
  it("parses a plain one-term-per-line list", () => {
    expect(parseVocabularyFile("Estoppel\nNetSuite\nAlecrae")).toEqual([
      "Estoppel",
      "NetSuite",
      "Alecrae",
    ]);
  });

  it("uses the written part of written\\spoken entries", () => {
    expect(parseVocabularyFile("Voxlen\\vox-len\nHigh Court\\high court")).toEqual([
      "Voxlen",
      "High Court",
    ]);
  });

  it("deduplicates case-insensitively while preserving first-seen casing", () => {
    expect(parseVocabularyFile("NetSuite\nnetsuite\nNETSUITE")).toEqual(["NetSuite"]);
  });

  it("skips comments and blanks and handles a leading BOM and whitespace", () => {
    expect(parseVocabularyFile("\uFEFF  EBITDA  \n\n# heading\n ; note\n  GAAP  ")).toEqual([
      "EBITDA",
      "GAAP",
    ]);
  });

  it("skips lines over 200 characters and caps accepted terms at 100", () => {
    expect(parseVocabularyFile(`${"x".repeat(201)}\n${"y".repeat(150)}`)).toEqual([
      "y".repeat(100),
    ]);
  });

  it("returns an empty list for an empty file", () => {
    expect(parseVocabularyFile("")).toEqual([]);
  });
});

describe("mergeVocabulary", () => {
  it("deduplicates against existing terms and preserves ordering", () => {
    expect(mergeVocabulary(["Estoppel", "GAAP"], ["estoppel", "NetSuite", "gaap", "EBITDA"])).toEqual({
      merged: ["Estoppel", "GAAP", "NetSuite", "EBITDA"],
      added: 2,
      addedTerms: ["NetSuite", "EBITDA"],
    });
  });

  it("keeps existing terms unchanged in order and appends new terms at the tail", () => {
    const existing = ["Zeta", "alpha", "Mid"];
    const { merged, addedTerms } = mergeVocabulary(existing, ["beta", "ALPHA", "Aardvark"]);
    expect(merged.slice(0, existing.length)).toEqual(existing);
    expect(merged.slice(existing.length)).toEqual(addedTerms);
    expect(addedTerms).toEqual(["beta", "Aardvark"]);
  });

  it("returns no added terms when everything already exists", () => {
    expect(mergeVocabulary(["NetSuite"], ["netsuite", "NETSUITE"])).toEqual({
      merged: ["NetSuite"],
      added: 0,
      addedTerms: [],
    });
  });
});
