/**
 * One-time migration of legacy flywheel time entries into the clients
 * billing store. The flywheel used to keep its own `timeEntries[]`
 * (voice-command "log 30 minutes" wrote to BOTH stores); the clients
 * store's MatterEntry is the surviving model.
 *
 * Reads the raw persisted flywheel data (plugin-store / localStorage) —
 * the flywheel store itself no longer knows about time entries.
 */

import { useClientsStore } from "@/stores/clients";

interface LegacyTimeEntry {
  id: string;
  matter: string;
  minutes: number;
  ratePerHour: number;
  amount: number;
  notes: string;
  createdAt: string; // ISO
}

const MIGRATED_FLAG = "timeEntriesMigrated";

/** Returns the number of entries migrated (0 if already done / nothing to do). */
export async function migrateLegacyTimeEntries(): Promise<number> {
  let legacy: LegacyTimeEntry[] = [];
  let markDone: () => Promise<void>;

  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("flywheel.json");
    if (await store.get<boolean>(MIGRATED_FLAG)) return 0;
    const raw = await store.get<LegacyTimeEntry[]>("timeEntries");
    legacy = Array.isArray(raw) ? raw : [];
    markDone = async () => {
      await store.set(MIGRATED_FLAG, true);
      await store.delete("timeEntries");
      await store.save();
    };
  } catch {
    // Browser / dev fallback.
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(localStorage.getItem("voxlen_flywheel") ?? "{}");
    } catch {
      return 0;
    }
    if (parsed[MIGRATED_FLAG]) return 0;
    legacy = Array.isArray(parsed.timeEntries)
      ? (parsed.timeEntries as LegacyTimeEntry[])
      : [];
    markDone = async () => {
      delete parsed.timeEntries;
      parsed[MIGRATED_FLAG] = true;
      localStorage.setItem("voxlen_flywheel", JSON.stringify(parsed));
    };
  }

  let migrated = 0;
  if (legacy.length > 0) {
    const { clients, addEntry } = useClientsStore.getState();
    for (const entry of legacy) {
      const matterName = (entry.matter ?? "").trim().toLowerCase();
      const match = matterName
        ? clients.find((c) => c.name.trim().toLowerCase() === matterName)
        : undefined;
      const id = addEntry({
        clientId: match?.id ?? "",
        date: Date.parse(entry.createdAt) || Date.now(),
        durationSeconds: Math.max(0, Math.round((entry.minutes || 0) * 60)),
        wordCount: 0,
        billableAmount: entry.amount || 0,
        rateAtTime: entry.ratePerHour || 0,
        note: entry.notes || undefined,
        status: "approved",
        source: "migrated",
        matterLabel: !match && entry.matter ? entry.matter : undefined,
      });
      if (id) migrated++;
    }
  }

  // Flag only after the clients store has the entries (its persist middleware
  // writes synchronously on set) — a crash in between re-runs the migration
  // rather than losing entries.
  await markDone();
  return migrated;
}
