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
  whisper_local_model: string;
  stt_language: string;
  auto_detect_language: boolean;
  custom_vocabulary: string[];
  speaker_diarization: boolean;

  // Grammar
  grammar_enabled: boolean;
  grammar_api_key: string;
  grammar_provider: "claude" | "openai";
  grammar_engine: "cloud" | "local_rules" | "local_llm";
  grammar_local_model: string;
  writing_style: "professional" | "casual" | "academic" | "creative" | "technical";
  auto_correct: boolean;
  preserve_tone: boolean;

  // Dictation
  auto_punctuate: boolean;
  smart_format: boolean;
  voice_commands_enabled: boolean;
  always_ready_mode: boolean;
  mic_switch_mode: boolean;

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

  // Privileged / Legal
  privileged_mode: boolean;
  legal_mode: boolean;
  jurisdiction: string;

  // Translation
  translation_enabled: boolean;
  translation_target_language: string;

  // Meeting capture consent
  meeting_jurisdiction: string;
  meeting_consent_ack_version: string | null;
  meeting_consent_ack_at: string | null;

  // Voxlen account
  voxlen_api_key: string;
  voxlen_tenant_id: string;
  voxlen_context: string;

  // Frontend-only fields round-tripped through Rust to prevent data loss on persist
  billable_rate_per_hour: number;
  legal_accepted_version: string | null;
  legal_accepted_at: string | null;
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
    whisper_local_model: s.whisperLocalModel,
    stt_language: s.sttLanguage,
    auto_detect_language: s.autoDetectLanguage,
    custom_vocabulary: s.customVocabulary,
    speaker_diarization: s.speakerDiarization,

    grammar_enabled: s.grammarEnabled,
    grammar_api_key: s.grammarApiKey,
    grammar_provider: s.grammarProvider,
    grammar_engine: s.grammarEngine,
    grammar_local_model: s.grammarLocalModel,
    writing_style: s.writingStyle,
    auto_correct: s.autoCorrect,
    preserve_tone: s.preserveTone,

    auto_punctuate: s.autoPunctuate,
    smart_format: s.smartFormat,
    voice_commands_enabled: s.voiceCommandsEnabled,
    always_ready_mode: s.alwaysReadyMode,
    mic_switch_mode: s.micSwitchMode,

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

    privileged_mode: s.privilegedMode,
    legal_mode: s.legalMode,
    jurisdiction: s.jurisdiction,

    translation_enabled: s.translationEnabled,
    translation_target_language: s.translationTargetLanguage,

    meeting_jurisdiction: s.meetingJurisdiction,
    meeting_consent_ack_version: s.meetingConsentAckVersion,
    meeting_consent_ack_at: s.meetingConsentAckAt,

    voxlen_api_key: s.voxlenApiKey,
    voxlen_tenant_id: s.voxlenTenantId,
    voxlen_context: s.voxlenContext,

    billable_rate_per_hour: s.billableRatePerHour,
    legal_accepted_version: s.legalAcceptedVersion,
    legal_accepted_at: s.legalAcceptedAt,
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
  if (s.whisper_local_model !== undefined) out.whisperLocalModel = s.whisper_local_model;
  if (s.stt_language !== undefined) out.sttLanguage = s.stt_language;
  if (s.auto_detect_language !== undefined) out.autoDetectLanguage = s.auto_detect_language;
  if (s.custom_vocabulary !== undefined) out.customVocabulary = s.custom_vocabulary;
  if (s.speaker_diarization !== undefined) out.speakerDiarization = s.speaker_diarization;

  if (s.grammar_enabled !== undefined) out.grammarEnabled = s.grammar_enabled;
  if (s.grammar_api_key !== undefined) out.grammarApiKey = s.grammar_api_key;
  if (s.grammar_provider !== undefined) out.grammarProvider = s.grammar_provider;
  if (s.grammar_engine !== undefined) out.grammarEngine = s.grammar_engine;
  if (s.grammar_local_model !== undefined) out.grammarLocalModel = s.grammar_local_model;
  if (s.writing_style !== undefined) out.writingStyle = s.writing_style;
  if (s.auto_correct !== undefined) out.autoCorrect = s.auto_correct;
  if (s.preserve_tone !== undefined) out.preserveTone = s.preserve_tone;

  if (s.auto_punctuate !== undefined) out.autoPunctuate = s.auto_punctuate;
  if (s.smart_format !== undefined) out.smartFormat = s.smart_format;
  if (s.voice_commands_enabled !== undefined) out.voiceCommandsEnabled = s.voice_commands_enabled;
  if (s.always_ready_mode !== undefined) out.alwaysReadyMode = s.always_ready_mode;
  if (s.mic_switch_mode !== undefined) out.micSwitchMode = s.mic_switch_mode;

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

  if (s.privileged_mode !== undefined) out.privilegedMode = s.privileged_mode;
  if (s.legal_mode !== undefined) out.legalMode = s.legal_mode;
  if (s.jurisdiction !== undefined) out.jurisdiction = s.jurisdiction as AppSettings["jurisdiction"];

  if (s.translation_enabled !== undefined) out.translationEnabled = s.translation_enabled;
  if (s.translation_target_language !== undefined) out.translationTargetLanguage = s.translation_target_language;

  if (s.meeting_jurisdiction !== undefined) out.meetingJurisdiction = s.meeting_jurisdiction;
  if (s.meeting_consent_ack_version !== undefined) out.meetingConsentAckVersion = s.meeting_consent_ack_version;
  if (s.meeting_consent_ack_at !== undefined) out.meetingConsentAckAt = s.meeting_consent_ack_at;

  if (s.voxlen_api_key !== undefined) out.voxlenApiKey = s.voxlen_api_key;
  if (s.voxlen_tenant_id !== undefined) out.voxlenTenantId = s.voxlen_tenant_id;
  if (s.voxlen_context !== undefined) out.voxlenContext = s.voxlen_context;

  if (s.billable_rate_per_hour !== undefined) out.billableRatePerHour = s.billable_rate_per_hour;
  if (s.legal_accepted_version !== undefined) out.legalAcceptedVersion = s.legal_accepted_version;
  if (s.legal_accepted_at !== undefined) out.legalAcceptedAt = s.legal_accepted_at;

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
      localStorage.setItem("voxlen_settings", JSON.stringify(settings));
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
      const raw = localStorage.getItem("voxlen_settings");
      if (raw) return JSON.parse(raw) as Partial<AppSettings>;
    } catch {
      // Ignore
    }
    return undefined;
  }
}
