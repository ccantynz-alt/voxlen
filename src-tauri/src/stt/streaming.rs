use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use futures_util::{SinkExt, StreamExt};
use crossbeam_channel::Receiver;

use crate::audio::AudioChunk;
use super::SttConfig;

/// Real-time streaming transcription via Deepgram WebSocket
pub struct StreamingSession {
    stop_flag: Arc<AtomicBool>,
    _handle: Option<tokio::task::JoinHandle<()>>,
}

impl StreamingSession {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }

    /// True once the session has been stopped or its worker task has exited
    /// (clean shutdown, auth failure, or retries exhausted).
    pub fn is_stopped(&self) -> bool {
        self.stop_flag.load(Ordering::Relaxed)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StreamingTranscript {
    pub text: String,
    pub is_final: bool,
    pub confidence: f32,
    pub speech_final: bool,
    pub words: Vec<StreamingWord>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StreamingWord {
    pub word: String,
    pub start: f64,
    pub end: f64,
    pub confidence: f32,
    pub punctuated_word: String,
}

/// Outcome of a single streaming session attempt
enum SessionOutcome {
    /// stop_flag was set — don't retry
    StoppedByUser,
    /// 401/403 — don't retry, emit error
    AuthFailed,
    /// connection lost — retry (Duration = how long session was active)
    Disconnected(Duration),
}

/// Exchange a Voxlen API key for a short-lived Deepgram temp key via the Voxlen proxy.
async fn fetch_deepgram_temp_key(voxlen_key: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://voxlen.ai/api/deepgram-token")
        .header("Authorization", format!("Bearer {}", voxlen_key))
        .send()
        .await?;
    if !resp.status().is_success() {
        anyhow::bail!("Voxlen token exchange failed: {}", resp.status());
    }
    let body: serde_json::Value = resp.json().await?;
    body["key"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("No key in Voxlen deepgram-token response"))
}

/// Start a real-time streaming session with Deepgram using full SttConfig.
pub fn start_streaming(
    config: SttConfig,
    audio_receiver: Receiver<AudioChunk>,
    app_handle: AppHandle,
) -> anyhow::Result<StreamingSession> {
    // Voxlen keys are not Deepgram keys — they must be exchanged for a temp
    // Deepgram key via the Voxlen proxy before opening the WebSocket.
    let direct_key = config.api_key.clone().filter(|k| !k.is_empty());
    let voxlen_key = config.voxlen_api_key.clone().filter(|k| !k.is_empty());

    if direct_key.is_none() && voxlen_key.is_none() {
        anyhow::bail!("No API key configured for Deepgram streaming");
    }

    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_clone = stop_flag.clone();

    let language = config.language.clone();
    let auto_detect = config.auto_detect_language;
    let custom_vocabulary = config.custom_vocabulary.clone();
    let diarization = config.speaker_diarization;
    let tenant_id = config.voxlen_tenant_id.clone();

    let stop_on_exit = stop_flag.clone();
    let handle = tokio::spawn(async move {
        let session_task = async {
            // Fetch the initial Deepgram key
            let initial_key = match direct_key.as_deref() {
                Some(k) => k.to_string(),
                None => match fetch_deepgram_temp_key(voxlen_key.as_deref().unwrap_or("")).await {
                    Ok(k) => k,
                    Err(e) => {
                        let _ = app_handle.emit("transcription-error", format!("Token exchange failed: {}", e));
                        return;
                    }
                },
            };

            run_streaming_session(
                &initial_key,
                direct_key.as_deref(),
                voxlen_key.as_deref(),
                &language,
                auto_detect,
                &custom_vocabulary,
                diarization,
                tenant_id.as_deref(),
                audio_receiver.clone(),
                app_handle.clone(),
                stop_clone.clone(),
            ).await;
        };
        session_task.await;
        // Mark the session ended so the processor knows to start a fresh one
        stop_on_exit.store(true, Ordering::Relaxed);
    });

    Ok(StreamingSession {
        stop_flag,
        _handle: Some(handle),
    })
}

async fn run_streaming_session(
    initial_key: &str,
    direct_key: Option<&str>,
    voxlen_key: Option<&str>,
    language: &str,
    auto_detect: bool,
    custom_vocabulary: &[String],
    diarization: bool,
    tenant_id: Option<&str>,
    audio_receiver: Receiver<AudioChunk>,
    app_handle: AppHandle,
    stop_flag: Arc<AtomicBool>,
) {
    let mut backoff_ms: u64 = 1000;
    let mut attempt: u32 = 0;
    let mut current_key = initial_key.to_string();

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        match run_session_once(
            &current_key,
            language,
            auto_detect,
            custom_vocabulary,
            diarization,
            tenant_id,
            &audio_receiver,
            app_handle.clone(),
            stop_flag.clone(),
        ).await {
            Ok(SessionOutcome::StoppedByUser) => break,
            Ok(SessionOutcome::AuthFailed) => {
                // For Voxlen users the temp key may have expired (30s TTL).
                // Try to fetch a fresh one before giving up.
                if let Some(vk) = voxlen_key.filter(|_| direct_key.is_none()) {
                    match fetch_deepgram_temp_key(vk).await {
                        Ok(new_key) => {
                            log::info!("Refreshed Deepgram temp key after auth failure");
                            current_key = new_key;
                            // Fall through to reconnect logic below
                        }
                        Err(e) => {
                            let _ = app_handle.emit(
                                "transcription-error",
                                format!("Token refresh failed: {}", e),
                            );
                            break;
                        }
                    }
                } else {
                    let _ = app_handle.emit(
                        "transcription-error",
                        "Authentication failed — check your API key in Settings",
                    );
                    break;
                }
                // continue loop to reconnect with refreshed key
            }
            outcome => {
                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }

                // Determine if last session was healthy (>10s)
                let session_duration_was_healthy = match &outcome {
                    Ok(SessionOutcome::Disconnected(d)) => *d > Duration::from_secs(10),
                    _ => false,
                };

                if session_duration_was_healthy {
                    backoff_ms = 1000;
                    attempt = 0;
                }

                // Refresh Deepgram temp key for Voxlen users before reconnecting
                if let Some(vk) = voxlen_key.filter(|_| direct_key.is_none()) {
                    match fetch_deepgram_temp_key(vk).await {
                        Ok(new_key) => { current_key = new_key; }
                        Err(e) => {
                            let _ = app_handle.emit(
                                "transcription-error",
                                format!("Token refresh failed: {}", e),
                            );
                            break;
                        }
                    }
                }

                attempt += 1;
                let _ = app_handle.emit("streaming-reconnecting", attempt);
                log::warn!(
                    "Deepgram disconnected, reconnecting in {}ms (attempt {})",
                    backoff_ms,
                    attempt
                );

                // Sleep with periodic stop_flag checks (100ms granularity)
                let sleep_until = Instant::now() + Duration::from_millis(backoff_ms);
                while Instant::now() < sleep_until {
                    if stop_flag.load(Ordering::Relaxed) {
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    // Also drain the audio receiver so queue doesn't backlog
                    while let Ok(_) = audio_receiver.try_recv() {}
                }

                backoff_ms = (backoff_ms * 2).min(16000);
            }
        }
    }

    let _ = app_handle.emit("streaming-disconnected", true);
    log::info!("Streaming session ended");
}

async fn run_session_once(
    api_key: &str,
    language: &str,
    auto_detect: bool,
    custom_vocabulary: &[String],
    diarization: bool,
    tenant_id: Option<&str>,
    audio_receiver: &Receiver<AudioChunk>,
    app_handle: AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> anyhow::Result<SessionOutcome> {
    let session_start = Instant::now();

    // Build Deepgram WebSocket URL
    let mut url = String::from(
        "wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-3&mip_opt_out=true&punctuate=true&smart_format=true&interim_results=true&utterance_end_ms=1000&vad_events=true&endpointing=200&no_delay=true"
    );

    if auto_detect {
        url.push_str("&detect_language=true");
    } else {
        url.push_str(&format!("&language={}", language));
    }

    if diarization {
        url.push_str("&diarize=true");
    }

    // Nova-3 uses keyterm prompting (the old `keywords` param is silently
    // ignored on nova-3), so custom vocabulary must go through `keyterm`.
    for word in custom_vocabulary {
        url.push_str(&format!("&keyterm={}", super::cloud::urlencoding(word)));
    }

    log::info!("Connecting to Deepgram streaming...");

    // Connect WebSocket
    let mut req_builder = tokio_tungstenite::tungstenite::http::Request::builder()
        .uri(&url)
        .header("Authorization", format!("Token {}", api_key))
        .header("Host", "api.deepgram.com");

    if let Some(tid) = tenant_id.filter(|s| !s.is_empty()) {
        req_builder = req_builder.header("X-Tenant-ID", tid);
    }

    let request = req_builder
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header("Sec-WebSocket-Key", tokio_tungstenite::tungstenite::handshake::client::generate_key())
        .body(())
        .map_err(|e| anyhow::anyhow!("Failed to build WebSocket request: {}", e))?;

    let (ws_stream, _response) = match tokio_tungstenite::connect_async(request).await {
        Ok(v) => v,
        Err(e) => {
            let es = e.to_string();
            let lower = es.to_lowercase();
            if es.contains("401") || es.contains("403") || lower.contains("unauthorized") {
                return Ok(SessionOutcome::AuthFailed);
            }
            return Err(anyhow::anyhow!("WebSocket connection failed: {}", e));
        }
    };

    log::info!("Connected to Deepgram streaming");
    let _ = app_handle.emit("streaming-connected", true);

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Spawn audio sender task
    let stop_sender = stop_flag.clone();
    let audio_receiver_clone = audio_receiver.clone();
    let sender_handle = tokio::spawn(async move {
        loop {
            if stop_sender.load(Ordering::Relaxed) {
                // Send close frame
                let _ = ws_sender.send(
                    tokio_tungstenite::tungstenite::Message::Text(
                        serde_json::json!({"type": "CloseStream"}).to_string().into()
                    )
                ).await;
                break;
            }

            match audio_receiver_clone.recv_timeout(std::time::Duration::from_millis(50)) {
                Ok(chunk) => {
                    // Convert f32 samples to 16-bit PCM bytes (Deepgram expects linear16)
                    let mono_samples = if chunk.channels > 1 {
                        to_mono(&chunk.samples, chunk.channels)
                    } else {
                        chunk.samples.clone()
                    };

                    // Resample to 16kHz if needed
                    let resampled = if chunk.sample_rate != 16000 {
                        simple_resample(&mono_samples, chunk.sample_rate, 16000)
                    } else {
                        mono_samples
                    };

                    // Convert to 16-bit PCM bytes
                    let pcm_bytes: Vec<u8> = resampled
                        .iter()
                        .flat_map(|&sample| {
                            let clamped = sample.clamp(-1.0, 1.0);
                            let int_sample = (clamped * i16::MAX as f32) as i16;
                            int_sample.to_le_bytes()
                        })
                        .collect();

                    if let Err(e) = ws_sender.send(
                        tokio_tungstenite::tungstenite::Message::Binary(pcm_bytes.into())
                    ).await {
                        log::error!("Failed to send audio: {}", e);
                        break;
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => continue,
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    // Process incoming transcription results
    while let Some(msg) = ws_receiver.next().await {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        match msg {
            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    let msg_type = json["type"].as_str().unwrap_or("");

                    match msg_type {
                        "Results" => {
                            let alternatives = &json["channel"]["alternatives"];
                            let channel = match alternatives.as_array().and_then(|a| a.first()) {
                                Some(c) => c,
                                None => continue,
                            };
                            let transcript = channel["transcript"].as_str().unwrap_or("");

                            if !transcript.is_empty() {
                                let is_final = json["is_final"].as_bool().unwrap_or(false);
                                let speech_final = json["speech_final"].as_bool().unwrap_or(false);
                                let confidence = channel["confidence"].as_f64().unwrap_or(0.0) as f32;

                                let words: Vec<StreamingWord> = channel["words"]
                                    .as_array()
                                    .map(|arr| {
                                        arr.iter().map(|w| StreamingWord {
                                            word: w["word"].as_str().unwrap_or("").to_string(),
                                            start: w["start"].as_f64().unwrap_or(0.0),
                                            end: w["end"].as_f64().unwrap_or(0.0),
                                            confidence: w["confidence"].as_f64().unwrap_or(0.0) as f32,
                                            punctuated_word: w["punctuated_word"]
                                                .as_str()
                                                .unwrap_or(w["word"].as_str().unwrap_or(""))
                                                .to_string(),
                                        }).collect()
                                    })
                                    .unwrap_or_default();

                                let result = StreamingTranscript {
                                    text: transcript.to_string(),
                                    is_final,
                                    confidence,
                                    speech_final,
                                    words,
                                };

                                // Emit to frontend
                                if is_final {
                                    // Build frontend-compatible word list (seconds, not ms)
                                    let fe_words: Vec<serde_json::Value> = channel["words"]
                                        .as_array()
                                        .map(|arr| {
                                            arr.iter().map(|w| {
                                                serde_json::json!({
                                                    "word": w["word"].as_str().unwrap_or(""),
                                                    "start": w["start"].as_f64().unwrap_or(0.0),
                                                    "end": w["end"].as_f64().unwrap_or(0.0),
                                                    "confidence": w["confidence"].as_f64().unwrap_or(0.0),
                                                    "punctuated_word": w["punctuated_word"].as_str()
                                                        .unwrap_or(w["word"].as_str().unwrap_or("")),
                                                    "speaker": w["speaker"].as_u64(),
                                                })
                                            }).collect()
                                        })
                                        .unwrap_or_default();

                                    let _ = app_handle.emit("transcription", serde_json::json!({
                                        "text": transcript,
                                        "is_final": true,
                                        "confidence": confidence,
                                        "language": json["channel"]["detected_language"].as_str(),
                                        "words": fe_words,
                                    }));
                                } else {
                                    let _ = app_handle.emit("streaming-partial", &result);
                                }
                            }
                        }
                        "UtteranceEnd" => {
                            let _ = app_handle.emit("utterance-end", true);
                        }
                        "SpeechStarted" => {
                            let _ = app_handle.emit("speech-started", true);
                        }
                        "Error" | "Metadata" => {
                            // Log but don't fail
                            log::debug!("Deepgram message: {}", text);
                        }
                        _ => {}
                    }
                }
            }
            Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                log::info!("WebSocket closed by server");
                break;
            }
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    sender_handle.abort();
    log::info!("Streaming session ended");

    if stop_flag.load(Ordering::Relaxed) {
        Ok(SessionOutcome::StoppedByUser)
    } else {
        Ok(SessionOutcome::Disconnected(session_start.elapsed()))
    }
}

fn to_mono(samples: &[f32], channels: u16) -> Vec<f32> {
    let ch = channels as usize;
    samples
        .chunks(ch)
        .map(|frame| frame.iter().sum::<f32>() / ch as f32)
        .collect()
}

fn simple_resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate {
        return samples.to_vec();
    }
    if samples.is_empty() {
        return Vec::new();
    }
    let ratio = to_rate as f64 / from_rate as f64;
    let output_len = (samples.len() as f64 * ratio) as usize;
    let mut output = Vec::with_capacity(output_len);
    for i in 0..output_len {
        let src_idx = i as f64 / ratio;
        let idx_floor = (src_idx.floor() as usize).min(samples.len() - 1);
        let idx_ceil = (idx_floor + 1).min(samples.len() - 1);
        let frac = src_idx - idx_floor as f64;
        let interpolated = samples[idx_floor] as f64 * (1.0 - frac)
            + samples[idx_ceil] as f64 * frac;
        output.push(interpolated as f32);
    }
    output
}
