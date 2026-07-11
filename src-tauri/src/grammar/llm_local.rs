//! Tier-2 local grammar polish — a small instruct LLM (llama.cpp via
//! llama-cpp-2) running fully on-device.
//!
//! Design constraints:
//! - The Tier-1 rules pass ALWAYS runs first; the LLM only polishes.
//! - Never ask a 3–4B model for JSON: prompt for corrected text only and
//!   compute the change list locally with a word-level diff.
//! - Guardrails: if the output length deviates more than 30% from the
//!   input or generation fails, return the rules result untouched.
//! - One model loaded at a time (cached); inferences are serialized by a
//!   global ticket — never concurrent with themselves.

use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaChatMessage, LlamaModel, Special};
use llama_cpp_2::sampling::LlamaSampler;
use parking_lot::Mutex;
use std::sync::OnceLock;
use tauri::AppHandle;

use crate::commands::grammar::{GrammarChange, GrammarResult};

static BACKEND: OnceLock<anyhow::Result<LlamaBackend>> = OnceLock::new();
static MODEL_CACHE: Mutex<Option<(PathBuf, Arc<LlamaModel>)>> = Mutex::new(None);
/// Serializes inference — a second call waits rather than thrashing the CPU.
static INFERENCE_TICKET: Mutex<()> = Mutex::new(());

fn backend() -> anyhow::Result<&'static LlamaBackend> {
    match BACKEND.get_or_init(|| {
        LlamaBackend::init().map_err(|e| anyhow::anyhow!("llama backend init failed: {e}"))
    }) {
        Ok(b) => Ok(b),
        Err(e) => Err(anyhow::anyhow!("{e}")),
    }
}

fn load_model(path: &Path) -> anyhow::Result<Arc<LlamaModel>> {
    {
        let cache = MODEL_CACHE.lock();
        if let Some((cached, model)) = cache.as_ref() {
            if cached == path {
                return Ok(model.clone());
            }
        }
    }
    let be = backend()?;
    log::info!("Loading grammar LLM from {}", path.display());
    let params = LlamaModelParams::default();
    let model = Arc::new(
        LlamaModel::load_from_file(be, path, &params)
            .map_err(|e| anyhow::anyhow!("failed to load grammar model: {e}"))?,
    );
    *MODEL_CACHE.lock() = Some((path.to_path_buf(), model.clone()));
    Ok(model)
}

/// Drop the cached model if it was loaded from `path` (called on delete).
pub fn evict_if_cached(path: &Path) {
    let mut cache = MODEL_CACHE.lock();
    if cache.as_ref().is_some_and(|(cached, _)| cached == path) {
        *cache = None;
    }
}

fn build_prompt(model: &LlamaModel, text: &str, style: &str, context: Option<&str>) -> anyhow::Result<String> {
    let system = format!(
        "You are a meticulous copy editor for professional dictation. Correct grammar, spelling, \
         and punctuation. Keep the author's meaning, tone, and wording; make the smallest edits \
         needed for {style} prose. {ctx}Return ONLY the corrected text — no preamble, no quotes, \
         no explanations.",
        style = style,
        ctx = context
            .filter(|c| !c.is_empty())
            .map(|c| format!("Context: {c}. "))
            .unwrap_or_default(),
    );
    let messages = vec![
        LlamaChatMessage::new("system".to_string(), system)?,
        LlamaChatMessage::new("user".to_string(), text.to_string())?,
    ];
    let template = model
        .chat_template(None)
        .map_err(|e| anyhow::anyhow!("model has no chat template: {e}"))?;
    model
        .apply_chat_template(&template, &messages, true)
        .map_err(|e| anyhow::anyhow!("chat template failed: {e}"))
}

fn generate(model: &LlamaModel, prompt: &str, max_output_tokens: usize) -> anyhow::Result<String> {
    let be = backend()?;
    let tokens = model
        .str_to_token(prompt, AddBos::Always)
        .map_err(|e| anyhow::anyhow!("tokenize failed: {e}"))?;

    let n_ctx = (tokens.len() + max_output_tokens + 8).max(512) as u32;
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(Some(NonZeroU32::new(n_ctx.min(8192)).unwrap()));
    let mut ctx = model
        .new_context(be, ctx_params)
        .map_err(|e| anyhow::anyhow!("context create failed: {e}"))?;

    let batch_capacity = tokens.len().max(64);
    let mut batch = LlamaBatch::new(batch_capacity, 1);
    let last_index = tokens.len() as i32 - 1;
    for (i, token) in (0_i32..).zip(tokens.into_iter()) {
        batch.add(token, i, &[0], i == last_index)?;
    }
    ctx.decode(&mut batch)?;

    // Near-greedy sampling: temperature 0.2 keeps corrections deterministic.
    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::temp(0.2),
        LlamaSampler::dist(42),
    ]);

    let mut out_tokens = Vec::with_capacity(max_output_tokens);
    let mut n_cur = batch.n_tokens();
    for _ in 0..max_output_tokens {
        let token = sampler.sample(&ctx, batch.n_tokens() - 1);
        sampler.accept(token);
        if model.is_eog_token(token) {
            break;
        }
        out_tokens.push(token);
        batch.clear();
        batch.add(token, n_cur, &[0], true)?;
        n_cur += 1;
        ctx.decode(&mut batch)?;
    }

    let text = model
        .tokens_to_str(&out_tokens, Special::Plaintext)
        .map_err(|e| anyhow::anyhow!("detokenize failed: {e}"))?;
    Ok(text.trim().to_string())
}

/// Word-level diff between original and corrected, for the existing UI.
fn diff_changes(original: &str, corrected: &str) -> Vec<GrammarChange> {
    use similar::{ChangeTag, TextDiff};
    let diff = TextDiff::from_words(original, corrected);
    let mut changes = Vec::new();
    let mut pending_del = String::new();
    let mut pending_ins = String::new();
    let mut flush = |del: &mut String, ins: &mut String, changes: &mut Vec<GrammarChange>| {
        let d = del.trim().to_string();
        let i = ins.trim().to_string();
        if !d.is_empty() || !i.is_empty() {
            changes.push(GrammarChange {
                original: d,
                corrected: i,
                reason: "AI polish".to_string(),
                category: "grammar".to_string(),
            });
        }
        del.clear();
        ins.clear();
    };
    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Delete => pending_del.push_str(change.value()),
            ChangeTag::Insert => pending_ins.push_str(change.value()),
            ChangeTag::Equal => flush(&mut pending_del, &mut pending_ins, &mut changes),
        }
    }
    flush(&mut pending_del, &mut pending_ins, &mut changes);
    changes.into_iter().take(40).collect()
}

/// Output sanity check — a polish must not rewrite or truncate the text.
fn plausible(original: &str, output: &str) -> bool {
    if output.is_empty() {
        return false;
    }
    let (ol, nl) = (original.len() as f32, output.len() as f32);
    if nl < ol * 0.7 || nl > ol * 1.3 {
        return false;
    }
    // Meta-text markers a small model sometimes emits despite instructions.
    let lower = output.to_lowercase();
    !(lower.starts_with("here is") || lower.starts_with("corrected text") || lower.contains("<think>"))
}

/// Polish `rules_result` with the local LLM. On any failure or implausible
/// output, the rules result is returned unchanged — this tier can only
/// improve things, never break them.
pub async fn polish(
    app: &AppHandle,
    rules_result: GrammarResult,
    model_id: &str,
    style: &str,
    context: Option<String>,
) -> GrammarResult {
    let Some(spec) = super::llm_models::resolve_model(app, model_id) else {
        return rules_result;
    };
    let Ok(path) = super::llm_models::model_path(app, spec.id) else {
        return rules_result;
    };

    let input = rules_result.corrected.clone();
    let style = style.to_string();
    let original = rules_result.original.clone();

    let llm_output = tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<String> {
        let _ticket = INFERENCE_TICKET.lock();
        let model = load_model(&path)?;
        let prompt = build_prompt(&model, &input, &style, context.as_deref())?;
        let input_tokens = input.len() / 3; // rough: chars→tokens
        let max_out = (input_tokens * 3 / 2 + 64).min(2048);
        generate(&model, &prompt, max_out)
    })
    .await;

    match llm_output {
        Ok(Ok(output)) if plausible(&rules_result.corrected, &output) => {
            let mut changes = rules_result.changes.clone();
            changes.extend(diff_changes(&rules_result.corrected, &output));
            GrammarResult {
                original,
                corrected: output,
                changes,
                score: 0.95,
            }
        }
        Ok(Ok(output)) => {
            log::warn!(
                "Grammar LLM output failed plausibility check ({} -> {} chars); using rules result",
                rules_result.corrected.len(),
                output.len()
            );
            rules_result
        }
        Ok(Err(e)) => {
            log::error!("Grammar LLM inference failed: {e}; using rules result");
            rules_result
        }
        Err(e) => {
            log::error!("Grammar LLM task join error: {e}; using rules result");
            rules_result
        }
    }
}
