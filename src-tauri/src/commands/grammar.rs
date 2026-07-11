use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrammarConfig {
    pub enabled: bool,
    pub api_key: Option<String>,
    pub provider: GrammarProvider,
    pub style: WritingStyle,
    pub auto_correct: bool,
    pub preserve_tone: bool,
    /// When set, grammar correction is proxied through voxlen.ai/api.
    #[serde(default)]
    pub voxlen_api_key: Option<String>,
    #[serde(default)]
    pub voxlen_context: Option<String>,
    #[serde(default)]
    pub voxlen_tenant_id: Option<String>,
    #[serde(default)]
    pub engine: GrammarEngine,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GrammarProvider {
    Claude,
    OpenAI,
}

/// Which correction engine handles requests. Cloud engines send the text
/// to an external LLM; LocalRules runs the on-device deterministic
/// pipeline (`crate::grammar::rules`) — the only engine reachable in
/// privileged mode.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GrammarEngine {
    Cloud,
    LocalRules,
}

impl Default for GrammarEngine {
    fn default() -> Self {
        GrammarEngine::Cloud
    }
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
            voxlen_api_key: None,
            voxlen_context: None,
            voxlen_tenant_id: None,
            engine: GrammarEngine::Cloud,
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
    matter_context: Option<String>,
    learned_patterns: Option<Vec<crate::grammar::rules::LearnedPattern>>,
) -> Result<GrammarResult, String> {
    let config = get_config_store().read().clone();

    if text.trim().is_empty() {
        return Ok(GrammarResult {
            original: text.clone(),
            corrected: text,
            changes: vec![],
            score: 1.0,
        });
    }

    if !config.enabled {
        return Ok(GrammarResult {
            original: text.clone(),
            corrected: text,
            changes: vec![],
            score: 1.0,
        });
    }

    let vocab = custom_vocabulary.unwrap_or_default();
    let patterns = learned_patterns.unwrap_or_default();

    // Privileged mode: cloud engines are unreachable by design (fail-closed).
    // Grammar still works — via the on-device rules engine — instead of the
    // old behavior of returning the text untouched. Users may also select
    // the local engine explicitly outside privileged mode.
    if crate::commands::settings::get_privileged_mode()
        || config.engine == GrammarEngine::LocalRules
    {
        return Ok(crate::grammar::rules::correct_with_rules(&text, &vocab, &patterns));
    }

    // Merge matter context into voxlen_context if provided
    let effective_context = matter_context
        .filter(|s| !s.is_empty())
        .or_else(|| config.voxlen_context.clone());

    let has_direct_key = config.api_key.as_ref().filter(|k| !k.is_empty()).is_some();

    // Prefer Voxlen proxy (no user API key needed) over direct provider calls.
    // Voxlen-first with BYOK fallback: if the proxy call fails and the user has
    // their own provider key, fall back to it rather than failing the request.
    if let Some(voxlen_key) = config.voxlen_api_key.as_ref().filter(|k| !k.is_empty()) {
        let mut proxy_config = config.clone();
        proxy_config.voxlen_context = effective_context.clone();
        match correct_with_voxlen_proxy(
            &text, voxlen_key,
            proxy_config.voxlen_context.as_deref(),
            &proxy_config, &vocab
        ).await {
            Ok(result) => return Ok(result),
            Err(e) => {
                if has_direct_key {
                    log::warn!(
                        "Voxlen grammar proxy failed ({e}); falling back to direct provider key"
                    );
                } else {
                    return Err(e);
                }
            }
        }
    }

    let api_key = config
        .api_key
        .as_ref()
        .filter(|k| !k.is_empty())
        .ok_or("No grammar AI key configured. Open Settings → Account to connect a Voxlen account, or add your own provider key under Grammar.")?;

    let mut effective_config = config.clone();
    if let Some(ctx) = effective_context {
        effective_config.voxlen_context = Some(ctx);
    }

    match config.provider {
        GrammarProvider::Claude => correct_with_claude(&text, api_key, &effective_config, &vocab).await,
        GrammarProvider::OpenAI => correct_with_openai(&text, api_key, &effective_config, &vocab).await,
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

    let context_instruction = config
        .voxlen_context
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|ctx| format!("\n- Context: {ctx}"))
        .unwrap_or_default();

    let prompt = format!(
        r#"You are a grammar and writing assistant. Correct the following text to be {style}.
{preserve}

Rules:
- Fix spelling, grammar, and punctuation errors
- Improve sentence structure where needed
- Keep the original meaning intact
- Do NOT add information or change the intent{vocab}{context}

Respond ONLY with valid JSON in this exact format:
{{"corrected": "the corrected text", "changes": [{{"original": "wrong", "corrected": "right", "reason": "why", "category": "grammar|spelling|punctuation|style"}}], "score": 0.95}}

Text to correct:
<text>
{text}
</text>"#,
        style = style_instruction,
        preserve = if config.preserve_tone {
            "- Preserve the author's natural tone and voice"
        } else {
            ""
        },
        vocab = vocab_instruction,
        context = context_instruction,
        text = text
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-6",
            "max_tokens": 8192,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("Grammar AI rate limit reached — try again in a moment (HTTP 429)".to_string());
    }
    if !response.status().is_success() {
        let status = response.status();
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Claude API error {status}: {error}"));
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

    let context_instruction = config
        .voxlen_context
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|ctx| format!(" Context: {ctx}.", ))
        .unwrap_or_default();

    let prompt = format!(
        r#"Correct this text to be {style}. Fix grammar, spelling, punctuation. Keep meaning intact.
{preserve}{vocab}{context}
Respond ONLY with JSON: {{"corrected": "text", "changes": [{{"original": "x", "corrected": "y", "reason": "z", "category": "grammar|spelling|punctuation|style"}}], "score": 0.95}}

Text:
<text>
{text}
</text>"#,
        style = style_instruction,
        preserve = if config.preserve_tone { "Preserve tone." } else { "" },
        vocab = vocab_instruction,
        context = context_instruction,
        text = text
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
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

    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("Grammar AI rate limit reached — try again in a moment (HTTP 429)".to_string());
    }
    if !response.status().is_success() {
        let status = response.status();
        let error = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error {status}: {error}"));
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

/// Proxy grammar correction through voxlen.ai/api — no provider key needed.
async fn correct_with_voxlen_proxy(
    text: &str,
    voxlen_key: &str,
    context: Option<&str>,
    config: &GrammarConfig,
    custom_vocabulary: &[String],
) -> Result<GrammarResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;
    let style_str = match config.style {
        WritingStyle::Professional => "professional",
        WritingStyle::Casual => "casual",
        WritingStyle::Academic => "academic",
        WritingStyle::Creative => "creative",
        WritingStyle::Technical => "technical",
    };
    let mut req = client
        .post("https://voxlen.ai/api/grammar")
        .header("Authorization", format!("Bearer {}", voxlen_key))
        .header("content-type", "application/json");
    if let Some(tid) = config.voxlen_tenant_id.as_deref().filter(|s| !s.is_empty()) {
        req = req.header("X-Tenant-ID", tid);
    }
    let response = req
        .json(&serde_json::json!({
            "text": text,
            "style": style_str,
            "context": context.unwrap_or("general"),
            "custom_vocabulary": custom_vocabulary,
            "preserve_tone": config.preserve_tone,
        }))
        .send()
        .await
        .map_err(|e| format!("Voxlen API error: {}", e))?;

    if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("Grammar AI rate limit reached — try again in a moment (HTTP 429)".to_string());
    }
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Voxlen grammar API returned {}: {}", status, body));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Voxlen grammar response: {}", e))?;

    Ok(GrammarResult {
        original: text.to_string(),
        corrected: result["corrected"].as_str().unwrap_or(text).to_string(),
        changes: result["changes"]
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
        score: result["score"].as_f64().unwrap_or(1.0) as f32,
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
