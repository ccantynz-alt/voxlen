import { create } from "zustand";
import { FREE_WEEKLY_WORD_CAP } from "./entitlement";

/**
 * Weekly word-count meter for Free tier enforcement.
 *
 * Storage is local-only: tauri-plugin-store when available, localStorage as a
 * fallback for non-Tauri dev. Aligned with the privacy stance in CLAUDE.md —
 * usage counters never leave the device.
 *
 * The "week" rolls over every Monday 00:00 in the user's local timezone. That's
 * slightly messier than UTC but matches how humans think about "this week".
 */

const STORE_FILE = "usage.json";
const LOCAL_KEY = "voxlen_usage";
const DATA_KEY = "usage";
const ONE_DAY_MS = 86_400_000;

export interface WeeklyUsage {
  /** Timestamp (ms since epoch) of this week's start — Monday 00:00 local. */
  weekStartMs: number;
  /** Total words transcribed during the current week. */
  wordsUsed: number;
}

export interface UsageState extends WeeklyUsage {
  isLoaded: boolean;

  /** Hydrate from persistent storage. Call on app start. */
  load: () => Promise<void>;
  /** Record N words against the weekly meter. Rolls the week over if stale. */
  recordWords: (count: number) => void;
  /** Zero the meter and start a new week at the current moment. */
  reset: () => void;
  /** Remaining words under the cap (never negative). */
  remaining: (cap?: number) => number;
  /** True if the user has used at least `cap` words this week. */
  isOverCap: (cap?: number) => boolean;
}

/** Returns the epoch ms for the most recent Monday 00:00 local-time. */
function startOfWeek(now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // getDay: 0=Sun, 1=Mon, ..., 6=Sat. Treat Monday as start.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

function freshWeek(): WeeklyUsage {
  return { weekStartMs: startOfWeek(), wordsUsed: 0 };
}

function rollIfStale(u: WeeklyUsage): WeeklyUsage {
  const current = startOfWeek();
  return u.weekStartMs === current ? u : { weekStartMs: current, wordsUsed: 0 };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistUsage(), 500);
}

export const useUsageStore = create<UsageState>((set, get) => ({
  ...freshWeek(),
  isLoaded: false,

  load: async () => {
    const loaded = await loadUsage();
    set({ ...rollIfStale(loaded), isLoaded: true });
  },

  recordWords: (count) => {
    if (!Number.isFinite(count) || count <= 0) return;
    set((state) => {
      const rolled = rollIfStale(state);
      return { ...rolled, wordsUsed: rolled.wordsUsed + Math.floor(count) };
    });
    schedulePersist();
  },

  reset: () => {
    set({ ...freshWeek() });
    schedulePersist();
  },

  remaining: (cap = FREE_WEEKLY_WORD_CAP) => {
    const { wordsUsed } = rollIfStale(get());
    return Math.max(0, cap - wordsUsed);
  },

  isOverCap: (cap = FREE_WEEKLY_WORD_CAP) => {
    const { wordsUsed } = rollIfStale(get());
    return wordsUsed >= cap;
  },
}));

async function loadUsage(): Promise<WeeklyUsage> {
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE);
    const v = (await store.get(DATA_KEY)) as WeeklyUsage | null;
    if (v && typeof v.weekStartMs === "number" && typeof v.wordsUsed === "number") {
      return v;
    }
  } catch {
    // Fall through to localStorage.
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WeeklyUsage;
      if (typeof parsed?.weekStartMs === "number" && typeof parsed?.wordsUsed === "number") {
        return parsed;
      }
    }
  } catch {
    // Ignore.
  }
  return freshWeek();
}

async function persistUsage(): Promise<void> {
  const { weekStartMs, wordsUsed } = useUsageStore.getState();
  const data: WeeklyUsage = { weekStartMs, wordsUsed };
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE);
    await store.set(DATA_KEY, data);
    await store.save();
    return;
  } catch {
    // Fall through.
  }
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal.
  }
}

/** End-of-week in ms (Monday 00:00 + 7 days). */
export function endOfWeekMs(weekStartMs: number): number {
  return weekStartMs + 7 * ONE_DAY_MS;
}
