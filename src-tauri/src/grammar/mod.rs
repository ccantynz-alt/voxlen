//! Local grammar correction.
//!
//! `rules` is the Tier-1 deterministic engine: pure functions, zero
//! model downloads, runs entirely on-device. It is the correction path
//! in Privileged Mode, where cloud grammar is unreachable by design.
//! A Tier-2 local LLM polish (llama.cpp) will slot in alongside it.

pub mod llm_local;
pub mod llm_models;
pub mod rules;
