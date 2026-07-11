//! Shared on-demand model downloader: streams to a `.part` file with
//! throttled progress events, renaming on completion so a killed download
//! never leaves a corrupt model behind. Used by the grammar LLM manager
//! (the whisper manager predates this and keeps its own identical copy).

use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Manager};

#[derive(serde::Serialize, Clone)]
pub struct DownloadProgress {
    pub id: String,
    pub received: u64,
    pub total: u64,
    pub done: bool,
    pub error: Option<String>,
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

/// Stream `url` to `dest`, emitting `event_name` progress events keyed by `id`.
pub async fn download_with_progress(
    app: &AppHandle,
    url: &str,
    dest: &Path,
    event_name: &str,
    id: &str,
    expected_total: u64,
) -> anyhow::Result<()> {
    let emit = |received: u64, total: u64, done: bool, error: Option<String>| {
        let _ = app.emit(
            event_name,
            DownloadProgress { id: id.to_string(), received, total, done, error },
        );
    };

    let result: anyhow::Result<()> = async {
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(15))
            .build()?;
        let resp = client.get(url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("Model download failed: HTTP {}", resp.status());
        }
        let total = resp.content_length().unwrap_or(expected_total);

        let part = dest.with_extension("part");
        let mut file = std::fs::File::create(&part)?;
        let mut received: u64 = 0;
        let mut last_emit = std::time::Instant::now();

        let mut stream = resp.bytes_stream();
        use futures_util::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk)?;
            received += chunk.len() as u64;
            if last_emit.elapsed() >= std::time::Duration::from_millis(200) {
                last_emit = std::time::Instant::now();
                emit(received, total, false, None);
            }
        }
        file.flush()?;
        drop(file);
        std::fs::rename(&part, dest)?;
        emit(received, total, true, None);
        Ok(())
    }
    .await;

    if let Err(ref e) = result {
        let _ = std::fs::remove_file(dest.with_extension("part"));
        emit(0, 0, false, Some(e.to_string()));
    }
    result
}
