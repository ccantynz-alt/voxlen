# Voxlen

AI-powered voice dictation and grammar correction for macOS, Windows, and Linux, with a companion iOS keyboard.

[![Licence: Proprietary](https://img.shields.io/badge/Licence-Proprietary-8a6b2f.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#installation)
[![iOS Keyboard](https://img.shields.io/badge/iOS-Keyboard%20Extension-black.svg)](./ios)

## What is Voxlen

Voxlen is a desktop voice dictation tool that transcribes your speech in real time and injects the result into whatever application you are using. It pairs a low-latency streaming speech-to-text engine with an optional AI grammar pass, so the text that lands in your editor, chat client, or email is already cleaned up. An iOS keyboard extension brings the same dictation and grammar assistance to mobile typing.

## Features

- Real-time streaming transcription via Deepgram Nova-3 (sub-300ms latency)
- Cloud transcription via OpenAI Whisper; fully offline Whisper Local (whisper-rs) with an in-app model manager (tiny/base/small English + large-v3-turbo multilingual)
- AI grammar correction: cloud (Claude Sonnet 4.6 or GPT-4o-mini, via the voxlen.ai proxy with a Voxlen account or your own keys), on-device rules engine, or a fully local LLM (Qwen3-4B via llama.cpp)
- Universal text injection into any application (keyboard simulation or clipboard paste)
- Voice commands: new line, period, comma, delete that, stop listening, and more
- 20+ languages with optional auto-detection; real-time translation of dictated text
- Five writing styles: Professional, Casual, Academic, Creative, Technical
- Global hotkeys, system tray with quick actions, Always-Ready mode, waveform visualizer
- Session history with full-text search; exports to TXT, Markdown, RTF, JSON, and SRT
- Speaker diarization, noise suppression, custom vocabulary (including Dragon vocabulary import)
- iOS keyboard extension with streaming dictation and an AI grammar bar

### Built for legal and accounting professionals

Voxlen ships a professional workflow layer on top of dictation: bot-free **meeting capture** (dual-channel system-audio + mic recording on Windows, consent-gated, transcribed on-device with task/deadline extraction); **ambient billing** that drafts time entries at session end with 0.1-hour rounding and exports to LEDES 1998B and Clio CSV; a file-based **secretary review queue** for routing dictations to a reviewer over your firm's shared storage; opt-in **auto-documents** that write each dictation into a per-client/per-matter `.docx`; and **Privileged Mode**, which forces all speech-to-text and grammar processing on-device so privileged material never touches any cloud endpoint.

## Installation

Download the latest installer for your platform from the [Releases page](https://github.com/ccantynz-alt/voxlen/releases).

- macOS: `.dmg` (Apple Silicon builds)
- Windows: `.msi` / `.exe` installer
- Linux: `.AppImage` and `.deb`

Builds are currently unsigned — expect a Windows SmartScreen / macOS Gatekeeper unknown-publisher warning on first launch.

## Build from source

### Prerequisites

- Node.js 22 or newer
- Rust 1.77 or newer (stable toolchain)
- **LLVM 18 (libclang) and CMake** — required to compile the native `whisper-rs` and `llama-cpp-2` dependencies. Set `LIBCLANG_PATH` to your LLVM `bin` directory and make sure `cmake` is on `PATH`.
- Platform libraries:
  - macOS: Xcode Command Line Tools
  - Windows: MSVC build tools and WebView2 runtime
  - Linux (Debian/Ubuntu):
    ```
    sudo apt-get install -y \
      libwebkit2gtk-4.1-dev \
      libappindicator3-dev \
      librsvg2-dev \
      patchelf \
      libasound2-dev \
      libssl-dev \
      libsecret-1-dev \
      pkg-config
    ```

### Commands

```bash
npm install
npm run tauri dev          # run the desktop app in dev mode
npm run tauri build        # produce a release bundle for the host platform
```

## Configuration

The simplest setup is a **Voxlen account key** (from the voxlen.ai dashboard) — all STT and grammar calls are then proxied through voxlen.ai, so you never need provider keys. Alternatively, bring your own keys and enter them in **Settings** (or during the first-run Onboarding Wizard). All keys are stored in the **OS keychain** (Windows Credential Manager / macOS Keychain / Linux Secret Service), never in plaintext files.

| Provider   | Used for                    | Where to get a key                                   |
| ---------- | --------------------------- | ---------------------------------------------------- |
| Deepgram   | Streaming STT               | https://console.deepgram.com                         |
| OpenAI     | Cloud Whisper + GPT-4o-mini | https://platform.openai.com/api-keys                 |
| Anthropic  | Claude grammar/translation  | https://console.anthropic.com/settings/keys          |

You only need the keys for the providers you actually enable. Whisper Local and the local grammar engines need no keys at all.

## Keyboard shortcuts

| Action                | Default shortcut                |
| --------------------- | ------------------------------- |
| Toggle dictation      | `Ctrl/Cmd + Shift + D`          |
| Push-to-talk          | `Ctrl/Cmd + Shift + Space`      |
| Correct grammar       | `Ctrl/Cmd + Shift + G`          |
| Cancel / stop         | `Escape`                        |

Shortcuts are customizable in Settings.

## Privacy

- No telemetry. The app does not phone home.
- Audio is streamed only to the STT provider you select (or nowhere, with Whisper Local); text is sent to the grammar provider only if cloud grammar correction is enabled. With a Voxlen account, traffic transits zero-retention voxlen.ai endpoints.
- Transcripts, settings, and session history are stored locally on your machine. You can delete any session or clear the entire history from the History panel.
- Privileged Mode forces everything on-device and blocks all cloud calls.
- See [docs/PRIVACY.md](./docs/PRIVACY.md) for the full data-flow breakdown.

## Contributing

Contributions are welcome. Please read [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) before opening a pull request.

## Licence and legal

Voxlen is a proprietary commercial product. Use of the Software
is governed by the [End User Licence Agreement](./legal/EULA.md), the
[Terms of Service](./legal/TERMS.md), the
[Privacy Policy](./legal/PRIVACY_POLICY.md), the
[Acceptable Use Policy](./legal/ACCEPTABLE_USE.md), and, for business
customers, the [Data Processing Addendum](./legal/DPA.md). The index of all
legal documents is in [`legal/README.md`](./legal/README.md).

Open-source components that Voxlen incorporates are listed,
together with their licences, in
[`legal/THIRD_PARTY_NOTICES.md`](./legal/THIRD_PARTY_NOTICES.md). Those
components remain subject to their original licences.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.
