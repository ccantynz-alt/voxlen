import type { BackendSessionRecord } from "@/stores/dictation";

export const REVIEW_SCHEMA_VERSION = 1;
export type ReviewState = "pending_review" | "in_review" | "finalized";

export interface ReviewPacket {
  schemaVersion: number;
  packetId: string;
  createdAt: string;
  sender: string;
  client: { name: string; matterNumber?: string };
  session: BackendSessionRecord;
  docFilename: string;
}

export interface ReviewStatus {
  schemaVersion: number;
  status: ReviewState;
  updatedAt: string;
  updatedBy: string;
  note?: string;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { kind: "malformed" | "newer-version"; message: string } };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function parseJson(text: string): ParseResult<Record<string, unknown>> {
  try {
    const value: unknown = JSON.parse(text);
    return object(value)
      ? { ok: true, value }
      : { ok: false, error: { kind: "malformed", message: "Expected a JSON object" } };
  } catch {
    return { ok: false, error: { kind: "malformed", message: "Invalid JSON" } };
  }
}

function schema(value: Record<string, unknown>): ParseResult<Record<string, unknown>> {
  if (!number(value.schemaVersion)) {
    return { ok: false, error: { kind: "malformed", message: "Missing schemaVersion" } };
  }
  if (value.schemaVersion > REVIEW_SCHEMA_VERSION) {
    return { ok: false, error: { kind: "newer-version", message: "Created by a newer Voxlen version" } };
  }
  if (value.schemaVersion !== REVIEW_SCHEMA_VERSION) {
    return { ok: false, error: { kind: "malformed", message: "Unsupported schemaVersion" } };
  }
  return { ok: true, value };
}

export function buildPacket(
  record: BackendSessionRecord,
  clientName: string,
  matterNumber: string | undefined,
  sender: string,
): ReviewPacket {
  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    packetId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sender: sender.trim() || "Voxlen user",
    client: { name: clientName.trim() || "Unfiled", ...(matterNumber?.trim() ? { matterNumber: matterNumber.trim() } : {}) },
    session: record,
    docFilename: "document.docx",
  };
}

export function packetDirName(packet: ReviewPacket): string {
  const date = packet.createdAt.slice(0, 10);
  const slug = packet.client.name.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "unfiled";
  return `${date}-${slug}-${packet.packetId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toLowerCase()}`;
}

export function parsePacket(text: string): ParseResult<ReviewPacket> {
  const json = parseJson(text); if (!json.ok) return json;
  const versioned = schema(json.value); if (!versioned.ok) return versioned;
  const v = versioned.value;
  if (!string(v.packetId) || !string(v.createdAt) || !string(v.sender) || !object(v.client)
    || !string(v.client.name) || !object(v.session) || !string(v.docFilename)
    || !string(v.session.id) || !number(v.session.started_at_ms) || !number(v.session.ended_at_ms)
    || !number(v.session.duration_ms) || !number(v.session.word_count) || !Array.isArray(v.session.segments)
    || !v.session.segments.every((s) => object(s) && string(s.id) && string(s.text)
      && (s.corrected_text === null || string(s.corrected_text)) && number(s.timestamp_ms))) {
    return { ok: false, error: { kind: "malformed", message: "Invalid review packet fields" } };
  }
  if (v.client.matterNumber !== undefined && !string(v.client.matterNumber)) {
    return { ok: false, error: { kind: "malformed", message: "Invalid matter number" } };
  }
  return { ok: true, value: v as unknown as ReviewPacket };
}

export function parseStatus(text: string): ParseResult<ReviewStatus> {
  const json = parseJson(text); if (!json.ok) return json;
  const versioned = schema(json.value); if (!versioned.ok) return versioned;
  const v = versioned.value;
  if (!string(v.status) || !["pending_review", "in_review", "finalized"].includes(v.status)
    || !string(v.updatedAt) || !string(v.updatedBy) || (v.note !== undefined && !string(v.note))) {
    return { ok: false, error: { kind: "malformed", message: "Invalid review status fields" } };
  }
  return { ok: true, value: v as unknown as ReviewStatus };
}

export function canTransition(from: ReviewState, to: ReviewState): boolean {
  return (from === "pending_review" && to === "in_review")
    || (from === "in_review" && to === "finalized");
}
