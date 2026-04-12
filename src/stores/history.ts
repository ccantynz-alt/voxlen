import { create } from "zustand";

export interface HistoryEntry {
  id: string;
  text: string;
  duration: number;
  wordCount: number;
  language: string;
  timestamp: string;
  grammarCorrected: boolean;
}

interface HistoryState {
  entries: HistoryEntry[];
  isLoaded: boolean;
  addEntry: (entry: HistoryEntry) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  loadFromStore: () => Promise<void>;
  saveToStore: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  isLoaded: false,

  addEntry: (entry) => {
    set((state) => ({
      entries: [entry, ...state.entries].slice(0, 100),
    }));
    get().saveToStore();
  },

  removeEntry: (id) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }));
    get().saveToStore();
  },

  clearAll: () => {
    set({ entries: [] });
    get().saveToStore();
  },

  loadFromStore: async () => {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json");
      const saved = await store.get<HistoryEntry[]>("history_entries");
      if (saved && Array.isArray(saved)) {
        set({ entries: saved, isLoaded: true });
        return;
      }
    } catch {
      // Try localStorage
      try {
        const saved = localStorage.getItem("voxlen_history");
        if (saved) {
          const entries = JSON.parse(saved);
          if (Array.isArray(entries)) {
            set({ entries, isLoaded: true });
            return;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    set({ isLoaded: true });
  },

  saveToStore: async () => {
    const { entries } = get();
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json");
      await store.set("history_entries", entries);
      await store.save();
    } catch {
      try {
        localStorage.setItem("voxlen_history", JSON.stringify(entries));
      } catch {
        // Storage full or unavailable
      }
    }
  },
}));
