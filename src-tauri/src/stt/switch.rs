//! Hardware mic-switch mode.
//!
//! Lets the physical mute/power switch on an external microphone (Razer,
//! Blue Yeti, Shure, Elgato Wave, …) drive dictation directly: flip the
//! switch on and Voxlen starts transcribing, flip it off and the session
//! finalizes — no Win+H, no keyboard shortcut, no clicking.
//!
//! Detection principle: a hardware-muted mic delivers *digital silence* —
//! sample peaks at or near exactly zero (at most ±1 LSB of dither, ≈3e-5
//! for 16-bit). A live analog capsule always carries a noise floor well
//! above that, even in a quiet room and even after Voxlen's noise gate
//! attenuates ambience. So "sustained peaks below −80 dBFS" reliably means
//! the switch is off, and the first frames back above it mean it was
//! flipped on. Mics whose switch powers the USB interface off entirely are
//! covered too: the capture watchdog re-arms capture when the device
//! re-enumerates, and this task starts over.
//!
//! Like the Always-Ready gate, the FSM (`SwitchFsm`) is a pure struct with
//! no tokio/tauri dependencies so it is directly unit-testable; the IO
//! wrapper owns the relay into an `AudioProcessor`, which already routes
//! Deepgram to streaming and Whisper (cloud or fully local) to batch — so
//! the switch works identically across every STT engine, including
//! privileged mode's forced-local engine.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crossbeam_channel::Receiver;
use parking_lot::RwLock;
use tauri::{AppHandle, Emitter};

use crate::audio::{AudioChunk, DictationStatus};
use super::processor::AudioProcessor;
use super::SttEngine;

// --- Tunables --------------------------------------------------------------

/// Peak amplitude below which a chunk counts as digital silence (−80 dBFS).
/// Above ±1 LSB of 16-bit dither (≈3e-5), below any live analog noise floor
/// even after the capture pipeline's noise gate attenuates ambience to 0.1×.
const DEAD_PEAK: f32 = 1e-4;
/// Consecutive dead audio required before declaring the switch off. Long
/// enough that a driver hiccup or a single zeroed buffer can't false-mute.
const MUTE_CONFIRM_SECS: f32 = 0.6;
/// Consecutive live chunks required before declaring the switch on — two
/// chunks (~200ms) so an isolated dither spike while muted can't false-arm.
const LIVE_CONFIRM_CHUNKS: u32 = 2;
/// After the switch goes off, keep the STT relay open (without forwarding)
/// this long so the processor's silence-flush transcribes the tail of the
/// last utterance before the session is torn down.
const DRAIN_SECS: f32 = 2.5;

// --- Pure FSM --------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SwitchPhase {
    /// Switch is on — audio is flowing to the STT session.
    Live,
    /// Switch is off — mic delivers digital silence; watching for flip-on.
    Muted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SwitchAction {
    None,
    /// Sustained digital silence — the physical switch was flipped off.
    WentMuted,
    /// Real signal returned — the physical switch was flipped on.
    WentLive,
}

pub struct SwitchFsm {
    phase: SwitchPhase,
    dead_secs: f32,
    live_chunks: u32,
}

impl SwitchFsm {
    pub fn new() -> Self {
        Self {
            phase: SwitchPhase::Live,
            dead_secs: 0.0,
            live_chunks: 0,
        }
    }

    pub fn phase(&self) -> SwitchPhase {
        self.phase
    }

    /// Feed one chunk's peak amplitude and duration. Time accounting is
    /// sample-count-based (callers derive `chunk_secs` from the chunk),
    /// never wall-clock — absence of chunks (capture paused) is not fed.
    pub fn feed(&mut self, peak: f32, chunk_secs: f32) -> SwitchAction {
        let dead = peak < DEAD_PEAK;

        match self.phase {
            SwitchPhase::Live => {
                if dead {
                    self.dead_secs += chunk_secs;
                    if self.dead_secs >= MUTE_CONFIRM_SECS {
                        self.phase = SwitchPhase::Muted;
                        self.dead_secs = 0.0;
                        self.live_chunks = 0;
                        return SwitchAction::WentMuted;
                    }
                } else {
                    self.dead_secs = 0.0;
                }
                SwitchAction::None
            }
            SwitchPhase::Muted => {
                if dead {
                    self.live_chunks = 0;
                } else {
                    self.live_chunks += 1;
                    if self.live_chunks >= LIVE_CONFIRM_CHUNKS {
                        self.phase = SwitchPhase::Live;
                        self.dead_secs = 0.0;
                        self.live_chunks = 0;
                        return SwitchAction::WentLive;
                    }
                }
                SwitchAction::None
            }
        }
    }
}

// --- IO wrapper ------------------------------------------------------------

pub struct SwitchHandle {
    stop_flag: Arc<AtomicBool>,
}

impl SwitchHandle {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}

fn emit_state(app: &AppHandle, state: &str) {
    let _ = app.emit("mic-switch-state", state);
    if let Some(tray) = app.tray_by_id(crate::TRAY_ID) {
        let tooltip = match state {
            "live" => "Voxlen — mic switch on, dictating",
            "muted" => "Voxlen — mic switched off (flip the switch to dictate)",
            _ => "Voxlen — AI voice dictation for legal and accounting professionals",
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

fn peak_amplitude(samples: &[f32]) -> f32 {
    samples.iter().fold(0.0_f32, |m, s| m.max(s.abs()))
}

/// Spawn the switch task over an always-alive capture receiver. Opens an
/// `AudioProcessor` relay while the physical switch is on, drains and closes
/// it when the switch goes off, and reopens on the next flip-on.
pub fn start_switch(
    audio_receiver: Receiver<AudioChunk>,
    stt_state: Arc<RwLock<SttEngine>>,
    status: Arc<RwLock<DictationStatus>>,
    app_handle: AppHandle,
) -> SwitchHandle {
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop = stop_flag.clone();

    tauri::async_runtime::spawn(async move {
        let mut fsm = SwitchFsm::new();
        // Relay into the engine-agnostic processor. Some(_) while a session
        // is open or draining; None while fully muted.
        let mut relay: Option<crossbeam_channel::Sender<AudioChunk>> = None;
        // Seconds of drain remaining after a mute before the relay is dropped.
        let mut drain_remaining: f32 = 0.0;

        let open_relay = |relay: &mut Option<crossbeam_channel::Sender<AudioChunk>>| {
            let (tx, rx) = crossbeam_channel::bounded::<AudioChunk>(512);
            AudioProcessor::new(app_handle.clone(), stt_state.clone(), status.clone()).start(rx);
            *relay = Some(tx);
        };

        // Assume the switch is on at start (capture just started); if the mic
        // is actually muted the FSM flips to Muted within MUTE_CONFIRM_SECS.
        open_relay(&mut relay);
        emit_state(&app_handle, "live");
        log::info!("Mic-switch mode active (hardware switch controls dictation)");

        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }

            match audio_receiver.recv_timeout(Duration::from_millis(100)) {
                Ok(chunk) => {
                    let denom = (chunk.sample_rate as f32 * chunk.channels as f32).max(1.0);
                    let chunk_secs = chunk.samples.len() as f32 / denom;
                    let peak = peak_amplitude(&chunk.samples);

                    match fsm.feed(peak, chunk_secs) {
                        SwitchAction::WentMuted => {
                            // Stop forwarding; keep the relay open briefly so
                            // the processor's silence-flush transcribes the
                            // tail, then drop it below as drain time elapses.
                            drain_remaining = DRAIN_SECS;
                            *status.write() = DictationStatus::Paused;
                            emit_state(&app_handle, "muted");
                            log::info!("Mic switch flipped OFF — finalizing session");
                        }
                        SwitchAction::WentLive => {
                            if relay.is_none() {
                                open_relay(&mut relay);
                            }
                            drain_remaining = 0.0;
                            *status.write() = DictationStatus::Listening;
                            emit_state(&app_handle, "live");
                            log::info!("Mic switch flipped ON — dictation live");
                            if let Some(tx) = &relay {
                                let _ = tx.try_send(chunk);
                            }
                        }
                        SwitchAction::None => match fsm.phase() {
                            SwitchPhase::Live => {
                                if let Some(tx) = &relay {
                                    let _ = tx.try_send(chunk);
                                }
                            }
                            SwitchPhase::Muted => {
                                if drain_remaining > 0.0 {
                                    drain_remaining -= chunk_secs;
                                    if drain_remaining <= 0.0 {
                                        relay = None; // processor sees Disconnected → finalizes
                                    }
                                }
                            }
                        },
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                    // No chunks (capture paused, or muted device delivering no
                    // callbacks) — only the drain countdown advances. The FSM
                    // itself never moves on absence of audio: paused ≠ muted.
                    if drain_remaining > 0.0 {
                        drain_remaining -= 0.1;
                        if drain_remaining <= 0.0 {
                            relay = None;
                        }
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                    // Capture torn down (stop, or device unplugged → watchdog
                    // will restart capture and re-enter switch mode).
                    break;
                }
            }
        }

        drop(relay); // close any open session
        emit_state(&app_handle, "off");
        log::info!("Mic-switch task exited");
    });

    SwitchHandle { stop_flag }
}

// --- Tests ------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    const CHUNK: f32 = 0.1; // 100ms chunks
    const SPEECH: f32 = 0.2;
    const ROOM_NOISE: f32 = 0.002; // quiet room analog floor, post-gate
    const DITHER: f32 = 3.0e-5; // ±1 LSB @ 16-bit — hardware muted
    const ZERO: f32 = 0.0;

    #[test]
    fn mutes_after_sustained_digital_silence() {
        let mut fsm = SwitchFsm::new();
        assert_eq!(fsm.phase(), SwitchPhase::Live);
        let confirm_chunks = (MUTE_CONFIRM_SECS / CHUNK) as usize;
        for _ in 0..confirm_chunks - 1 {
            assert_eq!(fsm.feed(ZERO, CHUNK), SwitchAction::None);
        }
        assert_eq!(fsm.feed(ZERO, CHUNK), SwitchAction::WentMuted);
        assert_eq!(fsm.phase(), SwitchPhase::Muted);
    }

    #[test]
    fn dither_counts_as_muted_but_room_noise_does_not() {
        let mut fsm = SwitchFsm::new();
        // Hardware mute with 1-LSB dither still reads as muted.
        for _ in 0..20 {
            fsm.feed(DITHER, CHUNK);
        }
        assert_eq!(fsm.phase(), SwitchPhase::Muted);

        // A live mic in a silent room (no speech) must NOT read as muted.
        let mut fsm = SwitchFsm::new();
        for _ in 0..600 {
            assert_eq!(fsm.feed(ROOM_NOISE, CHUNK), SwitchAction::None);
        }
        assert_eq!(fsm.phase(), SwitchPhase::Live);
    }

    #[test]
    fn brief_zero_buffer_does_not_false_mute() {
        let mut fsm = SwitchFsm::new();
        for _ in 0..50 {
            // Alternating: driver delivers an occasional zeroed buffer.
            assert_eq!(fsm.feed(ZERO, CHUNK), SwitchAction::None);
            assert_eq!(fsm.feed(ROOM_NOISE, CHUNK), SwitchAction::None);
        }
        assert_eq!(fsm.phase(), SwitchPhase::Live);
    }

    #[test]
    fn flip_on_goes_live_after_confirm() {
        let mut fsm = SwitchFsm::new();
        for _ in 0..10 {
            fsm.feed(ZERO, CHUNK);
        }
        assert_eq!(fsm.phase(), SwitchPhase::Muted);
        // Switch flipped on: analog floor returns on every chunk.
        assert_eq!(fsm.feed(ROOM_NOISE, CHUNK), SwitchAction::None); // 1 of 2
        assert_eq!(fsm.feed(ROOM_NOISE, CHUNK), SwitchAction::WentLive);
        assert_eq!(fsm.phase(), SwitchPhase::Live);
    }

    #[test]
    fn isolated_spike_while_muted_does_not_arm() {
        let mut fsm = SwitchFsm::new();
        for _ in 0..10 {
            fsm.feed(ZERO, CHUNK);
        }
        for _ in 0..50 {
            assert_eq!(fsm.feed(SPEECH, CHUNK), SwitchAction::None); // spike
            assert_eq!(fsm.feed(ZERO, CHUNK), SwitchAction::None);
        }
        assert_eq!(fsm.phase(), SwitchPhase::Muted);
    }

    #[test]
    fn full_toggle_cycle() {
        let mut fsm = SwitchFsm::new();
        // Dictating.
        for _ in 0..30 {
            assert_eq!(fsm.feed(SPEECH, CHUNK), SwitchAction::None);
        }
        // Flip off.
        let confirm_chunks = (MUTE_CONFIRM_SECS / CHUNK) as usize;
        for _ in 0..confirm_chunks - 1 {
            fsm.feed(ZERO, CHUNK);
        }
        assert_eq!(fsm.feed(ZERO, CHUNK), SwitchAction::WentMuted);
        // Flip back on and speak.
        fsm.feed(ROOM_NOISE, CHUNK);
        assert_eq!(fsm.feed(SPEECH, CHUNK), SwitchAction::WentLive);
        assert_eq!(fsm.phase(), SwitchPhase::Live);
    }
}
