# Voxlen IPC Reference

This document enumerates every Tauri `invoke` command and every event emitted from the Rust backend. Types are given in their serialized (JSON) shape.

All commands return either the documented success type or an `Err(string)` — in the frontend this is surfaced as a rejected Promise whose reason is a plain string.

Commands are registered in `src-tauri/src/lib.rs` (58 total).

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

Return the id of the currently selected (preferred) input device, if any.

- **Parameters:** none
- **Returns:** `string | null`

### `get_active_device`

Return the id of the device actually capturing right now (may differ from the preferred device if it is unplugged and capture fell back).

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

Begin capturing audio from the selected device. Streams frames into the configured STT engine. In Privileged Mode the engine is forced to Whisper Local and `privileged-mode-active` is emitted.

- **Parameters:** none
- **Returns:** `void`

### `stop_dictation`

Stop capture and tear down the STT session.

- **Parameters:** none
- **Returns:** `void`

### `pause_dictation`

Pause capture without tearing down the STT session (audio is gated at the capture callback; Deepgram is kept alive).

- **Parameters:** none
- **Returns:** `void`

### `resume_dictation`

Resume a paused session.

- **Parameters:** none
- **Returns:** `void`

### `get_dictation_status`

- **Parameters:** none
- **Returns:** `DictationStatus`

```ts
type DictationStatus = "idle" | "listening" | "paused" | "processing" | "error";
```

### `get_always_ready_state`

Whether tray-resident Always-Ready dictation is currently armed.

- **Parameters:** none
- **Returns:** `boolean`

---

## STT

### `get_stt_engines`

Enumerate the cloud STT engines and their capabilities (Whisper Local is managed separately via the model-manager commands and the `whisper_local` settings value).

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

Switch the active STT engine. In Privileged Mode the engine is forced to Whisper Local regardless of the requested id.

- **Parameters:** `engine_id: "whisper_cloud" | "deepgram"`
- **Returns:** `void`

### `get_stt_config`

- **Parameters:** none
- **Returns:** `SttConfig`

```ts
type SttConfig = {
  engine: "DeepgramCloud" | "WhisperCloud" | "WhisperLocal";
  language: string;             // ISO code, or "auto"
  auto_detect_language: boolean;
  api_key: string | null;       // direct provider key (BYOK)
  model: string;                // "nova-3" | "whisper-1" | local model id e.g. "base.en"
  punctuate: boolean;
  smart_format: boolean;
  profanity_filter: boolean;
  custom_vocabulary: string[];
  speaker_diarization: boolean; // Deepgram only
  voxlen_api_key: string | null;   // Voxlen-account mode: proxy via voxlen.ai/api
  voxlen_context: string | null;
  voxlen_tenant_id: string | null;
};
```

### `set_stt_config`

Privileged Mode forces `engine` to `WhisperLocal` before storing.

- **Parameters:** `config: SttConfig`
- **Returns:** `void`

---

## Whisper Local model manager

On-device models (ggml, downloaded from Hugging Face `ggerganov/whisper.cpp`). Download progress arrives via the `whisper-model-progress` event.

### `list_whisper_models`

Catalog of supported models with download state.

- **Parameters:** none
- **Returns:** `WhisperModelInfo[]` (id, label, description, size_mb, multilingual, downloaded)

### `download_whisper_model`

Download a model by catalog id (`"tiny.en" | "base.en" | "small.en" | "large-v3-turbo"`). Streams to a `.part` file and renames on completion.

- **Parameters:** `id: string`
- **Returns:** `void`

### `delete_whisper_model`

- **Parameters:** `id: string`
- **Returns:** `void`

### `has_whisper_model`

Whether **any** Whisper model is downloaded (used to gate offline mode / Privileged Mode).

- **Parameters:** none
- **Returns:** `boolean`

---

## Grammar

### `correct_grammar`

Run grammar/style correction on a text blob. Routed by `GrammarConfig.engine`: cloud (Claude Sonnet 4.6 / GPT-4o-mini, direct or via the voxlen.ai proxy), local rules, or local rules + on-device LLM polish.

- **Parameters:** `text: string`, `custom_vocabulary?: string[]`, `matter_context?: string`, `learned_patterns?: LearnedPattern[]`
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
  api_key: string | null;          // direct provider key (BYOK)
  provider: "Claude" | "OpenAI";
  style: "Professional" | "Casual" | "Academic" | "Creative" | "Technical";
  auto_correct: boolean;
  preserve_tone: boolean;
  voxlen_api_key: string | null;   // Voxlen-account mode
  voxlen_context: string | null;
  voxlen_tenant_id: string | null;
  engine: "Cloud" | "LocalRules" | "LocalLlm";
};
```

### `set_grammar_config`

- **Parameters:** `config: GrammarConfig`
- **Returns:** `void`

---

## Grammar LLM model manager

On-device grammar-polish models (GGUF, e.g. Qwen3-4B, downloaded from Hugging Face). Progress arrives via the `grammar-model-progress` event.

### `list_grammar_models`

- **Parameters:** none
- **Returns:** `LlmModelInfo[]` (id, label, description, size_mb, downloaded)

### `download_grammar_model`

- **Parameters:** `id: string` (e.g. `"qwen3-4b"`)
- **Returns:** `void`

### `delete_grammar_model`

- **Parameters:** `id: string`
- **Returns:** `void`

### `has_grammar_model`

- **Parameters:** `id: string`
- **Returns:** `boolean`

---

## Translation

### `translate_text`

Translate text via the configured provider (Claude/OpenAI direct, or the voxlen.ai proxy in account mode).

- **Parameters:** `text: string`, `target_language: string`
- **Returns:** `TranslationResult` (translated text + detected source language)

---

## Meeting capture

Bot-free, on-device meeting transcription (Windows WASAPI loopback + mic; consent-gated in Rust; Whisper Local forced).

### `meeting_capture_supported`

Whether the current platform has a capture backend (currently Windows only).

- **Parameters:** none
- **Returns:** `boolean`

### `meeting_capture_active`

- **Parameters:** none
- **Returns:** `boolean`

### `start_meeting_capture`

Starts dual-channel capture. Refuses (fail-closed) unless the meeting-consent acknowledgment is stored in settings. Emits `meeting-started` / `meeting-error`.

- **Parameters:** none
- **Returns:** `void`

### `stop_meeting_capture`

Stops capture and emits `meeting-stopped`.

- **Parameters:** none
- **Returns:** `void`

### `extract_meeting_items`

Extract action items / deadlines from meeting transcript segments (on-device, uses natural-language date parsing).

- **Parameters:** `segments: [speaker: string | null, text: string, timestamp_ms: number][]`, `meeting_started_at_ms: number`
- **Returns:** `ExtractedItem[]`

---

## Documents & review queue

### `save_document`

Write a document (e.g. a generated `.docx`) beneath `root`, creating `subdirs` as needed. Atomic write; returns the final absolute path.

- **Parameters:** `root: string`, `subdirs: string[]`, `filename: string`, `contents_b64: string`
- **Returns:** `string` (absolute path written)

### `create_review_packet`

Create a review-packet directory with its files under the shared review root.

- **Parameters:** `root: string`, `dir: string`, `files: { name: string; contents_b64: string }[]`
- **Returns:** `void`

### `list_review_packets`

Enumerate packets under the review root with their status files.

- **Parameters:** `root: string`
- **Returns:** `ReviewPacketList`

### `read_review_file`

- **Parameters:** `root: string`, `dir: string`, `name: string`
- **Returns:** `string` (file contents)

### `write_review_file`

- **Parameters:** `root: string`, `dir: string`, `name: string`, `contents_b64: string`
- **Returns:** `void`

---

## Text Injection

### `inject_text`

Insert `text` into whatever application currently has focus, using the active injection mode.

- **Parameters:** `text: string`
- **Returns:** `void`

### `get_injection_mode`

- **Parameters:** none
- **Returns:** `InjectionMode`

```ts
type InjectionMode = "KeyboardSimulation" | "ClipboardPaste" | "BufferOnly";
```

### `set_injection_mode`

- **Parameters:** `mode: InjectionMode`
- **Returns:** `void`

---

## Settings

The settings JSON on disk (`settings.json`, camelCase) is owned by the **frontend**; these commands manage the Rust-side in-memory mirror (snake_case) that drives the engines. API keys are never stored in `settings.json` — they live in the OS keychain (see Keyring below) and are hydrated at startup.

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
  stt_engine: string;             // "deepgram" | "whisper_cloud" | "whisper_local"
  stt_api_key: string | null;
  whisper_local_model: string;    // e.g. "base.en"
  stt_language: string;
  auto_detect_language: boolean;
  custom_vocabulary: string[];
  speaker_diarization: boolean;

  // Grammar
  grammar_enabled: boolean;
  grammar_api_key: string | null;
  grammar_provider: string;       // "claude" | "openai"
  grammar_engine: string;         // "cloud" | "local_rules" | "local_llm"
  grammar_local_model: string;    // e.g. "qwen3-4b"
  writing_style: string;          // "professional" | "casual" | ...
  auto_correct: boolean;
  preserve_tone: boolean;

  // Dictation
  auto_punctuate: boolean;
  smart_format: boolean;
  voice_commands_enabled: boolean;
  always_ready_mode: boolean;

  // Text injection
  injection_mode: string;         // "keyboard" | "clipboard" | "buffer"

  // Shortcuts
  shortcut_toggle: string;
  shortcut_push_to_talk: string;
  shortcut_cancel: string;
  shortcut_correct_grammar: string;

  // UI
  theme: string;
  show_waveform: boolean;
  font_size: number;
  start_minimized: boolean;
  minimize_to_tray: boolean;
  launch_at_login: boolean;

  // Privacy
  telemetry_enabled: boolean;     // default false; no telemetry backend exists
  save_transcripts: boolean;

  // Privileged mode / Legal
  privileged_mode: boolean;       // forces offline-only STT + local grammar, blocks all cloud calls
  legal_mode: boolean;            // Latin phrase recognition + legal smart format
  jurisdiction: string;           // "uk" | "us" | "australia" | "canada" | "nz" | "global"

  // Translation
  translation_enabled: boolean;
  translation_target_language: string;

  // Meeting capture consent (fail-closed start gate)
  meeting_jurisdiction: string;
  meeting_consent_ack_version: string | null;
  meeting_consent_ack_at: string | null;

  // Voxlen account (proxy mode)
  voxlen_api_key: string | null;
  voxlen_tenant_id: string | null;
  voxlen_context: string | null;

  // Frontend-owned fields Rust round-trips
  billable_rate_per_hour: number;
  legal_accepted_version: string | null;
  legal_accepted_at: string | null;
};
```

### `update_settings`

Persist a full `AppSettings` payload into the Rust mirror and push it to the STT/grammar/translation/audio engines, autostart, and injection mode. Also arms/disarms Always-Ready mode edge-triggered.

- **Parameters:** `settings: AppSettings`
- **Returns:** `void`

### `reset_settings`

Restore defaults and push them to the engines.

- **Parameters:** none
- **Returns:** `AppSettings` (the defaults that were written)

### `load_settings_from_disk`

Startup hydration: opens the store and loads API keys from the OS keychain into the in-memory settings so engines work before the frontend pushes its camelCase settings.

- **Parameters:** none
- **Returns:** `AppSettings`

---

## Keyring (secure key storage)

API keys are stored in the OS credential store (Windows Credential Manager / macOS Keychain / Linux Secret Service) via the `keyring` crate. Known keys: `sttApiKey`, `grammarApiKey`, `voxlenApiKey`.

### `keyring_get`

- **Parameters:** `key: string`
- **Returns:** `string | null`

### `keyring_set`

- **Parameters:** `key: string`, `value: string`
- **Returns:** `void`

### `keyring_delete`

- **Parameters:** `key: string`
- **Returns:** `void`

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

## Window & shell

### `minimize_to_tray`

Hide the main window. The tray icon keeps the app alive.

- **Parameters:** none
- **Returns:** `void`

### `toggle_window`

Show or hide the main window, focusing it when shown.

- **Parameters:** none
- **Returns:** `void`

### `open_url`

Open an external URL in the default browser.

- **Parameters:** `url: string`
- **Returns:** `void`

---

## Permissions

### `check_permissions`

Report OS-level permission state relevant to text injection / capture (e.g. macOS accessibility).

- **Parameters:** none
- **Returns:** `PermissionStatus`

### `request_admin_permissions`

Prompt for the elevated/accessibility permission where the platform supports it.

- **Parameters:** none
- **Returns:** `boolean`

---

## Events

Emitted by the backend with `AppHandle::emit` and consumed by the frontend via `@tauri-apps/api/event::listen` (see `src/hooks/useTauriEvents.ts`).

| Event                     | Payload type                             | Description                                                |
| ------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `audio-level`             | `number` (RMS, 0.0 – 1.0)                | High-frequency mic meter updates                           |
| `waveform-samples`        | `number[]`                               | Downsampled waveform frames for the visualizer             |
| `audio-stream-error`      | `string`                                 | The capture stream errored                                 |
| `audio-device-lost`       | `string`                                 | The active capture device disappeared                      |
| `audio-recovery-attempt`  | payload with attempt info                | Auto-recovery is retrying capture on device loss           |
| `audio-recovery-giveup`   | `string`                                 | Auto-recovery exhausted its retries                        |
| `transcription`           | `TranscriptionResult`                    | Final transcription segment                                |
| `streaming-partial`       | `TranscriptionResult`                    | In-flight interim result from a streaming engine           |
| `transcription-error`     | `string`                                 | Human-readable error from the active STT pipeline          |
| `streaming-connected`     | `true`                                   | WebSocket handshake with Deepgram succeeded                |
| `streaming-disconnected`  | `true`                                   | Streaming session ended                                    |
| `streaming-reconnecting`  | `true`                                   | Streaming session dropped; reconnect in progress           |
| `speech-started`          | `true`                                   | Voice activity detected                                    |
| `utterance-end`           | `true`                                   | End-of-utterance detected; good moment to finalize segment |
| `navigate`                | view id string                           | Tray menu requested a view switch                          |
| `privileged-mode-active`  | `true`                                   | Emitted when dictation starts in Privileged Mode           |
| `always-ready-state`      | `boolean`                                | Always-Ready gate armed/disarmed state changed             |
| `always-ready-toggle`     | `boolean`                                | Tray checkbox toggled; frontend flips the setting          |
| `meeting-started`         | `true`                                   | Meeting capture began                                      |
| `meeting-stopped`         | `true`                                   | Meeting capture ended                                      |
| `meeting-error`           | `string`                                 | Meeting capture failed                                     |
| `whisper-model-progress`  | `DownloadProgress`                       | Whisper model download progress                            |
| `grammar-model-progress`  | `DownloadProgress`                       | Grammar LLM model download progress                        |

```ts
type TranscriptionResult = {
  text: string;
  is_final: boolean;
  confidence: number;
  language: string | null;
  timestamp_ms: number;
  words: { word: string; start_ms: number; end_ms: number; confidence: number }[];
};

type DownloadProgress = {
  id: string;
  received: number;
  total: number;
  done: boolean;
  error: string | null;
};
```

---

## Web SDK

The Web SDK (`sdk/`) exposes a JavaScript API for embedding voice dictation in web applications. See `sdk/src/voxlen.ts` and `sdk/src/types.ts` for the full typed interface.

```ts
import { VoxlenSDK } from "@voxlen/sdk";

// Recommended: Voxlen platform key — provider keys stay on the server.
const voxlen = new VoxlenSDK({
  voxlenKey: "your-dashboard-jwt",      // or, trusted environments only:
  // deepgramApiKey / grammarApiKey / openaiApiKey (BYOK; readable by every visitor)
  language: "en-US",
  writingStyle: "professional",
  autoCorrect: false,
});

// Attach to any textarea / input / contenteditable — adds a floating mic button
voxlen.attachTo(document.querySelector("#email-compose"));

// Or drive it programmatically
await voxlen.startDictation();          // no arguments
voxlen.stop();                          // stop dictation
voxlen.on("transcript", (e) => console.log(e.text));         // final results
voxlen.on("partial-transcript", (e) => console.log(e.text)); // interim results

// Grammar correction — pass text, or omit to correct the attached element's content
const corrected = await voxlen.correctGrammar(text?);

// File transcription + low-level API client (requires voxlenKey)
const res = await voxlen.transcribeFile(audioBlob);
const api = await voxlen.getApi();      // VoxlenApiClient | null
```

Other members: `detach()`, `isListening` (getter), `on(event, cb)` / `off(event, cb)` with events `dictation-start`, `dictation-stop`, `transcript`, `partial-transcript`, `grammar-result`, `error`. The `api` property getter is deprecated in favour of `await getApi()`.
