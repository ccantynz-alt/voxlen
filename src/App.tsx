import { useState, useEffect, useCallback } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { DictationPanel } from "@/components/dictation/DictationPanel";
import { GrammarPanel } from "@/components/grammar/GrammarPanel";
import { HistoryPanel } from "@/components/dictation/HistoryPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { AdminPanel } from "@/components/settings/AdminPanel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useAudioStore } from "@/stores/audio";
import { useDictationStore } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { useHistoryStore } from "@/stores/history";

type View = "dictation" | "grammar" | "history" | "settings" | "admin";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dictation");
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const setDevices = useAudioStore((s) => s.setDevices);
  const theme = useSettingsStore((s) => s.theme);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else if (theme === "dark") {
      root.classList.remove("light");
      root.classList.add("dark");
    } else {
      // System preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
      root.classList.toggle("light", !prefersDark);

      const listener = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
        root.classList.toggle("light", !e.matches);
      };
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [theme]);

  // Apply font size to document
  const fontSize = useSettingsStore((s) => s.fontSize);
  useEffect(() => {
    document.documentElement.style.setProperty("--voxlen-font-size", `${fontSize}px`);
  }, [fontSize]);

  // Check if first launch
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
        const completed = localStorage.getItem("voxlen_onboarding_complete");
        setShowOnboarding(!completed);

        // Load saved settings from localStorage
        try {
          const saved = localStorage.getItem("voxlen_settings");
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

  // Load history on startup
  useEffect(() => {
    useHistoryStore.getState().loadFromStore();
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

    let unregisterFns: (() => void)[] = [];

    async function registerShortcuts() {
      try {
        const { register } = await import(
          "@tauri-apps/plugin-global-shortcut"
        );
        const settings = useSettingsStore.getState();

        // Toggle dictation shortcut
        await register(settings.shortcutToggle, (event) => {
          if (event.state === "Pressed") {
            const status = useDictationStore.getState().status;
            if (status === "idle") {
              useDictationStore.getState().setStatus("listening");
            } else {
              useDictationStore.getState().setStatus("idle");
            }
          }
        });

        // Push-to-talk shortcut
        await register(settings.shortcutPushToTalk, (event) => {
          if (event.state === "Pressed") {
            const status = useDictationStore.getState().status;
            if (status === "idle") {
              useDictationStore.getState().setStatus("listening");
              // Try to start capture
              import("@tauri-apps/api/core").then(({ invoke }) => {
                invoke("start_dictation").catch(() => {});
              });
            }
          } else if (event.state === "Released") {
            const status = useDictationStore.getState().status;
            if (status === "listening") {
              useDictationStore.getState().setStatus("idle");
              import("@tauri-apps/api/core").then(({ invoke }) => {
                invoke("stop_dictation").catch(() => {});
              });
            }
          }
        });

        // Grammar correction shortcut
        await register(settings.shortcutCorrectGrammar, (event) => {
          if (event.state === "Pressed") {
            const segments = useDictationStore.getState().segments;
            if (segments.length > 0) {
              const lastSegment = segments[segments.length - 1];
              const text = lastSegment.correctedText || lastSegment.text;
              import("@tauri-apps/api/core").then(({ invoke }) => {
                invoke("correct_grammar", { text })
                  .then((result: unknown) => {
                    const r = result as { corrected: string };
                    useDictationStore.getState().updateSegment(lastSegment.id, {
                      correctedText: r.corrected,
                      grammarApplied: true,
                    });
                  })
                  .catch(() => {});
              });
            }
          }
        });
      } catch {
        // Not in Tauri environment
      }
    }

    registerShortcuts();

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }, [showOnboarding]);

  // Listen for tray navigation events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const u = await listen<string>("navigate", (event) => {
          setActiveView(event.payload as View);
        });
        unlisten = u;
      } catch {
        // Not in Tauri
      }
    }
    setup();
    return () => unlisten?.();
  }, []);

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
        theme: settings.theme,
        fontSize: settings.fontSize,
        showWaveform: settings.showWaveform,
        injectionMode: settings.injectionMode,
        voiceCommandsEnabled: settings.voiceCommandsEnabled,
        shortcutToggle: settings.shortcutToggle,
        shortcutPushToTalk: settings.shortcutPushToTalk,
        shortcutCorrectGrammar: settings.shortcutCorrectGrammar,
      });
      await store.save();
    } catch {
      const settings = useSettingsStore.getState();
      localStorage.setItem("voxlen_settings", JSON.stringify({
        preferredDeviceId: settings.preferredDeviceId,
        sttEngine: settings.sttEngine,
        sttApiKey: settings.sttApiKey,
        theme: settings.theme,
        fontSize: settings.fontSize,
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
      case "admin":
        return <AdminPanel />;
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
