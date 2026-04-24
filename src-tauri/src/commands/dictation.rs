use tauri::{AppHandle, State};
use crate::audio::{AudioState, DictationStatus};
use crate::stt::{SttEngineType, SttState};
use crate::stt::streaming;

/// Holds the active streaming session so it can be stopped on demand.
pub struct StreamingSessionState(pub parking_lot::Mutex<Option<streaming::StreamingSession>>);

#[tauri::command]
pub async fn start_dictation(
    app: AppHandle,
    audio_state: State<'_, AudioState>,
    stt_state: State<'_, SttState>,
    streaming_state: State<'_, StreamingSessionState>,
) -> Result<(), String> {
    // Start audio capture (chunks go to batch channel by default).
    audio_state.0.read().start_capture().map_err(|e| e.to_string())?;

    // For Deepgram, open a streaming channel and start the WebSocket session.
    let config = stt_state.0.read().get_config();
    if matches!(config.engine, SttEngineType::DeepgramCloud) {
        if let Some(api_key) = config.api_key {
            let receiver = audio_state.0.read().start_streaming_channel();
            match streaming::start_streaming(
                api_key,
                config.language,
                config.auto_detect_language,
                receiver,
                app,
            ) {
                Ok(session) => {
                    *streaming_state.0.lock() = Some(session);
                    log::info!("Deepgram streaming session started");
                }
                Err(e) => {
                    // Streaming failed to initialize; fall back to batch silently.
                    audio_state.0.read().stop_streaming_channel();
                    log::warn!("Streaming init failed, falling back to batch: {}", e);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn stop_dictation(
    audio_state: State<'_, AudioState>,
    streaming_state: State<'_, StreamingSessionState>,
) -> Result<(), String> {
    if let Some(session) = streaming_state.0.lock().take() {
        session.stop();
    }
    audio_state.0.read().stop_streaming_channel();
    audio_state.0.read().stop_capture().map_err(|e| e.to_string())
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
