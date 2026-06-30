use tauri::{State, Emitter};
use crate::audio::{AudioState, DictationStatus};
use crate::stt::{SttState, SttEngineType, SttSessionState, streaming, processor};

#[tauri::command]
pub fn start_dictation(
    audio_state: State<'_, AudioState>,
    stt_state: State<'_, SttState>,
    session_state: State<'_, SttSessionState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
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

    // Snapshot the STT config without holding the lock across the spawn.
    let config = stt_state.0.read().get_config();
    let status_arc = audio_state.0.read().status.clone();

    match config.engine {
        SttEngineType::DeepgramCloud => {
            let session = streaming::start_streaming(config, receiver, app)
                .map_err(|e| e.to_string())?;
            session_state.set(session);
        }
        SttEngineType::WhisperCloud | SttEngineType::WhisperLocal => {
            let proc = processor::AudioProcessor::new(
                app,
                stt_state.0.clone(),
                status_arc,
            );
            proc.start(receiver);
        }
    }

    Ok(())
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
pub fn get_dictation_status(state: State<'_, AudioState>) -> Result<DictationStatus, String> {
    let engine = state.0.read();
    Ok(engine.get_status())
}
