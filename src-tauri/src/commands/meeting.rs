//! Meeting capture commands.
//!
//! The consent gate is enforced HERE, backend-side, fail-closed: capture
//! refuses to start unless a consent acknowledgment is stored in settings,
//! and refuses to start if the always-on-top recording indicator window
//! cannot be created. The indicator is deliberately honest — visible, in
//! the taskbar, showing elapsed time — Voxlen never records covertly.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};

use crate::meeting::{MeetingState, INDICATOR_LABEL};

/// Current version of the recording-consent notice. MUST match
/// `CONSENT_VERSION` in `src/components/meeting/MeetingPanel.tsx` — when the
/// consent copy changes, bump both so previously stored acknowledgments go
/// stale and every user is re-prompted before the next capture.
const MEETING_CONSENT_VERSION: &str = "2026-07";

#[tauri::command]
pub fn meeting_capture_supported() -> bool {
    crate::audio::loopback::is_supported()
}

#[tauri::command]
pub fn meeting_capture_active(state: State<'_, MeetingState>) -> bool {
    state.active.load(Ordering::Relaxed)
}

#[tauri::command]
pub async fn start_meeting_capture(
    app: AppHandle,
    state: State<'_, MeetingState>,
) -> Result<(), String> {
    if !crate::audio::loopback::is_supported() {
        return Err("Meeting capture is not yet supported on this platform.".to_string());
    }
    if state.active.load(Ordering::Relaxed) {
        return Err("A meeting capture is already running.".to_string());
    }

    // Fail-closed consent gate — frontend dialogs are not enough. The stored
    // acknowledgment must be for the CURRENT consent notice; an ack of an
    // older version means the user has never seen the current copy.
    let settings = crate::commands::settings::get_current_settings();
    match settings.meeting_consent_ack_version.as_deref() {
        Some(v) if v == MEETING_CONSENT_VERSION => {}
        Some(_) => {
            return Err(
                "The recording consent notice has been updated since it was last acknowledged. Open the Meeting panel to review and re-acknowledge the consent notice."
                    .to_string(),
            );
        }
        None => {
            return Err(
                "Recording consent has not been acknowledged. Open the Meeting panel to review the consent notice first."
                    .to_string(),
            );
        }
    }

    // Whisper Local is mandatory for meetings; verify a model exists before
    // opening any audio streams.
    if crate::stt::whisper_local::resolve_model(&app, &settings.whisper_local_model).is_none() {
        return Err(
            "Meeting capture runs fully on-device and needs a Whisper model. Download one in Settings → Speech Recognition."
                .to_string(),
        );
    }

    // Visible recording indicator — if it cannot be shown, do not record.
    let indicator = tauri::WebviewWindowBuilder::new(
        &app,
        INDICATOR_LABEL,
        tauri::WebviewUrl::App("index.html#/meeting-indicator".into()),
    )
    .title("Voxlen — Recording")
    .inner_size(240.0, 56.0)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .always_on_top(true)
    .decorations(false)
    .build()
    .map_err(|e| format!("Could not create the recording indicator window ({e}) — capture aborted."))?;
    let _ = indicator.show();

    let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));

    // Fault flags: set by the capture threads when a stream dies, polled by
    // the meeting task, surfaced to the UI as `meeting-audio-fault` events.
    let mic_fault = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let loopback_fault = Arc::new(std::sync::atomic::AtomicBool::new(false));

    // Mic channel — reuse the standard capture path (gain, noise suppression,
    // level events for the UI).
    let (mic_tx, mic_rx) = crossbeam_channel::bounded(64);
    let mic_result = crate::audio::capture::start_capture_with_options(
        settings.preferred_device_id.clone(),
        mic_tx,
        Arc::new(parking_lot::RwLock::new(0.0)),
        app.clone(),
        settings.input_gain as f32,
        settings.noise_suppression,
        mic_fault.clone(),
        Arc::new(std::sync::atomic::AtomicBool::new(false)),
    );
    let (mic_handle, _) = match mic_result {
        Ok(h) => h,
        Err(e) => {
            let _ = indicator.close();
            return Err(format!("Could not open the microphone: {e}"));
        }
    };

    // Loopback channel — the remote side of the call.
    let (loop_tx, loop_rx) = crossbeam_channel::bounded(64);
    let loopback_handle = match crate::audio::loopback::start_loopback_capture(loop_tx, loopback_fault.clone()) {
        Ok(h) => h,
        Err(e) => {
            mic_handle.stop();
            let _ = indicator.close();
            return Err(format!("Could not capture system audio: {e}"));
        }
    };

    state.active.store(true, Ordering::Relaxed);
    *state.stop_flag.lock() = Some(stop_flag.clone());
    *state.mic_handle.lock() = Some(mic_handle);
    *state.loopback_handle.lock() = Some(loopback_handle);

    crate::meeting::spawn_meeting_task(
        app.clone(),
        mic_rx,
        loop_rx,
        stop_flag,
        state.active.clone(),
        mic_fault,
        loopback_fault,
    );

    let _ = app.emit("meeting-started", ());
    log::info!("Meeting capture started (dual-channel, Whisper Local)");
    Ok(())
}

#[tauri::command]
pub async fn stop_meeting_capture(app: AppHandle) -> Result<(), String> {
    // Shared with the meeting task's exit path — see meeting::teardown_capture.
    crate::meeting::teardown_capture(&app);
    log::info!("Meeting capture stop requested");
    Ok(())
}
