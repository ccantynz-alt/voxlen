//! Grammar LLM model manager — catalog, download, and lookup for the GGUF
//! models used by the Tier-2 local grammar engine. Mirrors the whisper
//! model manager: models live in `app_data_dir/models/`, download on
//! demand from Hugging Face, and are never bundled.
//!
//! License note: Qwen3 is Apache-2.0 (Qwen2.5-3B is research-only — do not
//! add it); Llama 3.2 is under the Llama Community License (attribution).

use std::collections::HashSet;
use std::path::PathBuf;

use parking_lot::Mutex;
use tauri::AppHandle;

pub struct LlmModelSpec {
    pub id: &'static str,
    pub file: &'static str,
    pub url: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub size_mb: u64,
}

pub const LLM_CATALOG: &[LlmModelSpec] = &[
    LlmModelSpec {
        id: "qwen3-4b",
        file: "Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
        url: "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
        label: "Qwen3 4B (recommended)",
        description: "Best editing quality for its size — Apache-2.0",
        size_mb: 2440,
    },
    LlmModelSpec {
        id: "llama-3.2-3b",
        file: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        label: "Llama 3.2 3B",
        description: "Slightly smaller and faster — Llama Community License",
        size_mb: 2020,
    },
];

pub fn spec_for(id: &str) -> Option<&'static LlmModelSpec> {
    LLM_CATALOG.iter().find(|m| m.id == id)
}

pub fn model_path(app: &AppHandle, id: &str) -> anyhow::Result<PathBuf> {
    let spec = spec_for(id).ok_or_else(|| anyhow::anyhow!("Unknown grammar model '{id}'"))?;
    Ok(crate::models::models_dir(app)?.join(spec.file))
}

pub fn is_downloaded(app: &AppHandle, id: &str) -> bool {
    model_path(app, id).map(|p| p.exists()).unwrap_or(false)
}

/// The configured model if downloaded, else any downloaded catalog model.
pub fn resolve_model(app: &AppHandle, preferred: &str) -> Option<&'static LlmModelSpec> {
    if let Some(spec) = spec_for(preferred) {
        if is_downloaded(app, spec.id) {
            return Some(spec);
        }
    }
    LLM_CATALOG.iter().find(|m| is_downloaded(app, m.id))
}

static DOWNLOADING: Mutex<Option<HashSet<String>>> = Mutex::new(None);

fn downloading_guard(id: &str, insert: bool) -> bool {
    let mut lock = DOWNLOADING.lock();
    let set = lock.get_or_insert_with(HashSet::new);
    if insert {
        set.insert(id.to_string())
    } else {
        set.remove(id)
    }
}

// --- Commands ----------------------------------------------------------------

#[derive(serde::Serialize)]
pub struct LlmModelInfo {
    pub id: String,
    pub label: String,
    pub description: String,
    pub size_mb: u64,
    pub downloaded: bool,
}

#[tauri::command]
pub fn list_grammar_models(app: AppHandle) -> Vec<LlmModelInfo> {
    LLM_CATALOG
        .iter()
        .map(|m| LlmModelInfo {
            id: m.id.to_string(),
            label: m.label.to_string(),
            description: m.description.to_string(),
            size_mb: m.size_mb,
            downloaded: is_downloaded(&app, m.id),
        })
        .collect()
}

#[tauri::command]
pub fn has_grammar_model(app: AppHandle, id: String) -> bool {
    is_downloaded(&app, &id)
}

#[tauri::command]
pub async fn download_grammar_model(app: AppHandle, id: String) -> Result<(), String> {
    let spec = spec_for(&id).ok_or_else(|| format!("Unknown grammar model '{id}'"))?;
    let dest = model_path(&app, &id).map_err(|e| e.to_string())?;
    if dest.exists() {
        return Ok(());
    }
    if !downloading_guard(&id, true) {
        return Err(format!("Model '{id}' is already downloading"));
    }
    let result = crate::models::download_with_progress(
        &app,
        spec.url,
        &dest,
        "grammar-model-progress",
        &id,
        spec.size_mb * 1024 * 1024,
    )
    .await;
    downloading_guard(&id, false);
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_grammar_model(app: AppHandle, id: String) -> Result<(), String> {
    let path = model_path(&app, &id).map_err(|e| e.to_string())?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    super::llm_local::evict_if_cached(&path);
    Ok(())
}
