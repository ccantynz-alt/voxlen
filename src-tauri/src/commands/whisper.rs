use tauri::AppHandle;

use crate::stt::whisper_local::{self, MODEL_CATALOG};

#[derive(serde::Serialize)]
pub struct WhisperModelInfo {
    pub id: String,
    pub label: String,
    pub description: String,
    pub size_mb: u64,
    pub multilingual: bool,
    pub downloaded: bool,
}

/// Catalog of local Whisper models with their download state.
#[tauri::command]
pub fn list_whisper_models(app: AppHandle) -> Result<Vec<WhisperModelInfo>, String> {
    Ok(MODEL_CATALOG
        .iter()
        .map(|m| WhisperModelInfo {
            id: m.id.to_string(),
            label: m.label.to_string(),
            description: m.description.to_string(),
            size_mb: m.size_mb,
            multilingual: m.multilingual,
            downloaded: whisper_local::is_downloaded(&app, m.id),
        })
        .collect())
}

/// Download a model (progress arrives via `whisper-model-progress` events).
#[tauri::command]
pub async fn download_whisper_model(app: AppHandle, id: String) -> Result<(), String> {
    whisper_local::download_model(app, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_whisper_model(app: AppHandle, id: String) -> Result<(), String> {
    whisper_local::delete_model(&app, &id).map_err(|e| e.to_string())
}

/// True when at least one local model is downloaded — gates the privileged
/// mode toggle in the UI.
#[tauri::command]
pub fn has_whisper_model(app: AppHandle) -> Result<bool, String> {
    Ok(MODEL_CATALOG.iter().any(|m| whisper_local::is_downloaded(&app, m.id)))
}
