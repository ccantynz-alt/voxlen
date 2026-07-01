use tauri::State;
use crate::audio::{AudioDevice, AudioState};

#[tauri::command]
pub fn list_audio_devices(state: State<'_, AudioState>) -> Result<Vec<AudioDevice>, String> {
    let engine = state.0.read();
    Ok(engine.list_devices())
}

#[tauri::command]
pub fn get_selected_device(state: State<'_, AudioState>) -> Result<Option<String>, String> {
    let engine = state.0.read();
    let device = engine.selected_device.read().clone();
    Ok(device)
}

#[tauri::command]
pub fn set_audio_device(device_id: String, state: State<'_, AudioState>) -> Result<(), String> {
    let engine = state.0.read();
    engine.select_device(&device_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_input_level(state: State<'_, AudioState>) -> Result<f32, String> {
    let engine = state.0.read();
    Ok(engine.get_input_level())
}

/// The device actually in use for the current/last capture — may differ from
/// the user's preference if it was unavailable and capture fell back to the
/// best connected device (e.g. an external mic that was muted or unplugged).
#[tauri::command]
pub fn get_active_device(state: State<'_, AudioState>) -> Result<Option<String>, String> {
    let engine = state.0.read();
    Ok(engine.get_active_device_name())
}
