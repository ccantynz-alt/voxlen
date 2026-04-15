import type { AppSettings } from "@/stores/settings";

/**
 * Rust (tauri-plugin-store) side uses snake_case for field names.
 * This shape mirrors the Rust `AppSettings` struct returned by `get_settings`
 * and accepted by `update_settings`.
 */
export interface BackendAppSettings {
  // Audio
  preferred_device_id: string | null;
  input_gain: number;
  noise_suppression: boolean;

  // STT
  stt_engine: string;
  stt_api_key: string;
  stt_language: string;
  auto_detect_language: boolean;
  custom_vocabulary: string[];

  // Grammar
  grammar_enabled: boolean;
  grammar_api_key: string;
  grammar_provider: "claude" | "openai";
  writing_style: "professional" | "casual" | "academic" | "creative" | "technical";
  auto_correct: boolean;
  preserve_tone: boolean;

  // Dictation
  auto_punctuate: boolean;
  smart_format: boolean;
  voice_commands_enabled: boolean;

  // Text injection
  injection_mode: "keyboard" | "clipboard" | "buffer";

  // Shortcuts
  shortcut_toggle: string;
  shortcut_push_to_talk: string;
  shortcut_cancel: string;
  shortcut_correct_grammar: string;

  // UI
  theme: "dark" | "light" | "system";
  show_waveform: boolean;
  font_size: number;
  start_minimized: boolean;
  minimize_to_tray: boolean;
  launch_at_login: boolean;

  // Privacy
  telemetry_enabled: boolean;
  save_transcripts: boolean;
}

/**
 * Convert Zustand store settings (camelCase) -> Rust backend settings (snake_case).
 */
export function toBackendSettings(s: AppSettings): BackendAppSettings {
  return {
    preferred_device_id: s.preferredDeviceId,
    input_gain: s.inputGain,
    noise_suppression: s.noiseSuppression,

    stt_engine: s.sttEngine,
    stt_api_key: s.sttApiKey,
    stt_language: s.sttLanguage,
    auto_detect_language: s.autoDetectLanguage,
    custom_vocabulary: s.customVocabulary,

    grammar_enabled: s.grammarEnabled,
    grammar_api_key: s.grammarApiKey,
    grammar_provider: s.grammarProvider,
    writing_style: s.writingStyle,
    auto_correct: s.autoCorrect,
    preserve_tone: s.preserveTone,

    auto_punctuate: s.autoPunctuate,
    smart_format: s.smartFormat,
    voice_commands_enabled: s.voiceCommandsEnabled,

    injection_mode: s.injectionMode,

    shortcut_toggle: s.shortcutToggle,
    shortcut_push_to_talk: s.shortcutPushToTalk,
    shortcut_cancel: s.shortcutCancel,
    shortcut_correct_grammar: s.shortcutCorrectGrammar,

    theme: s.theme,
    show_waveform: s.showWaveform,
    font_size: s.fontSize,
    start_minimized: s.startMinimized,
    minimize_to_tray: s.minimizeToTray,
    launch_at_login: s.launchAtLogin,

    telemetry_enabled: s.telemetryEnabled,
    save_transcripts: s.saveTranscripts,
  };
}

/**
 * Convert Rust backend settings (snake_case) -> Zustand store settings (camelCase).
 * Missing fields fall back to undefined so the caller can merge over defaults.
 */
export function fromBackendSettings(
  s: Partial<BackendAppSettings>
): Partial<AppSettings> {
  const out: Partial<AppSettings> = {};

  if (s.preferred_device_id !== undefined) out.preferredDeviceId = s.preferred_device_id;
  if (s.input_gain !== undefined) out.inputGain = s.input_gain;
  if (s.noise_suppression !== undefined) out.noiseSuppression = s.noise_suppression;

  if (s.stt_engine !== undefined) out.sttEngine = s.stt_engine;
  if (s.stt_api_key !== undefined) out.sttApiKey = s.stt_api_key;
  if (s.stt_language !== undefined) out.sttLanguage = s.stt_language;
  if (s.auto_detect_language !== undefined) out.autoDetectLanguage = s.auto_detect_language;
  if (s.custom_vocabulary !== undefined) out.customVocabulary = s.custom_vocabulary;

  if (s.grammar_enabled !== undefined) out.grammarEnabled = s.grammar_enabled;
  if (s.grammar_api_key !== undefined) out.grammarApiKey = s.grammar_api_key;
  if (s.grammar_provider !== undefined) out.grammarProvider = s.grammar_provider;
  if (s.writing_style !== undefined) out.writingStyle = s.writing_style;
  if (s.auto_correct !== undefined) out.autoCorrect = s.auto_correct;
  if (s.preserve_tone !== undefined) out.preserveTone = s.preserve_tone;

  if (s.auto_punctuate !== undefined) out.autoPunctuate = s.auto_punctuate;
  if (s.smart_format !== undefined) out.smartFormat = s.smart_format;
  if (s.voice_commands_enabled !== undefined) out.voiceCommandsEnabled = s.voice_commands_enabled;

  if (s.injection_mode !== undefined) out.injectionMode = s.injection_mode;

  if (s.shortcut_toggle !== undefined) out.shortcutToggle = s.shortcut_toggle;
  if (s.shortcut_push_to_talk !== undefined) out.shortcutPushToTalk = s.shortcut_push_to_talk;
  if (s.shortcut_cancel !== undefined) out.shortcutCancel = s.shortcut_cancel;
  if (s.shortcut_correct_grammar !== undefined) out.shortcutCorrectGrammar = s.shortcut_correct_grammar;

  if (s.theme !== undefined) out.theme = s.theme;
  if (s.show_waveform !== undefined) out.showWaveform = s.show_waveform;
  if (s.font_size !== undefined) out.fontSize = s.font_size;
  if (s.start_minimized !== undefined) out.startMinimized = s.start_minimized;
  if (s.minimize_to_tray !== undefined) out.minimizeToTray = s.minimize_to_tray;
  if (s.launch_at_login !== undefined) out.launchAtLogin = s.launch_at_login;

  if (s.telemetry_enabled !== undefined) out.telemetryEnabled = s.telemetry_enabled;
  if (s.save_transcripts !== undefined) out.saveTranscripts = s.save_transcripts;

  return out;
}

/**
 * Persist current settings to the backend. Silently falls back in non-Tauri (browser) dev mode.
 */
export async function persistSettings(settings: AppSettings): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("update_settings", { settings: toBackendSettings(settings) });
  } catch {
    // Non-Tauri environment — best-effort localStorage fallback.
    try {
      localStorage.setItem("marcoreid_settings", JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }
}

/**
 * Load settings from backend. Returns undefined if unavailable.
 */
export async function loadSettings(): Promise<Partial<AppSettings> | undefined> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const backend = await invoke<Partial<BackendAppSettings> | null>("get_settings");
    if (!backend) return undefined;
    return fromBackendSettings(backend);
  } catch {
    try {
      const raw = localStorage.getItem("marcoreid_settings");
      if (raw) return JSON.parse(raw) as Partial<AppSettings>;
    } catch {
      // Ignore
    }
    return undefined;
  }
}
