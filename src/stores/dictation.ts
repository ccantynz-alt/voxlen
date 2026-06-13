import { create } from "zustand";

export type DictationStatus =
  | "idle"
  | "listening"
  | "processing"
  | "paused"
  | "error";

export interface SegmentWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuatedWord: string;
  speaker?: number;
}

export interface TranscriptionSegment {
  id: string;
  text: string;
  correctedText?: string;
  /** Translation of this segment into `translatedToLanguage`.
   *  Independent from `correctedText` so grammar polish and translation
   *  can coexist on the same segment. */
  translatedText?: string;
  translatedToLanguage?: string;
  timestamp: Date;
  confidence: number;
  language?: string;
  isFinal: boolean;
  grammarApplied: boolean;
  words?: SegmentWord[];
  speakerLabel?: string;
}

/**
 * Shape of a persisted session — mirrors the Rust `SessionRecord` struct
 * (snake_case on the wire). Converted at IPC boundary.
 */
export interface BackendSessionSegment {
  id: string;
  text: string;
  corrected_text: string | null;
  confidence: number;
  language: string | null;
  timestamp_ms: number;
  grammar_applied: boolean;
}

export interface BackendSessionRecord {
  id: string;
  started_at_ms: number;
  ended_at_ms: number;
  duration_ms: number;
  word_count: number;
  language: string | null;
  segments: BackendSessionSegment[];
}

const DRAFT_KEY = "voxlen_draft";

export interface DraftRecord {
  savedAt: number;
  sessionStartedAtMs: number | null;
  segments: Array<Omit<TranscriptionSegment, "timestamp"> & { timestampMs: number }>;
}

function persistDraft(state: { segments: TranscriptionSegment[]; sessionStartedAtMs: number | null }) {
  if (state.segments.length === 0) return;
  const draft: DraftRecord = {
    savedAt: Date.now(),
    sessionStartedAtMs: state.sessionStartedAtMs,
    segments: state.segments.map((s) => ({
      ...s,
      timestampMs: s.timestamp.getTime(),
      timestamp: undefined as unknown as Date,
    })),
  };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage quota — silently ignore
  }
}

export function loadDraftRecord(): DraftRecord | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftRecord;
  } catch {
    return null;
  }
}

export function clearDraftRecord() {
  localStorage.removeItem(DRAFT_KEY);
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
  sessionStartedAtMs: number | null;
  capsLock: boolean;

  // Actions
  setStatus: (status: DictationStatus) => void;
  addSegment: (segment: TranscriptionSegment) => void;
  updateSegment: (id: string, updates: Partial<TranscriptionSegment>) => void;
  popLastSegment: () => void;
  removeSegment: (id: string) => void;
  appendToLastSegment: (text: string) => void;
  setCurrentTranscript: (text: string) => void;
  setCorrectedTranscript: (text: string) => void;
  setInputLevel: (level: number) => void;
  setError: (error: string | null) => void;
  incrementDuration: () => void;
  clearSession: () => void;
  clearCurrentTranscript: () => void;
  getFullTranscript: () => string;
  setCapsLock: (value: boolean) => void;
  toggleCapsLock: () => void;
  restoreDraft: (draft: DraftRecord) => void;
  discardDraft: () => void;
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
  sessionStartedAtMs: null,
  capsLock: false,

  setStatus: (status) =>
    set((state) => {
      // When transitioning from idle -> listening, stamp the session start.
      const sessionStartedAtMs =
        status === "listening" && state.status === "idle"
          ? Date.now()
          : state.sessionStartedAtMs;
      return { status, sessionStartedAtMs };
    }),

  addSegment: (segment) =>
    set((state) => {
      if (!(segment.correctedText || segment.text).trim()) return state;
      const segments = [...state.segments, segment];
      const wordCount = segments.reduce(
        (count, s) =>
          count + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
        0
      );
      persistDraft({ segments, sessionStartedAtMs: state.sessionStartedAtMs });
      return { segments, wordCount };
    }),

  updateSegment: (id, updates) =>
    set((state) => {
      const segments = state.segments.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      persistDraft({ segments, sessionStartedAtMs: state.sessionStartedAtMs });
      return { segments };
    }),

  popLastSegment: () =>
    set((state) => {
      if (state.segments.length === 0) return {};
      const segments = state.segments.slice(0, -1);
      const wordCount = segments.reduce(
        (count, s) =>
          count + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
        0
      );
      return { segments, wordCount };
    }),

  removeSegment: (id) =>
    set((state) => {
      const segments = state.segments.filter((s) => s.id !== id);
      const wordCount = segments.reduce(
        (count, s) =>
          count + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
        0
      );
      return { segments, wordCount };
    }),

  appendToLastSegment: (text) =>
    set((state) => {
      if (state.segments.length === 0) return {};
      const segments = [...state.segments];
      const last = segments[segments.length - 1];
      const nextText = (last.correctedText ?? last.text) + text;
      segments[segments.length - 1] = last.correctedText
        ? { ...last, correctedText: nextText }
        : { ...last, text: nextText };
      const wordCount = segments.reduce(
        (count, s) =>
          count + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
        0
      );
      persistDraft({ segments, sessionStartedAtMs: state.sessionStartedAtMs });
      return { segments, wordCount };
    }),

  setCurrentTranscript: (text) => set({ currentTranscript: text }),
  setCorrectedTranscript: (text) => set({ correctedTranscript: text }),
  setInputLevel: (level) => set({ inputLevel: level }),
  setError: (error) => set({ error, status: error ? "error" : "idle" }),
  incrementDuration: () =>
    set((state) => ({ sessionDuration: state.sessionDuration + 1 })),

  clearSession: () => {
    clearDraftRecord();
    set({
      segments: [],
      currentTranscript: "",
      correctedTranscript: "",
      sessionDuration: 0,
      wordCount: 0,
      inputLevel: 0,
      error: null,
      status: "idle",
      sessionStartedAtMs: null,
      capsLock: false,
    });
  },

  clearCurrentTranscript: () => set({ currentTranscript: "" }),

  getFullTranscript: () => {
    const state = get();
    return state.segments
      .map((s) => s.correctedText || s.text)
      .join(" ");
  },

  setCapsLock: (value) => set({ capsLock: value }),
  toggleCapsLock: () => set((state) => ({ capsLock: !state.capsLock })),

  restoreDraft: (draft) => {
    const segments: TranscriptionSegment[] = draft.segments.map((s) => ({
      ...s,
      timestamp: new Date(s.timestampMs),
    }));
    const wordCount = segments.reduce(
      (count, s) =>
        count + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
      0
    );
    clearDraftRecord();
    set({ segments, wordCount, sessionStartedAtMs: draft.sessionStartedAtMs });
  },

  discardDraft: () => {
    clearDraftRecord();
  },
}));

/**
 * Build a backend SessionRecord from the current dictation store state.
 * Returns null if there's nothing meaningful to save (no segments).
 */
export function buildSessionRecord(): BackendSessionRecord | null {
  const state = useDictationStore.getState();
  if (state.segments.length === 0) return null;

  const started = state.sessionStartedAtMs ?? state.segments[0].timestamp.getTime();
  const ended = Date.now();

  return {
    id: crypto.randomUUID(),
    started_at_ms: started,
    ended_at_ms: ended,
    duration_ms: Math.max(0, ended - started),
    word_count: state.wordCount,
    language: state.segments.find((s) => s.language)?.language ?? null,
    segments: state.segments.map((s) => ({
      id: s.id,
      text: s.text,
      corrected_text: s.correctedText ?? null,
      confidence: s.confidence,
      language: s.language ?? null,
      timestamp_ms: s.timestamp.getTime(),
      grammar_applied: s.grammarApplied,
    })),
  };
}
