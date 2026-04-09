use tauri::State;
use crate::audio::{AudioState, DictationStatus};

#[tauri::command]
pub fn start_dictation(state: State<'_, AudioState>) -> Result<(), String> {
    let engine = state.0.read();
    engine.start_capture().map_err(|e| e.to_string())
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
