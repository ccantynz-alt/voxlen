import { invoke } from "@tauri-apps/api/core";
import { buildSessionDocx, uint8ToBase64 } from "./autoDoc";
import { buildPacket, packetDirName, type ReviewStatus } from "./reviewPacket";
import type { BackendSessionRecord } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";

const textB64 = (value: unknown) => uint8ToBase64(new TextEncoder().encode(JSON.stringify(value, null, 2)));

export async function sendSessionForReview(record: BackendSessionRecord): Promise<string> {
  const { reviewSharedFolderPath, reviewDisplayName } = useSettingsStore.getState();
  if (!reviewSharedFolderPath) throw new Error("Review shared folder is not configured");
  const sender = reviewDisplayName.trim() || "Voxlen user";
  const packet = buildPacket(record, record.client_name || "Unfiled", record.matter_label || undefined, sender);
  const doc = await buildSessionDocx({
    segments: record.segments, clientName: packet.client.name, matterLabel: packet.client.matterNumber,
    startedAtMs: record.started_at_ms, durationMs: record.duration_ms, wordCount: record.word_count,
    title: record.kind === "meeting" ? "Voxlen Meeting" : "Voxlen Transcript",
  });
  const status: ReviewStatus = { schemaVersion: 1, status: "pending_review", updatedAt: packet.createdAt, updatedBy: sender };
  const dir = packetDirName(packet);
  await invoke("create_review_packet", { root: reviewSharedFolderPath, dir, files: [
    { name: "document.docx", contentsB64: uint8ToBase64(doc) },
    { name: "packet.json", contentsB64: textB64(packet) },
    { name: "status.json", contentsB64: textB64(status) },
  ] });
  return dir;
}
