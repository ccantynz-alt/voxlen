import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DictationPanel } from "./DictationPanel";
import { useClientsStore } from "@/stores/clients";
import { useDictationStore } from "@/stores/dictation";

/**
 * Regression coverage for React error #185 ("Maximum update depth exceeded").
 *
 * DictationPanel previously selected `s.clients.filter(...)` directly from the
 * Zustand v5 store. Because `.filter()` allocates a new array on every call,
 * useSyncExternalStore saw the snapshot reference change on each render and
 * force-re-rendered forever, crashing the whole Dictation view. Mounting the
 * panel exercises that exact path, so a plain render is enough to guard it.
 */
describe("DictationPanel", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useDictationStore.getState().clearSession();
    useClientsStore.setState({ clients: [], activeClientId: null, entries: [] });
  });

  it("mounts without an infinite render loop (regression: React #185)", () => {
    expect(() => render(<DictationPanel />)).not.toThrow();
    expect(screen.getByText("Press to begin dictation")).toBeInTheDocument();
  });

  it("renders the client selector and filters out archived clients", () => {
    useClientsStore.setState({
      clients: [
        { id: "c1", name: "Acme Corp", billableRate: 0, color: "#abcabc", archived: false, createdAt: Date.now() },
        { id: "c2", name: "Archived Co", billableRate: 0, color: "#defdef", archived: true, createdAt: Date.now() },
      ],
      activeClientId: "c1",
      entries: [],
    });

    expect(() => render(<DictationPanel />)).not.toThrow();
    // The active (non-archived) client shows on the selector button…
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    // …while the archived one is filtered out of the visible selector.
    expect(screen.queryByText("Archived Co")).not.toBeInTheDocument();
  });
});
