//! Self-diagnostics ("Doctor") — a one-shot health sweep across the
//! subsystems a dictation session depends on: audio input, STT engine,
//! grammar engine, OS keychain, storage, network, meeting capture, and
//! on-disk models.
//!
//! Every check is content-free: no audio, transcripts, or document
//! contents are ever read or transmitted. Checks reuse the real helpers
//! from each subsystem (device enumeration, model catalogs, keyring
//! commands, settings store) so a green result means the actual code
//! paths work — and no error ever escapes as a command error: every
//! failure becomes a "fail" check result so the UI can render it.

use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::commands::grammar::GrammarEngine;
use crate::commands::settings::AppSettings;
use crate::grammar::llm_models;
use crate::stt::{whisper_local, SttEngineType, SttState};

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DoctorCheck {
    pub id: String,
    pub name: String,
    pub status: String, // "ok" | "warn" | "fail"
    pub detail: String,
    pub fix_hint: Option<String>,
}

fn ok(id: &str, name: &str, detail: String) -> DoctorCheck {
    DoctorCheck {
        id: id.to_string(),
        name: name.to_string(),
        status: "ok".to_string(),
        detail,
        fix_hint: None,
    }
}

fn warn(id: &str, name: &str, detail: String, hint: &str) -> DoctorCheck {
    DoctorCheck {
        id: id.to_string(),
        name: name.to_string(),
        status: "warn".to_string(),
        detail,
        fix_hint: Some(hint.to_string()),
    }
}

fn fail(id: &str, name: &str, detail: String, hint: &str) -> DoctorCheck {
    DoctorCheck {
        id: id.to_string(),
        name: name.to_string(),
        status: "fail".to_string(),
        detail,
        fix_hint: Some(hint.to_string()),
    }
}

/// Same integrity floor the model downloaders use: catalog sizes are rounded
/// to the MB, so an exact match is impossible — but a file below 90% of the
/// catalog size is a truncated artifact that will fail to load.
fn meets_size_floor(on_disk_bytes: u64, catalog_size_mb: u64) -> bool {
    on_disk_bytes >= catalog_size_mb * 1024 * 1024 * 9 / 10
}

/// Consent acknowledgment state relative to the current notice version
/// (`commands::meeting::MEETING_CONSENT_VERSION`).
#[derive(Debug, PartialEq)]
enum ConsentState {
    Current,
    Stale,
    NotAcknowledged,
}

fn consent_state(ack_version: Option<&str>, current_version: &str) -> ConsentState {
    match ack_version {
        Some(v) if v == current_version => ConsentState::Current,
        Some(_) => ConsentState::Stale,
        None => ConsentState::NotAcknowledged,
    }
}

// --- Checks ------------------------------------------------------------------

fn check_audio_input(settings: &AppSettings) -> DoctorCheck {
    const ID: &str = "audio-input";
    const NAME: &str = "Audio input";
    let devices = crate::audio::devices::enumerate_devices();
    if devices.is_empty() {
        return fail(
            ID,
            NAME,
            "No microphone or input device detected".to_string(),
            "Connect a microphone (or check OS microphone permissions) and run diagnostics again.",
        );
    }
    let default_name = devices
        .iter()
        .find(|d| d.is_default)
        .map(|d| d.name.clone())
        .unwrap_or_else(|| devices[0].name.clone());
    let detail = format!(
        "{} input device{} available; default: {}",
        devices.len(),
        if devices.len() == 1 { "" } else { "s" },
        default_name
    );
    if let Some(preferred) = settings.preferred_device_id.as_deref().filter(|p| !p.is_empty()) {
        if !devices.iter().any(|d| d.id == preferred) {
            return warn(
                ID,
                NAME,
                format!("Preferred device \"{preferred}\" is not connected — {detail}"),
                "Reconnect the device (check its power/mute switch) or pick another microphone in Settings → Audio.",
            );
        }
    }
    ok(ID, NAME, detail)
}

fn check_stt_engine(app: &AppHandle) -> DoctorCheck {
    const ID: &str = "stt-engine";
    const NAME: &str = "Speech engine";
    let config = match app.try_state::<SttState>() {
        Some(state) => state.0.read().get_config(),
        None => {
            return fail(
                ID,
                NAME,
                "STT engine state is not initialized".to_string(),
                "Restart Voxlen — if this persists, reinstall the app.",
            )
        }
    };

    match config.engine {
        SttEngineType::DeepgramCloud | SttEngineType::WhisperCloud => {
            let engine_label = match config.engine {
                SttEngineType::DeepgramCloud => "Deepgram Nova-3 (cloud)",
                _ => "OpenAI Whisper (cloud)",
            };
            // A Voxlen account key or a direct provider key both unlock cloud
            // STT. The engine config is hydrated from the OS keychain at boot,
            // but read the keychain too in case the doctor runs before the
            // frontend has pushed settings.
            let has_key = config.voxlen_api_key.as_deref().is_some_and(|k| !k.is_empty())
                || config.api_key.as_deref().is_some_and(|k| !k.is_empty())
                || crate::commands::keyring::read_secret("voxlenApiKey").is_some()
                || crate::commands::keyring::read_secret("sttApiKey").is_some();
            if has_key {
                ok(ID, NAME, format!("{engine_label} — API key configured"))
            } else {
                fail(
                    ID,
                    NAME,
                    format!("{engine_label} — no API key configured, dictation will fail"),
                    "Add a key in Settings → Speech Engine, or sign in to your Voxlen account in Settings → Account.",
                )
            }
        }
        SttEngineType::WhisperLocal => match whisper_local::resolve_model(app, &config.model) {
            None => fail(
                ID,
                NAME,
                "Whisper Local is selected but no model is downloaded".to_string(),
                "Download a model in Settings → Speech Engine to dictate offline.",
            ),
            Some(spec) => {
                let size = whisper_local::model_path(app, spec.id)
                    .ok()
                    .and_then(|p| std::fs::metadata(p).ok())
                    .map(|m| m.len())
                    .unwrap_or(0);
                if meets_size_floor(size, spec.size_mb) {
                    ok(
                        ID,
                        NAME,
                        format!(
                            "Whisper Local — model \"{}\" on disk ({} MB)",
                            spec.id,
                            size / (1024 * 1024)
                        ),
                    )
                } else {
                    fail(
                        ID,
                        NAME,
                        format!(
                            "Whisper Local model \"{}\" is truncated ({} of ~{} MB)",
                            spec.id,
                            size / (1024 * 1024),
                            spec.size_mb
                        ),
                        "Delete and re-download the model in Settings → Speech Engine.",
                    )
                }
            }
        },
    }
}

fn check_grammar_engine(app: &AppHandle, settings: &AppSettings) -> DoctorCheck {
    const ID: &str = "grammar-engine";
    const NAME: &str = "Grammar engine";
    let config = match crate::commands::grammar::get_grammar_config() {
        Ok(c) => c,
        Err(e) => {
            return fail(
                ID,
                NAME,
                format!("Could not read grammar configuration: {e}"),
                "Restart Voxlen — if this persists, reinstall the app.",
            )
        }
    };
    if !config.enabled {
        return ok(ID, NAME, "Grammar correction is disabled".to_string());
    }
    match config.engine {
        GrammarEngine::Cloud => {
            let has_key = config.voxlen_api_key.as_deref().is_some_and(|k| !k.is_empty())
                || config.api_key.as_deref().is_some_and(|k| !k.is_empty())
                || crate::commands::keyring::read_secret("voxlenApiKey").is_some()
                || crate::commands::keyring::read_secret("grammarApiKey").is_some();
            if has_key {
                ok(ID, NAME, "Cloud grammar — API key configured".to_string())
            } else {
                fail(
                    ID,
                    NAME,
                    "Cloud grammar — no API key configured, correction will fail".to_string(),
                    "Add a key in Settings → Grammar AI, or sign in to your Voxlen account in Settings → Account.",
                )
            }
        }
        GrammarEngine::LocalRules => ok(
            ID,
            NAME,
            "On-device rules engine — always available".to_string(),
        ),
        GrammarEngine::LocalLlm => {
            match llm_models::resolve_model(app, &settings.grammar_local_model) {
                None => fail(
                    ID,
                    NAME,
                    "Local AI grammar is selected but no model is downloaded".to_string(),
                    "Download the grammar model in Settings → Grammar AI (rules-only correction still works).",
                ),
                Some(spec) => {
                    let size = llm_models::model_path(app, spec.id)
                        .ok()
                        .and_then(|p| std::fs::metadata(p).ok())
                        .map(|m| m.len())
                        .unwrap_or(0);
                    if meets_size_floor(size, spec.size_mb) {
                        ok(
                            ID,
                            NAME,
                            format!(
                                "Rules + local AI polish — model \"{}\" on disk ({} MB)",
                                spec.id,
                                size / (1024 * 1024)
                            ),
                        )
                    } else {
                        fail(
                            ID,
                            NAME,
                            format!(
                                "Grammar model \"{}\" is truncated ({} of ~{} MB)",
                                spec.id,
                                size / (1024 * 1024),
                                spec.size_mb
                            ),
                            "Delete and re-download the model in Settings → Grammar AI.",
                        )
                    }
                }
            }
        }
    }
}

fn check_keyring() -> DoctorCheck {
    const ID: &str = "keyring";
    const NAME: &str = "Secure key storage";
    // Full write → read → delete roundtrip on a throwaway account, distinct
    // from every real key name — reuses the exact command internals the app
    // uses for API keys, so a green result means key storage actually works.
    const PROBE: &str = "voxlen-doctor-probe";
    const PROBE_VALUE: &str = "ok";
    let hint = "Your OS keychain (Credential Manager / Keychain) is not working — API keys cannot be saved. Check your OS user profile.";

    if let Err(e) = crate::commands::keyring::keyring_set(PROBE.into(), PROBE_VALUE.into()) {
        return fail(ID, NAME, format!("Keychain write failed: {e}"), hint);
    }
    let read_back = crate::commands::keyring::keyring_get(PROBE.into());
    // Always clean the probe entry up, even if the read failed.
    let deleted = crate::commands::keyring::keyring_delete(PROBE.into());
    match read_back {
        Ok(Some(v)) if v == PROBE_VALUE => {}
        Ok(other) => {
            return fail(
                ID,
                NAME,
                format!(
                    "Keychain read returned {} instead of the stored probe value",
                    if other.is_some() { "a different value" } else { "nothing" }
                ),
                hint,
            )
        }
        Err(e) => return fail(ID, NAME, format!("Keychain read failed: {e}"), hint),
    }
    if let Err(e) = deleted {
        return fail(ID, NAME, format!("Keychain delete failed: {e}"), hint);
    }
    ok(ID, NAME, "Write/read/delete roundtrip succeeded".to_string())
}

/// Write + delete a tiny probe file in `dir`. Content-free. Returns a
/// human-readable error on any failure.
fn probe_dir_writable(dir: &std::path::Path) -> Result<(), String> {
    let probe = dir.join("voxlen-doctor-probe.tmp");
    crate::commands::documents::write_file_atomic(&probe, b"voxlen doctor storage probe")
        .map_err(|e| e.to_string())?;
    std::fs::remove_file(&probe).map_err(|e| e.to_string())
}

/// Boot-flag pattern from `lib.rs`: read the frontend-owned camelCase
/// settings store READ-ONLY for the fields Rust doesn't mirror
/// (auto-documents + review queue paths).
fn frontend_settings(app: &AppHandle) -> Option<serde_json::Value> {
    app.store("settings.json").ok().and_then(|store| store.get("settings"))
}

fn check_storage(app: &AppHandle) -> DoctorCheck {
    const ID: &str = "storage";
    const NAME: &str = "Storage";

    // 1. App data dir — history, settings, and models live here; if this is
    //    broken nothing can persist.
    let app_data = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(e) => {
            return fail(
                ID,
                NAME,
                format!("App data directory is unavailable: {e}"),
                "Check disk space and permissions on your user profile folder.",
            )
        }
    };
    if let Err(e) = std::fs::create_dir_all(&app_data) {
        return fail(
            ID,
            NAME,
            format!("Could not create the app data directory: {e}"),
            "Check disk space and permissions on your user profile folder.",
        );
    }
    if let Err(e) = probe_dir_writable(&app_data) {
        return fail(
            ID,
            NAME,
            format!("App data directory is not writable: {e}"),
            "Check disk space and permissions on your user profile folder.",
        );
    }

    let mut details = vec!["app data writable".to_string()];

    // 2. Auto-documents root (frontend-owned setting) — only when enabled.
    let fe = frontend_settings(app);
    let auto_doc_enabled = fe
        .as_ref()
        .and_then(|v| v.get("autoDocEnabled"))
        .and_then(|b| b.as_bool())
        .unwrap_or(false);
    let auto_doc_root = fe
        .as_ref()
        .and_then(|v| v.get("autoDocRootPath"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();
    if auto_doc_enabled {
        if auto_doc_root.is_empty() {
            return warn(
                ID,
                NAME,
                "Auto-documents is enabled but no documents folder is set".to_string(),
                "Choose a documents folder in Settings → Privacy → Documents.",
            );
        }
        let root = std::path::PathBuf::from(&auto_doc_root);
        if !root.is_dir() {
            return warn(
                ID,
                NAME,
                "Auto-documents folder does not exist or is unavailable".to_string(),
                "Re-select the documents folder in Settings → Privacy → Documents (network drives must be connected).",
            );
        }
        if let Err(e) = probe_dir_writable(&root) {
            return warn(
                ID,
                NAME,
                format!("Auto-documents folder is not writable: {e}"),
                "Check permissions on the documents folder, or pick another in Settings → Privacy → Documents.",
            );
        }
        details.push("documents folder writable".to_string());
    }

    // 3. Review queue shared folder (frontend-owned setting) — reachability
    //    only; the queue itself may legitimately not exist yet.
    let review_root = fe
        .as_ref()
        .and_then(|v| v.get("reviewSharedFolderPath"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();
    if !review_root.is_empty() {
        let root = std::path::PathBuf::from(&review_root);
        if std::fs::read_dir(&root).is_err() {
            return warn(
                ID,
                NAME,
                "Review shared folder is unreachable".to_string(),
                "Check that the shared/network folder is connected, or re-select it in Settings → Privacy → Review.",
            );
        }
        details.push("review folder reachable".to_string());
    }

    ok(ID, NAME, details.join("; "))
}

async fn check_network(app: &AppHandle, settings: &AppSettings) -> DoctorCheck {
    const ID: &str = "network";
    const NAME: &str = "Network";

    if crate::commands::settings::get_privileged_mode() {
        return ok(ID, NAME, "skipped — privileged mode is offline-only".to_string());
    }

    // Only meaningful when something actually uses the cloud.
    let stt_cloud = app
        .try_state::<SttState>()
        .map(|s| {
            !matches!(s.0.read().get_config().engine, SttEngineType::WhisperLocal)
        })
        .unwrap_or(false);
    let grammar_cloud = crate::commands::grammar::get_grammar_config()
        .map(|c| c.enabled && c.engine == GrammarEngine::Cloud)
        .unwrap_or(false);
    let voxlen_key = settings.voxlen_api_key.as_deref().is_some_and(|k| !k.is_empty())
        || crate::commands::keyring::read_secret("voxlenApiKey").is_some();
    if !stt_cloud && !grammar_cloud && !voxlen_key {
        return ok(ID, NAME, "no cloud services in use — network not required".to_string());
    }

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return fail(
                ID,
                NAME,
                format!("Could not initialize the HTTP client: {e}"),
                "Restart Voxlen — if this persists, reinstall the app.",
            )
        }
    };

    // Unauthenticated HEAD probes — any HTTP response (including 401/405)
    // proves the host is reachable. No keys, no content.
    let (deepgram, voxlen) = tokio::join!(
        client.head("https://api.deepgram.com").send(),
        client.head("https://www.voxlen.ai/api/waitlist").send(),
    );
    let mut unreachable = Vec::new();
    if deepgram.is_err() {
        unreachable.push("api.deepgram.com");
    }
    if voxlen.is_err() {
        unreachable.push("voxlen.ai");
    }
    if unreachable.is_empty() {
        ok(ID, NAME, "Cloud endpoints reachable".to_string())
    } else {
        warn(
            ID,
            NAME,
            format!("Unreachable: {}", unreachable.join(", ")),
            "Cloud dictation will fail — check your connection/firewall.",
        )
    }
}

fn check_meeting_capture(settings: &AppSettings) -> DoctorCheck {
    const ID: &str = "meeting-capture";
    const NAME: &str = "Meeting capture";
    if !crate::audio::loopback::is_supported() {
        return warn(
            ID,
            NAME,
            "System-audio meeting capture is not supported on this OS".to_string(),
            "Windows only for now — macOS support (ScreenCaptureKit) is planned.",
        );
    }
    match consent_state(
        settings.meeting_consent_ack_version.as_deref(),
        crate::commands::meeting::MEETING_CONSENT_VERSION,
    ) {
        ConsentState::Current => ok(
            ID,
            NAME,
            "Supported on this OS; recording consent acknowledged (current notice)".to_string(),
        ),
        ConsentState::Stale => warn(
            ID,
            NAME,
            "The recording consent notice was updated since it was last acknowledged".to_string(),
            "Open the Meeting panel to review and re-acknowledge the consent notice before the next capture.",
        ),
        ConsentState::NotAcknowledged => ok(
            ID,
            NAME,
            "Supported on this OS; consent not yet acknowledged — you will be prompted before the first capture"
                .to_string(),
        ),
    }
}

fn check_models_on_disk(app: &AppHandle) -> DoctorCheck {
    const ID: &str = "models-on-disk";
    const NAME: &str = "Downloaded models";
    let mut healthy = Vec::new();
    let mut corrupt = Vec::new();

    // (model id, on-disk path, catalog size) across both catalogs.
    let mut entries: Vec<(String, std::path::PathBuf, u64)> = Vec::new();
    for spec in whisper_local::MODEL_CATALOG {
        if let Ok(path) = whisper_local::model_path(app, spec.id) {
            entries.push((spec.id.to_string(), path, spec.size_mb));
        }
    }
    for spec in llm_models::LLM_CATALOG {
        if let Ok(path) = llm_models::model_path(app, spec.id) {
            entries.push((spec.id.to_string(), path, spec.size_mb));
        }
    }

    for (id, path, size_mb) in entries {
        let Ok(meta) = std::fs::metadata(&path) else { continue }; // not downloaded
        if meets_size_floor(meta.len(), size_mb) {
            healthy.push(format!("{id} ({} MB)", meta.len() / (1024 * 1024)));
        } else {
            corrupt.push(format!(
                "{id} ({} of ~{} MB)",
                meta.len() / (1024 * 1024),
                size_mb
            ));
        }
    }

    if !corrupt.is_empty() {
        return fail(
            ID,
            NAME,
            format!("Truncated model file{}: {}", if corrupt.len() == 1 { "" } else { "s" }, corrupt.join(", ")),
            "Delete and re-download the affected model(s) in Settings.",
        );
    }
    if healthy.is_empty() {
        ok(ID, NAME, "No local models downloaded".to_string())
    } else {
        ok(ID, NAME, format!("All model files pass integrity checks: {}", healthy.join(", ")))
    }
}

// --- Command -----------------------------------------------------------------

/// Run every diagnostic check. Never returns Err: any per-check problem is
/// reported as a `"fail"` check result so the UI always has something to
/// render.
#[tauri::command]
pub async fn run_doctor(app: AppHandle) -> Result<Vec<DoctorCheck>, String> {
    let settings = crate::commands::settings::get_current_settings();
    let checks = vec![
        check_audio_input(&settings),
        check_stt_engine(&app),
        check_grammar_engine(&app, &settings),
        check_keyring(),
        check_storage(&app),
        check_network(&app, &settings).await,
        check_meeting_capture(&settings),
        check_models_on_disk(&app),
    ];
    Ok(checks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_floor_matches_downloader_convention() {
        // 100 MB catalog entry → floor is 90% of 100 MiB.
        let floor = 100u64 * 1024 * 1024 * 9 / 10;
        assert!(meets_size_floor(floor, 100));
        assert!(!meets_size_floor(floor - 1, 100));
        assert!(meets_size_floor(100 * 1024 * 1024, 100));
        // Empty / missing files never pass.
        assert!(!meets_size_floor(0, 77));
    }

    #[test]
    fn consent_state_tracks_notice_version() {
        let current = crate::commands::meeting::MEETING_CONSENT_VERSION;
        assert_eq!(consent_state(Some(current), current), ConsentState::Current);
        assert_eq!(consent_state(Some("2020-01"), current), ConsentState::Stale);
        assert_eq!(consent_state(None, current), ConsentState::NotAcknowledged);
    }

    #[test]
    fn status_constructors_set_hints_correctly() {
        let c = ok("x", "X", "fine".into());
        assert_eq!((c.status.as_str(), c.fix_hint.is_none()), ("ok", true));
        let c = warn("x", "X", "meh".into(), "do a thing");
        assert_eq!((c.status.as_str(), c.fix_hint.as_deref()), ("warn", Some("do a thing")));
        let c = fail("x", "X", "bad".into(), "fix it");
        assert_eq!((c.status.as_str(), c.fix_hint.as_deref()), ("fail", Some("fix it")));
    }
}
