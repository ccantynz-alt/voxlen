import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFlywheelStore } from "./flywheel";

// Stub out the Tauri plugin so persistFlywheel doesn't throw
vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

const defaultMetrics = {
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

beforeEach(() => {
  vi.useFakeTimers();
  useFlywheelStore.setState({
    vocabulary: [],
    corrections: [],
    metrics: { ...defaultMetrics },
    timeEntries: [],
  });
});

describe("recordSession", () => {
  it("increments totalSessions and totalWords", () => {
    useFlywheelStore.getState().recordSession(120, 60, "deepgram");
    const { metrics } = useFlywheelStore.getState();
    expect(metrics.totalSessions).toBe(1);
    expect(metrics.totalWords).toBe(120);
    expect(metrics.totalDuration).toBe(60);
    expect(metrics.mostUsedEngine).toBe("deepgram");
  });

  it("accumulates across multiple sessions", () => {
    const store = useFlywheelStore.getState();
    store.recordSession(100, 60, "deepgram");
    store.recordSession(200, 120, "whisper");
    const { metrics } = useFlywheelStore.getState();
    expect(metrics.totalSessions).toBe(2);
    expect(metrics.totalWords).toBe(300);
    expect(metrics.totalDuration).toBe(180);
  });

  it("calculates avgWordsPerMinute correctly", () => {
    useFlywheelStore.getState().recordSession(120, 60, "deepgram");
    const { metrics } = useFlywheelStore.getState();
    // 120 words / 60 seconds * 60 = 120 wpm
    expect(metrics.avgWordsPerMinute).toBe(120);
  });

  it("calculates avgSessionLength correctly", () => {
    useFlywheelStore.getState().recordSession(50, 90, "deepgram");
    const { metrics } = useFlywheelStore.getState();
    expect(metrics.avgSessionLength).toBe(90);
  });

  it("records sessions per day with today's date key", () => {
    useFlywheelStore.getState().recordSession(10, 10, "deepgram");
    useFlywheelStore.getState().recordSession(20, 20, "deepgram");
    const today = new Date().toISOString().slice(0, 10);
    const { metrics } = useFlywheelStore.getState();
    expect(metrics.sessionsPerDay[today]).toBe(2);
  });
});

describe("recordCorrection", () => {
  it("adds a new correction pattern to the corrections array", () => {
    useFlywheelStore.getState().recordCorrection("teh", "the", "spelling");
    const { corrections } = useFlywheelStore.getState();
    expect(corrections).toHaveLength(1);
    expect(corrections[0].original).toBe("teh");
    expect(corrections[0].corrected).toBe("the");
    expect(corrections[0].category).toBe("spelling");
    expect(corrections[0].occurrences).toBe(1);
  });

  it("increments occurrences on repeated corrections", () => {
    const store = useFlywheelStore.getState();
    store.recordCorrection("teh", "the", "spelling");
    store.recordCorrection("teh", "the", "spelling");
    const { corrections } = useFlywheelStore.getState();
    expect(corrections).toHaveLength(1);
    expect(corrections[0].occurrences).toBe(2);
  });

  it("treats distinct corrections as separate entries", () => {
    const store = useFlywheelStore.getState();
    store.recordCorrection("teh", "the", "spelling");
    store.recordCorrection("i", "I", "grammar");
    expect(useFlywheelStore.getState().corrections).toHaveLength(2);
  });

  it("is case-insensitive for deduplication", () => {
    const store = useFlywheelStore.getState();
    store.recordCorrection("Teh", "The", "spelling");
    store.recordCorrection("teh", "the", "spelling");
    expect(useFlywheelStore.getState().corrections).toHaveLength(1);
    expect(useFlywheelStore.getState().corrections[0].occurrences).toBe(2);
  });
});

describe("recordCorrectionFeedback", () => {
  it("increments correctionsApplied when accepted", () => {
    useFlywheelStore.getState().recordCorrectionFeedback(true);
    expect(useFlywheelStore.getState().metrics.correctionsApplied).toBe(1);
    expect(useFlywheelStore.getState().metrics.correctionsRejected).toBe(0);
  });

  it("increments correctionsRejected when not accepted", () => {
    useFlywheelStore.getState().recordCorrectionFeedback(false);
    expect(useFlywheelStore.getState().metrics.correctionsRejected).toBe(1);
    expect(useFlywheelStore.getState().metrics.correctionsApplied).toBe(0);
  });
});

describe("addVocabulary", () => {
  it("adds a new word to vocabulary", () => {
    useFlywheelStore.getState().addVocabulary("indemnification");
    const { vocabulary } = useFlywheelStore.getState();
    expect(vocabulary).toHaveLength(1);
    expect(vocabulary[0].word).toBe("indemnification");
    expect(vocabulary[0].frequency).toBe(1);
    expect(vocabulary[0].source).toBe("auto-detected");
  });

  it("increments frequency for existing word", () => {
    const store = useFlywheelStore.getState();
    store.addVocabulary("indemnification");
    store.addVocabulary("indemnification");
    const { vocabulary } = useFlywheelStore.getState();
    expect(vocabulary).toHaveLength(1);
    expect(vocabulary[0].frequency).toBe(2);
  });
});

describe("getTopCorrectionPatterns", () => {
  it("returns corrections sorted by occurrences descending", () => {
    const store = useFlywheelStore.getState();
    store.recordCorrection("a", "A", "grammar");
    store.recordCorrection("b", "B", "grammar");
    store.recordCorrection("b", "B", "grammar"); // 2 occurrences
    const top = useFlywheelStore.getState().getTopCorrectionPatterns(10);
    expect(top[0].original).toBe("b");
    expect(top[1].original).toBe("a");
  });
});

describe("clearAll", () => {
  it("resets all state to defaults", () => {
    const store = useFlywheelStore.getState();
    store.addVocabulary("test");
    store.recordSession(100, 60, "deepgram");
    store.recordCorrection("x", "y", "spelling");
    store.clearAll();
    const state = useFlywheelStore.getState();
    expect(state.vocabulary).toHaveLength(0);
    expect(state.corrections).toHaveLength(0);
    expect(state.metrics.totalSessions).toBe(0);
    expect(state.metrics.totalWords).toBe(0);
  });
});
