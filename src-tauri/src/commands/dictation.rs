use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{State, Emitter, Manager};
use crate::audio::{AudioState, DictationStatus};
use crate::stt::{SttState, SttEngineType, SttSessionState, streaming, processor, gate};

/// True while Always-Ready mode is armed. While armed, the watchdog treats
/// Idle/Error as recoverable (re-arms capture) instead of terminal, so the
/// mic pipeline survives stops, device unplugs, and sleep/wake indefinitely.
pub static ALWAYS_READY_ARMED: AtomicBool = AtomicBool::new(false);

/// Retry cadence once normal recovery has repeatedly failed while armed —
/// slow enough not to spam a missing device, fast enough to pick a replugged
/// mic up promptly.
const ALWAYS_READY_SLOW_RETRY: Duration = Duration::from_secs(15);

/// Guards against spawning more than one recovery watchdog at a time (e.g. if
/// push-to-talk fires start_dictation twice in quick succession). The
/// watchdog itself exits — and clears this — as soon as dictation reaches a
/// terminal state (Idle or Error).
static WATCHDOG_ACTIVE: AtomicBool = AtomicBool::new(false);

const WATCHDOG_POLL: Duration = Duration::from_millis(500);
const RECOVERY_SETTLE: Duration = Duration::from_millis(1500);
const MAX_CONSECUTIVE_FAILURES: u32 = 5;

fn start_dictation_internal(
    audio_state: &State<'_, AudioState>,
    stt_state: &State<'_, SttState>,
    session_state: &State<'_, SttSessionState>,
    app: &tauri::AppHandle,
) -> Result<Option<String>, String> {
    if crate::commands::settings::get_privileged_mode() {
        let _ = app.emit("privileged-mode-active", true);
    }

    // Stop any existing STT session before starting a new one.
    session_state.stop();

    let s = crate::commands::settings::get_current_settings();
    let input_gain = s.input_gain.max(0.1).min(4.0);
    let noise_suppression = s.noise_suppression;

    // Start audio capture; get back the receiver end of the fresh channel.
    let receiver = audio_state.0.read()
        .start_capture_with_options(input_gain, noise_suppression)
        .map_err(|e| e.to_string())?;

    let active_device = audio_state.0.read().get_active_device_name();

    // Snapshot the STT config without holding the lock across the spawn.
    let config = stt_state.0.read().get_config();
    let status_arc = audio_state.0.read().status.clone();

    match config.engine {
        SttEngineType::DeepgramCloud => {
            if s.always_ready_mode && !crate::commands::settings::get_privileged_mode() {
                // Always-Ready: capture stays alive; the gate opens/closes
                // cloud sessions on local voice activity.
                let g = gate::start_gate(receiver, stt_state.0.clone(), app.clone());
                session_state.set_gated(g);
            } else {
                let session = streaming::start_streaming(config, receiver, app.clone())
                    .map_err(|e| e.to_string())?;
                session_state.set(session);
            }
        }
        SttEngineType::WhisperCloud | SttEngineType::WhisperLocal => {
            let proc = processor::AudioProcessor::new(
                app.clone(),
                stt_state.0.clone(),
                status_arc,
            );
            proc.start(receiver);
        }
    }

    Ok(active_device)
}

#[tauri::command]
pub fn start_dictation(
    audio_state: State<'_, AudioState>,
    stt_state: State<'_, SttState>,
    session_state: State<'_, SttSessionState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    start_dictation_internal(&audio_state, &stt_state, &session_state, &app)?;
    spawn_capture_watchdog(app);
    Ok(())
}

/// Re-runs the same capture + STT wiring as `start_dictation`, but pulls
/// state via the AppHandle instead of Tauri-injected `State<T>` — needed
/// because the watchdog runs on a plain background thread, not inside a
/// `#[tauri::command]`.
fn restart_capture(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let audio_state = app.try_state::<AudioState>().ok_or("Audio engine unavailable")?;
    let stt_state = app.try_state::<SttState>().ok_or("STT engine unavailable")?;
    let session_state = app.try_state::<SttSessionState>().ok_or("STT session unavailable")?;

    // The old stream is already dead (that's why we're here) — stop it
    // cleanly before starting a fresh one on the same or a fallback device.
    let _ = audio_state.0.read().stop_capture();

    start_dictation_internal(&audio_state, &stt_state, &session_state, app)
}

/// Watches for capture faults (stream errors, device unplugged/muted) while
/// dictation is listening, and automatically restarts capture — reconnecting
/// to the preferred device if it came back, or falling back to the best
/// available one — instead of requiring the user to notice and manually
/// restart dictation. Gives up after a handful of consecutive failures so a
/// fundamentally broken device doesn't retry forever.
fn spawn_capture_watchdog(app: tauri::AppHandle) {
    if WATCHDOG_ACTIVE
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return; // Already watching this (or another) dictation session.
    }

    std::thread::spawn(move || {
        let mut consecutive_failures: u32 = 0;

        loop {
            std::thread::sleep(WATCHDOG_POLL);

            let Some(audio_state) = app.try_state::<AudioState>() else { break };
            match audio_state.0.read().get_status() {
                // Terminal states: user stopped dictation, or we gave up below —
                // UNLESS Always-Ready is armed, in which case Idle/Error means
                // the pipeline must be brought back up.
                DictationStatus::Idle | DictationStatus::Error => {
                    if !ALWAYS_READY_ARMED.load(Ordering::SeqCst) {
                        break;
                    }
                    // Pace retries: normal settle first, slow cadence once
                    // recovery has repeatedly failed (device unplugged, etc.).
                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES {
                        std::thread::sleep(ALWAYS_READY_SLOW_RETRY);
                    } else {
                        std::thread::sleep(RECOVERY_SETTLE);
                    }
                    // Re-check: user may have disarmed while we slept.
                    if !ALWAYS_READY_ARMED.load(Ordering::SeqCst) {
                        break;
                    }
                    match restart_capture(&app) {
                        Ok(device) => {
                            consecutive_failures = 0;
                            let _ = app.emit(
                                "audio-recovery-result",
                                serde_json::json!({ "ok": true, "device": device }),
                            );
                        }
                        Err(e) => {
                            consecutive_failures = consecutive_failures.saturating_add(1);
                            if consecutive_failures == MAX_CONSECUTIVE_FAILURES {
                                log::error!("Always-Ready: mic unavailable, dropping to slow retry: {}", e);
                                let _ = app.emit("audio-recovery-giveup", ());
                            }
                        }
                    }
                    continue;
                }
                // Paused: keep the watchdog alive but don't restart capture —
                // recovering here would silently resume a session the user
                // deliberately paused.
                DictationStatus::Paused => continue,
                // Listening, or Processing (batch mode sets Processing during
                // HTTP transcription): keep watching for device faults.
                DictationStatus::Listening | DictationStatus::Processing => {}
            }

            if !audio_state.0.read().take_device_fault() {
                consecutive_failures = 0;
                continue;
            }

            let _ = app.emit("audio-recovery-attempt", ());
            // Give a toggled mute button / USB re-enumeration a moment to settle
            // before we try to reopen the stream.
            std::thread::sleep(RECOVERY_SETTLE);

            match restart_capture(&app) {
                Ok(device) => {
                    consecutive_failures = 0;
                    let _ = app.emit(
                        "audio-recovery-result",
                        serde_json::json!({ "ok": true, "device": device }),
                    );
                }
                Err(e) => {
                    consecutive_failures += 1;
                    log::error!("Microphone auto-recovery failed: {}", e);
                    let _ = app.emit(
                        "audio-recovery-result",
                        serde_json::json!({ "ok": false, "error": e }),
                    );
                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES {
                        if let Some(audio_state) = app.try_state::<AudioState>() {
                            audio_state.0.read().mark_error();
                        }
                        let _ = app.emit("audio-recovery-giveup", ());
                        if ALWAYS_READY_ARMED.load(Ordering::SeqCst) {
                            // Status is now Error; the Idle/Error arm above
                            // keeps retrying on the slow cadence while armed.
                            continue;
                        }
                        break;
                    }
                }
            }
        }

        WATCHDOG_ACTIVE.store(false, Ordering::SeqCst);
    });
}

/// Arm Always-Ready mode: bring the capture pipeline up (off the calling
/// thread — device enumeration blocks) and keep the watchdog alive so it
/// survives faults and stops. Idempotent; called on the false→true edge of
/// the effective setting from `update_settings`.
pub fn arm_always_ready(app: &tauri::AppHandle) {
    if ALWAYS_READY_ARMED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return; // Already armed.
    }
    log::info!("Always-Ready mode armed");
    sync_tray_check(app, true);
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = restart_capture(&app) {
            // Watchdog will keep retrying — just surface the first failure.
            log::warn!("Always-Ready initial start failed (watchdog will retry): {}", e);
        }
        spawn_capture_watchdog(app);
    });
}

/// Disarm Always-Ready mode and tear the pipeline down. Idempotent.
pub fn disarm_always_ready(app: &tauri::AppHandle) {
    if ALWAYS_READY_ARMED
        .compare_exchange(true, false, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return; // Already disarmed.
    }
    log::info!("Always-Ready mode disarmed");
    sync_tray_check(app, false);
    if let Some(session_state) = app.try_state::<SttSessionState>() {
        session_state.stop();
    }
    if let Some(audio_state) = app.try_state::<AudioState>() {
        let _ = audio_state.0.read().stop_capture();
    }
    let _ = app.emit("always-ready-state", "off");
}

/// Keep the tray CheckMenuItem in sync when arming state changes from any
/// path (Settings UI, tray click, privileged-mode override, reset).
fn sync_tray_check(app: &tauri::AppHandle, checked: bool) {
    if let Some(tray_state) = app.try_state::<crate::TrayState>() {
        let _ = tray_state.always_ready_item.set_checked(checked);
    }
}

/// Whether Always-Ready is currently armed — for frontend hydration.
#[tauri::command]
pub fn get_always_ready_state() -> Result<bool, String> {
    Ok(ALWAYS_READY_ARMED.load(Ordering::SeqCst))
}

#[tauri::command]
pub fn stop_dictation(
    audio_state: State<'_, AudioState>,
    session_state: State<'_, SttSessionState>,
) -> Result<(), String> {
    // Send CloseStream to Deepgram (if streaming) before dropping the capture sender.
    session_state.stop();

    audio_state.0.read()
        .stop_capture()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pause_dictation(state: State<'_, AudioState>) -> Result<(), String> {
    let engine = state.0.read();
    engine.pause_capture().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resume_dictation(state: State<'_, AudioState>) -> Result<(), String> {
    let engine = state.0.read();
    engine.resume_capture().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_dictation_status(state: State<'_, AudioState>) -> Result<DictationStatus, String> {
    let engine = state.0.read();
    Ok(engine.get_status())
}
