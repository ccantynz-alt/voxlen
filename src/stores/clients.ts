import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Client {
  id: string;
  name: string;
  matterNumber?: string;
  billableRate: number; // $/hr, 0 = use default
  color: string; // hex for UI identification
  archived: boolean;
  createdAt: number;
}

export interface MatterEntry {
  id: string;
  clientId: string;
  date: number; // epoch ms, start of session
  durationSeconds: number;
  wordCount: number;
  billableAmount: number; // $
  note?: string; // brief description of what was dictated
}

interface ClientsState {
  clients: Client[];
  activeClientId: string | null;
  entries: MatterEntry[];

  addClient: (client: Omit<Client, "id" | "createdAt" | "archived">) => string;
  updateClient: (id: string, updates: Partial<Client>) => void;
  archiveClient: (id: string) => void;
  deleteClient: (id: string) => void;
  setActiveClient: (id: string | null) => void;

  addEntry: (entry: Omit<MatterEntry, "id">) => void;
  deleteEntry: (id: string) => void;

  getClientEntries: (clientId: string) => MatterEntry[];
  getTotalBillable: (clientId: string) => number;
  getTotalHours: (clientId: string) => number;
}

const CLIENT_COLORS = [
  "#7345d1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
];

let colorIndex = 0;

function nextColor(): string {
  const c = CLIENT_COLORS[colorIndex % CLIENT_COLORS.length];
  colorIndex++;
  return c;
}

export const useClientsStore = create<ClientsState>()(
  persist(
    (set, get) => ({
      clients: [],
      activeClientId: null,
      entries: [],

      addClient: (data) => {
        const id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const client: Client = {
          ...data,
          id,
          color: data.color || nextColor(),
          archived: false,
          createdAt: Date.now(),
        };
        set((s) => ({ clients: [...s.clients, client] }));
        return id;
      },

      updateClient: (id, updates) => {
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
      },

      archiveClient: (id) => {
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id ? { ...c, archived: true } : c
          ),
          activeClientId: s.activeClientId === id ? null : s.activeClientId,
        }));
      },

      deleteClient: (id) => {
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          activeClientId: s.activeClientId === id ? null : s.activeClientId,
          entries: s.entries.filter((e) => e.clientId !== id),
        }));
      },

      setActiveClient: (id) => set({ activeClientId: id }),

      addEntry: (data) => {
        const id = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({ entries: [...s.entries, { ...data, id }] }));
      },

      deleteEntry: (id) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
      },

      getClientEntries: (clientId) => {
        return get().entries.filter((e) => e.clientId === clientId);
      },

      getTotalBillable: (clientId) => {
        return get()
          .entries.filter((e) => e.clientId === clientId)
          .reduce((sum, e) => sum + e.billableAmount, 0);
      },

      getTotalHours: (clientId) => {
        return (
          get()
            .entries.filter((e) => e.clientId === clientId)
            .reduce((sum, e) => sum + e.durationSeconds, 0) / 3600
        );
      },
    }),
    {
      name: "voxlen-clients",
      version: 1,
    }
  )
);
