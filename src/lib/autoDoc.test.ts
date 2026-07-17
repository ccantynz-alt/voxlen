import { describe, expect, it } from "vitest";
import { autoDocFailureMessage, buildSessionDocx, renderFilename, uint8ToBase64 } from "./autoDoc";

describe("renderFilename", () => {
  const ctx = { date: "2026-07-17", time: "09-05", client: "Acme", matter: "M-42", kind: "dictation" };

  it("replaces all supported tokens", () => {
    expect(renderFilename("{date} {time} {client} {matter} {kind}", ctx))
      .toBe("2026-07-17 09-05 Acme M-42 dictation");
  });

  it("uses the default for a blank pattern and leaves unknown tokens alone", () => {
    expect(renderFilename(" ", ctx)).toBe("2026-07-17 dictation");
    expect(renderFilename("{date} {unknown}", ctx)).toBe("2026-07-17 {unknown}");
  });
});

describe("uint8ToBase64", () => {
  it("roundtrips a large array through atob", () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    const decoded = Uint8Array.from(atob(uint8ToBase64(bytes)), (char) => char.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });
});

describe("autoDocFailureMessage", () => {
  it("keeps the folder-unavailable wording for missing-root errors", () => {
    expect(autoDocFailureMessage(new Error("Document root does not exist or is unavailable")))
      .toBe("Document not saved - folder unavailable; retry from History");
    expect(autoDocFailureMessage(undefined))
      .toBe("Document not saved - folder unavailable; retry from History");
  });

  it("surfaces other error details", () => {
    expect(autoDocFailureMessage("Invalid document contents: bad base64"))
      .toBe("Document not saved - Invalid document contents: bad base64; retry from History");
  });
});

describe("buildSessionDocx", () => {
  it("packs a non-empty Word document", async () => {
    const bytes = await buildSessionDocx({
      segments: [{
        id: "segment-1", text: "Original", corrected_text: "Corrected text",
        confidence: 0.99, language: "en", timestamp_ms: Date.now(),
        grammar_applied: true, speaker: "you",
      }],
      clientName: "Example Client", matterLabel: "M-1", startedAtMs: Date.now(),
      durationMs: 12_000, wordCount: 2, title: "Voxlen Transcript",
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
