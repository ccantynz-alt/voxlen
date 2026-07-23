//! Tier-1 deterministic grammar correction — ordered pure passes over the
//! text, each contributing `GrammarChange`s so the existing diff UI works
//! unchanged. Conservative by design: only unambiguous fixes, no their/there
//! guessing. All processing on-device; nothing leaves the machine.

use crate::commands::grammar::{GrammarChange, GrammarResult};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

/// A correction pattern learned by the frontend flywheel and passed in with
/// each request (the flywheel store lives frontend-side).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnedPattern {
    pub original: String,
    pub corrected: String,
    #[serde(default)]
    pub occurrences: u32,
}

/// Unambiguous corrections, incl. legal/accounting terms that STT engines
/// reliably mangle. (pattern, replacement, reason). Matched word-bounded,
/// case-insensitively; replacement casing follows the matched text.
const CURATED_FIXES: &[(&str, &str, &str)] = &[
    ("should of", "should have", "\"of\" misheard for \"have\""),
    ("would of", "would have", "\"of\" misheard for \"have\""),
    ("could of", "could have", "\"of\" misheard for \"have\""),
    ("alot", "a lot", "common misspelling"),
    ("statue of limitations", "statute of limitations", "legal term"),
    ("tortuous interference", "tortious interference", "legal term"),
    ("principle amount", "principal amount", "financial term"),
    ("principle balance", "principal balance", "financial term"),
    ("in forma pauperus", "in forma pauperis", "Latin legal term"),
    ("harmless error rule", "harmless-error rule", "legal term"),
    ("attorneys fees", "attorneys' fees", "possessive in legal usage"),
];

/// Latin/legal phrases whose canonical casing should be enforced.
const CANONICAL_TERMS: &[&str] = &[
    "voir dire",
    "habeas corpus",
    "subpoena duces tecum",
    "res judicata",
    "prima facie",
    "certiorari",
    "amicus curiae",
    "pro bono",
    "pro se",
    "de novo",
    "en banc",
    "ex parte",
    "inter alia",
    "mens rea",
    "actus reus",
];

/// Legitimate doubled words that must not be deduped.
const DOUBLE_ALLOWLIST: &[&str] = &["had", "that", "is", "do", "can", "will"];

fn escape(s: &str) -> String {
    regex::escape(s)
}

/// Word-bounded, case-insensitive regex for a phrase; boundaries applied
/// only where the phrase edge is a word character.
fn phrase_regex(phrase: &str) -> Regex {
    let lead = if phrase.chars().next().is_some_and(|c| c.is_alphanumeric()) {
        r"\b"
    } else {
        ""
    };
    let tail = if phrase.chars().last().is_some_and(|c| c.is_alphanumeric()) {
        r"\b"
    } else {
        ""
    };
    Regex::new(&format!("(?i){lead}{}{tail}", escape(phrase))).expect("valid phrase regex")
}

/// Mirror the leading-capital of `matched` onto `replacement`.
fn match_case(replacement: &str, matched: &str) -> String {
    let starts_upper = matched.chars().next().is_some_and(|c| c.is_uppercase());
    if starts_upper {
        let mut chars = replacement.chars();
        match chars.next() {
            Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            None => String::new(),
        }
    } else {
        replacement.to_string()
    }
}

struct Pass {
    text: String,
    changes: Vec<GrammarChange>,
}

impl Pass {
    fn apply_replacement(
        &mut self,
        re: &Regex,
        replacement: &str,
        reason: &str,
        category: &str,
        case_follow: bool,
    ) {
        let mut changes: Vec<GrammarChange> = Vec::new();
        let out = re
            .replace_all(&self.text, |caps: &regex::Captures| {
                let matched = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                let rep = if case_follow {
                    match_case(replacement, matched)
                } else {
                    replacement.to_string()
                };
                if rep != matched {
                    changes.push(GrammarChange {
                        original: matched.to_string(),
                        corrected: rep.clone(),
                        reason: reason.to_string(),
                        category: category.to_string(),
                    });
                }
                rep
            })
            .into_owned();
        self.text = out;
        self.changes.append(&mut changes);
    }
}

/// Pass 1 — whitespace / punctuation normalization.
fn normalize_punctuation(p: &mut Pass) {
    static SPACE_BEFORE: OnceLock<Regex> = OnceLock::new();
    static MULTI_SPACE: OnceLock<Regex> = OnceLock::new();
    static NO_SPACE_AFTER: OnceLock<Regex> = OnceLock::new();

    let before = SPACE_BEFORE.get_or_init(|| Regex::new(r" +([,.;:?!])").unwrap());
    let multi = MULTI_SPACE.get_or_init(|| Regex::new(r"[ \t]{2,}").unwrap());
    // Missing space after sentence punctuation (but not inside numbers like
    // 1.5, section references like 5.2, or ellipses).
    let after = NO_SPACE_AFTER.get_or_init(|| Regex::new(r"([a-z])([,;])([A-Za-z])").unwrap());

    let orig = p.text.clone();
    let mut t = before.replace_all(&p.text, "$1").into_owned();
    t = multi.replace_all(&t, " ").into_owned();
    t = after.replace_all(&t, "$1$2 $3").into_owned();
    if t != orig {
        p.changes.push(GrammarChange {
            original: String::new(),
            corrected: String::new(),
            reason: "normalized spacing around punctuation".to_string(),
            category: "punctuation".to_string(),
        });
    }
    p.text = t;
}

/// Pass 2 — sentence capitalization + standalone "i".
fn capitalize(p: &mut Pass) {
    static STANDALONE_I: OnceLock<Regex> = OnceLock::new();
    let standalone_i = STANDALONE_I.get_or_init(|| Regex::new(r"\bi\b").unwrap());

    // Standalone "i" → "I" (never inside words; regex \b handles that).
    let before = p.text.clone();
    p.text = standalone_i.replace_all(&p.text, "I").into_owned();
    if p.text != before {
        p.changes.push(GrammarChange {
            original: "i".to_string(),
            corrected: "I".to_string(),
            reason: "capitalize the pronoun I".to_string(),
            category: "grammar".to_string(),
        });
    }

    // First alpha of the text and after . ? ! followed by whitespace.
    let bytes: Vec<char> = p.text.chars().collect();
    let mut out = String::with_capacity(p.text.len());
    let mut capitalize_next = true;
    let mut changed = false;
    for (idx, &c) in bytes.iter().enumerate() {
        if capitalize_next && c.is_alphabetic() {
            let up: String = c.to_uppercase().collect();
            if up != c.to_string() {
                changed = true;
            }
            out.push_str(&up);
            capitalize_next = false;
        } else {
            // Sentence end: . ? ! then whitespace — but not decimals (digit.digit)
            if matches!(c, '.' | '?' | '!') {
                let prev_is_digit = idx > 0 && bytes[idx - 1].is_ascii_digit();
                let next_is_digit = bytes.get(idx + 1).is_some_and(|n| n.is_ascii_digit());
                if !(c == '.' && prev_is_digit && next_is_digit) {
                    capitalize_next = true;
                }
            } else if !c.is_whitespace() && capitalize_next && !c.is_alphabetic() {
                // Non-alpha token (digit, quote) — keep looking for the next alpha.
            }
            out.push(c);
        }
    }
    if changed {
        p.changes.push(GrammarChange {
            original: String::new(),
            corrected: String::new(),
            reason: "sentence capitalization".to_string(),
            category: "grammar".to_string(),
        });
    }
    p.text = out;
}

/// Pass 3 — doubled-word dedupe ("the the" → "the"), with allowlist.
/// The regex crate has no backreferences, so match two adjacent words and
/// compare them in the replacement closure.
fn dedupe_doubles(p: &mut Pass) {
    static PAIR: OnceLock<Regex> = OnceLock::new();
    let re = PAIR.get_or_init(|| Regex::new(r"\b([A-Za-z']+) +([A-Za-z']+)\b").unwrap());

    // Loop to catch triples; bounded because each round strictly shrinks.
    loop {
        let mut changes: Vec<GrammarChange> = Vec::new();
        let out = re
            .replace_all(&p.text, |caps: &regex::Captures| {
                let whole = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                let a = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let b = caps.get(2).map(|m| m.as_str()).unwrap_or("");
                if !a.eq_ignore_ascii_case(b)
                    || DOUBLE_ALLOWLIST.contains(&a.to_lowercase().as_str())
                {
                    return whole.to_string();
                }
                changes.push(GrammarChange {
                    original: whole.to_string(),
                    corrected: a.to_string(),
                    reason: "repeated word".to_string(),
                    category: "grammar".to_string(),
                });
                a.to_string()
            })
            .into_owned();
        let changed = !changes.is_empty();
        p.changes.append(&mut changes);
        p.text = out;
        if !changed {
            break;
        }
    }
}

/// Pass 4 — curated unambiguous fixes (incl. legal terms).
fn curated_fixes(p: &mut Pass) {
    for (from, to, reason) in CURATED_FIXES {
        let re = phrase_regex(from);
        p.apply_replacement(&re, to, reason, "spelling", true);
    }
}

/// Pass 5 — canonical casing for legal Latin terms and custom vocabulary.
fn vocab_casing(p: &mut Pass, custom_vocabulary: &[String]) {
    for term in CANONICAL_TERMS {
        let re = phrase_regex(term);
        // Canonical Latin terms are lowercase mid-sentence; only fix casing
        // when the matched text differs beyond a sentence-initial capital.
        let mut changes: Vec<GrammarChange> = Vec::new();
        let out = re
            .replace_all(&p.text, |caps: &regex::Captures| {
                let matched = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                let canonical = match_case(term, matched);
                if matched != canonical {
                    changes.push(GrammarChange {
                        original: matched.to_string(),
                        corrected: canonical.clone(),
                        reason: "canonical legal term casing".to_string(),
                        category: "spelling".to_string(),
                    });
                }
                canonical
            })
            .into_owned();
        p.text = out;
        p.changes.append(&mut changes);
    }

    for word in custom_vocabulary {
        if word.len() < 3 {
            continue;
        }
        let re = phrase_regex(word);
        let mut changes: Vec<GrammarChange> = Vec::new();
        let out = re
            .replace_all(&p.text, |caps: &regex::Captures| {
                let matched = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                if matched != word {
                    changes.push(GrammarChange {
                        original: matched.to_string(),
                        corrected: word.clone(),
                        reason: "custom vocabulary casing".to_string(),
                        category: "spelling".to_string(),
                    });
                }
                word.clone()
            })
            .into_owned();
        p.text = out;
        p.changes.append(&mut changes);
    }
}

/// Pass 6 — flywheel-learned patterns (occurrences >= 3), longest first.
fn learned_patterns(p: &mut Pass, patterns: &[LearnedPattern]) {
    let mut usable: Vec<&LearnedPattern> = patterns
        .iter()
        .filter(|lp| {
            lp.occurrences >= 3
                && lp.original.len() >= 3
                && lp.original.to_lowercase() != lp.corrected.to_lowercase()
        })
        .collect();
    usable.sort_by(|a, b| b.original.len().cmp(&a.original.len()));
    for lp in usable.into_iter().take(50) {
        let re = phrase_regex(&lp.original);
        p.apply_replacement(&re, &lp.corrected, "learned from your corrections", "learned", true);
    }
}

/// Run the full deterministic pipeline.
pub fn correct_with_rules(
    text: &str,
    custom_vocabulary: &[String],
    patterns: &[LearnedPattern],
) -> GrammarResult {
    let mut pass = Pass {
        text: text.to_string(),
        changes: Vec::new(),
    };

    normalize_punctuation(&mut pass);
    dedupe_doubles(&mut pass);
    curated_fixes(&mut pass);
    learned_patterns(&mut pass, patterns);
    vocab_casing(&mut pass, custom_vocabulary);
    // Capitalization last so replacements get sentence-cased too.
    capitalize(&mut pass);

    GrammarResult {
        original: text.to_string(),
        corrected: pass.text,
        changes: pass.changes,
        score: 1.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(text: &str) -> GrammarResult {
        correct_with_rules(text, &[], &[])
    }

    #[test]
    fn capitalizes_sentences_and_pronoun_i() {
        let r = run("the court agreed. i think we should file. next week works");
        assert_eq!(
            r.corrected,
            "The court agreed. I think we should file. Next week works"
        );
    }

    #[test]
    fn does_not_capitalize_after_decimals() {
        let r = run("the fee is 1.5 hours at the rate");
        assert_eq!(r.corrected, "The fee is 1.5 hours at the rate");
    }

    #[test]
    fn normalizes_punctuation_spacing() {
        let r = run("we filed the motion , and the court agreed .");
        assert_eq!(r.corrected, "We filed the motion, and the court agreed.");
    }

    #[test]
    fn dedupes_repeated_words_but_respects_allowlist() {
        let r = run("we filed the the motion");
        assert_eq!(r.corrected, "We filed the motion");
        let r2 = run("he had had enough");
        assert_eq!(r2.corrected, "He had had enough");
    }

    #[test]
    fn fixes_legal_terms() {
        let r = run("the statue of limitations bars tortuous interference claims");
        assert_eq!(
            r.corrected,
            "The statute of limitations bars tortious interference claims"
        );
        assert!(r.changes.iter().any(|c| c.original.contains("statue")));
    }

    #[test]
    fn fixes_should_of_preserving_case() {
        let r = run("Should of filed. we should of known");
        assert_eq!(r.corrected, "Should have filed. We should have known");
    }

    #[test]
    fn enforces_custom_vocabulary_casing() {
        let r = correct_with_rules("we met with acmecorp yesterday", &["AcmeCorp".to_string()], &[]);
        assert_eq!(r.corrected, "We met with AcmeCorp yesterday");
    }

    #[test]
    fn applies_learned_patterns_word_bounded() {
        let patterns = vec![LearnedPattern {
            original: "form".to_string(),
            corrected: "from".to_string(),
            occurrences: 5,
        }];
        let r = correct_with_rules("format the form", &[], &patterns);
        assert_eq!(r.corrected, "Format the from");
    }

    #[test]
    fn skips_learned_patterns_below_threshold() {
        let patterns = vec![LearnedPattern {
            original: "teh".to_string(),
            corrected: "the".to_string(),
            occurrences: 2,
        }];
        let r = correct_with_rules("teh motion", &[], &patterns);
        assert_eq!(r.corrected, "Teh motion");
    }

    #[test]
    fn longest_learned_pattern_wins() {
        let patterns = vec![
            LearnedPattern { original: "should of".into(), corrected: "should have".into(), occurrences: 3 },
            LearnedPattern { original: "should of been".into(), corrected: "should have been".into(), occurrences: 3 },
        ];
        let r = correct_with_rules("it should of been filed", &[], &patterns);
        assert_eq!(r.corrected, "It should have been filed");
    }

    #[test]
    fn empty_text_is_unchanged() {
        let r = run("");
        assert_eq!(r.corrected, "");
        assert!(r.changes.is_empty());
    }
}
