import { useState, useEffect, useCallback } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { ShortcutsCheatsheet } from "@/components/layout/ShortcutsCheatsheet";
import { DictationPanel } from "@/components/dictation/DictationPanel";
import { GrammarPanel } from "@/components/grammar/GrammarPanel";
import { HistoryPanel } from "@/components/dictation/HistoryPanel";
import { FlywheelPanel } from "@/components/flywheel/FlywheelPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { AdminPanel } from "@/components/settings/AdminPanel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { loadHistory } from "@/stores/history";
import { usePersistedSettings, saveSettings } from "@/hooks/usePersistedSettings";
import { useTauriEvents } from "@/hooks/useTauriEvents";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { loadFlywheel } from "@/stores/flywheel";

type View = "dictation" | "grammar" | "history" | "flywheel" | "settings" | "admin";

export default function App() {
  // Load saved settings from disk/localStorage on startup
  usePersistedSettings();
  const [activeView, setActiveView] = useState<View>("dictation");
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const setDevices = useAudioStore((s) => s.setDevices);
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light", "system");
    if (theme === "light") {
      root.classList.add("light");
    } else if (theme === "system") {
      root.classList.add("system");
    }
    // dark is the default (no class needed, :root vars apply)
  }, [theme]);

  // Apply font size as a CSS variable so all rem-based text scales uniformly.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-size", `${fontSize}px`);
  }, [fontSize]);

  // Load flywheel data on startup
  useEffect(() => {
    loadFlywheel();
  }, []);

  // Wire Tauri events (audio-level, waveform-samples, transcription, etc.).
  // Hook handles its own cleanup and is safe outside Tauri.
  useTauriEvents();

  // Register all global shortcuts; re-registers on setting changes.
  useGlobalShortcuts(showOnboarding === false);

  // Check if first launch + hydrate settings from backend
  useEffect(() => {
    async function checkFirstLaunch() {
      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load("settings.json");
        const hasCompletedOnboarding = await store.get<boolean>("onboarding_complete");
        setShowOnboarding(!hasCompletedOnboarding);

        // Load saved settings
        const savedSettings = await store.get<Record<string, unknown>>("settings");
        if (savedSettings) {
          useSettingsStore.getState().updateSettings(savedSettings);
        }
      } catch {
        // Not in Tauri - check localStorage
        const completed = localStorage.getItem("voxlen_onboarding_complete");
        setShowOnboarding(!completed);

        // Load saved settings from localStorage
        try {
          const saved = localStorage.getItem("marcoreid_settings");
          if (saved) {
            useSettingsStore.getState().updateSettings(JSON.parse(saved));
          }
        } catch {
          // ignore
        }
      }

    }
    checkFirstLaunch();
  }, []);

  // Persist settings on every change.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastSerialized = "";

    const unsub = useSettingsStore.subscribe((state) => {
      // Strip transient UI-only fields.
      const {
        isLoaded: _isLoaded,
        activeTab: _activeTab,
        updateSetting: _us,
        updateSettings: _uss,
        setActiveTab: _sat,
        resetToDefaults: _rtd,
        ...appSettings
      } = state;
      void _isLoaded; void _activeTab; void _us; void _uss; void _sat; void _rtd;

      const serialized = JSON.stringify(appSettings);
      if (serialized === lastSerialized) return;
      lastSerialized = serialized;

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        saveSettings(appSettings);
      }, 300);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  // Load history on startup
  useEffect(() => {
    loadHistory();
  }, []);

  // Load audio devices on mount (when not in onboarding)
  useEffect(() => {
    if (showOnboarding) return;

    async function init() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const devices = await invoke<
          Array<{
            id: string;
            name: string;
            is_default: boolean;
            is_external: boolean;
            sample_rate: number;
            channels: number;
          }>
        >("list_audio_devices");

        setDevices(
          devices.map((d) => ({
            id: d.id,
            name: d.name,
            isDefault: d.is_default,
            isExternal: d.is_external,
            sampleRate: d.sample_rate,
            channels: d.channels,
          }))
        );

        // Auto-select external mic if available
        const preferred = useSettingsStore.getState().preferredDeviceId;
        if (preferred) {
          useAudioStore.getState().setSelectedDevice(preferred);
        } else {
          const externalMic = devices.find((d) => d.is_external);
          if (externalMic) {
            useAudioStore.getState().setSelectedDevice(externalMic.id);
          } else {
            const defaultMic = devices.find((d) => d.is_default);
            if (defaultMic) {
              useAudioStore.getState().setSelectedDevice(defaultMic.id);
            }
          }
        }
      } catch {
        // Running outside Tauri - load demo devices
        setDevices([
          {
            id: "default",
            name: "Built-in Microphone",
            isDefault: true,
            isExternal: false,
            sampleRate: 44100,
            channels: 1,
          },
          {
            id: "razer-seiren",
            name: "Razer Seiren Mini",
            isDefault: false,
            isExternal: true,
            sampleRate: 48000,
            channels: 1,
          },
        ]);
        useAudioStore.getState().setSelectedDevice("razer-seiren");
      }
    }

    init();
  }, [setDevices, showOnboarding]);

  const handleOnboardingComplete = useCallback(async () => {
    // Save onboarding state
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json");
      await store.set("onboarding_complete", true);
      await store.save();
    } catch {
      localStorage.setItem("voxlen_onboarding_complete", "true");
    }

    // Save current settings through the persistence pipeline
    const state = useSettingsStore.getState();
    const {
      isLoaded: _isLoaded,
      activeTab: _activeTab,
      updateSetting: _us,
      updateSettings: _uss,
      setActiveTab: _sat,
      resetToDefaults: _rtd,
      ...appSettings
    } = state;
    void _isLoaded; void _activeTab; void _us; void _uss; void _sat; void _rtd;
    await saveSettings(appSettings);

    setShowOnboarding(false);
  }, []);

  const renderView = useCallback(() => {
    switch (activeView) {
      case "dictation":
        return (
          <ErrorBoundary label="Dictation">
            <DictationPanel />
          </ErrorBoundary>
        );
      case "grammar":
        return (
          <ErrorBoundary label="Grammar">
            <GrammarPanel />
          </ErrorBoundary>
        );
      case "history":
        return (
          <ErrorBoundary label="History">
            <HistoryPanel />
          </ErrorBoundary>
        );
      case "flywheel":
        return (
          <ErrorBoundary label="Flywheel">
            <FlywheelPanel />
          </ErrorBoundary>
        );
      case "settings":
        return (
          <ErrorBoundary label="Settings">
            <SettingsPanel />
          </ErrorBoundary>
        );
      case "admin":
        return (
          <ErrorBoundary label="Admin">
            <AdminPanel />
          </ErrorBoundary>
        );
    }
  }, [activeView]);

  // Still loading
  if (showOnboarding === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0">
        <div className="animate-pulse text-surface-600">Loading...</div>
      </div>
    );
  }

  // Show onboarding wizard for first-time users
  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0 rounded-xl overflow-hidden border border-surface-300/30">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeView={activeView}
          onViewChange={(v) => setActiveView(v as View)}
        />
        <main className="flex-1 min-w-0 overflow-hidden">{renderView()}</main>
      </div>
      <ShortcutsCheatsheet />
    </div>
  );
}
