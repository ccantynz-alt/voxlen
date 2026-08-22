//! Meeting capture commands.
//!
//! The consent gate is enforced HERE, backend-side, fail-closed: capture
//! refuses to start unless a consent acknowledgment is stored in settings,
//! and refuses to start if the always-on-top recording indicator window
//! cannot be created. The indicator is deliberately honest — visible, in
//! the taskbar, showing elapsed time — Voxlen never records covertly.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::meeting::MeetingState;

const INDICATOR_LABEL: &str = "meeting-indicator";

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

    // Fail-closed consent gate — frontend dialogs are not enough.
    let settings = crate::commands::settings::get_current_settings();
    if settings.meeting_consent_ack_version.is_none() {
        return Err(
            "Recording consent has not been acknowledged. Open the Meeting panel to review the consent notice first."
                .to_string(),
        );
    }

    // Whisper Local is mandatory for meetings; verify a model exists before
    // opening any audio streams.
    if crate::stt::whisper_local::resolve_model(&app, &settings.whisper_local_model).is_none() {
        return Err(
            "Meeting capture runs fully on-device and needs a Whisper model. Download one in Settings → Speech Recognition."
                .to_string(),
        );
    }

    // From here on the start has side effects (indicator window, live audio
    // streams) but the handles are not published until the very end, so a
    // stop arriving in this window has nothing to take. Latch it instead.
    state.begin_start();

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
        Arc::new(std::sync::atomic::AtomicBool::new(false)),
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
    let loopback_handle = match crate::audio::loopback::start_loopback_capture(loop_tx) {
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

    // Close the start window. If the user hit Stop while devices were
    // opening, that click found nothing to stop — honour it now rather than
    // recording on with no indicator on screen.
    if state.take_stop_requested() {
        teardown_capture(&app, &state);
        state.active.store(false, Ordering::Relaxed);
        log::info!("Meeting capture stopped during startup (stop requested mid-start)");
        // Reported as an error, not Ok: the caller sets its "recording" UI
        // state on a successful start, and no meeting task exists to emit
        // `meeting-stopped` and clear it again.
        return Err("Meeting capture was stopped before it finished starting.".to_string());
    }

    crate::meeting::spawn_meeting_task(
        app.clone(),
        mic_rx,
        loop_rx,
        stop_flag,
        state.active.clone(),
    );

    let _ = app.emit("meeting-started", ());
    log::info!("Meeting capture started (dual-channel, Whisper Local)");
    Ok(())
}

/// Signals the capture task, stops both audio streams and closes the
/// indicator. Safe to call when nothing has been published yet.
fn teardown_capture(app: &AppHandle, state: &MeetingState) {
    if let Some(flag) = state.stop_flag.lock().take() {
        flag.store(true, Ordering::Relaxed);
    }
    if let Some(handle) = state.mic_handle.lock().take() {
        handle.stop();
    }
    if let Some(handle) = state.loopback_handle.lock().take() {
        handle.stop();
    }
    if let Some(win) = app.get_webview_window(INDICATOR_LABEL) {
        let _ = win.close();
    }
}

#[tauri::command]
pub async fn stop_meeting_capture(
    app: AppHandle,
    state: State<'_, MeetingState>,
) -> Result<(), String> {
    // Latch first, unconditionally: if a start is still opening devices the
    // handles below are all None and this click would otherwise be lost.
    state.request_stop();
    teardown_capture(&app, &state);
    log::info!("Meeting capture stop requested");
    Ok(())
}
