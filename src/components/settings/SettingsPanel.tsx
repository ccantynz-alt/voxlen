import { useEffect, useState, useCallback, useRef } from "react";
import {
  Mic,
  Cpu,
  Keyboard,
  SpellCheck,
  Palette,
  Shield,
  Zap,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { LicenseSettings } from "./LicenseSettings";
import { FlywheelSettings } from "./FlywheelSettings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Input } from "@/components/ui/Input";
import { useSettingsStore } from "@/stores/settings";
import { useAudioStore } from "@/stores/audio";
import { SUPPORTED_LANGUAGES, STT_ENGINES } from "@/lib/constants";

const tabs = [
  { id: "audio", label: "Audio", icon: Mic },
  { id: "stt", label: "Speech Engine", icon: Cpu },
  { id: "grammar", label: "Grammar AI", icon: SpellCheck },
  { id: "learning", label: "Learning", icon: Sparkles },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "advanced", label: "Advanced", icon: Zap },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "license", label: "License", icon: KeyRound },
];

// Persist settings whenever they change
function useSettingsPersistence() {
  const settings = useSettingsStore();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const saveSettings = async () => {
      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load("settings.json");
        await store.set("settings", {
          preferredDeviceId: settings.preferredDeviceId,
          inputGain: settings.inputGain,
          noiseSuppression: settings.noiseSuppression,
          sttEngine: settings.sttEngine,
          sttApiKey: settings.sttApiKey,
          sttLanguage: settings.sttLanguage,
          autoDetectLanguage: settings.autoDetectLanguage,
          grammarEnabled: settings.grammarEnabled,
          grammarApiKey: settings.grammarApiKey,
          grammarProvider: settings.grammarProvider,
          writingStyle: settings.writingStyle,
          autoCorrect: settings.autoCorrect,
          preserveTone: settings.preserveTone,
          autoPunctuate: settings.autoPunctuate,
          smartFormat: settings.smartFormat,
          voiceCommandsEnabled: settings.voiceCommandsEnabled,
          injectionMode: settings.injectionMode,
          shortcutToggle: settings.shortcutToggle,
          shortcutPushToTalk: settings.shortcutPushToTalk,
          shortcutCancel: settings.shortcutCancel,
          shortcutCorrectGrammar: settings.shortcutCorrectGrammar,
          theme: settings.theme,
          showWaveform: settings.showWaveform,
          fontSize: settings.fontSize,
          startMinimized: settings.startMinimized,
          minimizeToTray: settings.minimizeToTray,
          launchAtLogin: settings.launchAtLogin,
          telemetryEnabled: settings.telemetryEnabled,
          saveTranscripts: settings.saveTranscripts,
        });
        await store.save();
      } catch {
        try {
          localStorage.setItem(
            "voxlen_settings",
            JSON.stringify({
              preferredDeviceId: settings.preferredDeviceId,
              sttEngine: settings.sttEngine,
              sttApiKey: settings.sttApiKey,
              grammarApiKey: settings.grammarApiKey,
              grammarProvider: settings.grammarProvider,
              writingStyle: settings.writingStyle,
              theme: settings.theme,
              fontSize: settings.fontSize,
              showWaveform: settings.showWaveform,
              voiceCommandsEnabled: settings.voiceCommandsEnabled,
              injectionMode: settings.injectionMode,
              shortcutToggle: settings.shortcutToggle,
              shortcutPushToTalk: settings.shortcutPushToTalk,
              shortcutCorrectGrammar: settings.shortcutCorrectGrammar,
            })
          );
        } catch {
          // Storage unavailable
        }
      }
    };

    const timeout = setTimeout(saveSettings, 500);
    return () => clearTimeout(timeout);
  });
}

export function SettingsPanel() {
  const settings = useSettingsStore();
  const setDevices = useAudioStore((s) => s.setDevices);

  useSettingsPersistence();

  // Load audio devices
  useEffect(() => {
    async function loadDevices() {
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
      } catch {
        // Demo devices
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
      }
    }
    loadDevices();
  }, [setDevices]);

  const renderContent = () => {
    switch (settings.activeTab) {
      case "audio":
        return <AudioSettings />;
      case "stt":
        return <SttSettings />;
      case "grammar":
        return <GrammarSettings />;
      case "learning":
        return <FlywheelSettings />;
      case "shortcuts":
        return <ShortcutSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "advanced":
        return <AdvancedSettings />;
      case "privacy":
        return <PrivacySettings />;
      case "license":
        return <LicenseSettings />;
      default:
        return <AudioSettings />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-52 border-r border-surface-300/50 py-4 px-3 space-y-0.5 bg-surface-50/30">
        <div className="px-1 pb-2">
          <span className="label-caps">Settings</span>
        </div>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = settings.activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => settings.setActiveTab(tab.id)}
              className={cn(
                "group relative flex items-center gap-2.5 w-full pl-4 pr-3 py-2 rounded-md text-sm transition-all duration-200",
                isActive
                  ? "bg-marcoreid-900/40 text-surface-950"
                  : "text-surface-700 hover:bg-surface-100/80 hover:text-surface-900"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brass-400" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-brass-400" : "text-surface-600 group-hover:text-surface-800"
                )}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span className={cn("font-medium tracking-tight", isActive && "text-surface-950")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Settings content */}
      <div className="flex-1 p-8 overflow-y-auto">{renderContent()}</div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="font-display text-[18px] font-medium tracking-tight-display text-surface-950 leading-tight">
        {title}
      </h3>
      {description && (
        <p className="text-[12px] text-surface-600 mt-1 leading-relaxed max-w-md">
          {description}
        </p>
      )}
      <div className="divider-brass w-16 mt-3" />
    </div>
  );
}

function SettingRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-surface-300/30 last:border-0">
      {children}
    </div>
  );
}

// Shortcut recorder component
function ShortcutRecorder({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (shortcut: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();
      e.stopPropagation();

      const newKeys = new Set(keys);
      const key = e.key;

      // Map modifier keys
      if (e.ctrlKey || e.metaKey) newKeys.add("CommandOrControl");
      if (e.shiftKey) newKeys.add("Shift");
      if (e.altKey) newKeys.add("Alt");

      // Add non-modifier key
      if (!["Control", "Meta", "Shift", "Alt"].includes(key)) {
        newKeys.add(key.length === 1 ? key.toUpperCase() : key);
      }

      setKeys(newKeys);
    },
    [recording, keys]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();

      // Build shortcut string when a non-modifier key was pressed
      const modifiers: string[] = [];
      const regular: string[] = [];

      keys.forEach((k) => {
        if (["CommandOrControl", "Shift", "Alt"].includes(k)) {
          modifiers.push(k);
        } else {
          regular.push(k);
        }
      });

      if (modifiers.length > 0 && regular.length > 0) {
        const shortcut = [...modifiers, ...regular].join("+");
        onChange(shortcut);
        setRecording(false);
        setKeys(new Set());
      }
    },
    [recording, keys, onChange]
  );

  useEffect(() => {
    if (recording) {
      window.addEventListener("keydown", handleKeyDown, true);
      window.addEventListener("keyup", handleKeyUp, true);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [recording, handleKeyDown, handleKeyUp]);

  const displayValue = value
    .replace("CommandOrControl", "Ctrl/Cmd")
    .replace("Shift", "Shift")
    .replace("Alt", "Alt");

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-surface-900 tracking-tight">{label}</p>
        <p className="text-[11px] text-surface-600 mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        ref={inputRef}
        onClick={() => {
          setRecording(!recording);
          setKeys(new Set());
        }}
        className={cn(
          "px-3 py-1.5 rounded-md border text-[11px] font-mono transition-all min-w-[140px] text-center shadow-inset-hairline",
          recording
            ? "bg-brass-400/10 border-brass-400/50 text-brass-500 animate-pulse-soft"
            : "bg-surface-50 border-surface-300/70 text-surface-800 hover:border-surface-400"
        )}
      >
        {recording
          ? keys.size > 0
            ? Array.from(keys).join(" + ")
            : "Press keys…"
          : displayValue}
      </button>
    </div>
  );
}

function AudioSettings() {
  const devices = useAudioStore((s) => s.devices);
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="Microphone"
        description="Select your preferred input device. External mics are recommended for best accuracy."
      />

      <SettingRow>
        <Select
          label="Input Device"
          value={settings.preferredDeviceId || ""}
          onChange={(v) => settings.updateSetting("preferredDeviceId", v || null)}
          options={devices.map((d) => ({
            value: d.id,
            label: d.name,
            description: `${d.sampleRate / 1000}kHz ${d.channels}ch${d.isExternal ? " - External" : ""}`,
            icon: d.isExternal ? (
              <Mic className="h-4 w-4 text-marcoreid-400" />
            ) : (
              <Mic className="h-4 w-4 text-surface-600" />
            ),
          }))}
          placeholder="Select microphone..."
        />
      </SettingRow>

      <SettingRow>
        <Slider
          label="Input Gain"
          value={settings.inputGain}
          onChange={(v) => settings.updateSetting("inputGain", v)}
          min={0.1}
          max={3.0}
          step={0.1}
          formatValue={(v) => `${Math.round(v * 100)}%`}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Noise Suppression"
          description="AI-powered noise reduction for cleaner audio input"
          checked={settings.noiseSuppression}
          onChange={(v) => settings.updateSetting("noiseSuppression", v)}
        />
      </SettingRow>
    </div>
  );
}

function SttSettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="Speech-to-Text Engine"
        description="Choose your transcription engine. Cloud engines offer better accuracy; local offers privacy."
      />

      <SettingRow>
        <Select
          label="Engine"
          value={settings.sttEngine}
          onChange={(v) => settings.updateSetting("sttEngine", v)}
          options={Object.values(STT_ENGINES).map((e) => ({
            value: e.id,
            label: e.name,
            description: e.description,
          }))}
        />
      </SettingRow>

      <SettingRow>
        <Input
          label="API Key"
          type="password"
          value={settings.sttApiKey}
          onChange={(e) => settings.updateSetting("sttApiKey", e.target.value)}
          placeholder="Enter your API key..."
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Auto-Detect Language"
          description="Automatically identify the spoken language"
          checked={settings.autoDetectLanguage}
          onChange={(v) => settings.updateSetting("autoDetectLanguage", v)}
        />
      </SettingRow>

      {!settings.autoDetectLanguage && (
        <SettingRow>
          <Select
            label="Language"
            value={settings.sttLanguage}
            onChange={(v) => settings.updateSetting("sttLanguage", v)}
            options={SUPPORTED_LANGUAGES.map((l) => ({
              value: l.code,
              label: `${l.flag} ${l.name}`,
            }))}
          />
        </SettingRow>
      )}

      <SettingRow>
        <Switch
          label="Auto-Punctuate"
          description="Automatically add punctuation to transcriptions"
          checked={settings.autoPunctuate}
          onChange={(v) => settings.updateSetting("autoPunctuate", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Smart Formatting"
          description="Intelligently format numbers, dates, addresses, etc."
          checked={settings.smartFormat}
          onChange={(v) => settings.updateSetting("smartFormat", v)}
        />
      </SettingRow>
    </div>
  );
}

function GrammarSettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="AI Grammar Engine"
        description="Uses Claude or OpenAI to automatically polish your text. Like Grammarly, but powered by the best AI."
      />

      <SettingRow>
        <Switch
          label="Enable Grammar Correction"
          description="Automatically correct grammar and style in dictated text"
          checked={settings.grammarEnabled}
          onChange={(v) => settings.updateSetting("grammarEnabled", v)}
        />
      </SettingRow>

      <SettingRow>
        <Select
          label="AI Provider"
          value={settings.grammarProvider}
          onChange={(v) =>
            settings.updateSetting(
              "grammarProvider",
              v as "claude" | "openai"
            )
          }
          options={[
            {
              value: "claude",
              label: "Claude (Anthropic)",
              description: "Best quality, most natural corrections",
            },
            {
              value: "openai",
              label: "OpenAI GPT",
              description: "Fast, reliable corrections",
            },
          ]}
        />
      </SettingRow>

      <SettingRow>
        <Input
          label="AI API Key"
          type="password"
          value={settings.grammarApiKey}
          onChange={(e) =>
            settings.updateSetting("grammarApiKey", e.target.value)
          }
          placeholder={
            settings.grammarProvider === "claude"
              ? "sk-ant-..."
              : "sk-..."
          }
        />
      </SettingRow>

      <SettingRow>
        <Select
          label="Writing Style"
          value={settings.writingStyle}
          onChange={(v) =>
            settings.updateSetting(
              "writingStyle",
              v as typeof settings.writingStyle
            )
          }
          options={[
            { value: "professional", label: "Professional", description: "Polished business communication" },
            { value: "casual", label: "Casual", description: "Friendly, everyday language" },
            { value: "academic", label: "Academic", description: "Formal scholarly writing" },
            { value: "creative", label: "Creative", description: "Expressive, artistic writing" },
            { value: "technical", label: "Technical", description: "Precise, technical documentation" },
          ]}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Auto-Correct"
          description="Automatically apply corrections without asking"
          checked={settings.autoCorrect}
          onChange={(v) => settings.updateSetting("autoCorrect", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Preserve Tone"
          description="Keep your natural voice and personality in corrections"
          checked={settings.preserveTone}
          onChange={(v) => settings.updateSetting("preserveTone", v)}
        />
      </SettingRow>
    </div>
  );
}

function ShortcutSettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="Global Shortcuts"
        description="These shortcuts work from any application, even when Marco Reid Voice is minimized."
      />

      <SettingRow>
        <ShortcutRecorder
          label="Toggle Dictation"
          description="Start/stop voice input"
          value={settings.shortcutToggle}
          onChange={(v) => settings.updateSetting("shortcutToggle", v)}
        />
      </SettingRow>

      <SettingRow>
        <ShortcutRecorder
          label="Push to Talk"
          description="Hold to dictate, release to stop"
          value={settings.shortcutPushToTalk}
          onChange={(v) => settings.updateSetting("shortcutPushToTalk", v)}
        />
      </SettingRow>

      <SettingRow>
        <ShortcutRecorder
          label="Correct Grammar"
          description="Polish the last dictated text"
          value={settings.shortcutCorrectGrammar}
          onChange={(v) => settings.updateSetting("shortcutCorrectGrammar", v)}
        />
      </SettingRow>

      <SettingRow>
        <ShortcutRecorder
          label="Cancel"
          description="Cancel current operation"
          value={settings.shortcutCancel}
          onChange={(v) => settings.updateSetting("shortcutCancel", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Voice Commands"
          description='Enable commands like "new line", "period", "delete that"'
          checked={settings.voiceCommandsEnabled}
          onChange={(v) => settings.updateSetting("voiceCommandsEnabled", v)}
        />
      </SettingRow>

      <div className="rounded-md bg-surface-50/60 border border-surface-300/50 shadow-inset-hairline p-4 mt-2">
        <h4 className="label-caps mb-3 block">
          Available Voice Commands
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-surface-700 font-mono">
          <span><span className="text-brass-500/80">&ldquo;</span>new line<span className="text-brass-500/80">&rdquo;</span> &mdash; line break</span>
          <span><span className="text-brass-500/80">&ldquo;</span>new paragraph<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>period<span className="text-brass-500/80">&rdquo;</span> / <span className="text-brass-500/80">&ldquo;</span>full stop<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>comma<span className="text-brass-500/80">&rdquo;</span> / <span className="text-brass-500/80">&ldquo;</span>question mark<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>delete that<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>undo<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>select all<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>copy that<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>stop listening<span className="text-brass-500/80">&rdquo;</span></span>
          <span><span className="text-brass-500/80">&ldquo;</span>caps on/off<span className="text-brass-500/80">&rdquo;</span></span>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader title="Appearance" description="Customize how Voxlen looks." />

      <SettingRow>
        <Select
          label="Theme"
          value={settings.theme}
          onChange={(v) =>
            settings.updateSetting("theme", v as "dark" | "light" | "system")
          }
          options={[
            { value: "dark", label: "Dark", description: "Easy on the eyes" },
            { value: "light", label: "Light", description: "Bright and clear" },
            { value: "system", label: "System", description: "Match your OS setting" },
          ]}
        />
      </SettingRow>

      <SettingRow>
        <Slider
          label="Font Size"
          value={settings.fontSize}
          onChange={(v) => settings.updateSetting("fontSize", v)}
          min={10}
          max={24}
          step={1}
          formatValue={(v) => `${v}px`}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Show Waveform"
          description="Display audio waveform visualization during dictation"
          checked={settings.showWaveform}
          onChange={(v) => settings.updateSetting("showWaveform", v)}
        />
      </SettingRow>
    </div>
  );
}

function AdvancedSettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="Advanced"
        description="Text injection and startup options"
      />

      <SettingRow>
        <Select
          label="Text Injection Mode"
          value={settings.injectionMode}
          onChange={(v) =>
            settings.updateSetting(
              "injectionMode",
              v as "keyboard" | "clipboard" | "buffer"
            )
          }
          options={[
            {
              value: "keyboard",
              label: "Keyboard Simulation",
              description:
                "Types text character by character into the active app",
            },
            {
              value: "clipboard",
              label: "Clipboard Paste",
              description: "Copies to clipboard and pastes (faster)",
            },
            {
              value: "buffer",
              label: "Buffer Only",
              description: "Text stays in Marco Reid Voice - copy manually",
            },
          ]}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Start Minimized"
          description="Launch Marco Reid Voice minimized to the system tray"
          checked={settings.startMinimized}
          onChange={(v) => settings.updateSetting("startMinimized", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Minimize to Tray"
          description="Keep Marco Reid Voice running in the system tray when closed"
          checked={settings.minimizeToTray}
          onChange={(v) => settings.updateSetting("minimizeToTray", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Launch at Login"
          description="Automatically start Marco Reid Voice when you log in"
          checked={settings.launchAtLogin}
          onChange={async (v) => {
            settings.updateSetting("launchAtLogin", v);
            try {
              const { invoke } = await import("@tauri-apps/api/core");
              if (v) {
                await invoke("plugin:autostart|enable");
              } else {
                await invoke("plugin:autostart|disable");
              }
            } catch {
              // Not in Tauri or plugin not available
            }
          }}
        />
      </SettingRow>

      <div className="pt-4">
        <Button
          variant="danger"
          size="sm"
          onClick={() => settings.resetToDefaults()}
        >
          Reset All Settings
        </Button>
      </div>
    </div>
  );
}

function PrivacySettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="Privacy"
        description="Your data, your control. Audio streams device-to-provider on zero-retention endpoints — never routed through Voxlen servers."
      />

      <SettingRow>
        <Switch
          label="Save Transcripts"
          description="Store dictation history locally on your device"
          checked={settings.saveTranscripts}
          onChange={(v) => settings.updateSetting("saveTranscripts", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Usage Analytics"
          description="Help us improve Marco Reid Voice with anonymous usage data"
          checked={settings.telemetryEnabled}
          onChange={(v) => settings.updateSetting("telemetryEnabled", v)}
        />
      </SettingRow>

      <div className="rounded-md bg-surface-50/60 border border-surface-300/50 shadow-inset-hairline p-4 mt-4">
        <h4 className="label-caps mb-3 block">
          Privacy Guarantee
        </h4>
        <ul className="space-y-1.5 text-[12px] text-surface-700 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            Audio never passes through Voxlen servers. It streams direct to the speech provider on zero-retention endpoints.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            Grammar text goes direct to Anthropic or OpenAI on zero-retention endpoints.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            API keys and your licence live in your OS keychain (Keychain / Credential Manager / Secret Service).
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            Learned vocabulary and correction patterns stay on this device and never leave it.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            You can delete all local data any time — transcripts, learning data, or the whole settings store.
          </li>
        </ul>
      </div>
    </div>
  );
}
