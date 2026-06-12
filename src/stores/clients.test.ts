import { describe, it, expect, beforeEach } from "vitest";
import { useClientsStore, buildMatterContext } from "./clients";

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
    const id = store.addClient({ name: "Acme Corp", billableRate: 250, color: "" });
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
    const id = store.addClient({ name: "Old Name", billableRate: 100, color: "" });
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
    const id = store.addClient({ name: "To Archive", billableRate: 0, color: "" });
    useClientsStore.getState().archiveClient(id);
    const { clients } = useClientsStore.getState();
    expect(clients[0].archived).toBe(true);
  });

  it("clears activeClientId when the active client is archived", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Active", billableRate: 0, color: "" });
    useClientsStore.setState({ activeClientId: id });
    useClientsStore.getState().archiveClient(id);
    expect(useClientsStore.getState().activeClientId).toBeNull();
  });

  it("leaves activeClientId unchanged when a different client is archived", () => {
    const store = useClientsStore.getState();
    const id1 = store.addClient({ name: "Client A", billableRate: 0, color: "" });
    const id2 = store.addClient({ name: "Client B", billableRate: 0, color: "" });
    useClientsStore.setState({ activeClientId: id1 });
    useClientsStore.getState().archiveClient(id2);
    expect(useClientsStore.getState().activeClientId).toBe(id1);
  });
});

describe("addEntry and getTotalBillable", () => {
  it("addEntry stores the entry and getTotalBillable sums billableAmount", () => {
    const store = useClientsStore.getState();
    const clientId = store.addClient({ name: "Law Firm", billableRate: 500, color: "" });
    const base = { clientId, date: Date.now(), durationSeconds: 3600, wordCount: 500 };
    store.addEntry({ ...base, billableAmount: 500 });
    store.addEntry({ ...base, billableAmount: 250 });
    const total = useClientsStore.getState().getTotalBillable(clientId);
    expect(total).toBe(750);
  });

  it("getTotalBillable ignores entries from other clients", () => {
    const store = useClientsStore.getState();
    const id1 = store.addClient({ name: "Client 1", billableRate: 0, color: "" });
    const id2 = store.addClient({ name: "Client 2", billableRate: 0, color: "" });
    const base = { date: Date.now(), durationSeconds: 1800, wordCount: 200 };
    store.addEntry({ ...base, clientId: id1, billableAmount: 100 });
    store.addEntry({ ...base, clientId: id2, billableAmount: 999 });
    expect(useClientsStore.getState().getTotalBillable(id1)).toBe(100);
  });
});

describe("vocabulary", () => {
  it("adds terms to a client", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Law Corp", billableRate: 500, color: "" });
    store.addVocabularyTerm(id, "Smith v. Jones");
    store.addVocabularyTerm(id, "Exhibit A");
    const client = useClientsStore.getState().clients.find((c) => c.id === id);
    expect(client?.vocabulary).toEqual(["Smith v. Jones", "Exhibit A"]);
  });

  it("deduplicates terms", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Firm", billableRate: 400, color: "" });
    store.addVocabularyTerm(id, "GDPR");
    store.addVocabularyTerm(id, "GDPR");
    const client = useClientsStore.getState().clients.find((c) => c.id === id);
    expect(client?.vocabulary).toHaveLength(1);
  });

  it("removes terms", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Firm B", billableRate: 300, color: "" });
    store.addVocabularyTerm(id, "plaintiff");
    store.addVocabularyTerm(id, "defendant");
    store.removeVocabularyTerm(id, "plaintiff");
    const client = useClientsStore.getState().clients.find((c) => c.id === id);
    expect(client?.vocabulary).toEqual(["defendant"]);
  });

  it("ignores blank terms", () => {
    const store = useClientsStore.getState();
    const id = store.addClient({ name: "Firm C", billableRate: 200, color: "" });
    store.addVocabularyTerm(id, "  ");
    const client = useClientsStore.getState().clients.find((c) => c.id === id);
    expect(client?.vocabulary ?? []).toHaveLength(0);
  });
});

describe("buildMatterContext", () => {
  it("returns empty string for undefined client", () => {
    expect(buildMatterContext(undefined)).toBe("");
  });

  it("includes matter description, number and vocabulary", () => {
    const ctx = buildMatterContext({
      id: "x",
      name: "Test",
      matterNumber: "2024-001",
      matterDescription: "Contract dispute",
      vocabulary: ["Acme Inc", "Section 5.2"],
      billableRate: 0,
      color: "",
      archived: false,
      createdAt: 0,
    });
    expect(ctx).toContain("Contract dispute");
    expect(ctx).toContain("2024-001");
    expect(ctx).toContain("Acme Inc");
    expect(ctx).toContain("Section 5.2");
  });
});

describe("getTotalHours", () => {
  it("converts durationSeconds to hours correctly", () => {
    const store = useClientsStore.getState();
    const clientId = store.addClient({ name: "Accountant", billableRate: 300, color: "" });
    store.addEntry({ clientId, date: Date.now(), durationSeconds: 3600, wordCount: 400, billableAmount: 300 });
    store.addEntry({ clientId, date: Date.now(), durationSeconds: 1800, wordCount: 200, billableAmount: 150 });
    const hours = useClientsStore.getState().getTotalHours(clientId);
    expect(hours).toBeCloseTo(1.5);
  });

  it("returns 0 when there are no entries", () => {
    const store = useClientsStore.getState();
    const clientId = store.addClient({ name: "Empty", billableRate: 0, color: "" });
    expect(useClientsStore.getState().getTotalHours(clientId)).toBe(0);
  });
});
