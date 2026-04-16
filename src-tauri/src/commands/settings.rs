use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::secrets::{self, Secret};

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

    // Licensing
    #[serde(default)]
    pub license_key: Option<String>,
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

            license_key: None,
        }
    }
}

/// Read the currently-persisted license key (if any) from the in-memory
/// settings cache. Used by gated commands and by the `license` command
/// module. Backed by the OS keyring via the `secrets` module.
pub fn current_license_key() -> Option<String> {
    get_settings_store().read().license_key.clone()
}

/// Set (or clear) the license key. Persists to the OS keyring (not to
/// disk) and refreshes the in-memory cache.
pub fn set_license_key(_app: &AppHandle, key: Option<String>) -> Result<(), String> {
    secrets::write(Secret::LicenseKey, key.as_deref())?;
    get_settings_store().write().license_key = key;
    Ok(())
}

/// Fields that live in the OS keyring rather than the plain-text store.
/// Stripped from the struct before it is persisted to disk and re-hydrated
/// on load.
fn strip_secrets(settings: &mut AppSettings) {
    settings.license_key = None;
    settings.stt_api_key = None;
    settings.grammar_api_key = None;
}

/// Hydrate secrets from the OS keyring into an in-memory settings snapshot.
fn hydrate_secrets(settings: &mut AppSettings) {
    settings.license_key = secrets::read(Secret::LicenseKey);
    settings.stt_api_key = secrets::read(Secret::SttApiKey);
    settings.grammar_api_key = secrets::read(Secret::GrammarApiKey);
}

/// Migrate secrets that were previously written to the plain-text store
/// into the OS keyring, then wipe them from the on-disk snapshot. Safe to
/// call on every startup; becomes a no-op after the first successful run.
fn migrate_plaintext_secrets(app: &AppHandle, loaded: &mut AppSettings) -> Result<(), String> {
    let mut migrated = false;
    if let Some(v) = loaded.license_key.clone().filter(|s| !s.is_empty()) {
        if secrets::write(Secret::LicenseKey, Some(&v)).is_ok() {
            migrated = true;
        }
    }
    if let Some(v) = loaded.stt_api_key.clone().filter(|s| !s.is_empty()) {
        if secrets::write(Secret::SttApiKey, Some(&v)).is_ok() {
            migrated = true;
        }
    }
    if let Some(v) = loaded.grammar_api_key.clone().filter(|s| !s.is_empty()) {
        if secrets::write(Secret::GrammarApiKey, Some(&v)).is_ok() {
            migrated = true;
        }
    }
    if migrated {
        let mut stripped = loaded.clone();
        strip_secrets(&mut stripped);
        persist_settings(app, &stripped)?;
        log::info!("Migrated plain-text secrets to OS keyring.");
    }
    Ok(())
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
    // Never write secrets to the on-disk store; they live in the keyring.
    let mut sanitised = settings.clone();
    strip_secrets(&mut sanitised);
    let value = serde_json::to_value(&sanitised).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    Ok(get_settings_store().read().clone())
}

#[tauri::command]
pub fn update_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    // Route secrets to the OS keyring; everything else to the on-disk store.
    secrets::write(Secret::LicenseKey, settings.license_key.as_deref())?;
    secrets::write(Secret::SttApiKey, settings.stt_api_key.as_deref())?;
    secrets::write(Secret::GrammarApiKey, settings.grammar_api_key.as_deref())?;
    *get_settings_store().write() = settings.clone();
    persist_settings(&app, &settings)?;
    Ok(())
}

#[tauri::command]
pub fn reset_settings(app: AppHandle) -> Result<AppSettings, String> {
    // Clear keyring-backed secrets as part of the reset.
    let _ = secrets::write(Secret::LicenseKey, None);
    let _ = secrets::write(Secret::SttApiKey, None);
    let _ = secrets::write(Secret::GrammarApiKey, None);
    let defaults = AppSettings::default();
    *get_settings_store().write() = defaults.clone();
    persist_settings(&app, &defaults)?;
    Ok(defaults)
}

/// Load settings from disk into the in-memory cache. Called once during app
/// startup. If the store file does not exist or the `settings` key is missing,
/// defaults are written to disk so subsequent reads are consistent.
#[tauri::command]
pub fn load_settings_from_disk(app: AppHandle) -> Result<AppSettings, String> {
    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| e.to_string())?;

    let mut loaded = match store.get(SETTINGS_KEY) {
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

    // Move any plain-text secrets into the keyring before hydrating from it.
    // This is a one-shot migration for installs upgrading from pre-keyring builds.
    if let Err(e) = migrate_plaintext_secrets(&app, &mut loaded) {
        log::warn!("Secret migration failed: {}", e);
    }
    hydrate_secrets(&mut loaded);

    *get_settings_store().write() = loaded.clone();
    Ok(loaded)
}
