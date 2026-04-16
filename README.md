# Marco Reid Voice

AI-powered voice dictation and grammar correction for macOS, Windows, and Linux, with a companion iOS keyboard.

[![Licence: Proprietary](https://img.shields.io/badge/Licence-Proprietary-8a6b2f.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#installation)
[![iOS Keyboard](https://img.shields.io/badge/iOS-Keyboard%20Extension-black.svg)](./ios)

## What is Marco Reid Voice

Marco Reid Voice is a desktop voice dictation tool that transcribes your speech in real time and injects the result into whatever application you are using. It pairs a low-latency streaming speech-to-text engine with an optional AI grammar pass, so the text that lands in your editor, chat client, or email is already cleaned up. An iOS keyboard extension brings the same grammar assistance to mobile typing.

## Features

- Real-time streaming transcription via Deepgram Nova-2 (sub-300ms latency)
- Cloud transcription via OpenAI Whisper; offline Whisper Local scaffolded for v1.1
- AI grammar correction powered by Anthropic Claude Haiku or OpenAI GPT-4o-mini
- Universal text injection into any application (keyboard simulation or clipboard paste)
- Voice commands: new line, period, comma, delete that, stop listening, and more
- 20+ languages with optional auto-detection (roadmap extends coverage to 90+)
- Five writing styles: Professional, Casual, Academic, Creative, Technical
- Global hotkeys, system tray with quick actions, waveform visualizer
- Session history with full-text search; exports to TXT, Markdown, JSON, and SRT
- iOS keyboard extension with an AI grammar bar

## Screenshots

<img src="docs/screenshots/dictation.png" alt="Dictation panel" width="720" />
<img src="docs/screenshots/grammar.png" alt="Grammar panel" width="720" />
<img src="docs/screenshots/settings.png" alt="Settings panel" width="720" />

> Screenshots are placeholders. Drop PNG files into `docs/screenshots/` to populate.

## Installation

Download the latest installer for your platform from the [Releases page](https://github.com/ccantynz-alt/voxlen/releases) (placeholder URL).

- macOS: `.dmg` (Apple Silicon and Intel builds)
- Windows: `.msi` installer
- Linux: `.AppImage` and `.deb`

## Build from source

### Prerequisites

- Node.js 22 or newer
- Rust 1.77 or newer (stable toolchain)
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
      pkg-config
    ```

### Commands

```bash
npm install
npm run tauri dev          # run the desktop app in dev mode
npm run tauri build        # produce a release bundle for the host platform
```

## Configuration

Marco Reid Voice needs API keys for its cloud providers. Enter them in **Settings** (or during the first-run Onboarding Wizard). Keys are persisted locally via `tauri-plugin-store`.

| Provider   | Used for              | Where to get a key                                   |
| ---------- | --------------------- | ---------------------------------------------------- |
| Deepgram   | Streaming STT         | https://console.deepgram.com                         |
| OpenAI     | Cloud Whisper + GPT   | https://platform.openai.com/api-keys                 |
| Anthropic  | Claude Haiku grammar  | https://console.anthropic.com/settings/keys          |

You only need the keys for the providers you actually enable.

## Keyboard shortcuts

| Action                | Default shortcut                |
| --------------------- | ------------------------------- |
| Toggle dictation      | `Ctrl/Cmd + Shift + D`          |
| Push-to-talk          | `Ctrl/Cmd + Shift + Space`      |
| Cancel / stop         | `Escape`                        |

Shortcuts are customizable in Settings.

## Privacy

- No telemetry. The app does not phone home.
- Audio is streamed only to the STT provider you select; raw text is sent to the grammar provider only if grammar correction is enabled.
- Transcripts, settings, and session history are stored locally on your machine. You can delete any session or clear the entire history from the History panel.
- See [docs/PRIVACY.md](./docs/PRIVACY.md) for the full data-flow breakdown.

## Contributing

Contributions are welcome. Please read [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) before opening a pull request.

## Licence and legal

Marco Reid Voice is a proprietary commercial product. Use of the Software
is governed by the [End User Licence Agreement](./legal/EULA.md), the
[Terms of Service](./legal/TERMS.md), the
[Privacy Policy](./legal/PRIVACY_POLICY.md), the
[Acceptable Use Policy](./legal/ACCEPTABLE_USE.md), and, for business
customers, the [Data Processing Addendum](./legal/DPA.md). The index of all
legal documents is in [`legal/README.md`](./legal/README.md).

Open-source components that Marco Reid Voice incorporates are listed,
together with their licences, in
[`legal/THIRD_PARTY_NOTICES.md`](./legal/THIRD_PARTY_NOTICES.md). Those
components remain subject to their original licences.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.
