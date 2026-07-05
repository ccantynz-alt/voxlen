import { useEffect, useState, useCallback, useRef } from "react";
import {
  Mic,
  Cpu,
  Keyboard,
  SpellCheck,
  Palette,
  Shield,
  Zap,
  Globe,
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
  { id: "voxlen-api", label: "Account", icon: Globe },
  { id: "audio", label: "Audio", icon: Mic },
  { id: "stt", label: "Speech Engine", icon: Cpu },
  { id: "grammar", label: "Grammar AI", icon: SpellCheck },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "advanced", label: "Advanced", icon: Zap },
  { id: "privacy", label: "Privacy", icon: Shield },
];

export function SettingsPanel({ onReopenSetup }: { onReopenSetup?: () => void } = {}) {
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
        return <AdvancedSettings onReopenSetup={onReopenSetup} />;
      case "privacy":
        return <PrivacySettings />;
      case "voxlen-api":
        return <VoxlenApiSettings />;
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
        description="Choose your transcription engine. Offline mode (Whisper Local) is coming soon."
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
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${settings.voxlenApiKey ? "bg-purple-500/10 border border-purple-500/30 text-purple-300" : "bg-surface-100 border border-surface-300/50 text-surface-500"}`}>
          {settings.voxlenApiKey ? (
            <><span className="text-green-400">✓</span> Transcription powered by your Voxlen account — no provider API key needed.</>
          ) : (
            <><span className="text-surface-400">→</span> Sign in to your Voxlen account (Voxlen tab) to enable transcription.</>
          )}
        </div>
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

      <SettingRow>
        <Switch
          label="Speaker Diarization"
          description="Label each speaker separately in multi-person recordings (Deepgram only)."
          checked={settings.speakerDiarization}
          onChange={(v) => settings.updateSetting("speakerDiarization", v)}
        />
      </SettingRow>

      <SettingRow>
        <CustomVocabularyEditor />
      </SettingRow>
    </div>
  );
}

function CustomVocabularyEditor() {
  const vocabulary = useSettingsStore((s) => s.customVocabulary);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [draft, setDraft] = useState("");

  const add = () => {
    const term = draft.trim();
    if (!term) return;
    if (vocabulary.includes(term)) {
      setDraft("");
      return;
    }
    updateSetting("customVocabulary", [...vocabulary, term]);
    setDraft("");
  };

  const remove = (term: string) => {
    updateSetting(
      "customVocabulary",
      vocabulary.filter((t) => t !== term)
    );
  };

  return (
    <div>
      <p className="text-sm font-medium text-surface-900 tracking-tight">
        Custom Vocabulary
      </p>
      <p className="text-[11px] text-surface-600 mt-0.5 leading-snug mb-3">
        Boost recognition of names, legal terms, medication names, and
        industry-specific jargon. Sent with every Deepgram request; no
        document content ever leaves your device.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder='e.g. "Alecrae", "Estoppel", "NetSuite"'
          className="flex-1 rounded-md border border-surface-300/70 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 shadow-inset-hairline focus:border-brass-400 focus:outline-none focus:ring-1 focus:ring-brass-400/40"
        />
        <Button size="sm" variant="secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>

      {vocabulary.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {vocabulary.map((term) => (
            <span
              key={term}
              className="group inline-flex items-center gap-1.5 rounded-full bg-surface-100/80 border border-surface-300/70 px-2.5 py-0.5 text-[11px] font-mono text-surface-800 shadow-inset-hairline"
            >
              {term}
              <button
                onClick={() => remove(term)}
                className="text-surface-500 hover:text-red-500 transition-colors"
                aria-label={`Remove ${term}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
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
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${settings.voxlenApiKey ? "bg-purple-500/10 border border-purple-500/30 text-purple-300" : "bg-surface-100 border border-surface-300/50 text-surface-500"}`}>
          {settings.voxlenApiKey ? (
            <><span className="text-green-400">✓</span> Grammar AI powered by your Voxlen account — no provider API key needed.</>
          ) : (
            <><span className="text-surface-400">→</span> Sign in to your Voxlen account (Voxlen tab) to enable grammar correction.</>
          )}
        </div>
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

      <div className="pt-2">
        <SectionHeader
          title="Real-Time Translation"
          description="Translate your dictated text into another language. Translation runs after grammar correction, using your grammar AI provider and API key."
        />
      </div>

      <SettingRow>
        <Switch
          label="Enable Translation"
          description="Automatically translate transcribed text into the selected target language"
          checked={settings.translationEnabled}
          onChange={(v) => settings.updateSetting("translationEnabled", v)}
        />
      </SettingRow>

      {settings.translationEnabled && (
        <SettingRow>
          <Select
            label="Target Language"
            value={settings.translationTargetLanguage}
            onChange={(v) => settings.updateSetting("translationTargetLanguage", v)}
            options={[
              { value: "en", label: "🇬🇧 English" },
              { value: "es", label: "🇪🇸 Spanish" },
              { value: "fr", label: "🇫🇷 French" },
              { value: "de", label: "🇩🇪 German" },
              { value: "it", label: "🇮🇹 Italian" },
              { value: "pt", label: "🇵🇹 Portuguese" },
              { value: "nl", label: "🇳🇱 Dutch" },
              { value: "pl", label: "🇵🇱 Polish" },
              { value: "ru", label: "🇷🇺 Russian" },
              { value: "ja", label: "🇯🇵 Japanese" },
              { value: "ko", label: "🇰🇷 Korean" },
              { value: "zh", label: "🇨🇳 Chinese" },
              { value: "ar", label: "🇸🇦 Arabic" },
              { value: "hi", label: "🇮🇳 Hindi" },
              { value: "tr", label: "🇹🇷 Turkish" },
              { value: "sv", label: "🇸🇪 Swedish" },
              { value: "da", label: "🇩🇰 Danish" },
              { value: "fi", label: "🇫🇮 Finnish" },
              { value: "no", label: "🇳🇴 Norwegian" },
              { value: "uk", label: "🇺🇦 Ukrainian" },
            ]}
          />
        </SettingRow>
      )}
    </div>
  );
}

function ShortcutSettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="Global Shortcuts"
        description="These shortcuts work from any application, even when Voxlen is minimized."
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

function AdvancedSettings({ onReopenSetup }: { onReopenSetup?: () => void }) {
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
              label: "Clipboard / Citrix Mode",
              description: "Copies to clipboard then pastes — works in Citrix, VMware Horizon, and VDI sessions",
            },
            {
              value: "buffer",
              label: "Buffer Only",
              description: "Text stays in Voxlen - copy manually",
            },
          ]}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Start Minimized"
          description="Launch Voxlen minimized to the system tray"
          checked={settings.startMinimized}
          onChange={(v) => settings.updateSetting("startMinimized", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Minimize to Tray"
          description="Keep Voxlen running in the system tray when closed"
          checked={settings.minimizeToTray}
          onChange={(v) => settings.updateSetting("minimizeToTray", v)}
        />
      </SettingRow>

      <SettingRow>
        <Switch
          label="Launch at Login"
          description="Automatically start Voxlen when you log in"
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

      <div className="pt-4 flex items-center gap-3 flex-wrap">
        {onReopenSetup && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReopenSetup}
          >
            Re-run Setup Wizard
          </Button>
        )}
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

interface AccountInfo {
  plan: string;
  features: string[];
  name: string;
  email: string;
  isAdmin: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  stt: "Dictation (STT)",
  grammar: "AI Grammar Correction",
  export: "All Export Formats",
  clauses: "Clause Library",
  billing: "Client Billing Tracking",
};

function UsageMeter({ apiKey }: { apiKey: string }) {
  const [info, setInfo] = useState<AccountInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("https://voxlen.ai/api/me", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (cancelled) return;
        // Validate the payload shape before storing it — a freshly deployed or
        // misconfigured API can return HTTP 200 with an unexpected body (error
        // envelope, missing fields). Accessing info.plan/info.features blindly
        // throws during render and crashes the app right after connecting a key.
        if (!data || typeof data !== "object") return;
        const d = data as Partial<AccountInfo>;
        if (typeof d.plan !== "string") return;
        setInfo({
          plan: d.plan,
          features: Array.isArray(d.features) ? d.features : [],
          name: typeof d.name === "string" ? d.name : "",
          email: typeof d.email === "string" ? d.email : "",
          isAdmin: Boolean(d.isAdmin),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiKey]);

  if (!info) return null;

  const PLAN_LABELS: Record<string, string> = {
    free: "Free",
    free_trial: "Free Trial",
    pro: "Pro",
    professional: "Professional",
    admin: "Admin",
  };
  const planLabel = PLAN_LABELS[info.plan.toLowerCase()] ?? (info.plan.charAt(0).toUpperCase() + info.plan.slice(1));
  const isFree = info.plan.toLowerCase() === "free";

  return (
    <div className="rounded-xl border border-surface-300/50 bg-surface-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-surface-800 uppercase tracking-wider">
          Account
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7345d1]/15 text-[#7345d1] font-semibold">
          {planLabel}
        </span>
      </div>
      <div className="space-y-1">
        {info.features.map((f) => (
          <div key={f} className="flex items-center gap-1.5 text-[11px] text-surface-600">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7345d1] shrink-0" />
            {FEATURE_LABELS[f] ?? f}
          </div>
        ))}
      </div>
      {isFree && (
        <a
          href="https://voxlen.ai/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[11px] font-semibold text-[#7345d1] hover:text-[#5c35b0] transition-colors pt-1"
        >
          Upgrade plan →
        </a>
      )}
    </div>
  );
}

function VoxlenApiSettings() {
  const settings = useSettingsStore();
  const [verifying, setVerifying] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [dgKeyInput, setDgKeyInput] = useState("");
  const [dgKeyError, setDgKeyError] = useState("");
  const [dgKeyVerifying, setDgKeyVerifying] = useState(false);
  const isConnected = Boolean(settings.voxlenApiKey);
  const hasDgKey = Boolean(settings.sttApiKey);

  const saveDgKey = async () => {
    const key = dgKeyInput.trim();
    if (!key) return;
    setDgKeyError("");
    setDgKeyVerifying(true);
    try {
      const res = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${key}` },
      });
      if (!res.ok) {
        setDgKeyError("Key rejected by Deepgram — check it at console.deepgram.com.");
        return;
      }
    } catch {
      // Network error — save anyway so offline users aren't blocked, but warn.
      setDgKeyError("Could not verify key (no connection) — saved anyway.");
    } finally {
      setDgKeyVerifying(false);
    }
    settings.updateSetting("sttApiKey", key);
    settings.updateSetting("sttEngine", "deepgram");
    setDgKeyInput("");
  };

  const removeDgKey = () => {
    settings.updateSetting("sttApiKey", "");
  };

  const openDashboard = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_url", { url: "https://voxlen.ai/dashboard" });
    } catch {
      window.open("https://voxlen.ai/dashboard", "_blank");
    }
  };

  const connect = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setVerifying(true);
    setKeyError("");
    try {
      const res = await fetch("https://voxlen.ai/api/me", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        settings.updateSetting("voxlenApiKey", key);
        setKeyInput("");
      } else {
        setKeyError("Token invalid or expired. Sign in again at voxlen.ai/dashboard.");
      }
    } catch {
      // Network unreachable — accept the token so offline setup still works,
      // but warn the user it could not be verified rather than silently
      // treating an unchecked (possibly invalid) token as fully connected.
      settings.updateSetting("voxlenApiKey", key);
      setKeyInput("");
      setKeyError("Saved, but couldn't verify the token (no connection). It will be checked when you go online.");
    }
    setVerifying(false);
  };

  const disconnect = () => {
    settings.updateSetting("voxlenApiKey", "");
  };

  const CONTEXT_OPTIONS = [
    { value: "", label: "None (general)", description: "No domain-specific formatting" },
    { value: "legal_general", label: "Legal — General", description: "Legal writing defaults" },
    { value: "legal_contract", label: "Legal — Contract", description: "Defined terms, clause numbering" },
    { value: "legal_case_note", label: "Legal — Case Note", description: "Attendance note headings" },
    { value: "legal_court_filing", label: "Legal — Court Filing", description: "Court names, v. formatting" },
    { value: "legal_deposition", label: "Legal — Deposition", description: "Q/A speaker labels" },
    { value: "legal_correspondence", label: "Legal — Correspondence", description: "Dear/Yours formatting" },
    { value: "accounting_general", label: "Accounting — General", description: "Accounting defaults" },
    { value: "accounting_tax", label: "Accounting — Tax", description: "GST/VAT/IRD references" },
    { value: "accounting_audit", label: "Accounting — Audit", description: "Finding/Recommendation headings" },
    { value: "accounting_memo", label: "Accounting — Memo", description: "MEMORANDUM formatting" },
    { value: "accounting_correspondence", label: "Accounting — Correspondence", description: "Professional letter formatting" },
    { value: "general", label: "General", description: "Generic formatting" },
  ];

  return (
    <div className="space-y-5 max-w-lg">
      {/* Connected state */}
      {isConnected ? (
        <>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <span className="text-emerald-400 text-lg">✓</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-900">Voxlen Account Connected</p>
                <p className="text-[11px] text-surface-600">
                  Transcription and grammar AI powered by Voxlen. No provider keys needed.
                </p>
              </div>
            </div>
            <button
              onClick={disconnect}
              className="text-[11px] text-surface-500 hover:text-red-400 transition-colors"
            >
              Disconnect account
            </button>
          </div>
          <UsageMeter apiKey={settings.voxlenApiKey} />
        </>
      ) : (
        /* Not connected */
        <div className="rounded-xl border border-surface-300/60 bg-surface-50/40 p-5 space-y-4">
          <div className="text-center pb-2">
            <div className="flex items-baseline justify-center gap-0.5 mb-1">
              <span className="font-display text-xl text-surface-900 tracking-tight-display">Vox</span>
              <span className="font-display text-xl italic text-brass-500 tracking-tight-display">len</span>
            </div>
            <p className="text-[12px] text-surface-600 max-w-xs mx-auto">
              Connect your Voxlen account and the app works immediately — no Deepgram or Anthropic keys required.
            </p>
          </div>

          <button
            onClick={openDashboard}
            className="w-full flex items-center justify-center gap-2 bg-[#7345d1] hover:bg-[#5c35b0] text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            Sign in at voxlen.ai → copy your token
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-300/50" />
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">paste token below</span>
            <div className="flex-1 h-px bg-surface-300/50" />
          </div>

          <div className="space-y-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError(""); }}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="Paste token from voxlen.ai/dashboard"
              className="w-full bg-surface-50 border border-surface-300/70 rounded-lg px-3 py-2 text-sm text-surface-900 placeholder-surface-500 focus:outline-none focus:border-[#7345d1] shadow-inset-hairline"
            />
            {keyError && <p className="text-[11px] text-red-500">{keyError}</p>}
            <Button
              variant="secondary"
              size="sm"
              onClick={connect}
              disabled={!keyInput.trim() || verifying}
              className="w-full"
            >
              {verifying ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </div>
      )}

      {/* Deepgram BYOK — always visible, independent of Voxlen account */}
      <div className="space-y-3">
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-300/50" />
            <span className="text-[10px] text-surface-500 uppercase tracking-wider">
              or bring your own Deepgram key
            </span>
            <div className="flex-1 h-px bg-surface-300/50" />
          </div>

          {hasDgKey ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-surface-900">Deepgram Key Active</p>
                <p className="text-[11px] text-surface-600 mt-0.5">
                  Nova-3 streaming — real-time transcription ready.
                </p>
              </div>
              <button
                onClick={removeDgKey}
                className="text-[11px] text-surface-500 hover:text-red-400 transition-colors ml-4 shrink-0"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-surface-600">
                Get a free API key at{" "}
                <span className="font-mono text-surface-700">console.deepgram.com</span>.
                Your key is stored securely in the OS keychain.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={dgKeyInput}
                  onChange={(e) => { setDgKeyInput(e.target.value); setDgKeyError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && saveDgKey()}
                  placeholder="Paste Deepgram API key…"
                  className="flex-1 bg-surface-50 border border-surface-300/70 rounded-lg px-3 py-2 text-sm text-surface-900 placeholder-surface-500 focus:outline-none focus:border-[#7345d1] shadow-inset-hairline"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={saveDgKey}
                  disabled={!dgKeyInput.trim() || dgKeyVerifying}
                >
                  {dgKeyVerifying ? "Verifying…" : "Save"}
                </Button>
              </div>
              {dgKeyError && (
                <p className={`text-[11px] ${dgKeyError.startsWith("Could not verify") ? "text-amber-500" : "text-red-500"}`}>
                  {dgKeyError}
                </p>
              )}
            </div>
          )}
      </div>

      {isConnected && (
        <>
          <SectionHeader title="Dictation Settings" description="" />

          <SettingRow>
            <Select
              label="Dictation Context"
              value={settings.voxlenContext}
              onChange={(v) => settings.updateSetting("voxlenContext", v)}
              options={CONTEXT_OPTIONS}
            />
          </SettingRow>

          <SettingRow>
            <Switch
              label="Privileged Mode"
              description="Block all cloud STT — local processing only. Coming soon: requires Whisper Local (offline mode) which is not yet available."
              checked={false}
              onChange={() => {}}
              disabled
            />
          </SettingRow>

          <SettingRow>
            <Switch
              label="Legal Mode"
              description="Enable Latin phrase recognition, legal currency formatting, and jurisdiction-specific smart format."
              checked={settings.legalMode}
              onChange={(v) => settings.updateSetting("legalMode", v)}
            />
          </SettingRow>

          {settings.legalMode && (
            <SettingRow>
              <Select
                label="Jurisdiction"
                value={settings.jurisdiction}
                onChange={(v) =>
                  settings.updateSetting("jurisdiction", v as typeof settings.jurisdiction)
                }
                options={[
                  { value: "global", label: "Global", description: "International / neutral" },
                  { value: "uk", label: "United Kingdom", description: "England & Wales, Scotland" },
                  { value: "us", label: "United States", description: "Federal + state law" },
                  { value: "australia", label: "Australia", description: "Commonwealth + state law" },
                  { value: "nz", label: "New Zealand", description: "NZ common law" },
                  { value: "canada", label: "Canada", description: "Federal + provincial law" },
                ]}
              />
            </SettingRow>
          )}

          {settings.legalMode && (
            <SettingRow>
              <Slider
                label="Default Billable Rate"
                value={settings.billableRatePerHour}
                onChange={(v) => settings.updateSetting("billableRatePerHour", v)}
                min={0}
                max={2000}
                step={25}
                formatValue={(v) => `$${v}/hr`}
              />
            </SettingRow>
          )}

          <SettingRow>
            <Input
              label="Firm / Organisation ID (optional)"
              value={settings.voxlenTenantId}
              onChange={(e) => settings.updateSetting("voxlenTenantId", e.target.value)}
              placeholder="For team / SSO accounts"
            />
          </SettingRow>
        </>
      )}
    </div>
  );
}

function PrivacySettings() {
  const settings = useSettingsStore();

  return (
    <div className="space-y-6 max-w-lg">
      <SectionHeader
        title="Privacy"
        description="Your data, your control. Voxlen can work fully offline with local models."
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
          description="Help us improve Voxlen with anonymous usage data"
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
            Audio is never stored on our servers.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            Offline mode (Whisper Local) coming soon — no audio will leave your device.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            API keys are stored locally on your device.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            No data is shared with third parties.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brass-500 mt-0.5">&mdash;</span>
            You can delete all local data at any time.
          </li>
        </ul>
      </div>
    </div>
  );
}
