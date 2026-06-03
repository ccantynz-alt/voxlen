use tauri::{State, Emitter};
use crate::audio::{AudioState, DictationStatus};

#[tauri::command]
pub fn start_dictation(
    state: State<'_, AudioState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if crate::commands::settings::get_privileged_mode() {
        let _ = app.emit("privileged-mode-active", true);
    }
    let s = crate::commands::settings::get_current_settings();
    let input_gain = s.input_gain.max(0.1).min(4.0);
    let noise_suppression = s.noise_suppression;
    let engine = state.0.read();
    engine.start_capture_with_options(input_gain, noise_suppression).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_dictation(state: State<'_, AudioState>) -> Result<(), String> {
    let engine = state.0.read();
    engine.stop_capture().map_err(|e| e.to_string())
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
