use super::{SttConfig, TranscriptionResult, WordResult};

/// Proxy STT through voxlen.ai/api — no provider key needed.
async fn voxlen_proxy_transcribe(
    wav_data: &[u8],
    voxlen_key: &str,
    config: &SttConfig,
) -> anyhow::Result<TranscriptionResult> {
    // The proxy expects a raw audio body with settings carried in headers
    // (sending multipart here would forward form boundaries to Deepgram as
    // if they were audio).
    let client = reqwest::Client::new();
    let mut req = client
        .post("https://voxlen.ai/api/stt")
        .header("Authorization", format!("Bearer {}", voxlen_key))
        .header("Content-Type", "audio/wav")
        .header("X-Language", config.language.clone())
        .header("X-Auto-Detect", config.auto_detect_language.to_string())
        .header("X-Context", config.voxlen_context.clone().unwrap_or_else(|| "general".to_string()))
        .header("X-Smart-Format", config.smart_format.to_string())
        .header("X-Punctuate", config.punctuate.to_string())
        .header("X-Diarize", config.speaker_diarization.to_string());
    if !config.custom_vocabulary.is_empty() {
        // URL-encoded so header stays ASCII-safe; server splits on commas
        let keyterms = config
            .custom_vocabulary
            .iter()
            .map(|w| urlencoding(w))
            .collect::<Vec<_>>()
            .join(",");
        req = req.header("X-Keyterms", keyterms);
    }
    if let Some(tid) = config.voxlen_tenant_id.as_deref().filter(|s| !s.is_empty()) {
        req = req.header("X-Tenant-ID", tid);
    }
    let response = req.body(wav_data.to_vec()).send().await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        anyhow::bail!("Voxlen STT API error: {}", error_text);
    }

    let result: serde_json::Value = response.json().await?;
    let text = result["text"].as_str().unwrap_or("").to_string();
    let confidence = result["confidence"].as_f64().unwrap_or(0.95) as f32;
    let language = result["language"].as_str().map(|s| s.to_string());

    let words = result["words"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|w| super::WordResult {
                    word: w["word"].as_str().unwrap_or("").to_string(),
                    start_ms: (w["start"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
                    end_ms: (w["end"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
                    confidence: w["confidence"].as_f64().unwrap_or(0.95) as f32,
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(super::TranscriptionResult {
        text,
        is_final: true,
        confidence,
        language,
        timestamp_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        words,
    })
}

/// Transcribe audio using OpenAI Whisper API
pub async fn whisper_transcribe(
    wav_data: &[u8],
    config: &SttConfig,
) -> anyhow::Result<TranscriptionResult> {
    let api_key = config
        .api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("OpenAI API key not configured"))?;

    let part = reqwest::multipart::Part::bytes(wav_data.to_vec())
        .file_name("audio.wav")
        .mime_str("audio/wav")?;

    let mut form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", config.model.clone())
        .text("response_format", "verbose_json")
        .text("timestamp_granularities[]", "word");

    if !config.auto_detect_language {
        form = form.text("language", config.language.clone());
    }

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        anyhow::bail!("Whisper API error: {}", error_text);
    }

    let result: serde_json::Value = response.json().await?;

    let text = result["text"].as_str().unwrap_or("").to_string();
    let language = result["language"].as_str().map(|s| s.to_string());

    let words = result["words"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|w| WordResult {
                    word: w["word"].as_str().unwrap_or("").to_string(),
                    start_ms: (w["start"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
                    end_ms: (w["end"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
                    confidence: 0.95, // Whisper doesn't provide per-word confidence
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(TranscriptionResult {
        text,
        is_final: true,
        confidence: 0.95,
        language,
        timestamp_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        words,
    })
}

/// Transcribe audio using Deepgram API (best for real-time)
pub async fn deepgram_transcribe(
    wav_data: &[u8],
    config: &SttConfig,
) -> anyhow::Result<TranscriptionResult> {
    // Route through Voxlen proxy when account key is present
    if let Some(voxlen_key) = config.voxlen_api_key.as_ref().filter(|k| !k.is_empty()) {
        return voxlen_proxy_transcribe(wav_data, voxlen_key, config).await;
    }

    let api_key = config
        .api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Not connected to a Voxlen account. Open Settings → Account, sign in at voxlen.ai/dashboard, and paste your account key."))?;

    // mip_opt_out: never allow Deepgram to use customer audio for model training
    let mut url = String::from("https://api.deepgram.com/v1/listen?model=nova-3&mip_opt_out=true");

    if config.punctuate {
        url.push_str("&punctuate=true");
    }
    if config.smart_format {
        url.push_str("&smart_format=true");
    }
    if config.profanity_filter {
        url.push_str("&profanity_filter=true");
    }
    if config.auto_detect_language {
        url.push_str("&detect_language=true");
    } else {
        url.push_str(&format!("&language={}", config.language));
    }

    // Nova-3 uses keyterm prompting; the old `keywords` param is ignored on nova-3
    for word in &config.custom_vocabulary {
        url.push_str(&format!("&keyterm={}", urlencoding(word)));
    }

    if config.speaker_diarization {
        url.push_str("&diarize=true");
    }

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Token {}", api_key))
        .header("Content-Type", "audio/wav")
        .body(wav_data.to_vec())
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        anyhow::bail!("Deepgram API error: {}", error_text);
    }

    let result: serde_json::Value = response.json().await?;

    let channel = &result["results"]["channels"][0]["alternatives"][0];
    let plain_text = channel["transcript"].as_str().unwrap_or("").to_string();
    let confidence = channel["confidence"].as_f64().unwrap_or(0.0) as f32;

    // When diarization is enabled, re-assemble the transcript with speaker
    // labels by grouping consecutive words that share the same `speaker`.
    let text = if config.speaker_diarization {
        if let Some(word_arr) = channel["words"].as_array() {
            let mut out = String::new();
            let mut current_speaker: Option<i64> = None;
            for w in word_arr {
                let spk = w["speaker"].as_i64();
                let token = w["punctuated_word"]
                    .as_str()
                    .or_else(|| w["word"].as_str())
                    .unwrap_or("");
                if token.is_empty() {
                    continue;
                }
                if spk != current_speaker {
                    if !out.is_empty() {
                        out.push('\n');
                    }
                    if let Some(s) = spk {
                        out.push_str(&format!("[Speaker {}] ", s + 1));
                    }
                    current_speaker = spk;
                } else if !out.is_empty() && !out.ends_with(' ') && !out.ends_with('\n') {
                    out.push(' ');
                }
                out.push_str(token);
            }
            if out.is_empty() { plain_text } else { out }
        } else {
            plain_text
        }
    } else {
        plain_text
    };

    let language = result["results"]["channels"][0]["detected_language"]
        .as_str()
        .map(|s| s.to_string());

    let words = channel["words"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|w| WordResult {
                    word: w["punctuated_word"]
                        .as_str()
                        .or_else(|| w["word"].as_str())
                        .unwrap_or("")
                        .to_string(),
                    start_ms: (w["start"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
                    end_ms: (w["end"].as_f64().unwrap_or(0.0) * 1000.0) as u64,
                    confidence: w["confidence"].as_f64().unwrap_or(0.0) as f32,
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(TranscriptionResult {
        text,
        is_final: true,
        confidence,
        language,
        timestamp_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        words,
    })
}

pub(crate) fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for byte in s.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}
