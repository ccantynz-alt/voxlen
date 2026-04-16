use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptSegment {
    pub id: String,
    pub text: String,
    pub corrected_text: Option<String>,
    pub confidence: f32,
    pub language: Option<String>,
    pub timestamp_ms: u64,
    pub grammar_applied: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionRecord {
    pub id: String,
    pub started_at_ms: u64,
    pub ended_at_ms: u64,
    pub duration_ms: u64,
    pub word_count: u32,
    pub language: Option<String>,
    pub segments: Vec<TranscriptSegment>,
}

const HISTORY_STORE_FILE: &str = "history.json";
const HISTORY_KEY: &str = "sessions";
const MAX_SESSIONS: usize = 500;

fn load_sessions(app: &AppHandle) -> Result<Vec<SessionRecord>, String> {
    let store = app
        .store(HISTORY_STORE_FILE)
        .map_err(|e| e.to_string())?;

    match store.get(HISTORY_KEY) {
        Some(value) => serde_json::from_value::<Vec<SessionRecord>>(value).or_else(|e| {
            log::warn!(
                "Failed to parse persisted session history ({}). Starting with empty list.",
                e
            );
            Ok(Vec::new())
        }),
        None => Ok(Vec::new()),
    }
}

fn save_sessions(app: &AppHandle, sessions: &[SessionRecord]) -> Result<(), String> {
    let store = app
        .store(HISTORY_STORE_FILE)
        .map_err(|e| e.to_string())?;
    let value = serde_json::to_value(sessions).map_err(|e| e.to_string())?;
    store.set(HISTORY_KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Return the stored sessions sorted by `started_at_ms` descending (newest first).
fn sorted_desc(mut sessions: Vec<SessionRecord>) -> Vec<SessionRecord> {
    sessions.sort_by(|a, b| b.started_at_ms.cmp(&a.started_at_ms));
    sessions
}

#[tauri::command]
pub fn save_session(app: AppHandle, session: SessionRecord) -> Result<(), String> {
    let mut sessions = load_sessions(&app)?;

    // Replace existing session with the same id if one exists, otherwise append.
    if let Some(existing) = sessions.iter_mut().find(|s| s.id == session.id) {
        *existing = session;
    } else {
        sessions.push(session);
    }

    // Sort newest-first so we can trim oldest (end of list) deterministically.
    sessions.sort_by(|a, b| b.started_at_ms.cmp(&a.started_at_ms));
    if sessions.len() > MAX_SESSIONS {
        sessions.truncate(MAX_SESSIONS);
    }

    save_sessions(&app, &sessions)?;
    Ok(())
}

#[tauri::command]
pub fn get_history(app: AppHandle) -> Result<Vec<SessionRecord>, String> {
    let sessions = load_sessions(&app)?;
    Ok(sorted_desc(sessions))
}

#[tauri::command]
pub fn get_session(app: AppHandle, id: String) -> Result<Option<SessionRecord>, String> {
    let sessions = load_sessions(&app)?;
    Ok(sessions.into_iter().find(|s| s.id == id))
}

#[tauri::command]
pub fn delete_session(app: AppHandle, id: String) -> Result<(), String> {
    let mut sessions = load_sessions(&app)?;
    sessions.retain(|s| s.id != id);
    save_sessions(&app, &sessions)?;
    Ok(())
}

#[tauri::command]
pub fn clear_history(app: AppHandle) -> Result<(), String> {
    save_sessions(&app, &[])?;
    Ok(())
}

#[tauri::command]
pub fn search_history(app: AppHandle, query: String) -> Result<Vec<SessionRecord>, String> {
    let sessions = load_sessions(&app)?;
    let needle = query.to_lowercase();

    if needle.is_empty() {
        return Ok(sorted_desc(sessions));
    }

    let matched: Vec<SessionRecord> = sessions
        .into_iter()
        .filter(|session| {
            session.segments.iter().any(|seg| {
                seg.text.to_lowercase().contains(&needle)
                    || seg
                        .corrected_text
                        .as_ref()
                        .map(|t| t.to_lowercase().contains(&needle))
                        .unwrap_or(false)
            })
        })
        .collect();

    Ok(sorted_desc(matched))
}
