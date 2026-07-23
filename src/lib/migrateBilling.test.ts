import { describe, it, expect, beforeEach } from "vitest";
import { migrateLegacyTimeEntries } from "./migrateBilling";
import { useClientsStore } from "@/stores/clients";

// In the test environment @tauri-apps/plugin-store is unavailable, so the
// migration exercises its localStorage fallback path.

function seedLegacy(entries: unknown[], extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    "voxlen_flywheel",
    JSON.stringify({ vocabulary: [], timeEntries: entries, ...extra })
  );
}

const legacyEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  matter: "",
  minutes: 30,
  ratePerHour: 400,
  amount: 200,
  notes: "Reviewed contract",
  createdAt: "2026-06-01T10:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  useClientsStore.setState({ clients: [], activeClientId: null, entries: [] });
});

describe("migrateLegacyTimeEntries", () => {
  it("migrates entries matched to a client by name", async () => {
    const clientId = useClientsStore
      .getState()
      .addClient({ name: "Acme Corp", billableRate: 400, color: "" });
    seedLegacy([legacyEntry({ matter: "acme corp" })]);

    const count = await migrateLegacyTimeEntries();
    expect(count).toBe(1);
    const entries = useClientsStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].clientId).toBe(clientId);
    expect(entries[0].durationSeconds).toBe(1800);
    expect(entries[0].billableAmount).toBe(200);
    expect(entries[0].status).toBe("approved");
    expect(entries[0].source).toBe("migrated");
  });

  it("keeps unmatched entries as unassigned with a matterLabel", async () => {
    seedLegacy([legacyEntry({ matter: "Unknown Matter" })]);
    const count = await migrateLegacyTimeEntries();
    expect(count).toBe(1);
    const [entry] = useClientsStore.getState().entries;
    expect(entry.clientId).toBe("");
    expect(entry.matterLabel).toBe("Unknown Matter");
  });

  it("is idempotent via the migrated flag", async () => {
    seedLegacy([legacyEntry()]);
    expect(await migrateLegacyTimeEntries()).toBe(1);
    expect(await migrateLegacyTimeEntries()).toBe(0);
    expect(useClientsStore.getState().entries).toHaveLength(1);
    // legacy data removed from the persisted blob
    const blob = JSON.parse(localStorage.getItem("voxlen_flywheel")!);
    expect(blob.timeEntries).toBeUndefined();
    expect(blob.timeEntriesMigrated).toBe(true);
  });

  it("handles absence of legacy data gracefully", async () => {
    expect(await migrateLegacyTimeEntries()).toBe(0);
    expect(useClientsStore.getState().entries).toHaveLength(0);
  });
});
