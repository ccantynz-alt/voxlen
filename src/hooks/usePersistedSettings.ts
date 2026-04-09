import { useEffect } from "react";
import { useSettingsStore, type AppSettings } from "@/stores/settings";

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
          const saved = localStorage.getItem("vox_settings");
          if (saved) {
            const parsed = JSON.parse(saved) as Partial<AppSettings>;
            updateSettings(parsed);
          }
        } catch {
          // No saved settings
        }
      }
    }

    loadSettings();
  }, [updateSettings]);
}

export async function saveSettings(settings: Partial<AppSettings>) {
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json");
    const existing = (await store.get<Partial<AppSettings>>("settings")) || {};
    await store.set("settings", { ...existing, ...settings });
    await store.save();
  } catch {
    try {
      const existing = JSON.parse(localStorage.getItem("vox_settings") || "{}");
      localStorage.setItem("vox_settings", JSON.stringify({ ...existing, ...settings }));
    } catch {
      // Ignore
    }
  }
}
