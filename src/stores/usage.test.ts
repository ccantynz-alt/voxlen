import { beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_WEEKLY_WORD_CAP } from "./entitlement";
import { endOfWeekMs } from "./usage";

// The store caches module-level state (zustand). We re-import per test so each
// case gets a fresh store and we can also mock the tauri plugin to avoid
// touching the filesystem.
vi.mock("@tauri-apps/plugin-store", () => ({
  load: () => {
    throw new Error("tauri store not available in tests");
  },
}));

async function freshStore() {
  vi.resetModules();
  localStorage.clear();
  const mod = await import("./usage");
  return mod.useUsageStore;
}

describe("useUsageStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts at zero words for a new week", async () => {
    const store = await freshStore();
    const { wordsUsed, weekStartMs } = store.getState();
    expect(wordsUsed).toBe(0);
    expect(weekStartMs).toBeGreaterThan(0);
  });

  it("remaining defaults to the free cap", async () => {
    const store = await freshStore();
    expect(store.getState().remaining()).toBe(FREE_WEEKLY_WORD_CAP);
  });

  it("records words and reflects them in `remaining`", async () => {
    const store = await freshStore();
    store.getState().recordWords(100);
    expect(store.getState().wordsUsed).toBe(100);
    expect(store.getState().remaining()).toBe(FREE_WEEKLY_WORD_CAP - 100);
  });

  it("isOverCap flips true once the cap is reached", async () => {
    const store = await freshStore();
    expect(store.getState().isOverCap()).toBe(false);
    store.getState().recordWords(FREE_WEEKLY_WORD_CAP);
    expect(store.getState().isOverCap()).toBe(true);
    // Remaining never goes negative.
    expect(store.getState().remaining()).toBe(0);
  });

  it("ignores zero and negative counts", async () => {
    const store = await freshStore();
    store.getState().recordWords(0);
    store.getState().recordWords(-5);
    store.getState().recordWords(NaN);
    expect(store.getState().wordsUsed).toBe(0);
  });

  it("floors fractional word counts", async () => {
    const store = await freshStore();
    store.getState().recordWords(10.9);
    expect(store.getState().wordsUsed).toBe(10);
  });

  it("resets to a new week on demand", async () => {
    const store = await freshStore();
    store.getState().recordWords(42);
    store.getState().reset();
    expect(store.getState().wordsUsed).toBe(0);
  });

  it("rolls over when a new week begins", async () => {
    const store = await freshStore();
    store.getState().recordWords(100);
    // Force the stored weekStart to be last week. Next recordWords() should
    // roll the meter back to zero before adding.
    store.setState({
      ...store.getState(),
      weekStartMs: store.getState().weekStartMs - 14 * 86_400_000,
      wordsUsed: 300,
    });
    store.getState().recordWords(50);
    expect(store.getState().wordsUsed).toBe(50);
  });

  it("endOfWeekMs lands exactly seven days after weekStart", async () => {
    const store = await freshStore();
    const start = store.getState().weekStartMs;
    expect(endOfWeekMs(start) - start).toBe(7 * 86_400_000);
  });
});
