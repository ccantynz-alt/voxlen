//! Always-Ready speech gate.
//!
//! Sits between the (permanently running) audio capture and the Deepgram
//! streaming session. Watches local RMS energy and opens a cloud session
//! only while speech is present, closing it again after a silence hangover.
//! While no speech is detected — including whenever the mic is hardware-
//! muted and produces digital silence — **zero bytes leave the machine**.
//!
//! The FSM (`GateFsm`) is a pure struct with no tokio/tauri dependencies so
//! it is directly unit-testable; the IO wrapper task owns the ring buffer
//! and the streaming-session lifecycle.

use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crossbeam_channel::Receiver;
use tauri::{AppHandle, Emitter, Manager};

use crate::audio::AudioChunk;
use super::{streaming, SttEngineType};

// --- Tunables (empirical starting points — adjust on-device) -------------

/// Absolute minimum RMS for a chunk to count as speech. With noise
/// suppression on, ambient noise arrives attenuated to ≲0.0015 while speech
/// passes at ≳0.005–0.015, so 0.008 sits comfortably between.
const OPEN_RMS_FLOOR: f32 = 0.008;
/// Speech must also exceed this multiple of the adaptive ambient floor —
/// protects users with noise suppression off (fans, HVAC, music beds).
const NOISE_FLOOR_MULT: f32 = 2.5;
/// Open when at least OPEN_REQUIRED of the last OPEN_WINDOW chunks are
/// active (chunks are ~100ms ⇒ ≥200ms sustained energy in the last 300ms).
/// Keystroke clicks are <50ms transients and can never satisfy this.
const OPEN_WINDOW_CHUNKS: usize = 3;
const OPEN_REQUIRED_CHUNKS: usize = 2;
/// Close the cloud session after this much continuous local silence.
/// Longer than natural mid-dictation composing pauses; reconnects are
/// invisible anyway thanks to the pre-roll ring buffer.
const SILENCE_CLOSE_SECS: f32 = 10.0;
/// After a close, refuse to reopen for this long so a music bed or a
/// keyboard run can't flap the socket.
const REOPEN_COOLDOWN_SECS: f32 = 1.0;
/// Pre-roll ring capacity: ~1.8s of 100ms chunks. Covers the 200ms VAD
/// confirm plus worst-case ~500ms WebSocket connect with margin, so the
/// first words of an utterance are never lost.
const RING_CAPACITY_CHUNKS: usize = 18;
/// Adaptive noise floor EMA rates: falls quickly, rises slowly (speech is
/// intermittent, so talking barely lifts the floor; steady fan noise lifts
/// it over ~30s until it is correctly classified as ambient).
const FLOOR_FALL_ALPHA: f32 = 0.3;
const FLOOR_RISE_ALPHA: f32 = 0.02;

// --- Pure FSM -------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GatePhase {
    /// Watching for speech; nothing leaves the machine.
    Armed,
    /// Cloud session open; chunks forwarded.
    Streaming,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateAction {
    None,
    /// Sustained speech detected — open a streaming session and flush pre-roll.
    Open,
    /// Silence hangover expired — close the streaming session.
    Close,
}

pub struct GateFsm {
    phase: GatePhase,
    recent_active: VecDeque<bool>,
    silence_secs: f32,
    cooldown_secs: f32,
    noise_floor: f32,
}

impl GateFsm {
    pub fn new() -> Self {
        Self {
            phase: GatePhase::Armed,
            recent_active: VecDeque::with_capacity(OPEN_WINDOW_CHUNKS),
            silence_secs: 0.0,
            cooldown_secs: 0.0,
            noise_floor: 0.001,
        }
    }

    pub fn phase(&self) -> GatePhase {
        self.phase
    }

    fn threshold(&self) -> f32 {
        OPEN_RMS_FLOOR.max(self.noise_floor * NOISE_FLOOR_MULT)
    }

    /// Feed one audio chunk's RMS and duration. Returns what the IO layer
    /// should do. Time accounting is sample-count-based (callers derive
    /// `chunk_secs` from the chunk itself), never wall-clock.
    pub fn feed(&mut self, rms: f32, chunk_secs: f32) -> GateAction {
        // Adaptive ambient floor: fall fast, rise slow.
        let alpha = if rms < self.noise_floor { FLOOR_FALL_ALPHA } else { FLOOR_RISE_ALPHA };
        self.noise_floor = (self.noise_floor + (rms - self.noise_floor) * alpha).clamp(1e-5, 0.05);

        let active = rms >= self.threshold();

        if self.cooldown_secs > 0.0 {
            self.cooldown_secs = (self.cooldown_secs - chunk_secs).max(0.0);
        }

        self.recent_active.push_back(active);
        if self.recent_active.len() > OPEN_WINDOW_CHUNKS {
            self.recent_active.pop_front();
        }

        match self.phase {
            GatePhase::Armed => {
                let sustained =
                    self.recent_active.iter().filter(|a| **a).count() >= OPEN_REQUIRED_CHUNKS;
                if sustained && self.cooldown_secs <= 0.0 {
                    self.phase = GatePhase::Streaming;
                    self.silence_secs = 0.0;
                    return GateAction::Open;
                }
                GateAction::None
            }
            GatePhase::Streaming => {
                if active {
                    self.silence_secs = 0.0;
                } else {
                    self.silence_secs += chunk_secs;
                }
                if self.silence_secs >= SILENCE_CLOSE_SECS {
                    self.close_internal();
                    return GateAction::Close;
                }
                GateAction::None
            }
        }
    }

    /// Advance time with no audio arriving at all (capture paused, or the
    /// receiver timed out). While streaming this counts as silence so the
    /// session still drains; while armed it just runs the cooldown down.
    pub fn feed_silence(&mut self, secs: f32) -> GateAction {
        if self.cooldown_secs > 0.0 {
            self.cooldown_secs = (self.cooldown_secs - secs).max(0.0);
        }
        if self.phase == GatePhase::Streaming {
            self.silence_secs += secs;
            if self.silence_secs >= SILENCE_CLOSE_SECS {
                self.close_internal();
                return GateAction::Close;
            }
        }
        GateAction::None
    }

    fn close_internal(&mut self) {
        self.phase = GatePhase::Armed;
        self.silence_secs = 0.0;
        self.cooldown_secs = REOPEN_COOLDOWN_SECS;
        self.recent_active.clear();
    }
}

// --- IO wrapper ------------------------------------------------------------

pub struct GateHandle {
    stop_flag: Arc<AtomicBool>,
}

impl GateHandle {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}

fn emit_state(app: &AppHandle, state: &str) {
    let _ = app.emit("always-ready-state", state);
    if let Some(tray) = app.tray_by_id(crate::TRAY_ID) {
        let tooltip = match state {
            "armed" => "Voxlen — Always-Ready (armed, speak anytime)",
            "streaming" => "Voxlen — transcribing",
            _ => "Voxlen — AI voice dictation for legal and accounting professionals",
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

/// Spawn the gate task over an always-alive capture receiver. Lazily opens
/// and closes `StreamingSession`s as the FSM directs, flushing the pre-roll
/// ring on every open so no words are lost during the WS handshake.
pub fn start_gate(
    audio_receiver: Receiver<AudioChunk>,
    stt_state: Arc<parking_lot::RwLock<super::SttEngine>>,
    app_handle: AppHandle,
) -> GateHandle {
    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop = stop_flag.clone();

    tauri::async_runtime::spawn(async move {
        let mut fsm = GateFsm::new();
        let mut ring: VecDeque<AudioChunk> = VecDeque::with_capacity(RING_CAPACITY_CHUNKS);
        let mut session: Option<(
            streaming::StreamingSession,
            crossbeam_channel::Sender<AudioChunk>,
        )> = None;

        emit_state(&app_handle, "armed");
        log::info!("Always-Ready gate armed");

        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }

            match audio_receiver.recv_timeout(Duration::from_millis(50)) {
                Ok(chunk) => {
                    let denom = (chunk.sample_rate as f32 * chunk.channels as f32).max(1.0);
                    let chunk_secs = chunk.samples.len() as f32 / denom;
                    let rms = crate::audio::capture::calculate_rms(&chunk.samples);

                    match fsm.feed(rms, chunk_secs) {
                        GateAction::Open => {
                            // Fail-closed: never open a cloud session in
                            // privileged mode or on a non-Deepgram engine.
                            let cfg = stt_state.read().get_config();
                            let privileged = crate::commands::settings::get_privileged_mode();
                            let is_deepgram = matches!(cfg.engine, SttEngineType::DeepgramCloud);
                            if privileged || !is_deepgram {
                                log::warn!(
                                    "Always-Ready gate refused to open (privileged={}, engine ok={})",
                                    privileged, is_deepgram
                                );
                                // Force the FSM back to armed with a cooldown
                                // so it doesn't retry every chunk.
                                let _ = fsm.feed_silence(SILENCE_CLOSE_SECS);
                                continue;
                            }

                            let (tx, rx) = crossbeam_channel::bounded::<AudioChunk>(512);
                            match streaming::start_streaming(cfg, rx, app_handle.clone()) {
                                Ok(s) => {
                                    // Flush pre-roll (oldest first), then the
                                    // chunk that tripped the gate.
                                    for buffered in ring.drain(..) {
                                        let _ = tx.try_send(buffered);
                                    }
                                    let _ = tx.try_send(chunk);
                                    session = Some((s, tx));
                                    emit_state(&app_handle, "streaming");
                                    log::info!("Always-Ready gate opened streaming session");
                                }
                                Err(e) => {
                                    log::error!("Always-Ready gate failed to open session: {}", e);
                                    let _ = fsm.feed_silence(SILENCE_CLOSE_SECS);
                                    emit_state(&app_handle, "armed");
                                }
                            }
                        }
                        GateAction::Close => {
                            if let Some((s, tx)) = session.take() {
                                drop(tx); // sender loop sees Disconnected → CloseStream
                                s.stop();
                            }
                            ring.clear();
                            ring.push_back(chunk);
                            emit_state(&app_handle, "armed");
                            log::info!("Always-Ready gate closed streaming session (silence)");
                        }
                        GateAction::None => match fsm.phase() {
                            GatePhase::Streaming => {
                                if let Some((_, tx)) = &session {
                                    let _ = tx.try_send(chunk);
                                }
                            }
                            GatePhase::Armed => {
                                ring.push_back(chunk);
                                while ring.len() > RING_CAPACITY_CHUNKS {
                                    ring.pop_front();
                                }
                            }
                        },
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                    // Capture paused or no callbacks — time still passes.
                    if fsm.feed_silence(0.05) == GateAction::Close {
                        if let Some((s, tx)) = session.take() {
                            drop(tx);
                            s.stop();
                        }
                        ring.clear();
                        emit_state(&app_handle, "armed");
                        log::info!("Always-Ready gate closed streaming session (no audio)");
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                    // Capture torn down (stop, device fault → watchdog restart).
                    break;
                }
            }
        }

        if let Some((s, tx)) = session.take() {
            drop(tx);
            s.stop();
        }
        emit_state(&app_handle, "off");
        log::info!("Always-Ready gate exited");
    });

    GateHandle { stop_flag }
}

// --- Tests ------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    const CHUNK: f32 = 0.1; // 100ms chunks
    const SPEECH: f32 = 0.05;
    const QUIET: f32 = 0.0005;

    #[test]
    fn opens_only_after_sustained_energy() {
        let mut fsm = GateFsm::new();
        assert_eq!(fsm.feed(SPEECH, CHUNK), GateAction::None); // 1 of window
        assert_eq!(fsm.feed(SPEECH, CHUNK), GateAction::Open); // 2 of 3 → open
        assert_eq!(fsm.phase(), GatePhase::Streaming);
    }

    #[test]
    fn ignores_single_chunk_blips() {
        let mut fsm = GateFsm::new();
        for _ in 0..20 {
            assert_eq!(fsm.feed(QUIET, CHUNK), GateAction::None);
            assert_eq!(fsm.feed(SPEECH, CHUNK), GateAction::None); // isolated blip
            assert_eq!(fsm.feed(QUIET, CHUNK), GateAction::None);
            assert_eq!(fsm.feed(QUIET, CHUNK), GateAction::None);
        }
        assert_eq!(fsm.phase(), GatePhase::Armed);
    }

    #[test]
    fn closes_after_silence_hangover() {
        let mut fsm = GateFsm::new();
        fsm.feed(SPEECH, CHUNK);
        assert_eq!(fsm.feed(SPEECH, CHUNK), GateAction::Open);
        // Just under the hangover: still streaming.
        let chunks_short = ((SILENCE_CLOSE_SECS / CHUNK) as usize) - 1;
        for _ in 0..chunks_short {
            assert_eq!(fsm.feed(QUIET, CHUNK), GateAction::None);
        }
        // Crossing the hangover closes.
        assert_eq!(fsm.feed(QUIET, CHUNK), GateAction::Close);
        assert_eq!(fsm.phase(), GatePhase::Armed);
    }

    #[test]
    fn speech_resets_silence_hangover() {
        let mut fsm = GateFsm::new();
        fsm.feed(SPEECH, CHUNK);
        fsm.feed(SPEECH, CHUNK);
        for _ in 0..80 {
            assert_eq!(fsm.feed(QUIET, CHUNK), GateAction::None); // 8s silence
        }
        fsm.feed(SPEECH, CHUNK); // speak again — timer resets
        for _ in 0..80 {
            assert_eq!(fsm.feed(QUIET, CHUNK), GateAction::None); // another 8s ok
        }
        assert_eq!(fsm.phase(), GatePhase::Streaming);
    }

    #[test]
    fn cooldown_blocks_immediate_reopen() {
        let mut fsm = GateFsm::new();
        fsm.feed(SPEECH, CHUNK);
        fsm.feed(SPEECH, CHUNK);
        for _ in 0..((SILENCE_CLOSE_SECS / CHUNK) as usize) + 1 {
            fsm.feed(QUIET, CHUNK);
        }
        assert_eq!(fsm.phase(), GatePhase::Armed);
        // Immediately loud again: inside the 1s cooldown → no open.
        assert_eq!(fsm.feed(SPEECH, CHUNK), GateAction::None);
        assert_eq!(fsm.feed(SPEECH, CHUNK), GateAction::None);
        // Burn the rest of the cooldown with quiet chunks.
        for _ in 0..10 {
            fsm.feed(QUIET, CHUNK);
        }
        fsm.feed(SPEECH, CHUNK);
        assert_eq!(fsm.feed(SPEECH, CHUNK), GateAction::Open);
    }

    #[test]
    fn feed_silence_drains_open_session() {
        let mut fsm = GateFsm::new();
        fsm.feed(SPEECH, CHUNK);
        fsm.feed(SPEECH, CHUNK);
        assert_eq!(fsm.phase(), GatePhase::Streaming);
        // Capture paused: no chunks at all, wall time passes.
        assert_eq!(fsm.feed_silence(SILENCE_CLOSE_SECS - 0.1), GateAction::None);
        assert_eq!(fsm.feed_silence(0.2), GateAction::Close);
        assert_eq!(fsm.phase(), GatePhase::Armed);
    }

    #[test]
    fn adaptive_floor_rejects_steady_ambient_noise() {
        let mut fsm = GateFsm::new();
        // Steady fan noise just above the static floor. The adaptive floor
        // rises until 2.5× floor exceeds it; the gate may open once at the
        // start but must eventually close and stay closed.
        let fan = 0.012_f32;
        let mut closed_and_stayed = false;
        for i in 0..3000 {
            let action = fsm.feed(fan, CHUNK);
            if i > 2000 {
                assert_ne!(action, GateAction::Open, "gate reopened on steady noise at chunk {i}");
                if fsm.phase() == GatePhase::Armed {
                    closed_and_stayed = true;
                }
            }
        }
        assert!(closed_and_stayed, "gate never settled closed on steady ambient noise");
        // Real speech still gets through (well above the lifted floor).
        fsm.feed(0.2, CHUNK);
        assert_eq!(fsm.feed(0.2, CHUNK), GateAction::Open);
    }
}
