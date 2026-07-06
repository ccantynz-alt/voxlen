//! On-device transcription via whisper.cpp (whisper-rs bindings).
//!
//! This is the engine behind privileged mode: audio never leaves the
//! machine. GGUF/GGML models are downloaded on demand from Hugging Face
//! into the app data directory (never bundled — they are 75MB–1.6GB), and
//! the loaded context is cached so repeated utterances don't re-read the
//! model file.

use std::collections::HashSet;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use super::{SttConfig, TranscriptionResult};

/// Catalog of supported models, best-first within each family. `id` doubles
/// as the settings value (`whisper_local_model`).
pub struct ModelSpec {
    pub id: &'static str,
    pub file: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub size_mb: u64,
    pub multilingual: bool,
}

pub const MODEL_CATALOG: &[ModelSpec] = &[
    ModelSpec {
        id: "tiny.en",
        file: "ggml-tiny.en.bin",
        label: "Tiny (English)",
        description: "Fastest, lowest accuracy — quick notes on older machines",
        size_mb: 77,
        multilingual: false,
    },
    ModelSpec {
        id: "base.en",
        file: "ggml-base.en.bin",
        label: "Base (English)",
        description: "Balanced speed and accuracy — recommended starting point",
        size_mb: 148,
        multilingual: false,
    },
    ModelSpec {
        id: "small.en",
        file: "ggml-small.en.bin",
        label: "Small (English)",
        description: "High accuracy for professional dictation",
        size_mb: 488,
        multilingual: false,
    },
    ModelSpec {
        id: "large-v3-turbo",
        file: "ggml-large-v3-turbo.bin",
        label: "Large v3 Turbo (all languages)",
        description: "Best accuracy, 99 languages — needs a capable machine",
        size_mb: 1620,
        multilingual: true,
    },
];

const MODEL_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

fn spec_for(id: &str) -> Option<&'static ModelSpec> {
    MODEL_CATALOG.iter().find(|m| m.id == id)
}

pub fn models_dir(app: &AppHandle) -> anyhow::Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("No app data dir: {e}"))?
        .join("models");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn model_path(app: &AppHandle, id: &str) -> anyhow::Result<PathBuf> {
    let spec = spec_for(id).ok_or_else(|| anyhow::anyhow!("Unknown model '{id}'"))?;
    Ok(models_dir(app)?.join(spec.file))
}

pub fn is_downloaded(app: &AppHandle, id: &str) -> bool {
    model_path(app, id).map(|p| p.exists()).unwrap_or(false)
}

/// Best available model: the configured one if downloaded, else the largest
/// downloaded model (catalog is ordered smallest→largest).
pub fn resolve_model(app: &AppHandle, preferred: &str) -> Option<&'static ModelSpec> {
    if let Some(spec) = spec_for(preferred) {
        if is_downloaded(app, spec.id) {
            return Some(spec);
        }
    }
    MODEL_CATALOG.iter().rev().find(|m| is_downloaded(app, m.id))
}

// --- Download manager -------------------------------------------------------

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

#[derive(serde::Serialize, Clone)]
pub struct DownloadProgress {
    pub id: String,
    pub received: u64,
    pub total: u64,
    pub done: bool,
    pub error: Option<String>,
}

fn emit_progress(app: &AppHandle, p: DownloadProgress) {
    let _ = app.emit("whisper-model-progress", p);
}

/// Download a model with progress events. Streams to a `.part` file and
/// renames on completion so a killed download never leaves a corrupt model
/// that transcription would then try to load.
pub async fn download_model(app: AppHandle, id: String) -> anyhow::Result<()> {
    let spec = spec_for(&id).ok_or_else(|| anyhow::anyhow!("Unknown model '{id}'"))?;
    let dest = model_path(&app, &id)?;
    if dest.exists() {
        return Ok(());
    }
    if !downloading_guard(&id, true) {
        anyhow::bail!("Model '{id}' is already downloading");
    }

    let result: anyhow::Result<()> = async {
        let url = format!("{MODEL_BASE_URL}/{}", spec.file);
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(15))
            .build()?;
        let resp = client.get(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("Model download failed: HTTP {}", resp.status());
        }
        let total = resp.content_length().unwrap_or(spec.size_mb * 1024 * 1024);

        let part = dest.with_extension("bin.part");
        let mut file = std::fs::File::create(&part)?;
        let mut received: u64 = 0;
        let mut last_emit = std::time::Instant::now();

        let mut stream = resp.bytes_stream();
        use futures_util::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk)?;
            received += chunk.len() as u64;
            // Throttle progress events to ~5/s.
            if last_emit.elapsed() >= std::time::Duration::from_millis(200) {
                last_emit = std::time::Instant::now();
                emit_progress(
                    &app,
                    DownloadProgress { id: id.clone(), received, total, done: false, error: None },
                );
            }
        }
        file.flush()?;
        drop(file);
        std::fs::rename(&part, &dest)?;
        emit_progress(
            &app,
            DownloadProgress { id: id.clone(), received, total, done: true, error: None },
        );
        log::info!("Whisper model '{}' downloaded ({} MB)", id, received / (1024 * 1024));
        Ok(())
    }
    .await;

    downloading_guard(&id, false);
    if let Err(ref e) = result {
        // Clean up any partial file and surface the failure to the UI.
        if let Ok(dest) = model_path(&app, &id) {
            let _ = std::fs::remove_file(dest.with_extension("bin.part"));
        }
        emit_progress(
            &app,
            DownloadProgress {
                id: id.clone(),
                received: 0,
                total: 0,
                done: false,
                error: Some(e.to_string()),
            },
        );
    }
    result
}

pub fn delete_model(app: &AppHandle, id: &str) -> anyhow::Result<()> {
    let path = model_path(app, id)?;
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    // Drop the cached context if it was built from this model.
    let mut cache = CONTEXT_CACHE.lock();
    if let Some((cached_path, _)) = cache.as_ref() {
        if *cached_path == path {
            *cache = None;
        }
    }
    Ok(())
}

// --- Transcription -----------------------------------------------------------

/// Loaded model cache: (model file path, context). WhisperContext holds the
/// weights (~size of the model in RAM); keeping exactly one loaded matches
/// how dictation is actually used.
static CONTEXT_CACHE: Mutex<Option<(PathBuf, Arc<WhisperContext>)>> = Mutex::new(None);

fn load_context(path: &PathBuf) -> anyhow::Result<Arc<WhisperContext>> {
    {
        let cache = CONTEXT_CACHE.lock();
        if let Some((cached_path, ctx)) = cache.as_ref() {
            if cached_path == path {
                return Ok(ctx.clone());
            }
        }
    }
    log::info!("Loading Whisper model from {:?}", path.file_name().unwrap_or_default());
    let ctx = WhisperContext::new_with_params(
        path.to_str().ok_or_else(|| anyhow::anyhow!("Non-UTF8 model path"))?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| anyhow::anyhow!("Failed to load Whisper model: {e}"))?;
    let ctx = Arc::new(ctx);
    *CONTEXT_CACHE.lock() = Some((path.clone(), ctx.clone()));
    Ok(ctx)
}

/// Transcribe 16 kHz mono f32 samples fully on-device. Runs inference on a
/// blocking thread — whisper.cpp saturates the CPU for the duration.
pub async fn transcribe(
    app: &AppHandle,
    samples: &[f32],
    config: &SttConfig,
) -> anyhow::Result<TranscriptionResult> {
    let spec = resolve_model(app, &config.model).ok_or_else(|| {
        anyhow::anyhow!(
            "No local Whisper model downloaded. Open Settings › Speech Engine and download a model to dictate offline."
        )
    })?;
    let path = model_path(app, spec.id)?;

    // whisper.cpp needs at least ~1s of audio to produce anything useful.
    if samples.len() < 16_000 {
        return Ok(empty_result());
    }

    let language = if spec.multilingual {
        if config.auto_detect_language { "auto".to_string() } else { config.language.clone() }
    } else {
        "en".to_string()
    };
    // Bias recognition toward the user's custom vocabulary (client names,
    // legal/accounting terms) via the initial prompt — the local equivalent
    // of Deepgram keyterms.
    let vocab_prompt = if config.custom_vocabulary.is_empty() {
        None
    } else {
        Some(config.custom_vocabulary.join(", "))
    };

    let result_language = if language == "auto" { "en".to_string() } else { language.clone() };
    let samples: Vec<f32> = samples.to_vec();
    let result = tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<String> {
        let ctx = load_context(&path)?;
        let mut state = ctx
            .create_state()
            .map_err(|e| anyhow::anyhow!("Whisper state creation failed: {e}"))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        let threads = std::thread::available_parallelism()
            .map(|n| n.get() as i32)
            .unwrap_or(4)
            .min(8);
        params.set_n_threads(threads);
        params.set_language(Some(&language));
        params.set_translate(false);
        params.set_no_context(true);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        if let Some(ref prompt) = vocab_prompt {
            params.set_initial_prompt(prompt);
        }

        state
            .full(params, &samples)
            .map_err(|e| anyhow::anyhow!("Whisper inference failed: {e}"))?;

        let n_segments = state
            .full_n_segments()
            .map_err(|e| anyhow::anyhow!("Whisper segment read failed: {e}"))?;
        let mut text = String::new();
        for i in 0..n_segments {
            if let Ok(segment) = state.full_get_segment_text(i) {
                text.push_str(&segment);
            }
        }
        Ok(text.trim().to_string())
    })
    .await
    .map_err(|e| anyhow::anyhow!("Whisper task panicked: {e}"))??;

    Ok(TranscriptionResult {
        text: result,
        is_final: true,
        confidence: 1.0,
        language: Some(result_language),
        timestamp_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        words: Vec::new(),
    })
}

fn empty_result() -> TranscriptionResult {
    TranscriptionResult {
        text: String::new(),
        is_final: true,
        confidence: 1.0,
        language: None,
        timestamp_ms: 0,
        words: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_ids_are_unique_and_resolvable() {
        let mut seen = HashSet::new();
        for spec in MODEL_CATALOG {
            assert!(seen.insert(spec.id), "duplicate model id {}", spec.id);
            assert!(spec.file.starts_with("ggml-"));
            assert!(spec.size_mb > 0);
            assert!(spec_for(spec.id).is_some());
        }
    }

    #[test]
    fn unknown_model_is_rejected() {
        assert!(spec_for("gpt-5").is_none());
    }
}
