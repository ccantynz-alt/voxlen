import { create } from "zustand";

type View = "dictation" | "history" | "grammar" | "analytics" | "clients" | "flywheel" | "clauses" | "meeting" | "settings";

interface NavigationState {
  pendingView: View | null;
  requestView: (view: View) => void;
  clearPendingView: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  pendingView: null,
  requestView: (view) => set({ pendingView: view }),
  clearPendingView: () => set({ pendingView: null }),
}));
