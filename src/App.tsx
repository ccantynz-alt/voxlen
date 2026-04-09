import { useState, useEffect, useCallback } from "react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { DictationPanel } from "@/components/dictation/DictationPanel";
import { GrammarPanel } from "@/components/grammar/GrammarPanel";
import { HistoryPanel } from "@/components/dictation/HistoryPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useAudioStore } from "@/stores/audio";
import { useDictationStore } from "@/stores/dictation";

type View = "dictation" | "grammar" | "history" | "settings";

export default function App() {
  const [activeView, setActiveView] = useState<View>("dictation");
  const setDevices = useAudioStore((s) => s.setDevices);

  // Load audio devices on mount
  useEffect(() => {
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
        const externalMic = devices.find((d) => d.is_external);
        if (externalMic) {
          useAudioStore.getState().setSelectedDevice(externalMic.id);
        } else {
          const defaultMic = devices.find((d) => d.is_default);
          if (defaultMic) {
            useAudioStore.getState().setSelectedDevice(defaultMic.id);
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
  }, [setDevices]);

  // Register global shortcuts
  useEffect(() => {
    async function registerShortcuts() {
      try {
        const { register } = await import(
          "@tauri-apps/plugin-global-shortcut"
        );

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
      } catch {
        // Not in Tauri environment
      }
    }

    registerShortcuts();
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
