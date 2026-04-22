use super::{SttConfig, TranscriptionResult, WordResult};

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
    let api_key = config
        .api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Deepgram API key not configured"))?;

    let mut url = String::from("https://api.deepgram.com/v1/listen?model=nova-2");

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

    // Add custom vocabulary as keywords
    for word in &config.custom_vocabulary {
        url.push_str(&format!("&keywords={}", urlencoding(word)));
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

fn urlencoding(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "%20".to_string(),
            _ => format!("%{:02X}", c as u32),
        })
        .collect()
}
