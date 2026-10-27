import { describe, it, expect } from "vitest";
import { exportTranscript, exportBillingCsv, exportAllBillingCsv, neutralizeCsvField } from "./export";
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

  it("emits unassigned/unresolvable entries as rows so the TOTAL stays honest", () => {
    const unassigned: MatterEntry = {
      id: "e-un", clientId: "", date: new Date("2026-05-12").getTime(),
      durationSeconds: 1200, wordCount: 250, billableAmount: 150, rateAtTime: 450,
      ...entryDefaults,
    };
    const orphaned: MatterEntry = {
      id: "e-orph", clientId: "deleted-client", date: new Date("2026-05-13").getTime(),
      durationSeconds: 600, wordCount: 120, billableAmount: 50,
      matterLabel: "Old matter", ...entryDefaults,
    };
    const { content } = exportAllBillingCsv([mockClient], [...mockEntries, unassigned, orphaned]);
    const rows = content.split("\r\n");
    // header + 2 client rows + 2 unassigned rows + TOTAL
    expect(rows).toHaveLength(6);
    expect(content).toContain('"Unassigned"');
    expect(content).toContain('"Old matter"');
    expect(content).toContain("150.00");
    // TOTAL includes every entry: 400 + 200 + 150 + 50
    expect(rows[rows.length - 1]).toContain("TOTAL");
    expect(rows[rows.length - 1]).toContain("800.00");
  });
});

describe("CSV formula injection", () => {
  it.each(["=CMD()", "+SUM(A1)", "-2+3", "@evil", "\tX", "\rX"])(
    "neutralizeCsvField prefixes %j with a quote",
    (payload) => {
      expect(neutralizeCsvField(payload)).toBe("'" + payload);
    }
  );

  it("leaves benign values untouched", () => {
    expect(neutralizeCsvField("Contract draft")).toBe("Contract draft");
    expect(neutralizeCsvField("")).toBe("");
    expect(neutralizeCsvField("400.00")).toBe("400.00");
  });

  it("exportBillingCsv neutralizes hostile notes", () => {
    const e: MatterEntry = {
      id: "e4", clientId: "c1", date: Date.now(), durationSeconds: 600,
      wordCount: 100, billableAmount: 66.67,
      note: '=HYPERLINK("http://evil","click")', ...entryDefaults,
    };
    const { content } = exportBillingCsv(mockClient, [e]);
    expect(content).toContain("'=HYPERLINK");
    expect(content).not.toContain('"=HYPERLINK');
  });

  it("exportAllBillingCsv neutralizes hostile client names, matters and notes", () => {
    const hostileClient: Client = {
      ...mockClient, id: "c9", name: "=cmd|' /C calc'!A0", matterNumber: "+M-666",
    };
    const e: MatterEntry = {
      id: "e5", clientId: "c9", date: Date.now(), durationSeconds: 600,
      wordCount: 100, billableAmount: 50, note: "@import", ...entryDefaults,
    };
    const { content } = exportAllBillingCsv([hostileClient], [e]);
    expect(content).toContain("\"'=cmd");
    expect(content).toContain("\"'+M-666\"");
    expect(content).toContain("\"'@import\"");
  });
});
