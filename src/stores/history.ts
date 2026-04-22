import { create } from "zustand";

export interface HistoryEntry {
  id: string;
  text: string;
  duration: number;
  wordCount: number;
  language: string;
  timestamp: string; // ISO string for serialization
  grammarCorrected: boolean;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],

  addEntry: (entry) => {
    set((state) => ({
      entries: [entry, ...state.entries].slice(0, 200), // Keep last 200 sessions
    }));
    persistHistory(get().entries);
  },

  removeEntry: (id) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
    persistHistory(get().entries);
  },

  clearAll: () => {
    set({ entries: [] });
    persistHistory([]);
  },
}));

// Load history from storage on startup
export async function loadHistory(): Promise<void> {
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("history.json");
    const saved = await store.get<HistoryEntry[]>("sessions");
    if (saved && Array.isArray(saved)) {
      useHistoryStore.setState({ entries: saved });
    }
  } catch {
    try {
      const saved = localStorage.getItem("marcoreid_history");
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryEntry[];
        useHistoryStore.setState({ entries: parsed });
      }
    } catch {
      // No saved history
    }
  }
}

async function persistHistory(entries: HistoryEntry[]): Promise<void> {
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("history.json");
    await store.set("sessions", entries);
    await store.save();
  } catch {
    try {
      localStorage.setItem("marcoreid_history", JSON.stringify(entries));
    } catch {
      // Ignore
    }
  }
}
