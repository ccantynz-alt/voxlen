import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { invoke } from "@tauri-apps/api/core";
import { useClientsStore } from "@/stores/clients";
import { useSettingsStore } from "@/stores/settings";
import type { BackendSessionRecord, BackendSessionSegment } from "@/stores/dictation";

export interface BuildSessionDocxOptions {
  segments: BackendSessionSegment[];
  clientName?: string | null;
  matterLabel?: string | null;
  startedAtMs: number;
  durationMs: number;
  wordCount: number;
  title: string;
}

export async function buildSessionDocx(opts: BuildSessionDocxOptions): Promise<Uint8Array> {
  const heading = [opts.clientName, opts.matterLabel].filter(Boolean).join(" — ") || opts.title;
  const date = new Date(opts.startedAtMs).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const totalSeconds = Math.max(0, Math.round(opts.durationMs / 1000));
  const duration = totalSeconds >= 60
    ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
    : `${totalSeconds}s`;
  const children = [
    new Paragraph({ text: heading, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [new TextRun({ text: `${date} — ${duration} — ${opts.wordCount} words`, color: "666666" })],
      spacing: { after: 300 },
    }),
    ...opts.segments.map((segment) => {
      const time = new Date(segment.timestamp_ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const speaker = segment.speaker === "you" ? "You: " : segment.speaker === "remote" ? "Remote: " : "";
      return new Paragraph({
        children: [
          ...(speaker ? [new TextRun({ text: speaker, bold: true })] : []),
          new TextRun({ text: `[${time}]  `, color: "666666" }),
          new TextRun(segment.corrected_text || segment.text),
        ],
        spacing: { after: 240, line: 360 },
      });
    }),
  ];
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

export interface FilenameContext {
  date: string;
  time: string;
  client: string;
  matter: string;
  kind: string;
}

export function renderFilename(pattern: string, ctx: FilenameContext): string {
  const template = pattern.trim() || "{date} {kind}";
  return template.replace(/\{(date|time|client|matter|kind)\}/g, (_, token: keyof FilenameContext) => ctx[token]);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function autoDocFailureMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!detail || /unavailable|does not exist/i.test(detail)) {
    return "Document not saved - folder unavailable; retry from History";
  }
  return `Document not saved - ${detail.slice(0, 120)}; retry from History`;
}

export async function autoSaveSessionDocument(record: BackendSessionRecord): Promise<string> {
  const settings = useSettingsStore.getState();
  if (!settings.autoDocRootPath) throw new Error("Document folder unavailable");

  const clients = useClientsStore.getState().clients;
  const client = clients.find((candidate) => candidate.id === record.client_id);
  const clientName = client?.name || record.client_name || undefined;
  const matterLabel = client?.matterNumber?.trim() || record.matter_label?.trim() || undefined;
  const kind = record.kind ?? "dictation";
  const started = new Date(record.started_at_ms);
  // Local components for both tokens — mixing UTC dates with local times
  // misfiles sessions near midnight relative to the UTC offset.
  const date = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, "0")}-${String(started.getDate()).padStart(2, "0")}`;
  const time = `${String(started.getHours()).padStart(2, "0")}-${String(started.getMinutes()).padStart(2, "0")}`;
  const filename = renderFilename(settings.autoDocFilenamePattern, {
    date, time, client: clientName ?? "Unfiled", matter: matterLabel ?? "", kind,
  });
  const bytes = await buildSessionDocx({
    segments: record.segments, clientName, matterLabel,
    startedAtMs: record.started_at_ms, durationMs: record.duration_ms,
    wordCount: record.word_count, title: kind === "meeting" ? "Voxlen Meeting" : "Voxlen Transcript",
  });
  const subdirs = clientName ? [clientName, ...(matterLabel ? [matterLabel] : [])] : ["Unfiled"];
  return invoke<string>("save_document", {
    root: settings.autoDocRootPath,
    subdirs,
    filename: `${filename}.docx`,
    contentsB64: uint8ToBase64(bytes),
  });
}
