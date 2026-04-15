import { useEffect } from "react";
import {
  Mic,
  Cpu,
  Keyboard,
  SpellCheck,
  Palette,
  Shield,
  Zap,
} from "lucide-react";
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
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "advanced", label: "Advanced", icon: Zap },
  { id: "privacy", label: "Privacy", icon: Shield },
];

export function SettingsPanel() {
  const settings = useSettingsStore();
  const setDevices = useAudioStore((s) => s.setDevices);

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
      case "shortcuts":
        return <ShortcutSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "advanced":
        return <AdvancedSettings />;
      case "privacy":
        return <PrivacySettings />;
      default:
        return <AudioSettings />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-48 border-r border-surface-300/50 py-3 px-2 space-y-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = settings.activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => settings.setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-marcoreid-600/10 text-marcoreid-400"
                  : "text-surface-700 hover:bg-surface-200"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings content */}
      <div className="flex-1 p-6 overflow-y-auto">{renderContent()}</div>
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
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-surface-950">{title}</h3>
      {description && (
        <p className="text-xs text-surface-600 mt-0.5">{description}</p>
      )}
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-900">
              Toggle Dictation
            </p>
            <p className="text-xs text-surface-600">Start/stop voice input</p>
          </div>
          <kbd className="px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-800">
            {settings.shortcutToggle.replace("CommandOrControl", "Ctrl/Cmd")}
          </kbd>
        </div>
      </SettingRow>

      <SettingRow>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-900">
              Push to Talk
            </p>
            <p className="text-xs text-surface-600">
              Hold to dictate, release to stop
            </p>
          </div>
          <kbd className="px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-800">
            {settings.shortcutPushToTalk.replace(
              "CommandOrControl",
              "Ctrl/Cmd"
            )}
          </kbd>
        </div>
      </SettingRow>

      <SettingRow>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-900">
              Correct Grammar
            </p>
            <p className="text-xs text-surface-600">
              Polish the last dictated text
            </p>
          </div>
          <kbd className="px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-800">
            {settings.shortcutCorrectGrammar.replace(
              "CommandOrControl",
              "Ctrl/Cmd"
            )}
          </kbd>
        </div>
      </SettingRow>

      <SettingRow>
        <Switch
          label="Voice Commands"
          description='Enable commands like "new line", "period", "delete that"'
          checked={settings.voiceCommandsEnabled}
          onChange={(v) => settings.updateSetting("voiceCommandsEnabled", v)}
        />
      </SettingRow>
    </div>
  );
}

function AppearanceSettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader title="Appearance" />

      <SettingRow>
        <Select
          label="Theme"
          value={settings.theme}
          onChange={(v) =>
            settings.updateSetting("theme", v as "dark" | "light" | "system")
          }
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "system", label: "System" },
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
          description="Display audio waveform visualization"
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
          onChange={(v) => settings.updateSetting("launchAtLogin", v)}
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
        description="Your data, your control. Marco Reid Voice can work fully offline with local models."
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

      <div className="rounded-lg bg-surface-200/50 p-4 mt-4">
        <h4 className="text-xs font-semibold text-surface-800 mb-2">
          Privacy Guarantee
        </h4>
        <ul className="space-y-1.5 text-xs text-surface-600">
          <li>Audio is never stored on our servers</li>
          <li>Use Whisper Local for fully offline operation</li>
          <li>API keys are stored locally in your system keychain</li>
          <li>No data is shared with third parties</li>
          <li>You can delete all local data at any time</li>
        </ul>
      </div>
    </div>
  );
}
