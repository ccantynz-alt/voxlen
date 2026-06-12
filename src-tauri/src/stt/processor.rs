use std::sync::Arc;
use parking_lot::RwLock;
use crossbeam_channel::Receiver;
use tauri::{AppHandle, Emitter};

use crate::audio::{AudioChunk, DictationStatus};
use super::{SttEngine, SttEngineType};

/// Processes audio chunks from the capture thread and sends them to STT
pub struct AudioProcessor {
    app_handle: AppHandle,
    stt_engine: Arc<RwLock<SttEngine>>,
    status: Arc<RwLock<DictationStatus>>,
}

impl AudioProcessor {
    pub fn new(
        app_handle: AppHandle,
        stt_engine: Arc<RwLock<SttEngine>>,
        status: Arc<RwLock<DictationStatus>>,
    ) -> Self {
        Self {
            app_handle,
            stt_engine,
            status,
        }
    }

    /// Start processing audio chunks from the receiver.
    /// When engine is DeepgramCloud, routes audio to the WebSocket streaming
    /// session for real-time transcription. Falls back to batch HTTP processing
    /// for Whisper and other engines.
    pub fn start(&self, receiver: Receiver<AudioChunk>) {
        let app_handle = self.app_handle.clone();
        let stt_engine = self.stt_engine.clone();
        let status = self.status.clone();

        tauri::async_runtime::spawn(async move {
            // Batch-mode state
            let mut accumulated_samples: Vec<f32> = Vec::new();
            let mut sample_rate = 16000u32;
            let target_duration_ms: u64 = 1000;
            let mut accumulated_duration_ms: u64 = 0;

            // Streaming-mode state: (relay sender, session) for the active session
            let mut streaming_relay: Option<(
                crossbeam_channel::Sender<AudioChunk>,
                super::streaming::StreamingSession,
            )> = None;

            loop {
                let config = stt_engine.read().get_config();
                let is_deepgram = matches!(config.engine, SttEngineType::DeepgramCloud);

                match receiver.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(chunk) => {
                        if *status.read() == DictationStatus::Paused {
                            // Tear down any streaming session while paused
                            if let Some((_, session)) = streaming_relay.take() {
                                session.stop();
                            }
                            continue;
                        }

                        if is_deepgram {
                            // Streaming path — ensure a live session exists
                            let needs_new_session = streaming_relay
                                .as_ref()
                                .map(|(_, session)| session.is_stopped())
                                .unwrap_or(true);


                            if needs_new_session {
                                // Tear down old session if any
                                if let Some((_, session)) = streaming_relay.take() {
                                    session.stop();
                                }

                                let has_key = config.api_key.as_deref()
                                    .map(|k| !k.is_empty())
                                    .unwrap_or(false)
                                    || config.voxlen_api_key.as_deref()
                                    .map(|k| !k.is_empty())
                                    .unwrap_or(false);

                                if has_key {
                                    let (relay_tx, relay_rx) = crossbeam_channel::bounded::<AudioChunk>(512);
                                    match super::streaming::start_streaming(
                                        config.clone(),
                                        relay_rx,
                                        app_handle.clone(),
                                    ) {
                                        Ok(session) => {
                                            streaming_relay = Some((relay_tx, session));
                                        }
                                        Err(e) => {
                                            log::error!("Failed to start Deepgram streaming: {}", e);
                                            let _ = app_handle.emit("transcription-error", e.to_string());
                                        }
                                    }
                                } else {
                                    // No key — fall through to batch processing below
                                }
                            }

                            if let Some((ref tx, ref _session)) = streaming_relay {
                                let _ = tx.try_send(chunk);
                                continue;
                            }
                            // If no streaming session (no key), fall through to batch below
                        } else {
                            // Switching away from Deepgram — stop streaming session
                            if let Some((_, session)) = streaming_relay.take() {
                                session.stop();
                            }
                        }

                        // --- Batch processing path (Whisper / fallback) ---
                        sample_rate = chunk.sample_rate;
                        let chunk_duration_ms = (chunk.samples.len() as u64 * 1000)
                            / (chunk.sample_rate as u64 * chunk.channels as u64);

                        let mono_samples = if chunk.channels > 1 {
                            to_mono(&chunk.samples, chunk.channels)
                        } else {
                            chunk.samples
                        };

                        accumulated_samples.extend_from_slice(&mono_samples);
                        accumulated_duration_ms += chunk_duration_ms;

                        let has_voice = detect_voice_activity(&mono_samples);

                        if accumulated_duration_ms >= target_duration_ms && has_voice {
                            *status.write() = DictationStatus::Processing;

                            let samples = std::mem::take(&mut accumulated_samples);
                            accumulated_duration_ms = 0;

                            let resampled = if sample_rate != 16000 {
                                resample(&samples, sample_rate, 16000)
                            } else {
                                samples
                            };

                            match super::transcribe_audio(&resampled, 16000, config).await {
                                Ok(result) => {
                                    if !result.text.trim().is_empty() {
                                        log::info!("Transcription: {}", result.text);
                                        let _ = app_handle.emit("transcription", &result);
                                    }
                                }
                                Err(e) => {
                                    log::error!("Transcription error: {}", e);
                                    let _ = app_handle.emit("transcription-error", e.to_string());
                                }
                            }

                            *status.write() = DictationStatus::Listening;
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        if is_deepgram {
                            continue; // Streaming handles timeouts internally
                        }
                        // Batch mode: flush on silence
                        if !accumulated_samples.is_empty() && accumulated_duration_ms > 1000 {
                            let has_recent_voice = accumulated_samples
                                .chunks(accumulated_samples.len().min(4800))
                                .last()
                                .map(|chunk| detect_voice_activity(chunk))
                                .unwrap_or(false);

                            if !has_recent_voice {
                                *status.write() = DictationStatus::Processing;

                                let samples = std::mem::take(&mut accumulated_samples);
                                accumulated_duration_ms = 0;

                                let resampled = if sample_rate != 16000 {
                                    resample(&samples, sample_rate, 16000)
                                } else {
                                    samples
                                };

                                let config = stt_engine.read().get_config();
                                match super::transcribe_audio(&resampled, 16000, config).await {
                                    Ok(result) => {
                                        if !result.text.trim().is_empty() {
                                            let _ = app_handle.emit("transcription", &result);
                                        }
                                    }
                                    Err(e) => {
                                        log::error!("Transcription error: {}", e);
                                    }
                                }

                                *status.write() = DictationStatus::Listening;
                            }
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                        log::info!("Audio channel disconnected, stopping processor");
                        if let Some((_, session)) = streaming_relay.take() {
                            session.stop();
                        }
                        break;
                    }
                }
            }
        });
    }
}

/// Simple energy-based voice activity detection
fn detect_voice_activity(samples: &[f32]) -> bool {
    if samples.is_empty() {
        return false;
    }

    let rms: f32 = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();

    // Lower threshold catches soft speech — Deepgram handles noise robustly
    rms > 0.005
}

/// Convert interleaved multi-channel audio to mono
fn to_mono(samples: &[f32], channels: u16) -> Vec<f32> {
    let ch = channels as usize;
    samples
        .chunks(ch)
        .map(|frame| frame.iter().sum::<f32>() / ch as f32)
        .collect()
}

/// Simple linear resampling (for production, use rubato crate)
fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
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
