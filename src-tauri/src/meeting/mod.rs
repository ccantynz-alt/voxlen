//! Bot-free meeting transcription.
//!
//! Captures BOTH sides of a call locally — the microphone (the attorney)
//! and the system audio / loopback (remote parties) — with no bot joining
//! anything and no audio leaving the machine: meeting STT is forced to
//! Whisper Local regardless of the configured dictation engine.
//!
//! Dual-channel design doubles as diarization: mic = "you", loopback =
//! "remote". Whisper inferences run sequentially (whisper.cpp saturates
//! the CPU; two parallel inferences would thrash).

pub mod extract;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crossbeam_channel::Receiver;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::audio::AudioChunk;
use crate::stt::processor::resample;
use crate::stt::{SttConfig, SttEngineType};

#[derive(Default)]
pub struct MeetingState {
    pub active: Arc<AtomicBool>,
    pub stop_flag: parking_lot::Mutex<Option<Arc<AtomicBool>>>,
    pub mic_handle: parking_lot::Mutex<Option<crate::audio::capture::CaptureHandle>>,
    pub loopback_handle: parking_lot::Mutex<Option<crate::audio::loopback::LoopbackHandle>>,
    /// Latch for a stop that arrives while a start is still opening devices.
    /// Starting is not atomic (indicator window, mic stream, loopback stream)
    /// and the handles only land in this state at the very end, so a stop in
    /// that window has nothing to take and would otherwise be swallowed —
    /// leaving mic + system audio recording with no indicator on screen.
    stop_requested: AtomicBool,
}

impl MeetingState {
    /// Opens the start window: drops any stop request left over from an
    /// earlier (possibly failed) start so it cannot abort this one.
    pub fn begin_start(&self) {
        self.stop_requested.store(false, Ordering::SeqCst);
    }

    /// Records that a stop was asked for, whether or not handles exist yet.
    pub fn request_stop(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);
    }

    /// Closes the start window: true if a stop landed while it was open.
    /// Clears the latch so the next start begins fresh.
    pub fn take_stop_requested(&self) -> bool {
        self.stop_requested.swap(false, Ordering::SeqCst)
    }
}

#[derive(Serialize, Clone)]
pub struct MeetingSegment {
    pub speaker: String, // "you" | "remote"
    pub text: String,
    pub timestamp_ms: u64,
}

/// Per-channel accumulator: buffers native-rate mono audio and decides when
/// a flush is due (enough speech followed by a quiet tail, or a hard cap).
/// Time-driven, never callback-driven — WASAPI loopback goes silent (no
/// callbacks at all) whenever nothing is playing.
struct ChannelAccumulator {
    speaker: &'static str,
    samples: Vec<f32>,
    sample_rate: u32,
    started_at_ms: u64,
    /// RMS of the most recent ~300ms window that arrived.
    tail_rms: f32,
}

const MIN_FLUSH_SECS: f32 = 1.5;
const MAX_FLUSH_SECS: f32 = 12.0;
const QUIET_TAIL_RMS: f32 = 0.008;

impl ChannelAccumulator {
    fn new(speaker: &'static str) -> Self {
        Self {
            speaker,
            samples: Vec::new(),
            sample_rate: 16000,
            started_at_ms: 0,
            tail_rms: 0.0,
        }
    }

    fn push(&mut self, chunk: &AudioChunk) {
        let mono: Vec<f32> = if chunk.channels > 1 {
            chunk
                .samples
                .chunks(chunk.channels as usize)
                .map(|f| f.iter().sum::<f32>() / chunk.channels as f32)
                .collect()
        } else {
            chunk.samples.clone()
        };
        if self.samples.is_empty() {
            self.sample_rate = chunk.sample_rate;
            self.started_at_ms = chunk.timestamp_ms;
        }
        let sum_sq: f32 = mono.iter().map(|s| s * s).sum();
        self.tail_rms = if mono.is_empty() {
            0.0
        } else {
            (sum_sq / mono.len() as f32).sqrt()
        };
        self.samples.extend(mono);
    }

    fn duration_secs(&self) -> f32 {
        if self.sample_rate == 0 {
            return 0.0;
        }
        self.samples.len() as f32 / self.sample_rate as f32
    }

    fn should_flush(&self) -> bool {
        let dur = self.duration_secs();
        dur >= MAX_FLUSH_SECS || (dur >= MIN_FLUSH_SECS && self.tail_rms < QUIET_TAIL_RMS)
    }

    /// Take the buffered audio as 16kHz mono, resetting the accumulator.
    fn take(&mut self) -> Option<(Vec<f32>, u64)> {
        if self.samples.is_empty() {
            return None;
        }
        // Skip flushes that are pure silence — loopback picks up long quiet
        // stretches and whisper hallucinates on silence.
        let sum_sq: f32 = self.samples.iter().map(|s| s * s).sum();
        let rms = (sum_sq / self.samples.len() as f32).sqrt();
        let started = self.started_at_ms;
        let samples = std::mem::take(&mut self.samples);
        self.tail_rms = 0.0;
        if rms < 0.002 {
            return None;
        }
        Some((resample(&samples, self.sample_rate, 16000), started))
    }
}

/// Meeting STT config: always Whisper Local (local-first guarantee — cloud
/// meeting STT would ship both sides of a privileged call off-device).
fn meeting_stt_config() -> SttConfig {
    let s = crate::commands::settings::get_current_settings();
    SttConfig {
        engine: SttEngineType::WhisperLocal,
        language: s.stt_language.clone(),
        auto_detect_language: s.auto_detect_language,
        api_key: None,
        model: s.whisper_local_model.clone(),
        punctuate: s.auto_punctuate,
        smart_format: s.smart_format,
        profanity_filter: false,
        custom_vocabulary: s.custom_vocabulary.clone(),
        speaker_diarization: false,
        voxlen_api_key: None,
        voxlen_context: None,
        voxlen_tenant_id: None,
    }
}

/// Drive the meeting transcription loop until `stop_flag` is set. Consumes
/// both channel receivers; emits `meeting-transcript-segment` events.
pub fn spawn_meeting_task(
    app: AppHandle,
    mic_rx: Receiver<AudioChunk>,
    loop_rx: Receiver<AudioChunk>,
    stop_flag: Arc<AtomicBool>,
    active: Arc<AtomicBool>,
) {
    tauri::async_runtime::spawn(async move {
        let mut mic = ChannelAccumulator::new("you");
        let mut remote = ChannelAccumulator::new("remote");
        let config = meeting_stt_config();

        loop {
            let stopping = stop_flag.load(Ordering::Relaxed);

            // Drain whatever has arrived on both channels.
            while let Ok(chunk) = mic_rx.try_recv() {
                mic.push(&chunk);
            }
            while let Ok(chunk) = loop_rx.try_recv() {
                remote.push(&chunk);
            }

            // Flush channels sequentially — never two whisper inferences at once.
            for acc in [&mut mic, &mut remote] {
                if acc.should_flush() || (stopping && !acc.samples.is_empty()) {
                    if let Some((samples, started_at)) = acc.take() {
                        match crate::stt::whisper_local::transcribe(&app, &samples, &config).await
                        {
                            Ok(result) => {
                                let text = result.text.trim().to_string();
                                if !text.is_empty() {
                                    let _ = app.emit(
                                        "meeting-transcript-segment",
                                        MeetingSegment {
                                            speaker: acc.speaker.to_string(),
                                            text,
                                            timestamp_ms: started_at,
                                        },
                                    );
                                }
                            }
                            Err(e) => {
                                log::error!("Meeting transcription failed: {e}");
                                let _ = app.emit("meeting-error", e.to_string());
                                // Model missing etc. — stop rather than loop errors.
                                stop_flag.store(true, Ordering::Relaxed);
                            }
                        }
                    }
                }
            }

            if stopping {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }

        active.store(false, Ordering::Relaxed);
        let _ = app.emit("meeting-stopped", ());
        log::info!("Meeting transcription task ended");
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reproduces the start/stop race: the user clicks Stop after the
    /// indicator window appears but before `start_meeting_capture` publishes
    /// its handles. The stop must still take effect once the start finishes.
    #[test]
    fn stop_during_an_in_flight_start_is_not_swallowed() {
        let state = MeetingState::default();

        // start_meeting_capture: opening devices, nothing published yet.
        state.begin_start();

        // stop_meeting_capture runs here: every take() sees None.
        assert!(state.stop_flag.lock().take().is_none());
        state.request_stop();

        // start_meeting_capture finishes and publishes its live handles.
        let capture_stop_flag = Arc::new(AtomicBool::new(false));
        *state.stop_flag.lock() = Some(capture_stop_flag.clone());
        state.active.store(true, Ordering::Relaxed);

        // Handshake at the end of start.
        if state.take_stop_requested() {
            if let Some(flag) = state.stop_flag.lock().take() {
                flag.store(true, Ordering::Relaxed);
            }
            state.active.store(false, Ordering::Relaxed);
        }

        assert!(
            capture_stop_flag.load(Ordering::Relaxed),
            "capture kept running after the user asked it to stop"
        );
        assert!(!state.active.load(Ordering::Relaxed));
    }

    #[test]
    fn a_start_that_is_never_stopped_keeps_running() {
        let state = MeetingState::default();
        state.begin_start();
        assert!(!state.take_stop_requested());
    }

    #[test]
    fn a_stale_stop_request_does_not_abort_the_next_start() {
        let state = MeetingState::default();
        // Stop arrives against a start that failed before publishing anything.
        state.request_stop();
        // The next start opens a fresh window.
        state.begin_start();
        assert!(!state.take_stop_requested());
    }
}
