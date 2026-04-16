import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type Tier = "free" | "pro" | "professional" | "lifetime";

export interface LicenseStatus {
  tier: Tier;
  email: string | null;
  expires: number | null;
  valid: boolean;
  reason: string | null;
}

export interface EntitlementState {
  tier: Tier;
  email: string | null;
  expires: number | null;
  valid: boolean;
  reason: string | null;
  isLoaded: boolean;

  /** Fetch the current license status from the Rust side. Called on app start. */
  refresh: () => Promise<void>;
  /** Attempt to activate a pasted license key. Returns an error message on failure. */
  activate: (key: string) => Promise<string | null>;
  /** Remove the installed license and drop back to Free. */
  clear: () => Promise<void>;
}

const FREE_STATUS: LicenseStatus = {
  tier: "free",
  email: null,
  expires: null,
  valid: true,
  reason: null,
};

function apply(set: (p: Partial<EntitlementState>) => void, s: LicenseStatus) {
  set({
    tier: s.tier,
    email: s.email,
    expires: s.expires,
    valid: s.valid,
    reason: s.reason,
    isLoaded: true,
  });
}

export const useEntitlementStore = create<EntitlementState>((set) => ({
  tier: "free",
  email: null,
  expires: null,
  valid: true,
  reason: null,
  isLoaded: false,

  refresh: async () => {
    try {
      const status = await invoke<LicenseStatus>("get_license_status");
      apply(set, status);
    } catch (e) {
      console.error("Failed to load license status:", e);
      apply(set, FREE_STATUS);
    }
  },

  activate: async (key: string) => {
    try {
      const status = await invoke<LicenseStatus>("activate_license", { key });
      apply(set, status);
      return null;
    } catch (e) {
      const msg = typeof e === "string" ? e : e instanceof Error ? e.message : "License activation failed";
      return msg;
    }
  },

  clear: async () => {
    try {
      const status = await invoke<LicenseStatus>("clear_license");
      apply(set, status);
    } catch (e) {
      console.error("Failed to clear license:", e);
      apply(set, FREE_STATUS);
    }
  },
}));

/** Convenience selector: true if the user has any paid tier. */
export const isPaid = (tier: Tier) => tier !== "free";

/** Free-tier weekly word cap. Keep in sync with landing page copy. */
export const FREE_WEEKLY_WORD_CAP = 500;
