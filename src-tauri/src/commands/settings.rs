use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

use crate::audio::AudioState;
use crate::stt::{SttConfig, SttEngineType, SttState};
use crate::commands::grammar::{
    set_grammar_config_internal, GrammarConfig, GrammarProvider, WritingStyle,
};
use crate::commands::translate::{set_translation_config_internal, TranslationConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    // Audio
    pub preferred_device_id: Option<String>,
    pub input_gain: f32,
    pub noise_suppression: bool,

    // STT
    pub stt_engine: String,
    pub stt_api_key: Option<String>,
    pub stt_language: String,
    pub auto_detect_language: bool,
    pub custom_vocabulary: Vec<String>,
    #[serde(default)]
    pub speaker_diarization: bool,

    // Grammar
    pub grammar_enabled: bool,
    pub grammar_api_key: Option<String>,
    pub grammar_provider: String,
    pub writing_style: String,
    pub auto_correct: bool,
    #[serde(default = "default_true")]
    pub preserve_tone: bool,

    // Dictation
    pub auto_punctuate: bool,
    pub smart_format: bool,
    pub voice_commands_enabled: bool,

    // Text injection
    pub injection_mode: String,

    // Shortcuts
    pub shortcut_toggle: String,
    pub shortcut_push_to_talk: String,
    pub shortcut_cancel: String,
    #[serde(default = "default_shortcut_correct_grammar")]
    pub shortcut_correct_grammar: String,

    // UI
    pub theme: String,
    pub show_waveform: bool,
    pub font_size: u32,
    pub start_minimized: bool,
    pub minimize_to_tray: bool,
    pub launch_at_login: bool,

    // Privacy
    pub telemetry_enabled: bool,
    pub save_transcripts: bool,

    // Privileged mode / Legal
    #[serde(default)]
    pub privileged_mode: bool,
    #[serde(default)]
    pub legal_mode: bool,
    #[serde(default)]
    pub jurisdiction: String,

    // Translation
    #[serde(default)]
    pub translation_enabled: bool,
    #[serde(default = "default_translation_language")]
    pub translation_target_language: String,

    // Voxlen account — when set, all STT and grammar calls are proxied
    // through voxlen.ai/api so users never need their own API keys.
    #[serde(default)]
    pub voxlen_api_key: Option<String>,
    #[serde(default)]
    pub voxlen_tenant_id: Option<String>,
    #[serde(default)]
    pub voxlen_context: Option<String>,

    // Frontend-only fields that Rust round-trips but does not act on.
    // Keeping them here prevents update_settings from silently dropping
    // them when the frontend round-trips the settings object.
    #[serde(default)]
    pub billable_rate_per_hour: f64,
    #[serde(default)]
    pub legal_accepted_version: Option<String>,
    #[serde(default)]
    pub legal_accepted_at: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            preferred_device_id: None,
            input_gain: 1.0,
            noise_suppression: true,

            stt_engine: "deepgram".to_string(),
            stt_api_key: None,
            stt_language: "en".to_string(),
            auto_detect_language: true,
            custom_vocabulary: Vec::new(),
            speaker_diarization: false,

            grammar_enabled: true,
            grammar_api_key: None,
            grammar_provider: "claude".to_string(),
            writing_style: "professional".to_string(),
            auto_correct: true,
            preserve_tone: true,

            auto_punctuate: true,
            smart_format: true,
            voice_commands_enabled: true,

            injection_mode: "keyboard".to_string(),

            shortcut_toggle: "CommandOrControl+Shift+D".to_string(),
            shortcut_push_to_talk: "CommandOrControl+Shift+Space".to_string(),
            shortcut_cancel: "Escape".to_string(),
            shortcut_correct_grammar: "CommandOrControl+Shift+G".to_string(),

            theme: "dark".to_string(),
            show_waveform: true,
            font_size: 14,
            start_minimized: false,
            minimize_to_tray: true,
            launch_at_login: false,

            telemetry_enabled: false,
            save_transcripts: true,

            privileged_mode: false,
            legal_mode: false,
            jurisdiction: "global".to_string(),

            translation_enabled: false,
            translation_target_language: "en".to_string(),

            voxlen_api_key: None,
            voxlen_tenant_id: None,
            voxlen_context: None,

            billable_rate_per_hour: 0.0,
            legal_accepted_version: None,
            legal_accepted_at: None,
        }
    }
}

fn default_true() -> bool { true }
fn default_shortcut_correct_grammar() -> String { "CommandOrControl+Shift+G".to_string() }

fn default_translation_language() -> String {
    "en".to_string()
}

const SETTINGS_STORE_FILE: &str = "settings.json";

static SETTINGS: std::sync::OnceLock<parking_lot::RwLock<AppSettings>> =
    std::sync::OnceLock::new();

fn get_settings_store() -> &'static parking_lot::RwLock<AppSettings> {
    SETTINGS.get_or_init(|| parking_lot::RwLock::new(AppSettings::default()))
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    Ok(get_settings_store().read().clone())
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    stt_state: State<'_, SttState>,
    audio_state: State<'_, AudioState>,
    settings: AppSettings,
) -> Result<(), String> {
    *get_settings_store().write() = settings.clone();
    // The frontend (schedulePersist) owns the Tauri store and writes it in camelCase.
    // Writing snake_case from here would overwrite that and break frontend reads on
    // the next startup. We only update the in-memory engine config.
    apply_settings_to_engines(&stt_state.0, &audio_state, &settings);
    apply_autostart(&app, settings.launch_at_login);
    apply_injection_mode(&app, &settings.injection_mode);
    Ok(())
}

#[tauri::command]
pub fn reset_settings(
    app: AppHandle,
    stt_state: State<'_, SttState>,
    audio_state: State<'_, AudioState>,
) -> Result<AppSettings, String> {
    let defaults = AppSettings::default();
    *get_settings_store().write() = defaults.clone();
    apply_settings_to_engines(&stt_state.0, &audio_state, &defaults);
    apply_autostart(&app, defaults.launch_at_login);
    apply_injection_mode(&app, &defaults.injection_mode);
    Ok(defaults)
}

/// Callable from `setup()` — looks up managed state and pushes the currently
/// loaded settings into the STT + grammar + audio engines. No-op if state is missing.
pub fn apply_loaded_settings_to_engines(app: &AppHandle) {
    let settings = get_settings_store().read().clone();
    if let (Some(stt_state), Some(audio_state)) =
        (app.try_state::<SttState>(), app.try_state::<AudioState>())
    {
        apply_settings_to_engines(&stt_state.0, &audio_state, &settings);
    }
    apply_injection_mode(app, &settings.injection_mode);
}

/// Map an `AppSettings` snapshot onto the in-process STT + grammar + audio
/// engine config stores. Without this, API keys stored by the frontend never
/// reach the transcription / correction paths and every dictation fails with
/// "API key not configured" — and without the audio device sync, the mic a
/// user picks in Settings is silently ignored and capture always falls back
/// to the OS default input device.
fn apply_settings_to_engines(
    stt_engine_arc: &std::sync::Arc<parking_lot::RwLock<crate::stt::SttEngine>>,
    audio_state: &AudioState,
    s: &AppSettings,
) {
    // Sticky preference: applied even if the device isn't connected right
    // now (e.g. muted/unplugged at startup) so capture picks it up the
    // moment it reappears, instead of silently staying on the OS default.
    audio_state.0.read().set_preferred_device(s.preferred_device_id.clone());

    // Privileged mode: block all cloud STT. Only local (offline) processing allowed.
    // If WhisperLocal is not configured, dictation will fail with a clear error.
    let stt_engine_type = if s.privileged_mode {
        SttEngineType::WhisperLocal
    } else {
        match s.stt_engine.as_str() {
            "deepgram" | "deepgram_cloud" => SttEngineType::DeepgramCloud,
            "whisper_local" => SttEngineType::WhisperLocal,
            _ => SttEngineType::WhisperCloud,
        }
    };

    let model = match stt_engine_type {
        SttEngineType::DeepgramCloud => "nova-3".to_string(),
        SttEngineType::WhisperCloud => "whisper-1".to_string(),
        SttEngineType::WhisperLocal => "base".to_string(),
    };

    let voxlen_key = s.voxlen_api_key.clone().filter(|k| !k.is_empty());

    // Keep the user's direct provider key even when a Voxlen account key is
    // present. The engine layer applies Voxlen-first precedence and uses the
    // direct key as a fallback; blanking it here silently destroyed a working
    // BYOK key the moment a (possibly bad) Voxlen key was entered.
    let resolved_api_key = s.stt_api_key.clone().filter(|k| !k.is_empty());

    let stt_config = SttConfig {
        engine: stt_engine_type,
        language: s.stt_language.clone(),
        auto_detect_language: s.auto_detect_language,
        api_key: resolved_api_key,
        model,
        punctuate: s.auto_punctuate,
        smart_format: s.smart_format,
        profanity_filter: false,
        custom_vocabulary: s.custom_vocabulary.clone(),
        speaker_diarization: s.speaker_diarization,
        voxlen_api_key: voxlen_key.clone(),
        voxlen_context: s.voxlen_context.clone().filter(|k| !k.is_empty()),
        voxlen_tenant_id: s.voxlen_tenant_id.clone().filter(|k| !k.is_empty()),
    };
    stt_engine_arc.read().set_config(stt_config);

    let grammar_provider = match s.grammar_provider.as_str() {
        "openai" => GrammarProvider::OpenAI,
        _ => GrammarProvider::Claude,
    };
    let writing_style = match s.writing_style.as_str() {
        "casual" => WritingStyle::Casual,
        "academic" => WritingStyle::Academic,
        "creative" => WritingStyle::Creative,
        "technical" => WritingStyle::Technical,
        _ => WritingStyle::Professional,
    };
    // Keep the direct grammar key as a fallback even when a Voxlen key is set
    // (engine applies Voxlen-first precedence with BYOK fallback).
    let grammar_api_key = s.grammar_api_key.clone().filter(|k| !k.is_empty());

    let grammar_config = GrammarConfig {
        enabled: s.grammar_enabled,
        api_key: grammar_api_key,
        provider: grammar_provider,
        style: writing_style,
        auto_correct: s.auto_correct,
        preserve_tone: s.preserve_tone,
        voxlen_api_key: voxlen_key,
        voxlen_context: s.voxlen_context.clone().filter(|k| !k.is_empty()),
        voxlen_tenant_id: s.voxlen_tenant_id.clone().filter(|k| !k.is_empty()),
    };
    set_grammar_config_internal(grammar_config);

    let translation_config = TranslationConfig {
        enabled: s.translation_enabled,
        target_language: s.translation_target_language.clone(),
    };
    set_translation_config_internal(translation_config);
}

/// Load settings from disk into the in-memory cache. Called once during app
/// startup before the window opens.
///
/// The Tauri store (`settings.json`) is owned by the frontend and written in
/// camelCase. Rust must NOT read or write that JSON to avoid a snake_case /
/// camelCase mismatch that silently resets all user settings to defaults on
/// every restart. The frontend's `usePersistedSettings` hook owns loading
/// camelCase settings into the Zustand store.
///
/// This function's only job is to:
///   1. Open the store (initialises the app data directory).
///   2. Hydrate API keys from the OS keychain so that STT / grammar engines
///      have them before the first dictation.
#[tauri::command]
pub fn load_settings_from_disk(app: AppHandle) -> Result<AppSettings, String> {
    // Open the store so the app data directory is initialised. We deliberately
    // ignore the contents — the frontend owns the camelCase JSON.
    let _ = app.store(SETTINGS_STORE_FILE).map_err(|e| e.to_string())?;

    // Start from in-process defaults; the frontend will push its camelCase
    // settings to us via `update_settings` after the window loads.
    let mut loaded = AppSettings::default();

    // API keys live in the OS keychain only (never in plain JSON). Hydrate
    // them now so the STT / grammar engines work on the very first dictation
    // after a restart, before the frontend has had a chance to call
    // `update_settings`.
    loaded.stt_api_key = crate::commands::keyring::read_secret("sttApiKey");
    loaded.grammar_api_key = crate::commands::keyring::read_secret("grammarApiKey");
    loaded.voxlen_api_key = crate::commands::keyring::read_secret("voxlenApiKey");

    *get_settings_store().write() = loaded.clone();
    Ok(loaded)
}

/// Returns whether privileged mode is currently active. Used by dictation
/// commands to gate cloud STT and emit UI events.
pub fn get_privileged_mode() -> bool {
    get_settings_store().read().privileged_mode
}

/// Returns a snapshot of the current settings for use by non-command code.
pub fn get_current_settings() -> AppSettings {
    get_settings_store().read().clone()
}

/// Apply the launch-at-login setting to the OS autostart mechanism.
/// Silently ignores errors (not all platforms support autostart).
fn apply_autostart(app: &AppHandle, enable: bool) {
    let mgr = app.autolaunch();
    if enable {
        let _ = mgr.enable();
    } else {
        let _ = mgr.disable();
    }
}

/// Apply the text injection mode from settings to the in-process TextInjector.
/// Without this, changing injection_mode in Settings only takes effect after restart.
fn apply_injection_mode(app: &AppHandle, mode_str: &str) {
    use crate::text_injection::{InjectionMode, InjectorState};
    let mode = match mode_str {
        "clipboard" => InjectionMode::ClipboardPaste,
        "buffer" => InjectionMode::BufferOnly,
        _ => InjectionMode::KeyboardSimulation,
    };
    if let Some(state) = app.try_state::<InjectorState>() {
        state.0.read().set_mode(mode);
    }
}
