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
    Ok(engine.selected_device.read().clone())
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
