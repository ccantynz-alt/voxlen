# Voxlen Architecture

This document describes the high-level structure of Voxlen. For a line-by-line IPC reference, see [API.md](./API.md).

## Stack

- **Shell:** Tauri v2 (Rust host + WebView frontend)
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Zustand for state, Radix UI primitives, Framer Motion for animation
- **Backend:** Rust — `cpal` for audio capture, `reqwest` + `tokio-tungstenite` for HTTP and WebSocket I/O, `whisper-rs` for on-device STT, `llama-cpp-2` for the on-device grammar LLM, `keyring` for OS-keychain key storage, `parking_lot` for shared state, `tauri-plugin-store` for persistence

## Rust backend (`src-tauri/src/`)

Module layout:

```
src-tauri/src/
├── lib.rs                   # Tauri builder, plugin registration, tray, invoke handler
├── main.rs
├── models.rs                # Shared on-demand model downloader (.part staging + progress events)
├── audio/                   # Device enumeration + microphone capture (cpal), noise suppression
├── stt/                     # Speech-to-text engines
│   ├── cloud.rs             #   Whisper cloud + voxlen.ai /api/stt proxy
│   ├── streaming.rs         #   Deepgram Nova-3 WebSocket streaming (+ temp-key exchange in account mode)
│   ├── whisper_local.rs     #   On-device whisper.cpp (whisper-rs) + model catalog/downloads — fully implemented
│   ├── processor.rs         #   Batch pipeline for non-streaming engines
│   └── gate.rs              #   Always-Ready local voice-activity gate
├── grammar/                 # On-device grammar engines
│   ├── rules.rs             #   Tier-1 deterministic rules engine
│   ├── llm_local.rs         #   Tier-2 local LLM polish (llama.cpp / Qwen3-4B)
│   └── llm_models.rs        #   Grammar LLM model manager commands
├── meeting/                 # Bot-free meeting capture (WASAPI loopback + mic, consent-gated)
│   └── extract.rs           #   Task/deadline extraction from meeting transcripts
├── text_injection/          # Platform-specific typing and clipboard paste
└── commands/                # Tauri command handlers exposed to the frontend
    ├── audio.rs
    ├── dictation.rs         #   incl. Always-Ready arm/disarm + mic auto-recovery
    ├── documents.rs         #   auto-document (.docx) atomic writes
    ├── grammar.rs           #   cloud grammar (Claude Sonnet 4.6 / GPT-4o-mini / voxlen.ai proxy) + engine routing
    ├── history.rs
    ├── keyring.rs           #   OS-keychain get/set/delete for API keys
    ├── meeting.rs
    ├── permissions.rs
    ├── review.rs            #   file-based secretary review queue
    ├── settings.rs
    ├── stt.rs
    ├── text_injection.rs
    ├── translate.rs
    ├── whisper.rs           #   Whisper Local model manager commands
    └── window.rs
```

### Runtime state

State managers are registered with Tauri's `Manager` during `setup`:

- `AudioState` — wraps an `AudioEngine` that tracks devices, selected input, gain, and live RMS level.
- `SttState` / `SttSessionState` — the active STT config and per-session streaming task.
- `MeetingState` — meeting-capture session state.
- `InjectorState` — wraps a `TextInjector` that dispatches to the OS-specific backend.
- `TrayState` — handles to tray menu items kept in sync by backend code.

Settings and session history are persisted to `tauri-plugin-store` files on disk (`settings.json`, `history.json`) under the app's data directory. The settings JSON is **owned by the frontend** (camelCase); Rust keeps a snake_case in-memory mirror pushed via `update_settings`. API keys are held in the OS keychain, never in the JSON.

### Plugins enabled

`global-shortcut`, `notification`, `store`, `shell`, `dialog`, `fs`, `autostart`. There is **no updater plugin** — the app does not auto-update.

## React frontend (`src/`)

```
src/
├── App.tsx                  # Top-level view router + onboarding + theme/font handling
├── main.tsx
├── components/
│   ├── analytics/           # AnalyticsPanel
│   ├── clauses/             # ClauseLibrary
│   ├── clients/             # ClientsPanel (matters, billing)
│   ├── dictation/           # DictationPanel, HistoryPanel, waveform
│   ├── flywheel/            # FlywheelPanel (local-only learning data)
│   ├── grammar/             # GrammarPanel
│   ├── layout/              # TitleBar, Sidebar
│   ├── meeting/             # MeetingPanel
│   ├── onboarding/          # First-run wizard
│   ├── review/              # ReviewQueuePanel
│   ├── settings/            # SettingsPanel, AdminPanel
│   ├── ui/                  # Radix-based primitives, Toast
│   └── ErrorBoundary.tsx
├── hooks/
│   ├── useGlobalShortcuts.ts
│   └── useTauriEvents.ts
├── lib/
│   ├── autoDoc.ts           # per-matter .docx auto-documents
│   ├── billing.ts           # round-UP 0.1hr billing engine
│   ├── constants.ts
│   ├── contextFormat.ts     # legal/accounting smart formatting
│   ├── export.ts            # TXT / Markdown / RTF / JSON / SRT exporters
│   ├── exportLedes.ts       # LEDES 1998B + Clio CSV exports (with utbms.ts)
│   ├── keyring.ts           # frontend keychain bridge
│   ├── localCorrections.ts  # flywheel-learned corrections
│   ├── matterMatch.ts       # contextual client/matter matching
│   ├── migrateBilling.ts
│   ├── reviewPacket.ts      # review-queue packet format
│   ├── sendReview.ts
│   ├── settings.ts          # load/persist camelCase settings + push to Rust
│   ├── smartFormat.ts
│   ├── utils.ts
│   ├── vocab.ts / vocabImport.ts  # custom vocabulary + Dragon import
│   └── voiceCommands.ts
├── stores/                  # Zustand stores
│   ├── audio.ts
│   ├── clauses.ts
│   ├── clients.ts
│   ├── dictation.ts
│   ├── flywheel.ts          # local-only learning (never sent anywhere)
│   ├── history.ts
│   ├── navigation.ts
│   ├── review.ts
│   └── settings.ts
└── styles/
```

Eleven views are rendered through `App.tsx`: `dictation`, `grammar`, `history`, `review`, `clauses`, `clients`, `meeting`, `analytics`, `flywheel`, `admin`, `settings`. An `OnboardingWizard` preempts the main UI on first launch.

## Data flow

```
 +----------------+     audio frames     +------------------+
 |  Microphone    | -------------------> |  audio::capture  |
 |  (cpal input)  |                      |  (AudioEngine)   |
 +----------------+                      +--------+---------+
                                                  |
                                    audio-level   |  PCM chunks
                                    events        v
                                          +------------------+
                                          | stt::streaming   |  WebSocket  +-----------+
                                          | stt::processor   | <---------> | Deepgram  |
                                          | stt::whisper_local (offline)   +-----------+
                                          +--------+---------+
                                                   | transcription events
                                                   v
                                          +------------------+
                                          |  React frontend  |
                                          |  DictationPanel  |
                                          +--------+---------+
                                                   |
                                   invoke          | user accepts / auto
                                   correct_grammar |
                                                   v
                                          +------------------+   HTTPS   +----------------+
                                          | commands::grammar| --------> | Claude / OpenAI|
                                          | grammar::rules   |  (or none | / voxlen.ai    |
                                          | grammar::llm_local| for local)| proxy          |
                                          +--------+---------+           +----------------+
                                                   |
                                   invoke          |
                                   inject_text     v
                                          +------------------+
                                          | text_injection   | -> OS: SendInput /
                                          |                  |    osascript /
                                          |                  |    xdotool
                                          +------------------+
```

In Voxlen-account mode, cloud STT/grammar/translation requests transit the zero-retention `voxlen.ai/api` endpoints instead of going directly to providers (Deepgram streaming exchanges the account key for a short-lived Deepgram token via `/api/deepgram-token`). In Privileged Mode everything is forced through `stt::whisper_local` and the local grammar engines — no cloud calls.

## IPC catalog

Commands are registered in `src-tauri/src/lib.rs` via `tauri::generate_handler!` — **58 commands** across audio, dictation, STT, Whisper/grammar model managers, grammar, translation, meeting capture, documents, review queue, text injection, settings, keyring, history, window/shell, and permissions. Full parameter and return signatures live in [API.md](./API.md), which also documents all emitted events (transcription/streaming lifecycle, audio device recovery, Always-Ready state, meeting lifecycle, model download progress, and navigation).

## Persistence

| File / location         | Owner               | Contents                                        |
| ----------------------- | ------------------- | ----------------------------------------------- |
| `settings.json`         | frontend (`src/lib/settings.ts`) | User preferences, camelCase (no API keys) |
| `history.json`          | `commands::history` | Up to 500 most recent sessions with segments    |
| OS keychain             | `commands::keyring` | API keys (`sttApiKey`, `grammarApiKey`, `voxlenApiKey`) |
| `models/`               | `stt::whisper_local`, `grammar::llm_models` | Downloaded ggml/GGUF model files |
| Documents folder (opt-in) | `src/lib/autoDoc.ts` + `commands::documents` | Per-matter `.docx` auto-documents |
| `voxlen-review/` shared folder | `src/lib/reviewPacket.ts` + `commands::review` | Secretary review-queue packets |
