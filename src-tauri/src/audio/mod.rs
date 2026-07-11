pub mod capture;
pub mod devices;
pub mod loopback;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use parking_lot::RwLock;
use tauri::AppHandle;
use crossbeam_channel::Receiver;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub is_external: bool,
    pub sample_rate: u32,
    pub channels: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum DictationStatus {
    Idle,
    Listening,
    Processing,
    Paused,
    Error,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioChunk {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub timestamp_ms: u64,
}

pub struct AudioEngine {
    pub app_handle: AppHandle,
    /// The user's device preference. Sticky: kept even while the device is
    /// temporarily disconnected/muted so it is picked back up automatically
    /// as soon as it reappears, instead of silently staying on a fallback.
    pub selected_device: Arc<RwLock<Option<String>>>,
    /// The device actually in use for the current/last capture — may differ
    /// from `selected_device` when the preference was unavailable at capture
    /// start and we fell back to the best available device.
    pub active_device_id: Arc<RwLock<Option<String>>>,
    pub status: Arc<RwLock<DictationStatus>>,
    pub input_level: Arc<RwLock<f32>>,
    /// Set by the capture thread when the stream errors out or the active
    /// device disappears mid-capture. The dictation watchdog polls and
    /// clears this to trigger automatic recovery.
    pub device_fault: Arc<AtomicBool>,
    /// While true the capture callback discards all audio — nothing is
    /// buffered or forwarded to STT. Shared with the capture thread so
    /// pause takes effect immediately without tearing the stream down.
    paused: Arc<AtomicBool>,
    capture_handle: Arc<RwLock<Option<capture::CaptureHandle>>>,
}

impl AudioEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            selected_device: Arc::new(RwLock::new(None)),
            active_device_id: Arc::new(RwLock::new(None)),
            status: Arc::new(RwLock::new(DictationStatus::Idle)),
            input_level: Arc::new(RwLock::new(0.0)),
            device_fault: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
            capture_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn list_devices(&self) -> Vec<AudioDevice> {
        devices::enumerate_devices()
    }

    /// Explicitly select a device from a currently-connected list (used by
    /// the Settings device picker, which only ever shows connected devices).
    pub fn select_device(&self, device_id: &str) -> anyhow::Result<()> {
        let devices = self.list_devices();
        if devices.iter().any(|d| d.id == device_id) {
            *self.selected_device.write() = Some(device_id.to_string());
            log::info!("Selected audio device: {}", device_id);
            Ok(())
        } else {
            anyhow::bail!("Device not found: {}", device_id)
        }
    }

    /// Apply a stored preference unconditionally, even if the device is not
    /// currently connected. Used when hydrating settings on startup — the
    /// mic may be unplugged or muted at that moment, but the preference
    /// should still be remembered so capture picks it up the moment it's
    /// available again.
    pub fn set_preferred_device(&self, device_id: Option<String>) {
        *self.selected_device.write() = device_id;
    }

    /// Human-readable name of the device actually in use, for UI status text.
    pub fn get_active_device_name(&self) -> Option<String> {
        let id = self.active_device_id.read().clone()?;
        Some(
            self.list_devices()
                .into_iter()
                .find(|d| d.id == id)
                .map(|d| d.name)
                .unwrap_or(id),
        )
    }

    /// Swap the fault flag back to false and return whether it was set —
    /// used by the watchdog to consume a fault exactly once per recovery attempt.
    pub fn take_device_fault(&self) -> bool {
        self.device_fault.swap(false, Ordering::Relaxed)
    }

    pub fn mark_error(&self) {
        *self.status.write() = DictationStatus::Error;
    }

    pub fn start_capture(&self) -> anyhow::Result<Receiver<AudioChunk>> {
        self.start_capture_with_options(1.0, true)
    }

    /// Start audio capture with explicit gain and noise suppression settings.
    /// Returns the receiver end of the fresh audio channel, which must be
    /// passed to the STT handler by the caller.
    pub fn start_capture_with_options(&self, input_gain: f32, noise_suppression: bool) -> anyhow::Result<Receiver<AudioChunk>> {
        let (sender, receiver) = crossbeam_channel::bounded(256);

        let device_id = self.selected_device.read().clone();
        let input_level = self.input_level.clone();
        let app_handle = self.app_handle.clone();
        self.device_fault.store(false, Ordering::Relaxed);
        self.paused.store(false, Ordering::Relaxed);

        let (handle, resolved_id) = capture::start_capture_with_options(
            device_id, sender, input_level, app_handle, input_gain, noise_suppression, self.device_fault.clone(), self.paused.clone()
        )?;
        *self.active_device_id.write() = resolved_id;
        *self.capture_handle.write() = Some(handle);
        *self.status.write() = DictationStatus::Listening;

        log::info!("Audio capture started (gain={}, noise_suppression={})", input_gain, noise_suppression);
        Ok(receiver)
    }

    pub fn stop_capture(&self) -> anyhow::Result<()> {
        if let Some(handle) = self.capture_handle.write().take() {
            handle.stop();
        }
        *self.status.write() = DictationStatus::Idle;
        *self.input_level.write() = 0.0;
        *self.active_device_id.write() = None;
        self.device_fault.store(false, Ordering::Relaxed);
        self.paused.store(false, Ordering::Relaxed);

        log::info!("Audio capture stopped");
        Ok(())
    }

    pub fn pause_capture(&self) -> anyhow::Result<()> {
        // The paused flag gates the capture callback itself, so no audio is
        // buffered or forwarded (to Deepgram or anywhere else) while paused —
        // not just a UI status.
        self.paused.store(true, Ordering::Relaxed);
        *self.status.write() = DictationStatus::Paused;
        log::info!("Audio capture paused");
        Ok(())
    }

    pub fn resume_capture(&self) -> anyhow::Result<()> {
        let mut status = self.status.write();
        if *status != DictationStatus::Paused {
            anyhow::bail!("Cannot resume: dictation is not paused");
        }
        self.paused.store(false, Ordering::Relaxed);
        *status = DictationStatus::Listening;
        log::info!("Audio capture resumed");
        Ok(())
    }

    pub fn get_status(&self) -> DictationStatus {
        *self.status.read()
    }

    pub fn get_input_level(&self) -> f32 {
        *self.input_level.read()
    }
}

pub struct AudioState(pub Arc<RwLock<AudioEngine>>);

impl AudioState {
    pub fn new(engine: AudioEngine) -> Self {
        Self(Arc::new(RwLock::new(engine)))
    }
}
