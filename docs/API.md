# Voxlen IPC Reference

This document enumerates every Tauri `invoke` command and every event emitted from the Rust backend. Types are given in their serialized (JSON) shape.

All commands return either the documented success type or an `Err(string)` — in the frontend this is surfaced as a rejected Promise whose reason is a plain string.

---

## Audio

### `list_audio_devices`

List available input devices from `cpal`.

- **Parameters:** none
- **Returns:** `AudioDevice[]`

```ts
type AudioDevice = {
  id: string;
  name: string;
  is_default: boolean;
  is_external: boolean;
  sample_rate: number;
  channels: number;
};
```

### `get_selected_device`

Return the id of the currently selected input device, if any.

- **Parameters:** none
- **Returns:** `string | null`

### `set_audio_device`

Select a capture device by id.

- **Parameters:** `device_id: string`
- **Returns:** `void`

### `get_input_level`

Current microphone RMS level (0.0 – 1.0). Intended for polling fallback; prefer the `audio-level` event.

- **Parameters:** none
- **Returns:** `number` (`f32`)

---

## Dictation

### `start_dictation`

Begin capturing audio from the selected device. Streams frames into the configured STT engine.

- **Parameters:** none
- **Returns:** `void`

### `stop_dictation`

Stop capture and tear down the STT session.

- **Parameters:** none
- **Returns:** `void`

### `pause_dictation`

Pause capture without tearing down the STT session.

- **Parameters:** none
- **Returns:** `void`

### `get_dictation_status`

- **Parameters:** none
- **Returns:** `DictationStatus`

```ts
type DictationStatus = "idle" | "listening" | "paused" | "processing" | "error";
```

---

## STT

### `get_stt_engines`

Enumerate available STT engines and their capabilities.

- **Parameters:** none
- **Returns:** `EngineInfo[]`

```ts
type EngineInfo = {
  id: "whisper_cloud" | "deepgram";
  name: string;
  description: string;
  requires_api_key: boolean;
  supports_streaming: boolean;
  supports_offline: boolean;
};
```

### `set_stt_engine`

Switch the active STT engine.

- **Parameters:** `engine_id: "whisper_cloud" | "deepgram"`
- **Returns:** `void`

### `get_stt_config`

- **Parameters:** none
- **Returns:** `SttConfig`

```ts
type SttConfig = {
  engine: "DeepgramCloud" | "WhisperCloud";
  api_key: string | null;
  language: string;       // ISO code, or "auto"
  punctuate: boolean;
  smart_format: boolean;
  custom_vocabulary: string[];
};
```

### `set_stt_config`

- **Parameters:** `config: SttConfig`
- **Returns:** `void`

---

## Grammar

### `correct_grammar`

Run grammar/style correction on a text blob via Claude Haiku or GPT-4o-mini. Requires `grammar_api_key` to be set.

- **Parameters:** `text: string`
- **Returns:** `GrammarResult`

```ts
type GrammarResult = {
  original: string;
  corrected: string;
  changes: GrammarChange[];
  score: number; // 0.0 – 1.0
};

type GrammarChange = {
  original: string;
  corrected: string;
  reason: string;
  category: "grammar" | "spelling" | "punctuation" | "style";
};
```

### `get_grammar_config`

- **Parameters:** none
- **Returns:** `GrammarConfig`

```ts
type GrammarConfig = {
  enabled: boolean;
  api_key: string | null;
  provider: "Claude" | "OpenAI";
  style: "Professional" | "Casual" | "Academic" | "Creative" | "Technical";
  auto_correct: boolean;
  preserve_tone: boolean;
};
```

### `set_grammar_config`

- **Parameters:** `config: GrammarConfig`
- **Returns:** `void`

---

## Text Injection

### `inject_text`

Insert `text` into whatever application currently has focus, using the active injection mode (keyboard simulation or clipboard paste).

- **Parameters:** `text: string`
- **Returns:** `void`

### `get_injection_mode`

- **Parameters:** none
- **Returns:** `InjectionMode`

```ts
type InjectionMode = "Keyboard" | "Clipboard" | "Hybrid";
```

### `set_injection_mode`

- **Parameters:** `mode: InjectionMode`
- **Returns:** `void`

---

## Settings

All settings are persisted to `settings.json` via `tauri-plugin-store`.

### `get_settings`

- **Parameters:** none
- **Returns:** `AppSettings`

```ts
type AppSettings = {
  // Audio
  preferred_device_id: string | null;
  input_gain: number;
  noise_suppression: boolean;

  // STT
  stt_engine: string;
  stt_api_key: string | null;
  stt_language: string;
  auto_detect_language: boolean;
  custom_vocabulary: string[];

  // Grammar
  grammar_enabled: boolean;
  grammar_api_key: string | null;
  grammar_provider: string;   // "claude" | "openai"
  writing_style: string;      // "professional" | "casual" | ...
  auto_correct: boolean;

  // Dictation
  auto_punctuate: boolean;
  smart_format: boolean;
  voice_commands_enabled: boolean;

  // Text injection
  injection_mode: string;     // "keyboard" | "clipboard" | "hybrid"

  // Shortcuts
  shortcut_toggle: string;
  shortcut_push_to_talk: string;
  shortcut_cancel: string;

  // UI
  theme: string;
  show_waveform: boolean;
  font_size: number;
  start_minimized: boolean;
  minimize_to_tray: boolean;
  launch_at_login: boolean;

  // Privacy
  telemetry_enabled: boolean;
  save_transcripts: boolean;
};
```

### `update_settings`

Persist a full `AppSettings` payload.

- **Parameters:** `settings: AppSettings`
- **Returns:** `void`

### `reset_settings`

Restore defaults and persist them.

- **Parameters:** none
- **Returns:** `AppSettings` (the defaults that were written)

### `load_settings_from_disk`

Re-hydrate the in-memory settings cache from the store file. Called automatically during app startup; safe to invoke from the frontend if the user imports settings externally.

- **Parameters:** none
- **Returns:** `AppSettings`

---

## History

Sessions are persisted to `history.json`, capped at 500 entries, newest-first.

### `save_session`

Upsert a session (matched by `id`). Writes to disk immediately.

- **Parameters:** `session: SessionRecord`
- **Returns:** `void`

```ts
type TranscriptSegment = {
  id: string;
  text: string;
  corrected_text: string | null;
  confidence: number;
  language: string | null;
  timestamp_ms: number;
  grammar_applied: boolean;
};

type SessionRecord = {
  id: string;
  started_at_ms: number;
  ended_at_ms: number;
  duration_ms: number;
  word_count: number;
  language: string | null;
  segments: TranscriptSegment[];
};
```

### `get_history`

- **Parameters:** none
- **Returns:** `SessionRecord[]` (sorted newest-first by `started_at_ms`)

### `get_session`

- **Parameters:** `id: string`
- **Returns:** `SessionRecord | null`

### `delete_session`

- **Parameters:** `id: string`
- **Returns:** `void`

### `clear_history`

Remove all stored sessions.

- **Parameters:** none
- **Returns:** `void`

### `search_history`

Case-insensitive substring search against segment `text` and `corrected_text`.

- **Parameters:** `query: string`
- **Returns:** `SessionRecord[]`

---

## Window

### `minimize_to_tray`

Hide the main window. The tray icon keeps the app alive.

- **Parameters:** none
- **Returns:** `void`

### `toggle_window`

Show or hide the main window, focusing it when shown.

- **Parameters:** none
- **Returns:** `void`

---

## Events

Emitted by the backend with `AppHandle::emit` and consumed by the frontend via `@tauri-apps/api/event::listen`.

| Event                    | Payload type                             | Description                                                |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| `audio-level`            | `number` (RMS, 0.0 – 1.0)                | High-frequency mic meter updates                           |
| `transcription`          | `TranscriptionResult`                    | Final transcription segment                                |
| `streaming-partial`      | `TranscriptionResult`                    | In-flight interim result from a streaming engine           |
| `transcription-error`    | `string`                                 | Human-readable error from the active STT pipeline          |
| `streaming-connected`    | `true`                                   | WebSocket handshake with Deepgram succeeded                |
| `streaming-disconnected` | `true`                                   | Streaming session ended                                    |
| `speech-started`         | `true`                                   | Voice activity detected                                    |
| `utterance-end`          | `true`                                   | End-of-utterance detected; good moment to finalize segment |
| `navigate`               | `"dictation"` \| `"grammar"` \| `"settings"` | Tray menu requested a view switch                      |

```ts
type TranscriptionResult = {
  text: string;
  is_final: boolean;
  confidence: number;
  language: string | null;
  // ...provider-specific fields; see src-tauri/src/stt/
};
```
