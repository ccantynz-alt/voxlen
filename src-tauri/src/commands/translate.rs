use serde::{Deserialize, Serialize};

use super::grammar::{GrammarProvider, get_grammar_config};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationConfig {
    pub enabled: bool,
    pub target_language: String,
}

impl Default for TranslationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            target_language: "en".to_string(),
        }
    }
}

static TRANSLATION_CONFIG: std::sync::OnceLock<parking_lot::RwLock<TranslationConfig>> =
    std::sync::OnceLock::new();

fn get_config_store() -> &'static parking_lot::RwLock<TranslationConfig> {
    TRANSLATION_CONFIG.get_or_init(|| parking_lot::RwLock::new(TranslationConfig::default()))
}

pub fn set_translation_config_internal(config: TranslationConfig) {
    *get_config_store().write() = config;
}

pub fn get_translation_config_internal() -> TranslationConfig {
    get_config_store().read().clone()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResult {
    pub original: String,
    pub translated: String,
    pub target_language: String,
    pub detected_source: Option<String>,
}

/// Translate `text` to `target_language_code` using whichever provider the
/// user has configured for grammar correction. Re-uses the same API key so
/// users never need to supply a separate one — consistent with Voxlen's
/// "bring your own key" model.
#[tauri::command]
pub async fn translate_text(
    text: String,
    target_language: String,
) -> Result<TranslationResult, String> {
    if text.trim().is_empty() {
        return Ok(TranslationResult {
            original: text.clone(),
            translated: text,
            target_language,
            detected_source: None,
        });
    }

    let config = get_grammar_config()?;

    // Prefer Voxlen proxy — no user API key required
    if let Some(voxlen_key) = config.voxlen_api_key.as_ref().filter(|k| !k.is_empty()) {
        return translate_with_voxlen_proxy(&text, &target_language, voxlen_key).await;
    }

    let api_key = config
        .api_key
        .clone()
        .ok_or("No translation API key configured. Connect your Voxlen account in Settings → Account.")?;

    match config.provider {
        GrammarProvider::Claude => translate_with_claude(&text, &target_language, &api_key).await,
        GrammarProvider::OpenAI => translate_with_openai(&text, &target_language, &api_key).await,
    }
}

fn language_name(code: &str) -> &str {
    match code {
        "en" => "English",
        "es" => "Spanish",
        "fr" => "French",
        "de" => "German",
        "it" => "Italian",
        "pt" => "Portuguese",
        "nl" => "Dutch",
        "pl" => "Polish",
        "ru" => "Russian",
        "ja" => "Japanese",
        "ko" => "Korean",
        "zh" => "Chinese",
        "ar" => "Arabic",
        "hi" => "Hindi",
        "tr" => "Turkish",
        "sv" => "Swedish",
        "da" => "Danish",
        "fi" => "Finnish",
        "no" => "Norwegian",
        "uk" => "Ukrainian",
        _ => code,
    }
}

async fn translate_with_voxlen_proxy(
    text: &str,
    target_language: &str,
    voxlen_key: &str,
) -> Result<TranslationResult, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://voxlen.ai/api/translate")
        .header("Authorization", format!("Bearer {}", voxlen_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "text": text,
            "target_language": target_language,
        }))
        .send()
        .await
        .map_err(|e| format!("Translation proxy request failed: {}", e))?;

    if !response.status().is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(format!("Translation proxy error: {}", err));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse proxy response: {}", e))?;

    Ok(TranslationResult {
        original: text.to_string(),
        translated: result["translated"].as_str().unwrap_or(text).to_string(),
        target_language: target_language.to_string(),
        detected_source: result["detected_source"].as_str().map(|s| s.to_string()),
    })
}

async fn translate_with_claude(
    text: &str,
    target_code: &str,
    api_key: &str,
) -> Result<TranslationResult, String> {
    let target = language_name(target_code);
    let prompt = format!(
        r#"Translate the following text into {target}. Preserve meaning, tone, and any professional/legal terminology. Do NOT add commentary — respond ONLY with JSON in this format:
{{"translated": "...", "detected_source": "ISO-639-1 code or null"}}

Text:
"{text}""#,
        target = target,
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
            "messages": [{ "role": "user", "content": prompt }]
        }))
        .send()
        .await
        .map_err(|e| format!("Translation request failed: {}", e))?;

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

    let parsed: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse translation JSON: {}", e))?;

    Ok(TranslationResult {
        original: text.to_string(),
        translated: parsed["translated"]
            .as_str()
            .unwrap_or(text)
            .to_string(),
        target_language: target_code.to_string(),
        detected_source: parsed["detected_source"].as_str().map(|s| s.to_string()),
    })
}

async fn translate_with_openai(
    text: &str,
    target_code: &str,
    api_key: &str,
) -> Result<TranslationResult, String> {
    let target = language_name(target_code);
    let prompt = format!(
        r#"Translate this text into {target}. Preserve meaning, tone, and domain terminology. Respond ONLY with JSON:
{{"translated": "text", "detected_source": "ISO-639-1 or null"}}

Text: "{text}""#,
        target = target,
        text = text
    );

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": 0.0,
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|e| format!("Translation request failed: {}", e))?;

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

    let parsed: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse translation JSON: {}", e))?;

    Ok(TranslationResult {
        original: text.to_string(),
        translated: parsed["translated"]
            .as_str()
            .unwrap_or(text)
            .to_string(),
        target_language: target_code.to_string(),
        detected_source: parsed["detected_source"].as_str().map(|s| s.to_string()),
    })
}
