import { describe, it, expect } from "vitest";
import { exportTranscript } from "./export";
import type { TranscriptionSegment } from "@/stores/dictation";

function seg(
  text: string,
  correctedText?: string,
  ts = new Date("2026-04-20T10:00:00Z"),
  grammarApplied = false,
  translatedText?: string,
  translatedToLanguage?: string
): TranscriptionSegment {
  return {
    id: "id-" + text,
    text,
    correctedText,
    translatedText,
    translatedToLanguage,
    timestamp: ts,
    confidence: 0.92,
    isFinal: true,
    grammarApplied,
  };
}

describe("exportTranscript", () => {
  it("txt: joins segments, preferring corrected text when present", () => {
    const out = exportTranscript(
      [seg("hello", "hello."), seg("world")],
      "txt"
    );
    expect(out.content).toBe("hello. world");
    expect(out.filename).toMatch(/^voxlen-transcript-.*\.txt$/);
    expect(out.mimeType).toBe("text/plain");
  });

  it("md: emits heading, metadata, per-segment lines with grammar tag", () => {
    const out = exportTranscript(
      [seg("first"), seg("second", "second clean", undefined, true)],
      "md"
    );
    expect(out.content).toContain("# Voxlen Transcript");
    expect(out.content).toContain("**Segments:** 2");
    expect(out.content).toContain("*(AI polished)*");
    expect(out.mimeType).toBe("text/markdown");
  });

  it("json: is valid JSON with the expected shape", () => {
    const out = exportTranscript([seg("hi", "hi!")], "json");
    const parsed = JSON.parse(out.content);
    expect(parsed.app).toBe("Voxlen");
    expect(parsed.segments).toHaveLength(1);
    expect(parsed.segments[0].text).toBe("hi");
    expect(parsed.segments[0].correctedText).toBe("hi!");
    expect(out.mimeType).toBe("application/json");
  });

  it("srt: numbers segments and formats timestamps", () => {
    const out = exportTranscript([seg("one"), seg("two")], "srt");
    expect(out.content).toMatch(/^1\n\d\d:\d\d:\d\d,000 --> \d\d:\d\d:\d\d,000\none/);
    expect(out.content).toContain("2\n");
    expect(out.mimeType).toBe("text/srt");
  });

  it("unknown format falls back to txt", () => {
    // @ts-expect-error - intentionally wrong
    const out = exportTranscript([seg("ok")], "docx");
    expect(out.filename).toMatch(/\.txt$/);
  });

  it("md: renders translations as blockquote under the segment", () => {
    const out = exportTranscript(
      [seg("hello", undefined, undefined, false, "hola", "es")],
      "md"
    );
    expect(out.content).toContain("hello");
    expect(out.content).toContain("> hola (es)");
  });

  it("json: exposes translatedText + translatedToLanguage", () => {
    const out = exportTranscript(
      [seg("hi", undefined, undefined, false, "bonjour", "fr")],
      "json"
    );
    const parsed = JSON.parse(out.content);
    expect(parsed.segments[0].translatedText).toBe("bonjour");
    expect(parsed.segments[0].translatedToLanguage).toBe("fr");
  });
});
