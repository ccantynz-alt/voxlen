import type { TranscriptionSegment } from "@/stores/dictation";

export type ExportFormat = "txt" | "md" | "json" | "srt" | "docx";

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

function formatSrtTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s},000`;
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
