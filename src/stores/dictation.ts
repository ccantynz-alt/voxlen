import { create } from "zustand";
import { useClientsStore } from "@/stores/clients";

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
  /** Meeting sessions: "you" (mic) or "remote" (system audio). */
  speaker?: string | null;
}

export interface BackendSessionRecord {
  id: string;
  started_at_ms: number;
  ended_at_ms: number;
  duration_ms: number;
  word_count: number;
  language: string | null;
  segments: BackendSessionSegment[];
  /** "dictation" (default) or "meeting". */
  kind?: string;
  client_id?: string | null;
  client_name?: string | null;
  matter_label?: string | null;
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
  /** Always-Ready gate phase (backend-driven). "off" when the mode is
   *  disabled; "armed" = watching for speech locally, nothing streaming;
   *  "streaming" = cloud session open. */
  alwaysReadyPhase: "off" | "armed" | "streaming" | "error";
  /** Hardware mic-switch phase (backend-driven). "off" when the mode is
   *  disabled; "live" = physical switch on, dictating; "muted" = switch
   *  off, waiting for the user to flip it back on. */
  micSwitchPhase: "off" | "live" | "muted";
  /** Id of the draft billing entry created when the last session ended —
   *  drives the post-session review banner. */
  lastDraftEntryId: string | null;

  // Actions
  setStatus: (status: DictationStatus) => void;
  setLastDraftEntryId: (id: string | null) => void;
  setAlwaysReadyPhase: (phase: "off" | "armed" | "streaming" | "error") => void;
  setMicSwitchPhase: (phase: "off" | "live" | "muted") => void;
  addSegment: (segment: TranscriptionSegment) => void;
  updateSegment: (id: string, updates: Partial<TranscriptionSegment>) => void;
  popLastSegment: () => void;
  removeSegment: (id: string) => void;
  /** Replace the whole session with a single segment — used when a grammar
   *  polish is applied to the full transcript, so the corrected text doesn't
   *  get appended after the segments it already contains. */
  replaceAllSegments: (segment: TranscriptionSegment) => void;
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
  alwaysReadyPhase: "off",
  micSwitchPhase: "off",
  lastDraftEntryId: null,

  setAlwaysReadyPhase: (phase) => set({ alwaysReadyPhase: phase }),
  setMicSwitchPhase: (phase) => set({ micSwitchPhase: phase }),
  setLastDraftEntryId: (id) => set({ lastDraftEntryId: id }),

  setStatus: (status) =>
    set((state) => {
      // Stamp session start on idle→listening and also error→listening (retry).
      const sessionStartedAtMs =
        status === "listening" && (state.status === "idle" || state.status === "error")
          ? Date.now()
          : state.sessionStartedAtMs;
      // Clear stale error when leaving error state.
      const error = state.status === "error" && status !== "error" ? null : state.error;
      return { status, sessionStartedAtMs, error };
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
      const wordCount = segments.reduce(
        (count, s) =>
          count + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
        0
      );
      persistDraft({ segments, sessionStartedAtMs: state.sessionStartedAtMs });
      return { segments, wordCount };
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
      persistDraft({ segments, sessionStartedAtMs: state.sessionStartedAtMs });
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
      persistDraft({ segments, sessionStartedAtMs: state.sessionStartedAtMs });
      return { segments, wordCount };
    }),

  replaceAllSegments: (segment) =>
    set((state) => {
      const segments = [segment];
      const wordCount = (segment.correctedText || segment.text)
        .split(/\s+/)
        .filter(Boolean).length;
      persistDraft({ segments, sessionStartedAtMs: state.sessionStartedAtMs });
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
    // If the backend is still capturing, stop it — otherwise the UI shows
    // "idle" while the mic keeps streaming and new transcripts keep injecting.
    const active = get().status === "listening" || get().status === "processing" || get().status === "paused";
    if (active) {
      void (async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("stop_dictation");
        } catch {
          // Non-Tauri / already stopped.
        }
      })();
    }
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
  const { activeClientId, clients } = useClientsStore.getState();
  const client = clients.find((c) => c.id === activeClientId);

  return {
    id: crypto.randomUUID(),
    started_at_ms: started,
    ended_at_ms: ended,
    duration_ms: Math.max(0, ended - started),
    word_count: state.wordCount,
    language: state.segments.find((s) => s.language)?.language ?? null,
    client_id: activeClientId,
    client_name: client?.name ?? null,
    matter_label: client?.matterNumber?.trim() || null,
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
