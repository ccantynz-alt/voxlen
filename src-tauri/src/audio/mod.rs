pub mod capture;
pub mod devices;

use std::sync::Arc;
use parking_lot::RwLock;
use tauri::AppHandle;
use crossbeam_channel::{Sender, Receiver};

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
    pub selected_device: Arc<RwLock<Option<String>>>,
    pub status: Arc<RwLock<DictationStatus>>,
    pub audio_sender: Option<Sender<AudioChunk>>,
    pub audio_receiver: Option<Receiver<AudioChunk>>,
    pub input_level: Arc<RwLock<f32>>,
    capture_handle: Arc<RwLock<Option<capture::CaptureHandle>>>,
}

impl AudioEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        let (sender, receiver) = crossbeam_channel::bounded(256);

        Self {
            app_handle,
            selected_device: Arc::new(RwLock::new(None)),
            status: Arc::new(RwLock::new(DictationStatus::Idle)),
            audio_sender: Some(sender),
            audio_receiver: Some(receiver),
            input_level: Arc::new(RwLock::new(0.0)),
            capture_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn list_devices(&self) -> Vec<AudioDevice> {
        devices::enumerate_devices()
    }

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

    pub fn start_capture(&self) -> anyhow::Result<()> {
        let device_id = self.selected_device.read().clone();
        let sender = self.audio_sender.clone()
            .ok_or_else(|| anyhow::anyhow!("Audio sender not available"))?;
        let input_level = self.input_level.clone();
        let app_handle = self.app_handle.clone();

        let handle = capture::start_capture(device_id, sender, input_level, app_handle)?;
        *self.capture_handle.write() = Some(handle);
        *self.status.write() = DictationStatus::Listening;

        log::info!("Audio capture started");
        Ok(())
    }

    pub fn stop_capture(&self) -> anyhow::Result<()> {
        if let Some(handle) = self.capture_handle.write().take() {
            handle.stop();
        }
        *self.status.write() = DictationStatus::Idle;
        *self.input_level.write() = 0.0;

        log::info!("Audio capture stopped");
        Ok(())
    }

    pub fn pause_capture(&self) -> anyhow::Result<()> {
        *self.status.write() = DictationStatus::Paused;
        log::info!("Audio capture paused");
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
