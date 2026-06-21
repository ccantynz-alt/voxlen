import { useEffect } from "react";
import { useSettingsStore, hydrateSecrets, type AppSettings } from "@/stores/settings";

export function usePersistedSettings() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load("settings.json");
        const saved = await store.get<Partial<AppSettings>>("settings");

        if (saved) {
          updateSettings(saved);
        }
      } catch {
        // Fallback to localStorage
        try {
          const saved = localStorage.getItem("voxlen_settings");
          if (saved) {
            const parsed = JSON.parse(saved) as Partial<AppSettings>;
            updateSettings(parsed);
          }
        } catch {
          // No saved settings
        }
      }
    }

    loadSettings().then(() => hydrateSecrets());
  }, [updateSettings]);
}
