use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use parking_lot::RwLock;
use tauri::{AppHandle, Emitter};
use futures_util::{SinkExt, StreamExt};
use crossbeam_channel::Receiver;

use crate::audio::AudioChunk;
use super::TranscriptionResult;

/// Real-time streaming transcription via Deepgram WebSocket
pub struct StreamingSession {
    stop_flag: Arc<AtomicBool>,
    _handle: Option<tokio::task::JoinHandle<()>>,
}

impl StreamingSession {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);
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

/// Start a real-time streaming session with Deepgram
pub fn start_streaming(
    api_key: String,
    language: String,
    auto_detect: bool,
    audio_receiver: Receiver<AudioChunk>,
    app_handle: AppHandle,
) -> anyhow::Result<StreamingSession> {
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_clone = stop_flag.clone();

    let handle = tokio::spawn(async move {
        let max_retries = 3;
        let mut attempt = 0;

        loop {
            if stop_clone.load(Ordering::Relaxed) {
                break;
            }

            match run_streaming_session(
                &api_key,
                &language,
                auto_detect,
                audio_receiver.clone(),
                app_handle.clone(),
                stop_clone.clone(),
            ).await {
                Ok(()) => break, // Clean shutdown
                Err(e) => {
                    attempt += 1;
                    log::error!("Streaming session error (attempt {}/{}): {}", attempt, max_retries, e);

                    if attempt >= max_retries || stop_clone.load(Ordering::Relaxed) {
                        let _ = app_handle.emit("transcription-error", e.to_string());
                        break;
                    }

                    // Exponential backoff: 1s, 2s, 4s
                    let delay = std::time::Duration::from_secs(1 << (attempt - 1));
                    log::info!("Reconnecting in {:?}...", delay);
                    let _ = app_handle.emit("streaming-reconnecting", attempt);
                    tokio::time::sleep(delay).await;
                }
            }
        }
    });

    Ok(StreamingSession {
        stop_flag,
        _handle: Some(handle),
    })
}

async fn run_streaming_session(
    api_key: &str,
    language: &str,
    auto_detect: bool,
    audio_receiver: Receiver<AudioChunk>,
    app_handle: AppHandle,
    stop_flag: Arc<AtomicBool>,
) -> anyhow::Result<()> {
    // Build Deepgram WebSocket URL
    let mut url = String::from(
        "wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&punctuate=true&smart_format=true&interim_results=true&utterance_end_ms=1500&vad_events=true&endpointing=300"
    );

    if auto_detect {
        url.push_str("&detect_language=true");
    } else {
        url.push_str(&format!("&language={}", language));
    }

    log::info!("Connecting to Deepgram streaming...");

    // Connect WebSocket
    let request = tokio_tungstenite::tungstenite::http::Request::builder()
        .uri(&url)
        .header("Authorization", format!("Token {}", api_key))
        .header("Host", "api.deepgram.com")
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header("Sec-WebSocket-Key", tokio_tungstenite::tungstenite::handshake::client::generate_key())
        .body(())
        .map_err(|e| anyhow::anyhow!("Failed to build WebSocket request: {}", e))?;

    let (ws_stream, _response) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| anyhow::anyhow!("WebSocket connection failed: {}", e))?;

    log::info!("Connected to Deepgram streaming");
    let _ = app_handle.emit("streaming-connected", true);

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Spawn audio sender task
    let stop_sender = stop_flag.clone();
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

            match audio_receiver.recv_timeout(std::time::Duration::from_millis(50)) {
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
                            let channel = &json["channel"]["alternatives"][0];
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
                                    let _ = app_handle.emit("transcription", TranscriptionResult {
                                        text: transcript.to_string(),
                                        is_final: true,
                                        confidence,
                                        language: json["channel"]["detected_language"]
                                            .as_str()
                                            .map(|s| s.to_string()),
                                        timestamp_ms: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64,
                                        words: vec![],
                                    });
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
    let _ = app_handle.emit("streaming-disconnected", true);
    log::info!("Streaming session ended");

    Ok(())
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
    let ratio = to_rate as f64 / from_rate as f64;
    let output_len = (samples.len() as f64 * ratio) as usize;
    let mut output = Vec::with_capacity(output_len);
    for i in 0..output_len {
        let src_idx = i as f64 / ratio;
        let idx_floor = src_idx.floor() as usize;
        let idx_ceil = (idx_floor + 1).min(samples.len() - 1);
        let frac = src_idx - idx_floor as f64;
        let interpolated = samples[idx_floor] as f64 * (1.0 - frac)
            + samples[idx_ceil] as f64 * frac;
        output.push(interpolated as f32);
    }
    output
}
