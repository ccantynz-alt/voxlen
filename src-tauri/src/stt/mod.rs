pub mod cloud;
pub mod processor;
pub mod streaming;

use std::sync::Arc;
use parking_lot::RwLock;
use tauri::AppHandle;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub is_final: bool,
    pub confidence: f32,
    pub language: Option<String>,
    pub timestamp_ms: u64,
    pub words: Vec<WordResult>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WordResult {
    pub word: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub confidence: f32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum SttEngineType {
    DeepgramCloud,
    WhisperCloud,
    WhisperLocal,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SttConfig {
    pub engine: SttEngineType,
    pub language: String,
    pub auto_detect_language: bool,
    pub api_key: Option<String>,
    pub model: String,
    pub punctuate: bool,
    pub smart_format: bool,
    pub profanity_filter: bool,
    pub custom_vocabulary: Vec<String>,
}

impl Default for SttConfig {
    fn default() -> Self {
        Self {
            engine: SttEngineType::WhisperCloud,
            language: "en".to_string(),
            auto_detect_language: true,
            api_key: None,
            model: "whisper-1".to_string(),
            punctuate: true,
            smart_format: true,
            profanity_filter: false,
            custom_vocabulary: Vec::new(),
        }
    }
}

pub struct SttEngine {
    pub app_handle: AppHandle,
    pub config: Arc<RwLock<SttConfig>>,
}

impl SttEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            config: Arc::new(RwLock::new(SttConfig::default())),
        }
    }

    pub fn get_config(&self) -> SttConfig {
        self.config.read().clone()
    }

    pub fn set_config(&self, config: SttConfig) {
        *self.config.write() = config;
    }

    pub async fn transcribe(&self, audio_data: &[f32], sample_rate: u32) -> anyhow::Result<TranscriptionResult> {
        let config = self.config.read().clone();

        match config.engine {
            SttEngineType::DeepgramCloud => {
                let wav_data = encode_wav(audio_data, sample_rate)?;
                cloud::deepgram_transcribe(&wav_data, &config).await
            }
            SttEngineType::WhisperCloud => {
                let wav_data = encode_wav(audio_data, sample_rate)?;
                cloud::whisper_transcribe(&wav_data, &config).await
            }
            SttEngineType::WhisperLocal => {
                // TODO: Integrate whisper-rs (whisper.cpp Rust bindings) for true on-device inference.
                // For now, return a clear error rather than silently falling through to cloud.
                anyhow::bail!(
                    "Whisper Local is not yet available. Please select Deepgram or Whisper Cloud in Settings > Speech Engine. \
                     Local on-device inference (whisper.cpp) is coming in a future update."
                )
            }
        }
    }
}

fn encode_wav(samples: &[f32], sample_rate: u32) -> anyhow::Result<Vec<u8>> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::new(&mut cursor, spec)?;

    // Convert to mono if needed and write as 16-bit PCM
    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let int_sample = (clamped * i16::MAX as f32) as i16;
        writer.write_sample(int_sample)?;
    }

    writer.finalize()?;
    Ok(cursor.into_inner())
}

pub struct SttState(pub Arc<RwLock<SttEngine>>);

impl SttState {
    pub fn new(engine: SttEngine) -> Self {
        Self(Arc::new(RwLock::new(engine)))
    }
}
