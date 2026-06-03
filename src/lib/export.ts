import type { TranscriptionSegment } from "@/stores/dictation";
import type { Client, MatterEntry } from "@/stores/clients";

export type ExportFormat = "txt" | "md" | "json" | "srt" | "rtf";

export function exportTranscript(
  segments: TranscriptionSegment[],
  format: ExportFormat = "txt"
): { content: string; filename: string; mimeType: string } {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  switch (format) {
    case "txt":
      return {
        content: formatAsText(segments),
        filename: `voxlen-transcript-${timestamp}.txt`,
        mimeType: "text/plain",
      };
    case "md":
      return {
        content: formatAsMarkdown(segments),
        filename: `voxlen-transcript-${timestamp}.md`,
        mimeType: "text/markdown",
      };
    case "json":
      return {
        content: formatAsJson(segments),
        filename: `voxlen-transcript-${timestamp}.json`,
        mimeType: "application/json",
      };
    case "srt":
      return {
        content: formatAsSrt(segments),
        filename: `voxlen-transcript-${timestamp}.srt`,
        mimeType: "text/srt",
      };
    case "rtf":
      return {
        content: formatAsRtf(segments),
        filename: `voxlen-transcript-${timestamp}.rtf`,
        mimeType: "application/rtf",
      };
    default:
      return {
        content: formatAsText(segments),
        filename: `voxlen-transcript-${timestamp}.txt`,
        mimeType: "text/plain",
      };
  }
}

function formatAsText(segments: TranscriptionSegment[]): string {
  return segments.map((s) => s.correctedText || s.text).join(" ");
}

function formatAsMarkdown(segments: TranscriptionSegment[]): string {
  const lines = [
    "# Voxlen Transcript",
    "",
    `**Date:** ${new Date().toLocaleDateString()}`,
    `**Words:** ${segments.reduce((c, s) => c + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length, 0)}`,
    `**Segments:** ${segments.length}`,
    "",
    "---",
    "",
  ];

  segments.forEach((s) => {
    const time = s.timestamp.toLocaleTimeString();
    const text = s.correctedText || s.text;
    const grammarTag = s.grammarApplied ? " *(AI polished)*" : "";
    lines.push(`**[${time}]** ${text}${grammarTag}`);
    if (s.translatedText) {
      const lang = s.translatedToLanguage ? ` (${s.translatedToLanguage})` : "";
      lines.push(`> ${s.translatedText}${lang}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

function formatAsJson(segments: TranscriptionSegment[]): string {
  return JSON.stringify(
    {
      version: "1.0",
      app: "Voxlen",
      exported: new Date().toISOString(),
      segments: segments.map((s) => ({
        id: s.id,
        text: s.text,
        correctedText: s.correctedText || null,
        translatedText: s.translatedText || null,
        translatedToLanguage: s.translatedToLanguage || null,
        timestamp: s.timestamp.toISOString(),
        confidence: s.confidence,
        language: s.language || null,
        grammarApplied: s.grammarApplied,
      })),
    },
    null,
    2
  );
}

function formatAsSrt(segments: TranscriptionSegment[]): string {
  return segments
    .map((s, i) => {
      const start = formatSrtTime(s.timestamp);
      const endTime = new Date(s.timestamp.getTime() + 3000);
      const end = formatSrtTime(endTime);
      return `${i + 1}\n${start} --> ${end}\n${s.correctedText || s.text}\n`;
    })
    .join("\n");
}

function rtfEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0)}?`);
}

function formatAsRtf(segments: TranscriptionSegment[]): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const wordCount = segments.reduce((c, s) => c + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length, 0);

  const header = [
    `{\\rtf1\\ansi\\ansicpg1252\\deff0`,
    `{\\fonttbl{\\f0\\froman\\fprq2\\fcharset0 Times New Roman;}{\\f1\\fswiss\\fprq2\\fcharset0 Arial;}}`,
    `{\\colortbl;\\red0\\green0\\blue0;\\red100\\green100\\blue100;}`,
    `\\widowctrl\\wpaper15840\\wpaperh12240\\margl1800\\margr1800\\margt1440\\margb1440`,
    `\\f0\\fs24\\cf1`,
    `{\\f1\\fs28\\b Voxlen Transcript\\b0}\\par`,
    `{\\f1\\fs20\\cf2 ${rtfEscape(date)} \\emdash  ${wordCount} words}\\par\\par`,
    `\\pard\\sl360\\slmult1`,
  ].join("\n");

  const body = segments.map((s) => {
    const text = rtfEscape(s.correctedText || s.text);
    const time = s.timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const parts: string[] = [];
    if (s.speakerLabel) {
      parts.push(`{\\f1\\fs18\\b ${rtfEscape(s.speakerLabel)}\\b0  }`);
    }
    parts.push(`{\\f1\\fs18\\cf2 [${time}]  \\cf1}${text}`);
    if (s.translatedText) {
      parts.push(`\\par{\\f1\\fs18\\i ${rtfEscape(s.translatedText)}\\i0}`);
    }
    return parts.join("") + "\\par\\par";
  }).join("\n");

  return `${header}\n${body}\n}`;
}

function formatSrtTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s},000`;
}

export function exportBillingCsv(
  client: Client,
  entries: MatterEntry[]
): { content: string; filename: string; mimeType: string } {
  const rows: string[] = [
    ["Date", "Duration (min)", "Words", "Rate ($/hr)", "Amount ($)", "Note"].join(","),
  ];
  for (const e of entries) {
    const date = new Date(e.date).toLocaleDateString("en-GB");
    const mins = (e.durationSeconds / 60).toFixed(1);
    const rate = client.billableRate.toFixed(2);
    const amount = e.billableAmount.toFixed(2);
    const note = `"${(e.note ?? "").replace(/"/g, '""')}"`;
    rows.push([date, mins, e.wordCount, rate, amount, note].join(","));
  }
  const totalAmount = entries.reduce((s, e) => s + e.billableAmount, 0);
  const totalMins = entries.reduce((s, e) => s + e.durationSeconds / 60, 0);
  rows.push(["TOTAL", totalMins.toFixed(1), "", "", totalAmount.toFixed(2), ""].join(","));

  const slug = client.name.toLowerCase().replace(/\s+/g, "-");
  const timestamp = new Date().toISOString().slice(0, 10);
  return {
    content: rows.join("\r\n"),
    filename: `voxlen-billing-${slug}-${timestamp}.csv`,
    mimeType: "text/csv",
  };
}

export function exportAllBillingCsv(
  clients: Client[],
  entries: MatterEntry[]
): { content: string; filename: string; mimeType: string } {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const rows: string[] = [
    ["Client", "Matter #", "Date", "Duration (min)", "Words", "Rate ($/hr)", "Amount ($)", "Note"].join(","),
  ];
  for (const e of entries) {
    const c = clientMap.get(e.clientId);
    if (!c) continue;
    const date = new Date(e.date).toLocaleDateString("en-GB");
    const mins = (e.durationSeconds / 60).toFixed(1);
    const rate = c.billableRate.toFixed(2);
    const amount = e.billableAmount.toFixed(2);
    const note = `"${(e.note ?? "").replace(/"/g, '""')}"`;
    const matter = `"${(c.matterNumber ?? "").replace(/"/g, '""')}"`;
    rows.push([`"${c.name}"`, matter, date, mins, e.wordCount, rate, amount, note].join(","));
  }
  const total = entries.reduce((s, e) => s + e.billableAmount, 0);
  rows.push(["TOTAL", "", "", "", "", "", total.toFixed(2), ""].join(","));

  const timestamp = new Date().toISOString().slice(0, 10);
  return {
    content: rows.join("\r\n"),
    filename: `voxlen-billing-all-${timestamp}.csv`,
    mimeType: "text/csv",
  };
}

export async function downloadExport(
  segments: TranscriptionSegment[],
  format: ExportFormat
) {
  const { content, filename, mimeType } = exportTranscript(segments, format);

  // Try Tauri file dialog first
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (path) {
      await writeTextFile(path, content);
      return;
    }
  } catch {
    // Fallback to browser download
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadBillingExport(
  content: string,
  filename: string,
  mimeType: string
) {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (path) {
      await writeTextFile(path, content);
      return;
    }
  } catch {
    // Fallback to browser download
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
