# Voxlen Product Audit Report

**Date:** 2026-04-14
**Scope:** Full end-to-end codebase audit, launch readiness, AlecRae.com Email Client integration, cross-device strategy

---

## 1. Executive Summary

Voxlen is an **AI-powered voice dictation application** built with Tauri v2 (Rust backend + React/TypeScript frontend). It supports real-time speech-to-text via Deepgram Nova-2 streaming and OpenAI Whisper, AI grammar correction via Claude Haiku and GPT-4o-mini, and cross-platform text injection into any application.

**Current state: ~75% complete.** The core architecture is solid and well-structured, but several critical features are incomplete or stubbed. The product has strong bones but needs focused finishing work before it can launch as "the most advanced dictation tool on the market."

---

## 2. What's Built and Working

### Desktop App (Tauri v2) — STRONG FOUNDATION
- Real-time audio capture via `cpal` with cross-platform support (macOS/Windows/Linux)
- Audio buffering with 100ms chunks, mono conversion, and 16kHz resampling
- Deepgram Nova-2 WebSocket streaming (sub-300ms latency) — **fully wired up**
- OpenAI Whisper cloud transcription — **fully wired up**
- Voice activity detection (energy-based VAD)
- Text injection into any app: keyboard simulation (osascript/SendInput/xdotool) + clipboard paste
- System tray with quick-access menu
- Global hotkeys: Ctrl/Cmd+Shift+D (toggle), Ctrl/Cmd+Shift+Space (push-to-talk)
- First-time onboarding wizard with mic test and API key validation
- Persistent settings via tauri-plugin-store
- 20 language support with auto-detection
- Voice commands: new line, period, comma, delete that, stop listening, etc.
- Export to TXT, Markdown, JSON, SRT formats
- Session history with transcript viewing
- AI grammar correction (Claude Haiku + GPT-4o-mini) with writing styles
- CI/CD pipeline for macOS (ARM + Intel), Windows, and Linux builds
- Auto-updater via tauri-plugin-updater

### iOS Keyboard Extension — FUNCTIONAL SKELETON
- Custom QWERTY keyboard with shift, caps lock, number mode
- AI grammar "Polish" bar integrated into keyboard
- Claude and OpenAI grammar correction APIs wired up
- Settings app with writing style, AI provider, and API key management
- App Groups for settings sharing between app and extension

### Landing Page — EXISTS BUT NOT REVIEWED IN DETAIL

---

## 3. Critical Gaps — What's Incomplete

### 3.1 Whisper Local (Offline Mode) — NOT IMPLEMENTED
**File:** `src-tauri/src/stt/mod.rs:96-99`
The `WhisperLocal` engine type falls through to the cloud Whisper API. There is **no actual local inference**. This is a major gap because:
- Privacy mode is advertised but doesn't actually work offline
- The onboarding wizard offers "Whisper Local — no API key needed" but it would fail

**Fix required:** Integrate `whisper-rs` (Rust bindings for whisper.cpp) for on-device inference.

### 3.2 Push-to-Talk — NOT WIRED UP
The global shortcut `Ctrl/Cmd+Shift+Space` is defined in settings but never registered. Only `Ctrl/Cmd+Shift+D` (toggle) is registered in `App.tsx:118`.

**Fix required:** Register push-to-talk shortcut with press-to-start, release-to-stop behavior.

### 3.3 Noise Suppression — SETTING EXISTS, NOT IMPLEMENTED
`noiseSuppression: true` exists in settings but no actual noise suppression is applied in the audio pipeline. The capture and STT pipeline sends raw audio.

**Fix required:** Integrate RNNoise or a similar noise suppression library in the audio pipeline.

### 3.4 Session History Persistence — DEMO DATA ONLY
`HistoryPanel.tsx` uses hardcoded demo data. There is no actual persistence of past dictation sessions.

**Fix required:** Store sessions in SQLite or the Tauri store, with search functionality.

### 3.5 Settings Persistence — PARTIALLY WORKING
Settings are saved on onboarding completion, but changes made in the Settings panel are only stored in Zustand (in-memory). Settings don't persist across app restarts except for onboarding data.

**Fix required:** Wire up `usePersistedSettings.ts` hook properly, auto-save on every change.

### 3.6 Grammar Correction During Dictation — NOT CONNECTED
The `handleCorrectGrammar` in `DictationPanel.tsx` exists but is never automatically triggered. The Ctrl/Cmd+Shift+G shortcut isn't registered. Grammar correction only works manually in the Grammar Panel.

**Fix required:** Register the grammar shortcut and enable auto-correct for each transcribed segment.

### 3.7 Voice Command Processing — NOT CONNECTED TO STT
Voice commands are defined in `voiceCommands.ts` but never processed against incoming transcriptions. The STT result arrives and gets added as a segment, but no voice command matching occurs.

**Fix required:** Run `processVoiceCommands()` on each transcription result before adding it as a segment.

### 3.8 Audio Level → Waveform Connection — ONLY IN TAURI
The waveform visualization only works when running inside Tauri (via event listeners). No web/demo fallback for the waveform.

### 3.9 Light Theme — NOT IMPLEMENTED
Theme setting exists (dark/light/system) but the entire CSS is dark-only. No light theme CSS variables defined.

### 3.10 Launch at Login — NOT IMPLEMENTED
The setting exists but no autostart registration code exists.

### 3.11 iOS Keyboard — NO VOICE INPUT
The iOS keyboard extension has grammar correction but **no microphone/voice dictation**. It's purely a typing keyboard with a "Polish" button. The talk-to-text that Craig needs on mobile is completely missing.

### 3.12 No Tests
Zero test files exist in the entire project — no unit tests, no integration tests, no E2E tests.

### 3.13 No Android Support
No Android keyboard extension or app exists.

---

## 4. Talk-to-Text Assessment

### What works:
- Desktop: Full talk-to-text pipeline works (audio capture → STT → transcript → text injection)
- Three STT engines available (Deepgram streaming, Whisper cloud, "Whisper local" — see gap above)
- Real-time streaming with interim results (words appear as you speak)
- Voice activity detection for intelligent segment boundaries

### What needs finishing:
1. **Whisper Local must actually work offline** — integrate whisper.cpp/whisper-rs
2. **Voice commands must be connected** — currently parsed but never executed on incoming audio
3. **Push-to-talk must be wired up** — critical for quick dictation bursts
4. **Auto-grammar on transcription** — should optionally polish each segment as it arrives
5. **iOS needs speech input** — use Apple Speech framework or embed Whisper on-device

### To be "most advanced on the market":
- Add speaker diarization (who said what) via Deepgram or AssemblyAI
- Add real-time translation (dictate in one language, output in another)
- Add custom wake word ("Hey Voxlen, start dictating")
- Add domain-specific vocabulary training
- Add intelligent formatting rules (email addresses, phone numbers, code snippets)

---

## 5. Cross-Device Strategy — Craig's Requirement

Craig needs Voxlen across ALL devices. Current state:

| Platform | Status | Talk-to-Text | Grammar |
|----------|--------|-------------|---------|
| macOS | Ready (needs finishing) | Yes | Yes |
| Windows | Ready (needs finishing) | Yes | Yes |
| Linux | Ready (needs finishing) | Yes | Yes |
| iOS | Keyboard only | **NO** | Yes |
| Android | **NOTHING** | NO | NO |
| Web | **NOTHING** | NO | NO |

### Recommended cross-device plan:

1. **Desktop (macOS/Windows/Linux):** Finish the gaps listed above. This is the primary product. Ship first.

2. **iOS:** Two paths:
   - **Quick win:** Add Apple Speech Framework to the keyboard extension for on-device voice input. This gives talk-to-text on iOS within the keyboard.
   - **Full app:** Build a standalone Voxlen iOS app (not just keyboard extension) with full dictation UI, history, and Deepgram streaming.

3. **Android:** Build a custom keyboard with Android SpeechRecognizer API + grammar correction. Mirror the iOS approach.

4. **Web (for AlecRae.com integration):** Build a lightweight web SDK/widget using the Web Speech API + a backend grammar API. This is the integration point for the email client.

---

## 6. AlecRae.com Email Client Integration

### Architecture Recommendation

The integration should work at **two levels**:

#### Level 1: Voxlen Web SDK (Embeddable Widget)
Build a JavaScript/TypeScript SDK that AlecRae.com can embed:
```
<script src="https://sdk.voxlen.ai/v1/voxlen.js"></script>
<VoxlenDictation apiKey="..." onTranscript={handleText} />
```

This SDK would:
- Use the browser's Web Speech API for basic dictation (free, no API cost)
- Optionally upgrade to Deepgram streaming for premium accuracy
- Include the AI grammar correction engine (calls Claude Haiku API)
- Provide a floating mic button that attaches to any textarea/contenteditable
- Auto-inject corrected text into the email compose area

#### Level 2: Desktop App Deep Integration
When Voxlen desktop is running alongside AlecRae.com:
- Voxlen detects AlecRae.com is in focus
- Dictated text is injected directly into the email compose field
- Shortcut Ctrl/Cmd+Shift+D works from within the email client
- This works automatically via the existing text injection system

### Pro Users vs All Users — RECOMMENDATION

**DO NOT restrict to Pro users only.** Here's why:

1. **Craig's requirement:** Craig needs it across all his devices, all the time. If it's Pro-only, that creates friction.

2. **Recommended tiering instead:**

| Feature | Free | Pro |
|---------|------|-----|
| Basic voice dictation (Web Speech API) | Yes | Yes |
| Deepgram/Whisper STT (premium accuracy) | 30 min/month | Unlimited |
| AI Grammar correction | 50 corrections/month | Unlimited |
| Voice commands | Yes | Yes |
| Export (TXT, MD) | Yes | Yes |
| Export (JSON, SRT, DOCX) | - | Yes |
| Custom vocabulary | - | Yes |
| Speaker diarization | - | Yes |
| AlecRae.com basic integration | Yes | Yes |
| AlecRae.com deep integration (templates, smart compose) | - | Yes |
| Priority STT (lower latency) | - | Yes |
| Offline mode (Whisper Local) | - | Yes |

This way:
- Everyone gets voice dictation in the email client (drives adoption)
- Pro unlocks premium accuracy, unlimited usage, and advanced features
- Craig gets everything as a Pro user across all devices

---

## 7. Launch Checklist — What Must Be Done

### Phase 1: Core Finishing (Ship Desktop v1.0) — CRITICAL
- [ ] Wire up Whisper Local with whisper-rs for actual offline mode
- [ ] Register push-to-talk global shortcut
- [ ] Connect voice commands to incoming transcriptions
- [ ] Persist settings on every change (not just onboarding)
- [ ] Implement session history persistence (SQLite)
- [ ] Register grammar correction shortcut (Ctrl/Cmd+Shift+G)
- [ ] Connect auto-grammar to dictation pipeline
- [ ] Implement noise suppression (RNNoise integration)
- [ ] Add light theme CSS variables
- [ ] Implement launch-at-login (OS autostart APIs)
- [ ] Add basic error recovery (reconnect on WebSocket drop)
- [ ] Add tray icon assets (currently references icons/icon.png which may not exist)

### Phase 2: Testing & Polish
- [ ] Unit tests for voice command processing
- [ ] Unit tests for export formats
- [ ] Integration tests for STT pipeline
- [ ] E2E tests for onboarding flow
- [ ] Rust tests for audio capture and encoding
- [ ] Accessibility audit (keyboard navigation, screen reader support)
- [ ] Performance profiling (memory, CPU during long dictation)

### Phase 3: iOS Completion
- [ ] Add Apple Speech Framework to keyboard extension for voice input
- [ ] Or: Build standalone iOS app with full dictation UI
- [ ] Add Xcode project file (currently just Swift source files, no .xcodeproj)
- [ ] TestFlight beta distribution

### Phase 4: AlecRae.com Integration
- [ ] Build Voxlen Web SDK (voxlen.js)
- [ ] Web Speech API dictation with grammar correction
- [ ] Floating mic button component
- [ ] API backend for grammar correction (or client-side with user's API key)
- [ ] Integration guide for AlecRae.com team
- [ ] Test in email compose flow

### Phase 5: Android
- [ ] Android keyboard extension with SpeechRecognizer
- [ ] Grammar correction integration
- [ ] Settings sync via cloud account

### Phase 6: Market Differentiation
- [ ] Speaker diarization (meeting notes use case)
- [ ] Real-time translation
- [ ] Custom wake word
- [ ] Smart templates (email signatures, common phrases)
- [ ] Voxlen Cloud account for cross-device sync
- [ ] Analytics dashboard (words dictated, time saved)

---

## 8. Competitive Analysis — What Makes Voxlen "Most Advanced"

Current leaders: **Otter.ai**, **Dragon NaturallySpeaking**, **Whisper Memos**, **Superwhisper**

### Voxlen's unique advantages already built:
1. **Multi-engine STT** — Users choose between Deepgram (fastest), Whisper (most accurate), or Local (most private)
2. **AI grammar engine** — No competitor has real-time Claude/GPT grammar correction built into dictation
3. **Universal text injection** — Types directly into any app on any OS
4. **Cross-platform native** — Tauri gives native performance on all desktop OSes
5. **Open pricing** — Users bring their own API keys, costs are transparent ($0.03/month for grammar)

### What would make it definitively #1:
1. **Email client integration** — No dictation tool integrates with email clients natively
2. **Cross-device continuity** — Start dictating on desktop, continue on phone
3. **Real-time translation** — Dictate in English, output in Spanish
4. **Speaker diarization** — Built-in meeting transcription
5. **Smart formatting** — Automatically formats emails, code, lists based on context

---

## 9. Technical Debt & Risks

1. **No error boundaries** — React app will white-screen on any component error
2. **No retry logic** — WebSocket disconnections aren't handled gracefully
3. **API keys stored in plain text** — Should use OS keychain (Tauri has keyring plugin)
4. **No rate limiting** — Grammar API calls could run up costs if spammed
5. **CSP is null** — Security header should be configured for production
6. **Linear resampler** — Comments note "for production, use rubato crate" but rubato is already in Cargo.toml and unused
7. **No telemetry backend** — Telemetry setting exists but nothing sends data
8. **Landing page references voxlen.ai domain** — DNS/hosting needs to be configured

---

## 10. Summary

**Voxlen has an excellent foundation.** The architecture is clean, the tech choices are right (Tauri v2, Deepgram streaming, Claude Haiku for grammar), and the UI is well-designed. But it's an unfinished product sitting at ~75%.

**The path to launch (compressed timeline — ship fast):**
1. **Phase 1 — Desktop gaps:** Wire up the 12 missing connections. Most are plumbing, not new architecture. Do in parallel.
2. **Phase 2 — Tests + polish:** Core unit tests alongside Phase 1, not after.
3. **Phase 3 — iOS voice input:** Add Apple Speech Framework to keyboard extension.
4. **Phase 4 — AlecRae.com Web SDK:** Lightweight JS embed with Web Speech API + grammar.
5. **Phase 5+:** Android, market differentiation features.

The AlecRae.com email integration should be available to ALL users (not just Pro), with Pro unlocking premium accuracy and unlimited usage. Craig should be on a Pro/internal account with full access across all devices.
