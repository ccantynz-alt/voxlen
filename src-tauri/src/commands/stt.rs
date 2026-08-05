use tauri::State;
use crate::stt::{SttConfig, SttEngineType, SttState};

#[derive(serde::Serialize)]
pub struct EngineInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub requires_api_key: bool,
    pub supports_streaming: bool,
    pub supports_offline: bool,
}

#[tauri::command]
pub fn get_stt_engines() -> Result<Vec<EngineInfo>, String> {
    Ok(vec![
        EngineInfo {
            id: "whisper_cloud".to_string(),
            name: "OpenAI Whisper".to_string(),
            description: "High-accuracy cloud transcription. Best for general use.".to_string(),
            requires_api_key: true,
            supports_streaming: false,
            supports_offline: false,
        },
        EngineInfo {
            id: "deepgram".to_string(),
            name: "Deepgram Nova-3".to_string(),
            description: "Fastest real-time transcription. Best for live dictation.".to_string(),
            requires_api_key: true,
            supports_streaming: true,
            supports_offline: false,
        },
    ])
}

#[tauri::command]
pub fn set_stt_engine(engine_id: String, state: State<'_, SttState>) -> Result<(), String> {
    let engine = state.0.read();
    let mut config = engine.get_config();

    config.engine = match engine_id.as_str() {
        "deepgram" => SttEngineType::DeepgramCloud,
        "whisper_cloud" => SttEngineType::WhisperCloud,
        _ => return Err(format!("Unknown engine: {}", engine_id)),
    };

    // Privileged mode: block all cloud STT — mirror apply_settings_to_engines
    // so this command cannot be used to bypass the local-only guarantee.
    if crate::commands::settings::get_privileged_mode() {
        log::warn!(
            "Privileged mode active: forcing STT engine to Whisper Local (requested '{}')",
            engine_id
        );
        config.engine = SttEngineType::WhisperLocal;
        config.model = crate::commands::settings::get_current_settings().whisper_local_model;
    }

    engine.set_config(config);
    Ok(())
}

#[tauri::command]
pub fn get_stt_config(state: State<'_, SttState>) -> Result<SttConfig, String> {
    let engine = state.0.read();
    Ok(engine.get_config())
}

#[tauri::command]
pub fn set_stt_config(mut config: SttConfig, state: State<'_, SttState>) -> Result<(), String> {
    // Privileged mode: block all cloud STT — mirror apply_settings_to_engines
    // so this command (called on every dictation start) cannot be used to
    // bypass the local-only guarantee.
    if crate::commands::settings::get_privileged_mode()
        && !matches!(config.engine, SttEngineType::WhisperLocal)
    {
        log::warn!("Privileged mode active: forcing STT config to Whisper Local");
        config.engine = SttEngineType::WhisperLocal;
        config.model = crate::commands::settings::get_current_settings().whisper_local_model;
    }

    let engine = state.0.read();
    engine.set_config(config);
    Ok(())
}
