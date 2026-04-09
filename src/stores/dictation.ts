import { create } from "zustand";

export type DictationStatus =
  | "idle"
  | "listening"
  | "processing"
  | "paused"
  | "error";

export interface TranscriptionSegment {
  id: string;
  text: string;
  correctedText?: string;
  timestamp: Date;
  confidence: number;
  language?: string;
  isFinal: boolean;
  grammarApplied: boolean;
}

interface DictationState {
  status: DictationStatus;
  segments: TranscriptionSegment[];
  currentTranscript: string;
  correctedTranscript: string;
  sessionDuration: number;
  wordCount: number;
  inputLevel: number;
  error: string | null;

  // Actions
  setStatus: (status: DictationStatus) => void;
  addSegment: (segment: TranscriptionSegment) => void;
  updateSegment: (id: string, updates: Partial<TranscriptionSegment>) => void;
  setCurrentTranscript: (text: string) => void;
  setCorrectedTranscript: (text: string) => void;
  setInputLevel: (level: number) => void;
  setError: (error: string | null) => void;
  incrementDuration: () => void;
  clearSession: () => void;
  getFullTranscript: () => string;
}

export const useDictationStore = create<DictationState>((set, get) => ({
  status: "idle",
  segments: [],
  currentTranscript: "",
  correctedTranscript: "",
  sessionDuration: 0,
  wordCount: 0,
  inputLevel: 0,
  error: null,

  setStatus: (status) => set({ status }),

  addSegment: (segment) =>
    set((state) => {
      const segments = [...state.segments, segment];
      const wordCount = segments.reduce(
        (count, s) =>
          count + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
        0
      );
      return { segments, wordCount };
    }),

  updateSegment: (id, updates) =>
    set((state) => ({
      segments: state.segments.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  setCurrentTranscript: (text) => set({ currentTranscript: text }),
  setCorrectedTranscript: (text) => set({ correctedTranscript: text }),
  setInputLevel: (level) => set({ inputLevel: level }),
  setError: (error) => set({ error, status: error ? "error" : "idle" }),
  incrementDuration: () =>
    set((state) => ({ sessionDuration: state.sessionDuration + 1 })),

  clearSession: () =>
    set({
      segments: [],
      currentTranscript: "",
      correctedTranscript: "",
      sessionDuration: 0,
      wordCount: 0,
      inputLevel: 0,
      error: null,
      status: "idle",
    }),

  getFullTranscript: () => {
    const state = get();
    return state.segments
      .map((s) => s.correctedText || s.text)
      .join(" ");
  },
}));
