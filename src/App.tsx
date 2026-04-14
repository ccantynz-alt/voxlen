import { useState, useEffect, useCallback } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { DictationPanel } from "@/components/dictation/DictationPanel";
import { GrammarPanel } from "@/components/grammar/GrammarPanel";
import { HistoryPanel } from "@/components/dictation/HistoryPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useAudioStore } from "@/stores/audio";
import { useDictationStore } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { usePersistedSettings } from "@/hooks/usePersistedSettings";

type View = "dictation" | "grammar" | "history" | "settings";

export default function App() {
  // Load saved settings from disk/localStorage on startup
  usePersistedSettings();
  const [activeView, setActiveView] = useState<View>("dictation");
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const setDevices = useAudioStore((s) => s.setDevices);

  // Check if first launch
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
    }
    checkFirstLaunch();
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

  // Register global shortcuts
  useEffect(() => {
    if (showOnboarding) return;

    async function registerShortcuts() {
      try {
        const { register } = await import(
          "@tauri-apps/plugin-global-shortcut"
        );

        // Toggle dictation: Ctrl/Cmd+Shift+D
        await register("CommandOrControl+Shift+D", (event) => {
          if (event.state === "Pressed") {
            const status = useDictationStore.getState().status;
            if (status === "idle") {
              useDictationStore.getState().setStatus("listening");
            } else {
              useDictationStore.getState().setStatus("idle");
            }
          }
        });

        // Push-to-talk: Ctrl/Cmd+Shift+Space — hold to dictate, release to stop
        await register("CommandOrControl+Shift+Space", (event) => {
          if (event.state === "Pressed") {
            const status = useDictationStore.getState().status;
            if (status === "idle") {
              useDictationStore.getState().setStatus("listening");
            }
          } else if (event.state === "Released") {
            const status = useDictationStore.getState().status;
            if (status === "listening" || status === "processing") {
              useDictationStore.getState().setStatus("idle");
            }
          }
        });

        // Grammar correction: Ctrl/Cmd+Shift+G — polish the current transcript
        await register("CommandOrControl+Shift+G", async () => {
          const segments = useDictationStore.getState().segments;
          if (segments.length === 0) return;
          const fullText = segments.map((s) => s.correctedText || s.text).join(" ");
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            const result = await invoke<{
              corrected: string;
              changes: Array<{ original: string; corrected: string; reason: string }>;
            }>("correct_grammar", { text: fullText });
            // Update the last segment with the corrected full text
            const lastSegment = segments[segments.length - 1];
            useDictationStore.getState().updateSegment(lastSegment.id, {
              correctedText: result.corrected,
              grammarApplied: true,
            });
          } catch {
            // Grammar correction not available
          }
        });
      } catch {
        // Not in Tauri environment
      }
    }

    registerShortcuts();
  }, [showOnboarding]);

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

    // Save current settings
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json");
      const settings = useSettingsStore.getState();
      await store.set("settings", {
        preferredDeviceId: settings.preferredDeviceId,
        sttEngine: settings.sttEngine,
        sttApiKey: settings.sttApiKey,
        grammarApiKey: settings.grammarApiKey,
        grammarProvider: settings.grammarProvider,
        writingStyle: settings.writingStyle,
      });
      await store.save();
    } catch {
      // Store in localStorage as fallback
      const settings = useSettingsStore.getState();
      localStorage.setItem("voxlen_settings", JSON.stringify({
        preferredDeviceId: settings.preferredDeviceId,
        sttEngine: settings.sttEngine,
        sttApiKey: settings.sttApiKey,
      }));
    }

    setShowOnboarding(false);
  }, []);

  const renderView = useCallback(() => {
    switch (activeView) {
      case "dictation":
        return <DictationPanel />;
      case "grammar":
        return <GrammarPanel />;
      case "history":
        return <HistoryPanel />;
      case "settings":
        return <SettingsPanel />;
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
