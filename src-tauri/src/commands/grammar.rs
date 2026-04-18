use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrammarConfig {
    pub enabled: bool,
    pub api_key: Option<String>,
    pub provider: GrammarProvider,
    pub style: WritingStyle,
    pub auto_correct: bool,
    pub preserve_tone: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GrammarProvider {
    Claude,
    OpenAI,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WritingStyle {
    Professional,
    Casual,
    Academic,
    Creative,
    Technical,
}

impl Default for GrammarConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            api_key: None,
            provider: GrammarProvider::Claude,
            style: WritingStyle::Professional,
            auto_correct: true,
            preserve_tone: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrammarResult {
    pub original: String,
    pub corrected: String,
    pub changes: Vec<GrammarChange>,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrammarChange {
    pub original: String,
    pub corrected: String,
    pub reason: String,
    pub category: String,
}

static GRAMMAR_CONFIG: std::sync::OnceLock<parking_lot::RwLock<GrammarConfig>> =
    std::sync::OnceLock::new();

fn get_config_store() -> &'static parking_lot::RwLock<GrammarConfig> {
    GRAMMAR_CONFIG.get_or_init(|| parking_lot::RwLock::new(GrammarConfig::default()))
}

#[tauri::command]
pub async fn correct_grammar(
    text: String,
    custom_vocabulary: Option<Vec<String>>,
) -> Result<GrammarResult, String> {
    let config = get_config_store().read().clone();

    if !config.enabled {
        return Ok(GrammarResult {
            original: text.clone(),
            corrected: text,
            changes: vec![],
            score: 1.0,
        });
    }

    let api_key = config
        .api_key
        .as_ref()
        .ok_or("Grammar API key not configured")?;

    let vocab = custom_vocabulary.unwrap_or_default();

    match config.provider {
        GrammarProvider::Claude => correct_with_claude(&text, api_key, &config, &vocab).await,
        GrammarProvider::OpenAI => correct_with_openai(&text, api_key, &config, &vocab).await,
    }
}

async fn correct_with_claude(
    text: &str,
    api_key: &str,
    config: &GrammarConfig,
    custom_vocabulary: &[String],
) -> Result<GrammarResult, String> {
    let style_instruction = match config.style {
        WritingStyle::Professional => "professional and polished",
        WritingStyle::Casual => "casual and conversational",
        WritingStyle::Academic => "academic and formal",
        WritingStyle::Creative => "creative and expressive",
        WritingStyle::Technical => "technical and precise",
    };

    let vocab_instruction = if custom_vocabulary.is_empty() {
        String::new()
    } else {
        format!(
            "\n- These are known custom vocabulary words (do NOT flag as spelling errors): {}",
            custom_vocabulary.join(", ")
        )
    };

    let prompt = format!(
        r#"You are a grammar and writing assistant. Correct the following text to be {style}.
{preserve}

Rules:
- Fix spelling, grammar, and punctuation errors
- Improve sentence structure where needed
- Keep the original meaning intact
- Do NOT add information or change the intent{vocab}

Respond ONLY with valid JSON in this exact format:
{{"corrected": "the corrected text", "changes": [{{"original": "wrong", "corrected": "right", "reason": "why", "category": "grammar|spelling|punctuation|style"}}], "score": 0.95}}

Text to correct:
"{text}""#,
        style = style_instruction,
        preserve = if config.preserve_tone {
            "- Preserve the author's natural tone and voice"
        } else {
            ""
        },
        vocab = vocab_instruction,
        text = text
    );

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 2048,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Claude API error: {}", error));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = result["content"][0]["text"]
        .as_str()
        .ok_or("No content in response")?;

    // Parse the JSON response from Claude
    let grammar_result: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse grammar result: {}", e))?;

    Ok(GrammarResult {
        original: text.to_string(),
        corrected: grammar_result["corrected"]
            .as_str()
            .unwrap_or(text)
            .to_string(),
        changes: grammar_result["changes"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|c| GrammarChange {
                        original: c["original"].as_str().unwrap_or("").to_string(),
                        corrected: c["corrected"].as_str().unwrap_or("").to_string(),
                        reason: c["reason"].as_str().unwrap_or("").to_string(),
                        category: c["category"].as_str().unwrap_or("grammar").to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
        score: grammar_result["score"].as_f64().unwrap_or(1.0) as f32,
    })
}

async fn correct_with_openai(
    text: &str,
    api_key: &str,
    config: &GrammarConfig,
    custom_vocabulary: &[String],
) -> Result<GrammarResult, String> {
    let style_instruction = match config.style {
        WritingStyle::Professional => "professional and polished",
        WritingStyle::Casual => "casual and conversational",
        WritingStyle::Academic => "academic and formal",
        WritingStyle::Creative => "creative and expressive",
        WritingStyle::Technical => "technical and precise",
    };

    let vocab_instruction = if custom_vocabulary.is_empty() {
        String::new()
    } else {
        format!(
            " Known vocabulary (not spelling errors): {}.",
            custom_vocabulary.join(", ")
        )
    };

    let prompt = format!(
        r#"Correct this text to be {style}. Fix grammar, spelling, punctuation. Keep meaning intact.
{preserve}{vocab}
Respond ONLY with JSON: {{"corrected": "text", "changes": [{{"original": "x", "corrected": "y", "reason": "z", "category": "grammar|spelling|punctuation|style"}}], "score": 0.95}}

Text: "{text}""#,
        style = style_instruction,
        preserve = if config.preserve_tone { "Preserve tone." } else { "" },
        vocab = vocab_instruction,
        text = text
    );

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", error));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = result["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("No content in response")?;

    let grammar_result: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse grammar result: {}", e))?;

    Ok(GrammarResult {
        original: text.to_string(),
        corrected: grammar_result["corrected"]
            .as_str()
            .unwrap_or(text)
            .to_string(),
        changes: grammar_result["changes"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|c| GrammarChange {
                        original: c["original"].as_str().unwrap_or("").to_string(),
                        corrected: c["corrected"].as_str().unwrap_or("").to_string(),
                        reason: c["reason"].as_str().unwrap_or("").to_string(),
                        category: c["category"].as_str().unwrap_or("grammar").to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default(),
        score: grammar_result["score"].as_f64().unwrap_or(1.0) as f32,
    })
}

#[tauri::command]
pub fn get_grammar_config() -> Result<GrammarConfig, String> {
    Ok(get_config_store().read().clone())
}

#[tauri::command]
pub fn set_grammar_config(config: GrammarConfig) -> Result<(), String> {
    *get_config_store().write() = config;
    Ok(())
}

/// Non-command variant for in-process setters (e.g. applying persisted
/// settings to the engine at startup and on `update_settings`).
pub fn set_grammar_config_internal(config: GrammarConfig) {
    *get_config_store().write() = config;
}
