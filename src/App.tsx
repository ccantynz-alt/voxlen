import { useState, useEffect, useCallback } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { DictationPanel } from "@/components/dictation/DictationPanel";
import { GrammarPanel } from "@/components/grammar/GrammarPanel";
import { HistoryPanel } from "@/components/dictation/HistoryPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { AdminPanel } from "@/components/settings/AdminPanel";
import { ClauseLibrary } from "@/components/clauses/ClauseLibrary";
import { ClientsPanel } from "@/components/clients/ClientsPanel";
import { AnalyticsPanel } from "@/components/analytics/AnalyticsPanel";
import { FlywheelPanel } from "@/components/flywheel/FlywheelPanel";
import { MeetingPanel } from "@/components/meeting/MeetingPanel";
import { ReviewQueuePanel } from "@/components/review/ReviewQueuePanel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { loadHistory } from "@/stores/history";
import { loadFlywheel } from "@/stores/flywheel";
import { loadSettings, persistSettings } from "@/lib/settings";
import { useTauriEvents } from "@/hooks/useTauriEvents";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { loadCustomClauses } from "@/stores/clauses";
import { useNavigationStore } from "@/stores/navigation";
import { ToastContainer } from "@/components/ui/Toast";

type View =
  | "dictation"
  | "grammar"
  | "history"
  | "review"
  | "clauses"
  | "clients"
  | "meeting"
  | "analytics"
  | "flywheel"
  | "admin"
  | "settings";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dictation");
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const setDevices = useAudioStore((s) => s.setDevices);
  const hydrateSettingsStore = useSettingsStore((s) => s.hydrateSettings);
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const { pendingView, clearPendingView } = useNavigationStore();

  useEffect(() => {
    if (pendingView) {
      setActiveView(pendingView as View);
      clearPendingView();
    }
  }, [pendingView, clearPendingView]);

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

  // Load flywheel and clause data on startup, then run the one-time
  // migration of legacy flywheel time entries into the clients store.
  useEffect(() => {
    loadFlywheel().then(async () => {
      try {
        const { migrateLegacyTimeEntries } = await import("@/lib/migrateBilling");
        await migrateLegacyTimeEntries();
      } catch (err) {
        console.error("Legacy time-entry migration failed:", err);
      }
    });
    loadCustomClauses();
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
          useSettingsStore.getState().hydrateSettings(savedSettings);
        }
      } catch {
        // Not in Tauri - check localStorage
        let completed = localStorage.getItem("voxlen_onboarding_complete");
        if (!completed && localStorage.getItem("marcoreid_onboarding_complete")) {
          completed = "true";
          localStorage.setItem("voxlen_onboarding_complete", "true");
          localStorage.removeItem("marcoreid_onboarding_complete");
        }
        setShowOnboarding(!completed);

        // Load saved settings from localStorage
        try {
          const saved = localStorage.getItem("voxlen_settings");
          if (saved) {
            useSettingsStore.getState().hydrateSettings(JSON.parse(saved));
          }
        } catch {
          // ignore
        }
      }

      // Hydrate ONLY the API keys from the backend on boot. The backend's
      // get_settings returns Rust defaults for everything except the keys it
      // hydrates from the OS keychain — merging the full object would wipe
      // the user's saved settings back to defaults on every launch (which it
      // did, for months). The frontend settings.json is the source of truth
      // for everything else; the persist subscriber below pushes the merged
      // result back to the Rust engine.
      try {
        const backendSettings = await loadSettings();
        if (backendSettings) {
          const keysOnly: Record<string, unknown> = {};
          if (backendSettings.sttApiKey) keysOnly.sttApiKey = backendSettings.sttApiKey;
          if (backendSettings.grammarApiKey) keysOnly.grammarApiKey = backendSettings.grammarApiKey;
          if (backendSettings.voxlenApiKey) keysOnly.voxlenApiKey = backendSettings.voxlenApiKey;
          if (Object.keys(keysOnly).length > 0) {
            hydrateSettingsStore(keysOnly);
          }
        }
      } catch {
        // Already handled inside loadSettings.
      }
    }
    checkFirstLaunch();
  }, [hydrateSettingsStore]);

  // Persist settings on every change.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastSerialized = "";

    const unsub = useSettingsStore.subscribe((state) => {
      // Strip transient UI-only fields.
      const {
        activeTab: _activeTab,
        updateSetting: _us,
        updateSettings: _uss,
        hydrateSettings: _hs,
        setActiveTab: _sat,
        resetToDefaults: _rtd,
        ...appSettings
      } = state;
      void _activeTab; void _us; void _uss; void _hs; void _sat; void _rtd;

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

        // Auto-select external mic if available. Any pick made here (not just
        // an explicit Settings change) is written through settings.updateSetting
        // so it reaches the Rust audio engine via update_settings and survives
        // restarts — otherwise the choice only ever lived in this UI store and
        // capture kept silently falling back to the OS default input device.
        const preferred = useSettingsStore.getState().preferredDeviceId;
        if (preferred) {
          useAudioStore.getState().setSelectedDevice(preferred);
        } else {
          const externalMic = devices.find((d) => d.is_external);
          if (externalMic) {
            useAudioStore.getState().setSelectedDevice(externalMic.id);
            useSettingsStore.getState().updateSetting("preferredDeviceId", externalMic.id);
          } else {
            const defaultMic = devices.find((d) => d.is_default);
            if (defaultMic) {
              useAudioStore.getState().setSelectedDevice(defaultMic.id);
              useSettingsStore.getState().updateSetting("preferredDeviceId", defaultMic.id);
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
      localStorage.removeItem("marcoreid_onboarding_complete");
    }

    // Save current settings through the persistence pipeline
    const state = useSettingsStore.getState();
    const {
      activeTab: _activeTab,
      updateSetting: _us,
      updateSettings: _uss,
      hydrateSettings: _hs,
      setActiveTab: _sat,
      resetToDefaults: _rtd,
      ...appSettings
    } = state;
    void _activeTab; void _us; void _uss; void _hs; void _sat; void _rtd;
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
      case "review":
        return (
          <ErrorBoundary label="Review">
            <ReviewQueuePanel />
          </ErrorBoundary>
        );
      case "meeting":
        return (
          <ErrorBoundary label="Meeting">
            <MeetingPanel />
          </ErrorBoundary>
        );
      case "clauses":
        return (
          <ErrorBoundary label="Clauses">
            <ClauseLibrary />
          </ErrorBoundary>
        );
      case "clients":
        return (
          <ErrorBoundary label="Clients">
            <ClientsPanel />
          </ErrorBoundary>
        );
      case "analytics":
        return (
          <ErrorBoundary label="Analytics">
            <AnalyticsPanel />
          </ErrorBoundary>
        );
      case "flywheel":
        return (
          <ErrorBoundary label="Flywheel">
            <FlywheelPanel />
          </ErrorBoundary>
        );
      case "admin":
        return (
          <ErrorBoundary label="Admin">
            <AdminPanel />
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
    <>
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
      <ToastContainer />
    </>
  );
}
