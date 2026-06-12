import { describe, it, expect, beforeEach } from "vitest";
import { useDictationStore, loadDraftRecord, clearDraftRecord } from "./dictation";
import type { TranscriptionSegment } from "./dictation";

function makeSeg(overrides: Partial<TranscriptionSegment> = {}): TranscriptionSegment {
  return {
    id: crypto.randomUUID(),
    text: "Hello world",
    confidence: 0.95,
    isFinal: true,
    grammarApplied: false,
    timestamp: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  useDictationStore.setState({
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
  });
  localStorage.clear();
});

describe("addSegment", () => {
  it("appends a segment and updates wordCount", () => {
    useDictationStore.getState().addSegment(makeSeg({ text: "one two three" }));
    const { segments, wordCount } = useDictationStore.getState();
    expect(segments).toHaveLength(1);
    expect(wordCount).toBe(3);
  });

  it("uses correctedText word count when present", () => {
    useDictationStore.getState().addSegment(makeSeg({ text: "a b c", correctedText: "one two" }));
    expect(useDictationStore.getState().wordCount).toBe(2);
  });
});

describe("updateSegment", () => {
  it("updates fields on matching segment", () => {
    const seg = makeSeg({ text: "raw text" });
    useDictationStore.getState().addSegment(seg);
    useDictationStore.getState().updateSegment(seg.id, { correctedText: "polished text" });
    const updated = useDictationStore.getState().segments[0];
    expect(updated.correctedText).toBe("polished text");
  });
});

describe("popLastSegment", () => {
  it("removes the last segment", () => {
    useDictationStore.getState().addSegment(makeSeg({ text: "a" }));
    useDictationStore.getState().addSegment(makeSeg({ text: "b" }));
    useDictationStore.getState().popLastSegment();
    expect(useDictationStore.getState().segments).toHaveLength(1);
    expect(useDictationStore.getState().segments[0].text).toBe("a");
  });

  it("is a no-op on empty segments", () => {
    expect(() => useDictationStore.getState().popLastSegment()).not.toThrow();
  });
});

describe("removeSegment", () => {
  it("removes segment by id", () => {
    const a = makeSeg({ text: "a" });
    const b = makeSeg({ text: "b" });
    useDictationStore.getState().addSegment(a);
    useDictationStore.getState().addSegment(b);
    useDictationStore.getState().removeSegment(a.id);
    const { segments } = useDictationStore.getState();
    expect(segments).toHaveLength(1);
    expect(segments[0].id).toBe(b.id);
  });
});

describe("clearSession", () => {
  it("resets all state and clears the draft", () => {
    useDictationStore.getState().addSegment(makeSeg());
    expect(loadDraftRecord()).not.toBeNull();
    useDictationStore.getState().clearSession();
    const s = useDictationStore.getState();
    expect(s.segments).toHaveLength(0);
    expect(s.wordCount).toBe(0);
    expect(loadDraftRecord()).toBeNull();
  });
});

describe("draft persistence", () => {
  it("persists a draft to localStorage on addSegment", () => {
    useDictationStore.getState().addSegment(makeSeg({ text: "persisted" }));
    const draft = loadDraftRecord();
    expect(draft).not.toBeNull();
    expect(draft!.segments).toHaveLength(1);
    expect(draft!.segments[0].text).toBe("persisted");
  });

  it("persists draft on updateSegment", () => {
    const seg = makeSeg({ text: "raw" });
    useDictationStore.getState().addSegment(seg);
    useDictationStore.getState().updateSegment(seg.id, { correctedText: "updated" });
    const draft = loadDraftRecord();
    expect(draft!.segments[0].correctedText).toBe("updated");
  });

  it("persists draft on appendToLastSegment", () => {
    useDictationStore.getState().addSegment(makeSeg({ text: "hello" }));
    useDictationStore.getState().appendToLastSegment(" world");
    const draft = loadDraftRecord();
    expect(draft!.segments[0].text).toBe("hello world");
  });

  it("clearDraftRecord removes the draft", () => {
    useDictationStore.getState().addSegment(makeSeg());
    clearDraftRecord();
    expect(loadDraftRecord()).toBeNull();
  });
});

describe("restoreDraft", () => {
  it("restores segments from a draft, rehydrating timestamps", () => {
    const now = Date.now();
    useDictationStore.getState().restoreDraft({
      savedAt: now,
      sessionStartedAtMs: now - 5000,
      segments: [
        {
          id: "abc",
          text: "recovered text",
          confidence: 0.9,
          isFinal: true,
          grammarApplied: false,
          timestampMs: now - 3000,
        },
      ],
    });
    const { segments, sessionStartedAtMs } = useDictationStore.getState();
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("recovered text");
    expect(segments[0].timestamp).toBeInstanceOf(Date);
    expect(segments[0].timestamp.getTime()).toBe(now - 3000);
    expect(sessionStartedAtMs).toBe(now - 5000);
  });

  it("clears the draft record after restoring", () => {
    useDictationStore.getState().addSegment(makeSeg());
    const draft = loadDraftRecord()!;
    useDictationStore.getState().restoreDraft(draft);
    expect(loadDraftRecord()).toBeNull();
  });
});

describe("discardDraft", () => {
  it("removes the saved draft", () => {
    useDictationStore.getState().addSegment(makeSeg());
    useDictationStore.getState().discardDraft();
    expect(loadDraftRecord()).toBeNull();
  });
});

describe("getFullTranscript", () => {
  it("joins correctedText preferentially", () => {
    useDictationStore.getState().addSegment(makeSeg({ text: "raw", correctedText: "polished" }));
    useDictationStore.getState().addSegment(makeSeg({ text: "second" }));
    expect(useDictationStore.getState().getFullTranscript()).toBe("polished second");
  });
});

describe("capsLock", () => {
  it("toggles capsLock", () => {
    expect(useDictationStore.getState().capsLock).toBe(false);
    useDictationStore.getState().toggleCapsLock();
    expect(useDictationStore.getState().capsLock).toBe(true);
    useDictationStore.getState().toggleCapsLock();
    expect(useDictationStore.getState().capsLock).toBe(false);
  });
});
