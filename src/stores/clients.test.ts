import { describe, it, expect, beforeEach } from "vitest";
import { useClientsStore } from "./clients";

// Reset store state before each test
beforeEach(() => {
  useClientsStore.setState({
    clients: [],
    activeClientId: null,
    entries: [],
  });
  // Reset localStorage so persist middleware doesn't bleed between tests
  localStorage.clear();
});

describe("addClient", () => {
  it("creates a client with correct defaults", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Acme Corp", billableRate: 250 });
    const { clients } = useClientsStore.getState();
    expect(clients).toHaveLength(1);
    expect(clients[0].id).toBe(id);
    expect(clients[0].name).toBe("Acme Corp");
    expect(clients[0].billableRate).toBe(250);
    expect(clients[0].archived).toBe(false);
    expect(clients[0].createdAt).toBeGreaterThan(0);
    expect(typeof clients[0].color).toBe("string");
    expect(clients[0].color).toMatch(/^#/);
  });

  it("uses provided color instead of auto-assigned", () => {
    const store = useClientsStore.getState();
    store.addClient({ name: "Blue Co", billableRate: 0, color: "#123456" });
    const { clients } = useClientsStore.getState();
    expect(clients[0].color).toBe("#123456");
  });
});

describe("updateClient", () => {
  it("updates specified fields without touching others", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Old Name", billableRate: 100 });
    useClientsStore.getState().updateClient(id, { name: "New Name", billableRate: 350 });
    const { clients } = useClientsStore.getState();
    expect(clients[0].name).toBe("New Name");
    expect(clients[0].billableRate).toBe(350);
    expect(clients[0].archived).toBe(false); // untouched
  });
});

describe("archiveClient", () => {
  it("sets archived=true on the target client", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "To Archive", billableRate: 0 });
    useClientsStore.getState().archiveClient(id);
    const { clients } = useClientsStore.getState();
    expect(clients[0].archived).toBe(true);
  });

  it("clears activeClientId when the active client is archived", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Active", billableRate: 0 });
    useClientsStore.setState({ activeClientId: id });
    useClientsStore.getState().archiveClient(id);
    expect(useClientsStore.getState().activeClientId).toBeNull();
  });

  it("leaves activeClientId unchanged when a different client is archived", () => {
    const store = useClientsStore.getState();
    const id1 = store.addClient({ name: "Client A", billableRate: 0 });
    const id2 = store.addClient({ name: "Client B", billableRate: 0 });
    useClientsStore.setState({ activeClientId: id1 });
    useClientsStore.getState().archiveClient(id2);
    expect(useClientsStore.getState().activeClientId).toBe(id1);
  });
});

describe("addEntry and getTotalBillable", () => {
  it("addEntry stores the entry and getTotalBillable sums billableAmount", () => {
    const store = useClientsStore.getState();
    const clientId = store.addClient({ name: "Law Firm", billableRate: 500 });
    const base = { clientId, date: Date.now(), durationSeconds: 3600, wordCount: 500 };
    store.addEntry({ ...base, billableAmount: 500 });
    store.addEntry({ ...base, billableAmount: 250 });
    const total = useClientsStore.getState().getTotalBillable(clientId);
    expect(total).toBe(750);
  });

  it("getTotalBillable ignores entries from other clients", () => {
    const store = useClientsStore.getState();
    const id1 = store.addClient({ name: "Client 1", billableRate: 0 });
    const id2 = store.addClient({ name: "Client 2", billableRate: 0 });
    const base = { date: Date.now(), durationSeconds: 1800, wordCount: 200 };
    store.addEntry({ ...base, clientId: id1, billableAmount: 100 });
    store.addEntry({ ...base, clientId: id2, billableAmount: 999 });
    expect(useClientsStore.getState().getTotalBillable(id1)).toBe(100);
  });
});

describe("getTotalHours", () => {
  it("converts durationSeconds to hours correctly", () => {
    const store = useClientsStore.getState();
    const clientId = store.addClient({ name: "Accountant", billableRate: 300 });
    store.addEntry({ clientId, date: Date.now(), durationSeconds: 3600, wordCount: 400, billableAmount: 300 });
    store.addEntry({ clientId, date: Date.now(), durationSeconds: 1800, wordCount: 200, billableAmount: 150 });
    const hours = useClientsStore.getState().getTotalHours(clientId);
    expect(hours).toBeCloseTo(1.5);
  });

  it("returns 0 when there are no entries", () => {
    const store = useClientsStore.getState();
    const clientId = store.addClient({ name: "Empty", billableRate: 0 });
    expect(useClientsStore.getState().getTotalHours(clientId)).toBe(0);
  });
});
