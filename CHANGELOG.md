# Changelog

## [1.0.0] - 2026-04-09

### Added
- Real-time voice dictation with Deepgram Nova-2 streaming (sub-300ms latency)
- OpenAI Whisper cloud and local transcription engines
- AI grammar correction powered by Claude Haiku and GPT-4o-mini
- Universal text injection into any application (keyboard simulation + clipboard paste)
- Smart microphone management with external USB mic auto-detection
- Voice commands: new line, period, comma, delete that, stop listening, and more
- Global hotkeys: Ctrl/Cmd+Shift+D (toggle), Ctrl/Cmd+Shift+Space (push-to-talk)
- System tray with quick access menu
- First-time onboarding wizard with mic test and API key setup
- 20+ language support with auto-detection
- 5 writing styles: Professional, Casual, Academic, Creative, Technical
- Session history with search
- Export to TXT, Markdown, JSON, and SRT formats
- iOS keyboard extension with AI grammar bar
- Privacy mode with fully offline Whisper Local
- Persistent settings storage
- Custom dark theme with glass-morphism UI
- Waveform audio visualization
- Production landing page
- CI/CD pipeline for macOS, Windows, and Linux builds
- macOS App Store packaging with proper entitlements

### Technical
- Tauri v2 with Rust backend for native performance
- React 18 + TypeScript frontend with Zustand state management
- Tailwind CSS with custom design system
- cpal for cross-platform audio capture
- Deepgram WebSocket streaming for real-time STT
- Platform-specific text injection (osascript/SendInput/xdotool)
- GitHub Actions CI/CD for multi-platform builds
