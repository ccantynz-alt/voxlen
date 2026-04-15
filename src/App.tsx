import { useState, useEffect, useCallback } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { DictationPanel } from "@/components/dictation/DictationPanel";
import { GrammarPanel } from "@/components/grammar/GrammarPanel";
import { HistoryPanel } from "@/components/dictation/HistoryPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { loadSettings, persistSettings } from "@/lib/settings";
import { useTauriEvents } from "@/hooks/useTauriEvents";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

type View = "dictation" | "grammar" | "history" | "settings";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dictation");
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const setDevices = useAudioStore((s) => s.setDevices);
  const updateSettingsStore = useSettingsStore((s) => s.updateSettings);

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
      } catch {
        // Not in Tauri - check localStorage
        const completed = localStorage.getItem("voxlen_onboarding_complete");
        setShowOnboarding(!completed);
      }

      // Hydrate settings from backend on boot.
      try {
        const backendSettings = await loadSettings();
        if (backendSettings) {
          updateSettingsStore(backendSettings);
        }
      } catch {
        // Already handled inside loadSettings.
      }
    }
    checkFirstLaunch();
  }, [updateSettingsStore]);

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
        persistSettings(appSettings);
      }, 300);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsub();
    };
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
    await persistSettings(appSettings);

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
      case "settings":
        return (
          <ErrorBoundary label="Settings">
            <SettingsPanel />
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
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
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
    </div>
  );
}
