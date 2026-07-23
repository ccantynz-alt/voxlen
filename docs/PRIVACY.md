# Voxlen Privacy Notes

This page describes what leaves your machine, what stays on your machine, and what you can delete. This is an engineering-level summary — treat it as the source of truth for the app's actual behavior.

## TL;DR

- **No telemetry.** Voxlen does not contact any analytics, metrics, or crash-reporting service.
- **No cloud sync.** Voxlen never stores your data. With a Voxlen account, requests pass transiently through zero-retention voxlen.ai endpoints to reach the AI providers; nothing is logged or retained.
- **Third-party calls are strictly on your behalf**, to the providers you select.

## What gets sent off your device

Voxlen only talks to two categories of endpoints, and only when you ask it to:

| Outbound traffic | Destination                                 | When                                                                 |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Audio frames     | Deepgram or OpenAI Whisper (your choice)    | Only while dictation is active, and only to the engine you selected  |
| Text             | Anthropic (Claude) or OpenAI (your choice)  | Only when grammar correction is enabled **and** you trigger a pass   |
| App update check | `https://releases.voxlen.ai/...` (placeholder — replace with real host) | When the updater plugin runs (configurable)          |

No other outbound traffic originates from the desktop app.

## What is stored locally

Everything Voxlen retains lives on your machine, under the Tauri app data directory:

| File              | Contents                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `settings.json`   | Non-secret user preferences (API keys are **not** stored here)    |
| `history.json`    | Up to 500 most recent dictation sessions with transcripts         |

### API keys live in the OS keychain

API keys are stored in the operating system's secure credential store (Windows Credential Manager, macOS Keychain, Linux Secret Service) via the `keyring` crate — encrypted at rest by the OS and scoped to your user account. See [SECURITY.md](./SECURITY.md).

### Deleting your data

- **Single session:** History panel → select session → delete.
- **All history:** History panel → "Clear all".
- **Settings and keys:** Settings → Reset to defaults (clears API keys in memory and on disk).
- **Nuclear option:** Remove the Voxlen data directory while the app is closed.

## Telemetry

There is a `telemetry_enabled` setting in `AppSettings`, but it is **off by default** and no telemetry backend is wired up in the current codebase. The field exists so that if telemetry is ever added, it will default to opt-in.

## Third-party privacy

When you send audio to Deepgram or OpenAI, or text to Anthropic or OpenAI, the vendor's privacy policy applies. Review their terms:

- Deepgram: https://deepgram.com/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- Anthropic: https://www.anthropic.com/legal/privacy

## iOS keyboard

The iOS keyboard extension is a separate bundle (`ios/VoxKeyboard`). It only transmits text when the user taps the grammar action, and only to the provider configured in the main Voxlen iOS app. Extensions run in a sandbox with network access granted explicitly via `RequestsOpenAccess`.

## Questions

Security-impacting privacy questions: `security@voxlen.ai` (placeholder).
