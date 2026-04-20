import { create } from "zustand";

/**
 * Privacy-safe flywheel / learning system.
 *
 * ALL data stays on-device. Nothing is transmitted to any server.
 * Designed for professionals handling privileged information
 * (attorneys, accountants, etc.) — no content ever leaves the device.
 *
 * What it learns:
 * 1. Custom vocabulary — words the user frequently uses that get miscorrected
 * 2. Correction patterns — common grammar fixes to pre-apply locally
 * 3. Usage metrics — anonymous session stats for local UX optimization
 * 4. Writing style profile — adapts grammar prompts based on past corrections
 */

export interface VocabularyEntry {
  word: string;
  frequency: number;
  addedAt: string;
  source: "manual" | "auto-detected";
}

export interface CorrectionPattern {
  original: string;
  corrected: string;
  category: "grammar" | "spelling" | "punctuation" | "style";
  occurrences: number;
  lastSeen: string;
}

export interface UsageMetrics {
  totalSessions: number;
  totalWords: number;
  totalDuration: number;
  avgWordsPerMinute: number;
  avgSessionLength: number;
  correctionsApplied: number;
  correctionsRejected: number;
  mostUsedEngine: string;
  sessionsPerDay: Record<string, number>;
}

export interface FlywheelState {
  vocabulary: VocabularyEntry[];
  corrections: CorrectionPattern[];
  metrics: UsageMetrics;

  addVocabulary: (word: string, source?: "manual" | "auto-detected") => void;
  removeVocabulary: (word: string) => void;
  recordCorrection: (original: string, corrected: string, category: CorrectionPattern["category"]) => void;
  recordSession: (wordCount: number, durationSec: number, engine: string) => void;
  recordCorrectionFeedback: (accepted: boolean) => void;
  getTopCorrectionPatterns: (limit?: number) => CorrectionPattern[];
  getVocabularyList: () => string[];
  clearAll: () => void;
}

const defaultMetrics: UsageMetrics = {
  totalSessions: 0,
  totalWords: 0,
  totalDuration: 0,
  avgWordsPerMinute: 0,
  avgSessionLength: 0,
  correctionsApplied: 0,
  correctionsRejected: 0,
  mostUsedEngine: "",
  sessionsPerDay: {},
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persistFlywheel(), 1000);
}

export const useFlywheelStore = create<FlywheelState>((set, get) => ({
  vocabulary: [],
  corrections: [],
  metrics: { ...defaultMetrics },

  addVocabulary: (word, source = "auto-detected") => {
    set((state) => {
      const existing = state.vocabulary.find((v) => v.word.toLowerCase() === word.toLowerCase());
      if (existing) {
        return {
          vocabulary: state.vocabulary.map((v) =>
            v.word.toLowerCase() === word.toLowerCase()
              ? { ...v, frequency: v.frequency + 1 }
              : v
          ),
        };
      }
      return {
        vocabulary: [
          ...state.vocabulary,
          { word, frequency: 1, addedAt: new Date().toISOString(), source },
        ].slice(0, 1000),
      };
    });
    schedulePersist();
  },

  removeVocabulary: (word) => {
    set((state) => ({
      vocabulary: state.vocabulary.filter((v) => v.word.toLowerCase() !== word.toLowerCase()),
    }));
    schedulePersist();
  },

  recordCorrection: (original, corrected, category) => {
    set((state) => {
      const key = `${original.toLowerCase()}→${corrected.toLowerCase()}`;
      const existing = state.corrections.find(
        (c) => `${c.original.toLowerCase()}→${c.corrected.toLowerCase()}` === key
      );
      if (existing) {
        return {
          corrections: state.corrections.map((c) =>
            `${c.original.toLowerCase()}→${c.corrected.toLowerCase()}` === key
              ? { ...c, occurrences: c.occurrences + 1, lastSeen: new Date().toISOString() }
              : c
          ),
        };
      }
      return {
        corrections: [
          ...state.corrections,
          { original, corrected, category, occurrences: 1, lastSeen: new Date().toISOString() },
        ].slice(0, 500),
      };
    });
    schedulePersist();
  },

  recordSession: (wordCount, durationSec, engine) => {
    set((state) => {
      const m = state.metrics;
      const newTotal = m.totalSessions + 1;
      const newWords = m.totalWords + wordCount;
      const newDuration = m.totalDuration + durationSec;
      const today = new Date().toISOString().slice(0, 10);
      const sessionsPerDay = { ...m.sessionsPerDay };
      sessionsPerDay[today] = (sessionsPerDay[today] || 0) + 1;

      // Keep only last 90 days of daily counts
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      for (const day of Object.keys(sessionsPerDay)) {
        if (day < cutoffStr) delete sessionsPerDay[day];
      }

      return {
        metrics: {
          totalSessions: newTotal,
          totalWords: newWords,
          totalDuration: newDuration,
          avgWordsPerMinute: newDuration > 0 ? Math.round((newWords / newDuration) * 60) : 0,
          avgSessionLength: newTotal > 0 ? Math.round(newDuration / newTotal) : 0,
          correctionsApplied: m.correctionsApplied,
          correctionsRejected: m.correctionsRejected,
          mostUsedEngine: engine,
          sessionsPerDay,
        },
      };
    });
    schedulePersist();
  },

  recordCorrectionFeedback: (accepted) => {
    set((state) => ({
      metrics: {
        ...state.metrics,
        correctionsApplied: state.metrics.correctionsApplied + (accepted ? 1 : 0),
        correctionsRejected: state.metrics.correctionsRejected + (accepted ? 0 : 1),
      },
    }));
    schedulePersist();
  },

  getTopCorrectionPatterns: (limit = 20) => {
    return [...get().corrections].sort((a, b) => b.occurrences - a.occurrences).slice(0, limit);
  },

  getVocabularyList: () => {
    return get().vocabulary.map((v) => v.word);
  },

  clearAll: () => {
    set({ vocabulary: [], corrections: [], metrics: { ...defaultMetrics } });
    schedulePersist();
  },
}));

export async function loadFlywheel(): Promise<void> {
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("flywheel.json");
    const vocab = await store.get<VocabularyEntry[]>("vocabulary");
    const corrections = await store.get<CorrectionPattern[]>("corrections");
    const metrics = await store.get<UsageMetrics>("metrics");
    useFlywheelStore.setState({
      vocabulary: Array.isArray(vocab) ? vocab : [],
      corrections: Array.isArray(corrections) ? corrections : [],
      metrics: metrics || { ...defaultMetrics },
    });
  } catch {
    try {
      const saved = localStorage.getItem("marcoreid_flywheel");
      if (saved) {
        const parsed = JSON.parse(saved);
        useFlywheelStore.setState({
          vocabulary: parsed.vocabulary || [],
          corrections: parsed.corrections || [],
          metrics: parsed.metrics || { ...defaultMetrics },
        });
      }
    } catch {
      // No saved flywheel data
    }
  }
}

async function persistFlywheel(): Promise<void> {
  const state = useFlywheelStore.getState();
  const data = {
    vocabulary: state.vocabulary,
    corrections: state.corrections,
    metrics: state.metrics,
  };
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("flywheel.json");
    await store.set("vocabulary", data.vocabulary);
    await store.set("corrections", data.corrections);
    await store.set("metrics", data.metrics);
    await store.save();
  } catch {
    try {
      localStorage.setItem("marcoreid_flywheel", JSON.stringify(data));
    } catch {
      // Ignore
    }
  }
}
