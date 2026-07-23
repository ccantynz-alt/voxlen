import { describe, it, expect } from "vitest";
import { exportTranscript, exportBillingCsv, exportAllBillingCsv } from "./export";
import type { TranscriptionSegment } from "@/stores/dictation";
import type { Client, MatterEntry } from "@/stores/clients";

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

const mockClient: Client = {
  id: "c1", name: "Smith & Co", matterNumber: "M-001",
  billableRate: 400, color: "#7345d1", archived: false, createdAt: 1700000000000,
};

const entryDefaults = { status: "approved" as const, source: "manual" as const };

const mockEntries: MatterEntry[] = [
  { id: "e1", clientId: "c1", date: new Date("2026-05-01").getTime(), durationSeconds: 3600, wordCount: 800, billableAmount: 400, note: "Contract draft", ...entryDefaults },
  { id: "e2", clientId: "c1", date: new Date("2026-05-10").getTime(), durationSeconds: 1800, wordCount: 400, billableAmount: 200, ...entryDefaults },
];

describe("exportBillingCsv", () => {
  it("includes header row and one row per entry", () => {
    const { content, filename } = exportBillingCsv(mockClient, mockEntries);
    const rows = content.split("\r\n");
    expect(rows[0]).toContain("Date");
    expect(rows).toHaveLength(4); // header + 2 entries + TOTAL
    expect(rows[3]).toContain("TOTAL");
    expect(rows[3]).toContain("600.00");
    expect(filename).toContain("smith");
  });

  it("wraps notes with commas in quotes", () => {
    const e: MatterEntry = { id: "e3", clientId: "c1", date: Date.now(), durationSeconds: 600, wordCount: 100, billableAmount: 66.67, note: "Draft, review", ...entryDefaults };
    const { content } = exportBillingCsv(mockClient, [e]);
    expect(content).toContain('"Draft, review"');
  });
});

describe("exportAllBillingCsv", () => {
  it("includes client name and matter number columns", () => {
    const { content } = exportAllBillingCsv([mockClient], mockEntries);
    expect(content).toContain("Smith & Co");
    expect(content).toContain("M-001");
    expect(content).toContain("TOTAL");
  });
});
