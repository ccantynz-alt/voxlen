import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShallow } from "zustand/react/shallow";
import { useClientsStore } from "@/stores/clients";

/**
 * Regression test for React error #185 ("Maximum update depth exceeded").
 *
 * DictationPanel selects the non-archived clients with:
 *   useClientsStore(useShallow((s) => s.clients.filter((c) => !c.archived)))
 *
 * Under Zustand v5 (useSyncExternalStore), a selector that calls `.filter()`
 * without `useShallow` allocates a brand-new array reference on every render —
 * even `[].filter()` returns a fresh `[]` that is not `Object.is`-equal to the
 * previous one. React's snapshot consistency check then re-renders forever and
 * throws error #185, crashing the Dictation view. `useShallow` memoises the
 * derived array by shallow equality, keeping the reference stable.
 */
describe("clients useShallow selector — React #185 regression", () => {
  beforeEach(() => {
    useClientsStore.setState({ clients: [], activeClientId: null, entries: [] });
  });

  const selectActive = () =>
    useClientsStore(useShallow((s) => s.clients.filter((c) => !c.archived)));

  it("returns a stable reference across re-renders when state is unchanged", () => {
    const { result, rerender } = renderHook(selectActive);
    const first = result.current;
    rerender();
    rerender();
    // A new reference here would mean an infinite update loop in the real app.
    expect(result.current).toBe(first);
  });

  it("stays stable with the empty array (the unconditional crash case)", () => {
    const { result, rerender } = renderHook(selectActive);
    expect(result.current).toHaveLength(0);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("produces a new reference only when the underlying clients change", () => {
    const { result } = renderHook(selectActive);
    const before = result.current;

    act(() => {
      useClientsStore.getState().addClient({
        name: "Acme Corp",
        billableRate: 0,
        color: "#7345d1",
      });
    });

    expect(result.current).not.toBe(before);
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe("Acme Corp");
  });

  it("excludes archived clients", () => {
    let id = "";
    act(() => {
      id = useClientsStore.getState().addClient({
        name: "Old Matter",
        billableRate: 0,
        color: "#ef4444",
      });
    });
    const { result } = renderHook(selectActive);
    expect(result.current).toHaveLength(1);

    act(() => {
      useClientsStore.getState().archiveClient(id);
    });
    expect(result.current).toHaveLength(0);
  });
});
