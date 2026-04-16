# Marco Reid Voice Privacy Notes

This page describes what leaves your machine, what stays on your machine, and what you can delete. This is an engineering-level summary — treat it as the source of truth for the app's actual behavior.

## TL;DR

- **No telemetry.** Marco Reid Voice does not contact any analytics, metrics, or crash-reporting service.
- **No cloud sync.** Your data never touches Marco Reid Voice-operated servers.
- **Third-party calls are strictly on your behalf**, to the providers you select.

## What gets sent off your device

Marco Reid Voice only talks to two categories of endpoints, and only when you ask it to:

| Outbound traffic | Destination                                 | When                                                                 |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Audio frames     | Deepgram or OpenAI Whisper (your choice)    | Only while dictation is active, and only to the engine you selected  |
| Text             | Anthropic (Claude) or OpenAI (your choice)  | Only when grammar correction is enabled **and** you trigger a pass   |
| App update check | `https://releases.marcoreid.com/...` (placeholder — replace with real host) | When the updater plugin runs (configurable)          |

No other outbound traffic originates from the desktop app.

## What is stored locally

Everything Marco Reid Voice retains lives on your machine, under the Tauri app data directory:

| File              | Contents                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `settings.json`   | All user preferences, including API keys (**plaintext**, see below) |
| `history.json`    | Up to 500 most recent dictation sessions with transcripts         |

### Plaintext API keys

API keys are written to `settings.json` in plaintext. They are not encrypted at rest. Anyone with read access to your user profile can read them. Integrating a hardware-backed keystore is on the roadmap — see [SECURITY.md](./SECURITY.md).

### Deleting your data

- **Single session:** History panel → select session → delete.
- **All history:** History panel → "Clear all".
- **Settings and keys:** Settings → Reset to defaults (clears API keys in memory and on disk).
- **Nuclear option:** Remove the Marco Reid Voice data directory while the app is closed.

## Telemetry

There is a `telemetry_enabled` setting in `AppSettings`, but it is **off by default** and no telemetry backend is wired up in the current codebase. The field exists so that if telemetry is ever added, it will default to opt-in.

## Third-party privacy

When you send audio to Deepgram or OpenAI, or text to Anthropic or OpenAI, the vendor's privacy policy applies. Review their terms:

- Deepgram: https://deepgram.com/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- Anthropic: https://www.anthropic.com/legal/privacy

## iOS keyboard

The iOS keyboard extension is a separate bundle (`ios/VoxKeyboard`). It only transmits text when the user taps the grammar action, and only to the provider configured in the main Marco Reid Voice iOS app. Extensions run in a sandbox with network access granted explicitly via `RequestsOpenAccess`.

## Questions

Security-impacting privacy questions: `security@marcoreid.com` (placeholder).
