use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use cpal::traits::{DeviceTrait, StreamTrait};
use crossbeam_channel::Sender;
use parking_lot::{Mutex, RwLock};
use tauri::{AppHandle, Emitter};

use super::{AudioChunk, devices};

const WAVEFORM_BARS: usize = 64;
const WAVEFORM_EMIT_INTERVAL: Duration = Duration::from_millis(33); // ~30fps

pub struct CaptureHandle {
    stop_flag: Arc<AtomicBool>,
    _stream_thread: Option<std::thread::JoinHandle<()>>,
}

impl CaptureHandle {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}

pub fn start_capture(
    device_id: Option<String>,
    sender: Sender<AudioChunk>,
    input_level: Arc<RwLock<f32>>,
    app_handle: AppHandle,
) -> anyhow::Result<CaptureHandle> {
    start_capture_with_options(device_id, sender, input_level, app_handle, 1.0, true)
}

pub fn start_capture_with_options(
    device_id: Option<String>,
    sender: Sender<AudioChunk>,
    input_level: Arc<RwLock<f32>>,
    app_handle: AppHandle,
    input_gain: f32,
    noise_suppression: bool,
) -> anyhow::Result<CaptureHandle> {
    let device = if let Some(ref id) = device_id {
        devices::get_device_by_id(id)
            .ok_or_else(|| anyhow::anyhow!("Device not found: {}", id))?
    } else {
        devices::get_default_device()
            .ok_or_else(|| anyhow::anyhow!("No default input device found"))?
    };

    let config = device.default_input_config()?;
    let sample_rate = config.sample_rate().0;
    let channels = config.channels();

    log::info!(
        "Starting capture: device={:?}, rate={}, channels={}",
        device_id,
        sample_rate,
        channels
    );

    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_clone = stop_flag.clone();

    let thread = std::thread::spawn(move || {
        let err_fn = |err: cpal::StreamError| {
            log::error!("Audio stream error: {}", err);
        };

        let sender_clone = sender.clone();
        let input_level_clone = input_level.clone();
        let app_handle_clone = app_handle.clone();

        // Buffer to accumulate samples before sending chunks
        let chunk_duration_ms: u64 = 100; // Send 100ms chunks
        let samples_per_chunk = (sample_rate as usize * channels as usize * chunk_duration_ms as usize) / 1000;
        let buffer = Arc::new(RwLock::new(Vec::with_capacity(samples_per_chunk)));
        let buffer_clone = buffer.clone();
        let waveform_last_emit = Arc::new(Mutex::new(Instant::now()));
        let waveform_last_emit_clone = waveform_last_emit.clone();

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    process_audio_data(
                        data,
                        sample_rate,
                        channels,
                        &sender_clone,
                        &input_level_clone,
                        &app_handle_clone,
                        &buffer_clone,
                        samples_per_chunk,
                        &waveform_last_emit_clone,
                        input_gain,
                        noise_suppression,
                    );
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let float_data: Vec<f32> = data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                    process_audio_data(
                        &float_data,
                        sample_rate,
                        channels,
                        &sender_clone,
                        &input_level_clone,
                        &app_handle_clone,
                        &buffer_clone,
                        samples_per_chunk,
                        &waveform_last_emit_clone,
                        input_gain,
                        noise_suppression,
                    );
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_input_stream(
                &config.into(),
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    let float_data: Vec<f32> = data
                        .iter()
                        .map(|&s| (s as f32 / u16::MAX as f32) * 2.0 - 1.0)
                        .collect();
                    process_audio_data(
                        &float_data,
                        sample_rate,
                        channels,
                        &sender_clone,
                        &input_level_clone,
                        &app_handle_clone,
                        &buffer_clone,
                        samples_per_chunk,
                        &waveform_last_emit_clone,
                        input_gain,
                        noise_suppression,
                    );
                },
                err_fn,
                None,
            ),
            _ => {
                log::error!("Unsupported sample format");
                return;
            }
        };

        match stream {
            Ok(stream) => {
                if let Err(e) = stream.play() {
                    log::error!("Failed to play stream: {}", e);
                    return;
                }

                // Keep the stream alive until stop flag is set
                while !stop_flag_clone.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }

                drop(stream);
                log::info!("Audio capture stream stopped");
            }
            Err(e) => {
                log::error!("Failed to build input stream: {}", e);
            }
        }
    });

    Ok(CaptureHandle {
        stop_flag,
        _stream_thread: Some(thread),
    })
}

fn process_audio_data(
    data: &[f32],
    sample_rate: u32,
    channels: u16,
    sender: &Sender<AudioChunk>,
    input_level: &Arc<RwLock<f32>>,
    app_handle: &AppHandle,
    buffer: &Arc<RwLock<Vec<f32>>>,
    chunk_size: usize,
    waveform_last_emit: &Arc<Mutex<Instant>>,
    input_gain: f32,
    noise_suppression: bool,
) {
    // Apply input gain + noise processing
    let processed: Vec<f32> = apply_audio_processing(data, input_gain, noise_suppression);
    let data = processed.as_slice();

    // Calculate RMS level for visualization
    let rms = calculate_rms(data);
    *input_level.write() = rms;

    // Emit input level to frontend
    let _ = app_handle.emit("audio-level", rms);

    // Emit waveform bars (throttled to ~30fps to avoid IPC flooding)
    {
        let now = Instant::now();
        let mut last = waveform_last_emit.lock();
        if now.duration_since(*last) >= WAVEFORM_EMIT_INTERVAL {
            *last = now;
            drop(last);
            let bars = compute_waveform_bars(data, WAVEFORM_BARS);
            let _ = app_handle.emit("waveform-samples", bars);
        }
    }

    // Accumulate samples in buffer
    let mut buf = buffer.write();
    buf.extend_from_slice(data);

    // When we have enough samples, send a chunk
    while buf.len() >= chunk_size {
        let chunk_data: Vec<f32> = buf.drain(..chunk_size).collect();

        let chunk = AudioChunk {
            samples: chunk_data,
            sample_rate,
            channels,
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        };

        // Non-blocking send - drop chunks if receiver is too slow
        let _ = sender.try_send(chunk);
    }
}

/// Apply input gain and a simple spectral noise gate.
///
/// Noise gate: compute the RMS of the frame. If it is below the threshold
/// (−40 dBFS ≈ 0.01), treat the frame as silence and zero it out. This
/// removes constant background hum / HVAC without introducing latency or
/// requiring RNNoise. A soft-knee is applied so speech onset is not clipped.
///
/// High-pass biquad at 80 Hz removes low-frequency rumble (desk vibration,
/// air conditioning). Coefficients pre-computed for fs=16000; for other rates
/// the filter is a gentle high-pass that still removes sub-80Hz energy.
fn apply_audio_processing(samples: &[f32], gain: f32, noise_suppression: bool) -> Vec<f32> {
    // Apply gain first
    let mut out: Vec<f32> = samples.iter().map(|&s| (s * gain).clamp(-1.0, 1.0)).collect();

    if noise_suppression {
        // High-pass biquad (80 Hz, Q=0.707) — removes low-frequency rumble.
        // Coefficients for fs=16000 Hz (close enough for 44.1/48 kHz too).
        let b0: f32 = 0.9780;
        let b1: f32 = -1.9560;
        let b2: f32 = 0.9780;
        let a1: f32 = -1.9556;
        let a2: f32 = 0.9565;

        let mut x1 = 0f32;
        let mut x2 = 0f32;
        let mut y1 = 0f32;
        let mut y2 = 0f32;

        for s in out.iter_mut() {
            let x0 = *s;
            let y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            x2 = x1; x1 = x0;
            y2 = y1; y1 = y0;
            *s = y0.clamp(-1.0, 1.0);
        }

        // Noise gate: −40 dBFS threshold with soft knee
        let rms = calculate_rms(&out);
        const GATE_THRESHOLD: f32 = 0.01;   // −40 dBFS
        const GATE_KNEE: f32 = 0.025;       // soft knee top
        if rms < GATE_THRESHOLD {
            // Full silence — background noise floor
            out.iter_mut().for_each(|s| *s = 0.0);
        } else if rms < GATE_KNEE {
            // Soft knee: fade in proportionally
            let knee_ratio = (rms - GATE_THRESHOLD) / (GATE_KNEE - GATE_THRESHOLD);
            out.iter_mut().for_each(|s| *s *= knee_ratio);
        }
        // Above knee: pass through unchanged
    }

    out
}

fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}

/// Reduce an audio frame to `n_bars` RMS values in the range 0.0..=1.0.
/// Each bar covers an equal-width chunk of the input; empty input yields zeros.
fn compute_waveform_bars(samples: &[f32], n_bars: usize) -> Vec<f32> {
    if samples.is_empty() || n_bars == 0 {
        return vec![0.0; n_bars];
    }

    let mut bars = Vec::with_capacity(n_bars);
    let len = samples.len();

    for i in 0..n_bars {
        let start = (i * len) / n_bars;
        let end = ((i + 1) * len) / n_bars;
        if start >= end {
            bars.push(0.0);
            continue;
        }
        let chunk = &samples[start..end];
        let sum_sq: f32 = chunk.iter().map(|s| s * s).sum();
        let rms = (sum_sq / chunk.len() as f32).sqrt();
        bars.push(rms.clamp(0.0, 1.0));
    }

    bars
}
