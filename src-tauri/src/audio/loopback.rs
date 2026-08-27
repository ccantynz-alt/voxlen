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
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crossbeam_channel::{Receiver, RecvTimeoutError, Sender};

use super::AudioChunk;

/// How long the caller waits for the capture thread to confirm the loopback
/// stream is actually running. Opening a WASAPI loopback client is fast
/// (well under a second); anything slower is treated as a failed start
/// rather than reported as a recording that captures both sides.
const STREAM_START_TIMEOUT: Duration = Duration::from_secs(5);

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

    // The stream itself must be built on the capture thread (cpal streams are
    // not Send), so the thread reports the outcome back here and the caller
    // only sees Ok once audio is genuinely flowing.
    let (ready_tx, ready_rx) = crossbeam_channel::bounded::<Result<(), String>>(1);

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
                let _ = ready_tx.send(Err(format!("Unsupported sample format: {other:?}")));
                return;
            }
        };

        match stream {
            Ok(stream) => {
                if let Err(e) = stream.play() {
                    log::error!("Failed to start loopback stream: {e}");
                    let _ = ready_tx.send(Err(format!("Could not start the stream: {e}")));
                    return;
                }
                let _ = ready_tx.send(Ok(()));
                while !stop_clone.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                drop(stream);
                log::info!("Loopback capture stopped");
            }
            Err(e) => {
                log::error!("Failed to build loopback stream: {e}");
                let _ = ready_tx.send(Err(format!("Could not open the stream: {e}")));
            }
        }
    });

    if let Err(e) = await_stream_start(&ready_rx, STREAM_START_TIMEOUT) {
        // Wind the thread down if it is still trying, and surface a real
        // error: a meeting that would only ever have recorded the local mic
        // must not be reported to the caller as a successful start.
        stop_flag.store(true, Ordering::Relaxed);
        return Err(e);
    }

    Ok(LoopbackHandle {
        stop_flag,
        _thread: Some(thread),
    })
}

/// Waits for the capture thread's start outcome. A dropped sender means the
/// thread died without reporting, which is a failure too — never a success.
fn await_stream_start(
    ready: &Receiver<Result<(), String>>,
    timeout: Duration,
) -> anyhow::Result<()> {
    match ready.recv_timeout(timeout) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => anyhow::bail!("System-audio (loopback) capture failed to start: {e}"),
        Err(RecvTimeoutError::Timeout) => anyhow::bail!(
            "System-audio (loopback) capture did not start within {}s",
            timeout.as_secs()
        ),
        Err(RecvTimeoutError::Disconnected) => {
            anyhow::bail!("System-audio (loopback) capture thread exited before the stream started")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_success_only_when_the_thread_confirms_the_stream() {
        let (tx, rx) = crossbeam_channel::bounded::<Result<(), String>>(1);
        tx.send(Ok(())).unwrap();
        assert!(await_stream_start(&rx, Duration::from_millis(50)).is_ok());
    }

    #[test]
    fn propagates_a_stream_build_failure() {
        let (tx, rx) = crossbeam_channel::bounded::<Result<(), String>>(1);
        tx.send(Err("Could not open the stream: device in use".into()))
            .unwrap();
        let err = await_stream_start(&rx, Duration::from_millis(50)).unwrap_err();
        assert!(err.to_string().contains("device in use"), "{err}");
    }

    #[test]
    fn a_thread_that_dies_without_reporting_is_a_failure() {
        let (tx, rx) = crossbeam_channel::bounded::<Result<(), String>>(1);
        drop(tx);
        let err = await_stream_start(&rx, Duration::from_millis(50)).unwrap_err();
        assert!(err.to_string().contains("exited before"), "{err}");
    }

    #[test]
    fn a_stream_that_never_opens_times_out_instead_of_reporting_success() {
        let (_tx, rx) = crossbeam_channel::bounded::<Result<(), String>>(1);
        let err = await_stream_start(&rx, Duration::from_millis(50)).unwrap_err();
        assert!(err.to_string().contains("did not start"), "{err}");
    }
}
