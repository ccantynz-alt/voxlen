//! System-audio (loopback) capture for meeting transcription.
//!
//! Windows: WASAPI loopback via cpal — building an *input* stream on an
//! output (render) device transparently enables loopback mode (cpal sets
//! AUDCLNT_STREAMFLAGS_LOOPBACK when data_flow == eRender). No extra crate.
//!
//! Known WASAPI quirk: loopback delivers NO callbacks while nothing is
//! playing — consumers must be time-driven (recv_timeout), never assume a
//! steady callback cadence.
//!
//! macOS needs ScreenCaptureKit (Screen Recording permission) and is not
//! wired yet; `is_supported()` gates the feature per-platform.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crossbeam_channel::Sender;

use super::AudioChunk;

pub fn is_supported() -> bool {
    cfg!(target_os = "windows")
}

pub struct LoopbackHandle {
    stop_flag: Arc<AtomicBool>,
    _thread: Option<std::thread::JoinHandle<()>>,
}

impl LoopbackHandle {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}

impl Drop for LoopbackHandle {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}

/// Start capturing what the machine is playing (the remote side of a call).
/// Chunks are 100ms of f32 samples at the device's native rate/channels.
pub fn start_loopback_capture(sender: Sender<AudioChunk>) -> anyhow::Result<LoopbackHandle> {
    if !is_supported() {
        anyhow::bail!("System-audio capture is not supported on this platform yet");
    }

    let host = cpal::default_host();
    let device = host
        .default_output_device()
        .ok_or_else(|| anyhow::anyhow!("No output device available for loopback capture"))?;
    let config = device.default_output_config()?;
    let sample_rate = config.sample_rate().0;
    let channels = config.channels();
    if sample_rate == 0 || channels == 0 {
        anyhow::bail!("Output device reported an invalid configuration");
    }

    log::info!(
        "Starting loopback capture: device={:?}, rate={}, channels={}",
        device.name().unwrap_or_default(),
        sample_rate,
        channels
    );

    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_clone = stop_flag.clone();

    let thread = std::thread::spawn(move || {
        let err_fn = |err: cpal::StreamError| {
            log::error!("Loopback stream error: {err}");
        };

        let chunk_size = ((sample_rate as u64 * channels as u64 * 100) / 1000) as usize;
        let buffer = Arc::new(parking_lot::Mutex::new(Vec::<f32>::with_capacity(chunk_size)));
        let buffer_cb = buffer.clone();
        let sender_cb = sender.clone();

        let mut push = move |data: &[f32]| {
            let mut buf = buffer_cb.lock();
            buf.extend_from_slice(data);
            while buf.len() >= chunk_size {
                let chunk_data: Vec<f32> = buf.drain(..chunk_size).collect();
                let _ = sender_cb.try_send(AudioChunk {
                    samples: chunk_data,
                    sample_rate,
                    channels,
                    timestamp_ms: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                });
            }
        };

        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| push(data),
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let f: Vec<f32> = data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                    push(&f);
                },
                err_fn,
                None,
            ),
            other => {
                log::error!("Unsupported loopback sample format: {other:?}");
                return;
            }
        };

        match stream {
            Ok(stream) => {
                if let Err(e) = stream.play() {
                    log::error!("Failed to start loopback stream: {e}");
                    return;
                }
                while !stop_clone.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                drop(stream);
                log::info!("Loopback capture stopped");
            }
            Err(e) => log::error!("Failed to build loopback stream: {e}"),
        }
    });

    Ok(LoopbackHandle {
        stop_flag,
        _thread: Some(thread),
    })
}
