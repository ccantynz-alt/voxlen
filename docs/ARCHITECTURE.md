# Marco Reid Voice Architecture

This document describes the high-level structure of Marco Reid Voice. For a line-by-line IPC reference, see [API.md](./API.md).

## Stack

- **Shell:** Tauri v2 (Rust host + WebView frontend)
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Zustand for state, Radix UI primitives, Framer Motion for animation
- **Backend:** Rust, `cpal` for audio capture, `reqwest` + `tokio-tungstenite` for HTTP and WebSocket I/O, `parking_lot` for shared state, `tauri-plugin-store` for persistence

## Rust backend (`src-tauri/src/`)

Module layout:

```
src-tauri/src/
├── lib.rs                   # Tauri builder, plugin registration, tray, invoke handler
├── audio/                   # Device enumeration + microphone capture (cpal)
├── stt/                     # Speech-to-text engines (Deepgram streaming, Whisper cloud, Whisper local stub)
├── text_injection/          # Platform-specific typing and clipboard paste
└── commands/                # Tauri command handlers exposed to the frontend
    ├── audio.rs
    ├── dictation.rs
    ├── grammar.rs
    ├── history.rs
    ├── settings.rs
    ├── stt.rs
    ├── text_injection.rs
    └── window.rs
```

### Runtime state

State managers are registered with Tauri's `Manager` during `setup`:

- `AudioState` — wraps an `AudioEngine` that tracks devices, selected input, gain, and live RMS level.
- `SttState` — wraps an `SttEngine` that owns the active STT config and streaming task.
- `InjectorState` — wraps a `TextInjector` that dispatches to the OS-specific backend.

Settings and session history are persisted to `tauri-plugin-store` files on disk (`settings.json`, `history.json`) under the app's data directory.

### Plugins enabled

`global-shortcut`, `notification`, `store`, `shell`, `updater`, `dialog`, `fs`.

## React frontend (`src/`)

```
src/
├── App.tsx                  # Top-level view router + first-run + shortcut registration
├── main.tsx
├── components/
│   ├── dictation/           # DictationPanel, HistoryPanel, waveform
│   ├── grammar/             # GrammarPanel
│   ├── layout/              # TitleBar, Sidebar
│   ├── onboarding/          # First-run wizard
│   ├── settings/            # SettingsPanel
│   └── ui/                  # Radix-based primitives
├── hooks/
│   └── usePersistedSettings.ts
├── lib/
│   ├── constants.ts
│   ├── export.ts            # TXT / Markdown / JSON / SRT exporters
│   ├── utils.ts
│   └── voiceCommands.ts
├── stores/                  # Zustand stores
│   ├── audio.ts
│   ├── dictation.ts
│   └── settings.ts
└── styles/
```

Four primary views are rendered through `App.tsx`: `dictation`, `grammar`, `history`, `settings`. An `OnboardingWizard` preempts the main UI on first launch.

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
                                          |  stt::streaming  |  WebSocket  +-----------+
                                          |  or stt::proc    | <---------> |  Deepgram |
                                          +--------+---------+             +-----------+
                                                   | transcription events
                                                   v
                                          +------------------+
                                          |  React frontend  |
                                          |  DictationPanel  |
                                          +--------+---------+
                                                   |
                                   invoke          | user accepts
                                   correct_grammar |
                                                   v
                                          +------------------+   HTTPS   +-------------+
                                          | commands::       | --------> | Claude /    |
                                          | grammar          |           | OpenAI      |
                                          +--------+---------+           +-------------+
                                                   |
                                   invoke          |
                                   inject_text     v
                                          +------------------+
                                          | text_injection   | -> OS: SendInput /
                                          |                  |    osascript /
                                          |                  |    xdotool
                                          +------------------+
```

## IPC catalog

Commands are registered in `src-tauri/src/lib.rs` via `tauri::generate_handler!`. Full parameter and return signatures live in [API.md](./API.md).

### Commands (27 total)

- **Audio:** `list_audio_devices`, `get_selected_device`, `set_audio_device`, `get_input_level`
- **Dictation:** `start_dictation`, `stop_dictation`, `pause_dictation`, `get_dictation_status`
- **STT:** `get_stt_engines`, `set_stt_engine`, `get_stt_config`, `set_stt_config`
- **Grammar:** `correct_grammar`, `get_grammar_config`, `set_grammar_config`
- **Text injection:** `inject_text`, `get_injection_mode`, `set_injection_mode`
- **Settings:** `get_settings`, `update_settings`, `reset_settings`, `load_settings_from_disk`
- **History:** `save_session`, `get_history`, `get_session`, `delete_session`, `clear_history`, `search_history`
- **Window:** `minimize_to_tray`, `toggle_window`

### Events emitted to the frontend

| Event                    | Payload                          | Source                         |
| ------------------------ | -------------------------------- | ------------------------------ |
| `audio-level`            | `f32` RMS value                  | `audio::capture`               |
| `transcription`          | `TranscriptionResult`            | `stt::processor`, `streaming` |
| `streaming-partial`      | `TranscriptionResult` (partial)  | `stt::streaming`               |
| `transcription-error`    | `string`                         | `stt::processor`, `streaming` |
| `streaming-connected`    | `true`                           | `stt::streaming`               |
| `streaming-disconnected` | `true`                           | `stt::streaming`               |
| `speech-started`         | `true`                           | `stt::streaming`               |
| `utterance-end`          | `true`                           | `stt::streaming`               |
| `navigate`               | view id (`dictation` / `grammar` / `settings`) | tray menu |

## Persistence

| File                    | Owner               | Contents                                        |
| ----------------------- | ------------------- | ----------------------------------------------- |
| `settings.json`         | `commands::settings`| All user preferences (see `AppSettings` struct) |
| `history.json`          | `commands::history` | Up to 500 most recent sessions with segments    |

Both files live under the Tauri app data directory resolved by `tauri-plugin-store`.
