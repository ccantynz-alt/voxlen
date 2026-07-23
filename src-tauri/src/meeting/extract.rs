//! Post-meeting extraction: tasks, dates, and deadlines from a transcript.
//!
//! Rules baseline — pure Rust, works in Privileged Mode with zero network.
//! Sentences matching commitment/deadline language are flagged, and any
//! relative dates ("by next Friday", "end of month") are resolved with the
//! `interim` natural-date parser anchored to the meeting start time.
//! Architecture note: `ExtractedItem` is serializable and flows through one
//! seam so a future task-manager/GateTest integration only consumes JSON.

use chrono::{DateTime, Local, TimeZone};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedItem {
    pub id: String,
    pub kind: ItemKind,
    /// The source sentence, verbatim.
    pub text: String,
    /// ISO date (YYYY-MM-DD) when a due date could be resolved.
    pub due_date: Option<String>,
    pub speaker: Option<String>,
    pub timestamp_ms: u64,
    pub source: String, // "rules" | "llm"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ItemKind {
    Task,
    Deadline,
    Date,
}

fn commitment_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)\b(action item|i(?:'ll| will| shall)|we (?:need to|should|will|must)|you(?:'ll| will) (?:get|send|receive)|follow(?:ing)? up|draft|file the|serve the|send (?:the|a|him|her|them)|circulate|schedule|book|prepare|review and)\b",
        )
        .unwrap()
    })
}

fn deadline_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)\b(due|deadline|no later than|by (?:the )?end of|before the hearing|by (?:next |this )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|tomorrow)|within \d+ (?:days?|weeks?|business days?)|statute of limitations|limitation period|court date|hearing (?:is |on )|trial date)\b",
        )
        .unwrap()
    })
}

/// Fragments that suggest a date phrase worth resolving with `interim`.
fn date_phrase_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)\b((?:by |on |before |until )?(?:next |this |coming )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|end of (?:the )?(?:week|month|year)|(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)? (?:of )?(?:january|february|march|april|may|june|july|august|september|october|november|december)|in \d+ (?:days?|weeks?))\b",
        )
        .unwrap()
    })
}

fn split_sentences(text: &str) -> Vec<&str> {
    text.split_inclusive(|c| matches!(c, '.' | '?' | '!'))
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect()
}

fn resolve_date(sentence: &str, anchor: DateTime<Local>) -> Option<String> {
    let phrase = date_phrase_re().find(sentence)?.as_str();
    // Strip leading prepositions interim doesn't need.
    let cleaned = phrase
        .trim_start_matches(|c: char| !c.is_alphanumeric())
        .trim();
    let cleaned = ["by ", "on ", "before ", "until "]
        .iter()
        .fold(cleaned, |acc, p| acc.strip_prefix(p).unwrap_or(acc));
    let parsed = interim::parse_date_string(cleaned, anchor, interim::Dialect::Us).ok()?;
    Some(parsed.format("%Y-%m-%d").to_string())
}

/// Extract action items and deadlines from one transcript segment.
pub fn extract_from_segment(
    text: &str,
    speaker: Option<&str>,
    segment_timestamp_ms: u64,
    meeting_started_at_ms: u64,
) -> Vec<ExtractedItem> {
    let anchor = Local
        .timestamp_millis_opt(meeting_started_at_ms as i64)
        .single()
        .unwrap_or_else(Local::now);

    let mut items = Vec::new();
    for sentence in split_sentences(text) {
        let is_deadline = deadline_re().is_match(sentence);
        let is_task = commitment_re().is_match(sentence);
        if !is_deadline && !is_task {
            continue;
        }
        let due_date = resolve_date(sentence, anchor);
        let kind = if is_deadline {
            ItemKind::Deadline
        } else if due_date.is_some() {
            ItemKind::Date
        } else {
            ItemKind::Task
        };
        items.push(ExtractedItem {
            id: uuid::Uuid::new_v4().to_string(),
            kind,
            text: sentence.to_string(),
            due_date,
            speaker: speaker.map(|s| s.to_string()),
            timestamp_ms: segment_timestamp_ms,
            source: "rules".to_string(),
        });
    }
    items
}

/// Command surface: extract from a full list of (speaker, text, ts) tuples.
#[tauri::command]
pub fn extract_meeting_items(
    segments: Vec<(Option<String>, String, u64)>,
    meeting_started_at_ms: u64,
) -> Result<Vec<ExtractedItem>, String> {
    let mut all = Vec::new();
    for (speaker, text, ts) in &segments {
        all.extend(extract_from_segment(
            text,
            speaker.as_deref(),
            *ts,
            meeting_started_at_ms,
        ));
    }
    Ok(all)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ANCHOR_MS: u64 = 1_782_000_000_000; // fixed anchor for date tests

    #[test]
    fn extracts_commitment_sentences() {
        let items = extract_from_segment(
            "The weather was fine. I'll file the motion by next Friday. We discussed lunch.",
            Some("you"),
            0,
            ANCHOR_MS,
        );
        assert_eq!(items.len(), 1);
        assert!(items[0].text.contains("file the motion"));
        assert!(matches!(items[0].kind, ItemKind::Deadline));
        assert!(items[0].due_date.is_some());
    }

    #[test]
    fn extracts_deadlines_without_commitment_verbs() {
        let items = extract_from_segment(
            "The limitation period expires soon. Nothing else happened.",
            None,
            0,
            ANCHOR_MS,
        );
        assert_eq!(items.len(), 1);
        assert!(matches!(items[0].kind, ItemKind::Deadline));
    }

    #[test]
    fn ignores_smalltalk() {
        let items = extract_from_segment(
            "How are the kids? Great weather this week. See you around.",
            None,
            0,
            ANCHOR_MS,
        );
        assert!(items.is_empty());
    }

    #[test]
    fn resolves_relative_dates_against_the_anchor() {
        let items = extract_from_segment("I'll send the draft tomorrow.", None, 0, ANCHOR_MS);
        assert_eq!(items.len(), 1);
        let due = items[0].due_date.as_deref().expect("date resolved");
        let anchor = Local.timestamp_millis_opt(ANCHOR_MS as i64).single().unwrap();
        let expected = (anchor + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
        assert_eq!(due, expected);
    }
}
