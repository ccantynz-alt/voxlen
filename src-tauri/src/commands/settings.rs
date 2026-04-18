use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_store::StoreExt;

use crate::stt::{SttConfig, SttEngineType, SttState};
use crate::commands::grammar::{
    set_grammar_config_internal, GrammarConfig, GrammarProvider, WritingStyle,
};

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

    // Grammar
    pub grammar_enabled: bool,
    pub grammar_api_key: Option<String>,
    pub grammar_provider: String,
    pub writing_style: String,
    pub auto_correct: bool,

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
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            preferred_device_id: None,
            input_gain: 1.0,
            noise_suppression: true,

            stt_engine: "whisper_cloud".to_string(),
            stt_api_key: None,
            stt_language: "en".to_string(),
            auto_detect_language: true,
            custom_vocabulary: Vec::new(),

            grammar_enabled: true,
            grammar_api_key: None,
            grammar_provider: "claude".to_string(),
            writing_style: "professional".to_string(),
            auto_correct: true,

            auto_punctuate: true,
            smart_format: true,
            voice_commands_enabled: true,

            injection_mode: "keyboard".to_string(),

            shortcut_toggle: "CommandOrControl+Shift+D".to_string(),
            shortcut_push_to_talk: "CommandOrControl+Shift+Space".to_string(),
            shortcut_cancel: "Escape".to_string(),

            theme: "dark".to_string(),
            show_waveform: true,
            font_size: 14,
            start_minimized: false,
            minimize_to_tray: true,
            launch_at_login: false,

            telemetry_enabled: false,
            save_transcripts: true,
        }
    }
}

const SETTINGS_STORE_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

static SETTINGS: std::sync::OnceLock<parking_lot::RwLock<AppSettings>> =
    std::sync::OnceLock::new();

fn get_settings_store() -> &'static parking_lot::RwLock<AppSettings> {
    SETTINGS.get_or_init(|| parking_lot::RwLock::new(AppSettings::default()))
}

fn persist_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| e.to_string())?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    Ok(get_settings_store().read().clone())
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    stt_state: State<'_, SttState>,
    settings: AppSettings,
) -> Result<(), String> {
    *get_settings_store().write() = settings.clone();
    persist_settings(&app, &settings)?;
    apply_settings_to_engines(&stt_state.0, &settings);
    Ok(())
}

#[tauri::command]
pub fn reset_settings(
    app: AppHandle,
    stt_state: State<'_, SttState>,
) -> Result<AppSettings, String> {
    let defaults = AppSettings::default();
    *get_settings_store().write() = defaults.clone();
    persist_settings(&app, &defaults)?;
    apply_settings_to_engines(&stt_state.0, &defaults);
    Ok(defaults)
}

/// Callable from `setup()` — looks up managed state and pushes the currently
/// loaded settings into the STT + grammar engines. No-op if state is missing.
pub fn apply_loaded_settings_to_engines(app: &AppHandle) {
    let settings = get_settings_store().read().clone();
    if let Some(stt_state) = app.try_state::<SttState>() {
        apply_settings_to_engines(&stt_state.0, &settings);
    }
}

/// Map an `AppSettings` snapshot onto the in-process STT + grammar engine
/// config stores. Without this, API keys stored by the frontend never reach
/// the transcription / correction paths and every dictation fails with
/// "API key not configured".
fn apply_settings_to_engines(
    stt_engine_arc: &std::sync::Arc<parking_lot::RwLock<crate::stt::SttEngine>>,
    s: &AppSettings,
) {
    let stt_engine_type = match s.stt_engine.as_str() {
        "deepgram" | "deepgram_cloud" => SttEngineType::DeepgramCloud,
        "whisper_local" => SttEngineType::WhisperLocal,
        _ => SttEngineType::WhisperCloud,
    };

    let model = match stt_engine_type {
        SttEngineType::DeepgramCloud => "nova-2".to_string(),
        SttEngineType::WhisperCloud => "whisper-1".to_string(),
        SttEngineType::WhisperLocal => "base".to_string(),
    };

    let stt_config = SttConfig {
        engine: stt_engine_type,
        language: s.stt_language.clone(),
        auto_detect_language: s.auto_detect_language,
        api_key: s.stt_api_key.clone().filter(|k| !k.is_empty()),
        model,
        punctuate: s.auto_punctuate,
        smart_format: s.smart_format,
        profanity_filter: false,
        custom_vocabulary: s.custom_vocabulary.clone(),
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
    let grammar_config = GrammarConfig {
        enabled: s.grammar_enabled,
        api_key: s.grammar_api_key.clone().filter(|k| !k.is_empty()),
        provider: grammar_provider,
        style: writing_style,
        auto_correct: s.auto_correct,
        preserve_tone: true,
    };
    set_grammar_config_internal(grammar_config);
}

/// Load settings from disk into the in-memory cache. Called once during app
/// startup. If the store file does not exist or the `settings` key is missing,
/// defaults are written to disk so subsequent reads are consistent.
#[tauri::command]
pub fn load_settings_from_disk(app: AppHandle) -> Result<AppSettings, String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| e.to_string())?;

    let loaded = match store.get(SETTINGS_KEY) {
        Some(value) => match serde_json::from_value::<AppSettings>(value) {
            Ok(s) => s,
            Err(e) => {
                log::warn!(
                    "Failed to parse persisted settings ({}). Falling back to defaults.",
                    e
                );
                let defaults = AppSettings::default();
                let v = serde_json::to_value(&defaults).map_err(|e| e.to_string())?;
                store.set(SETTINGS_KEY, v);
                store.save().map_err(|e| e.to_string())?;
                defaults
            }
        },
        None => {
            let defaults = AppSettings::default();
            let v = serde_json::to_value(&defaults).map_err(|e| e.to_string())?;
            store.set(SETTINGS_KEY, v);
            store.save().map_err(|e| e.to_string())?;
            defaults
        }
    };

    *get_settings_store().write() = loaded.clone();
    Ok(loaded)
}
