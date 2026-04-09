use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use cpal::traits::{DeviceTrait, StreamTrait};
use crossbeam_channel::Sender;
use parking_lot::RwLock;
use tauri::{AppHandle, Emitter};

use super::{AudioChunk, devices};

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
) {
    // Calculate RMS level for visualization
    let rms = calculate_rms(data);
    *input_level.write() = rms;

    // Emit input level to frontend for waveform visualization
    let _ = app_handle.emit("audio-level", rms);

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

fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}
