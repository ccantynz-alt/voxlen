import { describe, it, expect, beforeEach, vi } from "vitest";
import { useHistoryStore } from "./history";
import type { HistoryEntry } from "./history";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    save: vi.fn(),
  }),
}));

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    text: "Hello world",
    duration: 30,
    wordCount: 2,
    language: "en",
    timestamp: new Date().toISOString(),
    grammarCorrected: false,
    ...overrides,
  };
}

describe("useHistoryStore", () => {
  beforeEach(() => {
    useHistoryStore.setState({ entries: [] });
  });

  it("starts empty", () => {
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("addEntry prepends new entries", () => {
    const a = makeEntry({ text: "first" });
    const b = makeEntry({ text: "second" });
    useHistoryStore.getState().addEntry(a);
    useHistoryStore.getState().addEntry(b);
    const { entries } = useHistoryStore.getState();
    expect(entries[0].text).toBe("second");
    expect(entries[1].text).toBe("first");
  });

  it("addEntry caps entries at 200", () => {
    for (let i = 0; i < 205; i++) {
      useHistoryStore.getState().addEntry(makeEntry({ id: `id-${i}` }));
    }
    expect(useHistoryStore.getState().entries).toHaveLength(200);
  });

  it("removeEntry deletes by id", () => {
    const a = makeEntry({ id: "keep" });
    const b = makeEntry({ id: "remove" });
    useHistoryStore.getState().addEntry(a);
    useHistoryStore.getState().addEntry(b);
    useHistoryStore.getState().removeEntry("remove");
    const { entries } = useHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("keep");
  });

  it("removeEntry is a no-op for unknown id", () => {
    const a = makeEntry();
    useHistoryStore.getState().addEntry(a);
    useHistoryStore.getState().removeEntry("nonexistent");
    expect(useHistoryStore.getState().entries).toHaveLength(1);
  });

  it("clearAll empties entries", () => {
    useHistoryStore.getState().addEntry(makeEntry());
    useHistoryStore.getState().addEntry(makeEntry());
    useHistoryStore.getState().clearAll();
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("preserves all entry fields", () => {
    const entry = makeEntry({
      id: "x1",
      text: "Legal memo",
      duration: 120,
      wordCount: 45,
      language: "en-US",
      grammarCorrected: true,
      timestamp: "2026-06-12T10:00:00.000Z",
    });
    useHistoryStore.getState().addEntry(entry);
    const saved = useHistoryStore.getState().entries[0];
    expect(saved).toEqual(entry);
  });
});
