use tauri::State;
use crate::text_injection::{InjectionMode, InjectorState};

#[tauri::command]
pub fn inject_text(text: String, state: State<'_, InjectorState>) -> Result<(), String> {
    let injector = state.0.read();
    injector.inject(&text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_injection_mode(state: State<'_, InjectorState>) -> Result<InjectionMode, String> {
    let injector = state.0.read();
    Ok(injector.get_mode())
}

#[tauri::command]
pub fn set_injection_mode(mode: InjectionMode, state: State<'_, InjectorState>) -> Result<(), String> {
    let injector = state.0.read();
    injector.set_mode(mode);
    Ok(())
}
