import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { parsePacket, parseStatus, type ReviewPacket, type ReviewStatus } from "@/lib/reviewPacket";
import { useSettingsStore } from "./settings";

interface RawEntry { dir: string; packetJson: string; statusJson: string }
interface ListResult { packets: RawEntry[]; skippedCount: number }
export interface ReviewSummary {
  dir: string; packet?: ReviewPacket; status?: ReviewStatus; newerVersion: boolean;
  fallback: { client: string; createdAt: string; sender: string; status: string; updatedBy: string };
}
interface ReviewStore {
  packets: ReviewSummary[]; unreadableCount: number; loading: boolean; error: string | null;
  refresh: () => Promise<void>; pendingCount: () => number;
}
const rawObject = (text: string) => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } };

export const useReviewStore = create<ReviewStore>((set, get) => ({
  packets: [], unreadableCount: 0, loading: false, error: null,
  refresh: async () => {
    const root = useSettingsStore.getState().reviewSharedFolderPath;
    if (!root) { set({ packets: [], unreadableCount: 0, loading: false, error: "Choose a review shared folder in Settings." }); return; }
    set({ loading: true, error: null });
    try {
      const result = await invoke<ListResult>("list_review_packets", { root });
      let unreadable = result.skippedCount;
      const packets: ReviewSummary[] = [];
      for (const entry of result.packets) {
        const packet = parsePacket(entry.packetJson); const status = parseStatus(entry.statusJson);
        const newerVersion = (!packet.ok && packet.error.kind === "newer-version") || (!status.ok && status.error.kind === "newer-version");
        if ((!packet.ok || !status.ok) && !newerVersion) { unreadable++; continue; }
        const p = rawObject(entry.packetJson); const s = rawObject(entry.statusJson);
        packets.push({ dir: entry.dir, packet: packet.ok ? packet.value : undefined, status: status.ok ? status.value : undefined, newerVersion,
          fallback: { client: p.client?.name || "Unknown client", createdAt: p.createdAt || "", sender: p.sender || "Unknown",
            status: s.status || "unknown", updatedBy: s.updatedBy || "Unknown" } });
      }
      set({ packets, unreadableCount: unreadable, loading: false });
    } catch (e) { set({ loading: false, error: e instanceof Error ? e.message : String(e) }); }
  },
  pendingCount: () => get().packets.filter((p) => p.status?.status === "pending_review").length,
}));
