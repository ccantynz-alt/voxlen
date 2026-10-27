# Voxlen Privacy Notes

This page describes what leaves your machine, what stays on your machine, and what you can delete. This is an engineering-level summary — treat it as the source of truth for the app's actual behavior.

## TL;DR

- **No telemetry.** Voxlen does not contact any analytics, metrics, or crash-reporting service.
- **No cloud sync.** Voxlen never stores your data. With a Voxlen account, requests pass transiently through zero-retention voxlen.ai endpoints to reach the AI providers; nothing is logged or retained.
- **Third-party calls are strictly on your behalf**, to the providers you select.

## What gets sent off your device

The desktop app only makes outbound requests in the following situations:

| Outbound traffic | Destination                                 | When                                                                 |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Audio frames     | Deepgram or OpenAI Whisper (your choice)    | Only while dictation is active, and only to the engine you selected (BYOK mode) |
| Text             | Anthropic (Claude) or OpenAI (your choice)  | Only when grammar correction or translation is enabled **and** a pass runs (BYOK mode) |
| Audio frames / text | `voxlen.ai/api` (`/stt`, `/grammar`, `/translate`, `/deepgram-token`) | Voxlen-account mode: requests are relayed transiently through zero-retention endpoints to the same providers, so you don't need your own provider keys |
| Model downloads  | `huggingface.co` (whisper.cpp GGML models from `ggerganov/whisper.cpp`; grammar LLMs, e.g. Qwen3-4B GGUF) | Only when you explicitly download a Whisper Local or local-grammar model in Settings |

No other outbound traffic originates from the desktop app. There is no updater traffic — the app has no auto-updater; updates are downloaded manually from GitHub Releases.

Whisper Local transcription and the local grammar engines (rules + on-device LLM) run entirely offline once a model is downloaded — Privileged Mode forces these paths and blocks all cloud calls.

## What is stored locally

Everything Voxlen retains lives on your machine, under the Tauri app data directory (plus any folders you configure):

| File / location   | Contents                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `settings.json`   | User preferences (API keys are **not** stored here — see below)   |
| `history.json`    | Up to 500 most recent dictation sessions with transcripts         |
| `models/`         | Downloaded Whisper / grammar-LLM model files                      |
| Auto-documents    | Opt-in per-matter `.docx` files in your chosen documents folder   |
| Review queue      | Review packet files under your configured `voxlen-review/` shared folder |

### API keys live in the OS keychain

API keys (Deepgram, OpenAI, Anthropic, Voxlen account) are stored in the operating system's credential store via the `keyring` crate — Windows Credential Manager, macOS Keychain, or the Linux Secret Service — never in plaintext JSON. See `src-tauri/src/commands/keyring.rs`.

### Deleting your data

- **Single session:** History panel → select session → delete.
- **All history:** History panel → "Clear all".
- **Settings and keys:** Settings → Reset to defaults (clears API keys in memory and in the OS keychain).
- **Downloaded models:** Settings → model manager → delete.
- **Auto-documents / review packets:** ordinary files — delete them from the folders you configured.
- **Nuclear option:** Remove the Voxlen data directory while the app is closed (keychain entries are removed via Reset or your OS credential manager).

## Telemetry

There is a `telemetry_enabled` setting in `AppSettings`, but it is **off by default** and no telemetry backend is wired up in the current codebase. The field exists so that if telemetry is ever added, it will default to opt-in.

## Third-party privacy

When you send audio to Deepgram or OpenAI, or text to Anthropic or OpenAI — directly (BYOK) or via the voxlen.ai relay (account mode) — the vendor's privacy policy applies. Review their terms:

- Deepgram: https://deepgram.com/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- Anthropic: https://www.anthropic.com/legal/privacy

Every Deepgram request sets `mip_opt_out=true` to opt out of Deepgram's model-improvement program.

## iOS keyboard

The iOS keyboard extension (`ios/VoxKeyboard`) transmits data in two cases: while dictation is active it streams microphone audio to Deepgram (Nova-3, over WebSocket — either with your own Deepgram key, or via a short-lived key fetched from `voxlen.ai/api/deepgram-token` in Voxlen-account mode), and when you tap the grammar action it sends the text to the configured provider (Claude or OpenAI). Extensions run in a sandbox with network access granted explicitly via `RequestsOpenAccess`.

## Questions

Security-impacting privacy questions: `security@voxlen.ai`.
