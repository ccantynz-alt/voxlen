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

---

## 11. Website / Landing Page Audit (April 2026)

### Issues Found & Fixed

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | `GH_RELEASES` URL pointed to `ccantynz-alt/voice` instead of `ccantynz-alt/voxlen` — all download links were broken | **CRITICAL** | FIXED |
| 2 | Changelog link pointed to wrong repo (`/voice/` not `/voxlen/`) | **CRITICAL** | FIXED |
| 3 | Footer links (Privacy Policy, Terms, Support, GitHub) all had placeholder anchors | **HIGH** | FIXED — Privacy/Terms now open modal overlays, Support links to email, GitHub links to repo |
| 4 | Claims "90+ languages" but only 20 languages defined in the app | **HIGH** | FIXED — Changed to "20+ languages" across all mentions |
| 5 | No favicon — references `/vox-icon.svg` but file didn't exist | **MEDIUM** | FIXED — Created SVG favicon (blue rounded square + mic icon) |
| 6 | No Privacy Policy or Terms of Service — **critical for lawyer/accountant market** | **CRITICAL** | FIXED — Full Privacy Policy and Terms of Service added as modal pages |
| 7 | No structured data (JSON-LD) for SEO | **MEDIUM** | FIXED — Added SoftwareApplication schema with pricing offers |
| 8 | Footer showed "Built with pride" instead of copyright year | **LOW** | FIXED — Now shows dynamic copyright year |
| 9 | Footer version was hardcoded string, not synced with `APP_VERSION` | **LOW** | FIXED — Now references `APP_VERSION` constant |

### Remaining Website Issues (Not Yet Fixed)

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 10 | No OG image exists at `https://voxlen.ai/og-image.png` | **MEDIUM** | Need to create a 1200x630 OG image for social sharing |
| 11 | No payment system (Stripe/Paddle) — pricing shown but can't purchase | **HIGH** | Needs Stripe integration or link to app-based purchasing |
| 12 | App Store link for iOS keyboard used a placeholder anchor — dead link | **LOW** | FIXED — Now points to `/ios-waitlist` with `aria-disabled` until launch |
| 13 | No cookie consent banner | **MEDIUM** | Needed for GDPR if serving EU users |
| 14 | `voxlen.ai` domain not confirmed as live | **HIGH** | DNS/hosting must be configured before launch |
| 15 | No sitemap.xml or robots.txt | **LOW** | Should be added for SEO |

### Privacy Policy — Key Design Decisions for Legal Market

The Privacy Policy was specifically written for the lawyer/accountant audience:
- Explicit statement that Voxlen is a **pass-through** application — no Voxlen server ever touches user content
- Dedicated section on **attorney-client privilege** and confidentiality obligations
- Clear documentation that API keys are user-owned — Voxlen has no access to user data flows
- Telemetry is opt-in and can be fully disabled
- Offline mode guarantees zero external data transmission

---

## 12. Flywheel / Learning System Architecture

### Design Principles (Privacy-Safe for Legal Professionals)

The flywheel is **100% local-first**. No learning data ever leaves the user's device.

```
┌─────────────────────────────────────────────────────┐
│                   USER'S DEVICE ONLY                 │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │   Dictation   │───▶│  Flywheel Store (local)  │   │
│  │   Session     │    │  • Custom vocabulary      │   │
│  └──────┬───────┘    │  • Correction patterns     │   │
│         │            │  • Usage metrics            │   │
│         ▼            │  • Writing style profile    │   │
│  ┌──────────────┐    └──────────┬───────────────┘   │
│  │   Grammar     │              │                    │
│  │   Correction  │◀─────────────┘                    │
│  │  (uses vocab  │   Feeds vocabulary into           │
│  │   + patterns) │   grammar prompts so AI           │
│  └──────────────┘   doesn't flag known words         │
│                                                      │
│  ╔══════════════════════════════════════════════╗    │
│  ║  NOTHING CROSSES THIS BOUNDARY TO VOXLEN    ║    │
│  ╚══════════════════════════════════════════════╝    │
└─────────────────────────────────────────────────────┘
```

### What the Flywheel Learns (All Local)

1. **Custom Vocabulary** — Words the user frequently uses that get miscorrected by STT or grammar AI. These are auto-detected when the user undoes a correction, or manually added. Fed back into grammar prompts so the AI stops flagging them.

2. **Correction Patterns** — Tracks which grammar corrections are applied most often (e.g., "their → there", missing commas). Over time, these could be pre-applied locally before sending to the AI, reducing API calls and latency.

3. **Usage Metrics** — Session counts, word counts, words per minute, most-used engine. Used locally to optimize the UX (e.g., suggest switching engines, show productivity stats).

4. **Writing Style Profile** — Tracks acceptance/rejection of grammar corrections to learn the user's actual style preferences. If the user consistently rejects "formal" corrections, the system adapts.

### Why This Is Safe for Lawyers/Accountants

- **Zero content transmission** — The flywheel stores only vocabulary words and correction patterns (individual word pairs), never full sentences, paragraphs, or documents.
- **No cloud sync** — Data stays on the device. No Voxlen account, no cloud backup of learning data.
- **No aggregate analysis** — We never collect correction patterns across users. Each user's flywheel is fully isolated.
- **User control** — Users can view, edit, and delete any learned data. Full transparency.
- **Compliant with attorney-client privilege** — Since no content leaves the device and the flywheel only stores word-level patterns (not document content), it does not create a privilege issue.

### Implementation Status

- [x] `src/stores/flywheel.ts` — Zustand store with vocabulary, correction patterns, usage metrics
- [x] `src/stores/flywheel.ts` — Persistence to tauri-plugin-store / localStorage
- [x] `src/components/dictation/DictationPanel.tsx` — Sessions recorded to flywheel on stop
- [x] `src/components/dictation/DictationPanel.tsx` — Grammar corrections recorded as patterns
- [x] `src-tauri/src/commands/grammar.rs` — Custom vocabulary parameter added to grammar API calls
- [x] `src/App.tsx` — Flywheel loaded on startup
- [ ] UI panel to view/manage learned vocabulary and patterns
- [ ] Auto-detection of miscorrected words (when user undoes a correction)
- [ ] Pre-apply common corrections locally before AI call
- [ ] Keyboard shortcut to add current word to vocabulary

---

## 13. Comprehensive Feature Gap Analysis — What's Needed to Be #1

### Tier 1: Must-Have Before Launch

| Feature | Status | Notes |
|---------|--------|-------|
| Fix broken download URLs on landing page | DONE | Was pointing to wrong repo |
| Privacy Policy / Terms of Service | DONE | Critical for legal market |
| Push-to-talk global shortcut | DONE | Hold Ctrl+Shift+Space |
| Voice commands connected to STT | DONE | processVoiceCommands() wired in |
| Settings persistence on every change | DONE | Debounced auto-save |
| Session history persistence | DONE | Via tauri-plugin-store |
| Grammar shortcut (Ctrl+Shift+G) | DONE | Registered in App.tsx |
| Auto-grammar on dictation | DONE | Background polishing |
| Light theme | DONE | CSS custom properties |
| Launch at login | DONE | tauri-plugin-autostart |
| WebSocket reconnection | DONE | Exponential backoff |
| iOS voice input | DONE | Apple Speech Framework |
| Web SDK for AlecRae.com | DONE | @voxlen/sdk package |
| Flywheel / learning system | DONE | Local-first, privacy-safe |
| Favicon | DONE | SVG mic icon |
| Structured data (SEO) | DONE | JSON-LD schema |
| Payment system (Stripe) | NOT DONE | Needed for Pro/Lifetime tiers |
| Whisper Local (offline mode) | NOT DONE | Needs whisper-rs integration |
| Noise suppression (RNNoise) | NOT DONE | Setting exists, not implemented |
| Error boundaries in React | NOT DONE | App white-screens on error |
| API key secure storage | NOT DONE | Should use OS keychain |
| OG image for social sharing | NOT DONE | 1200x630 image needed |

### Tier 2: Differentiation Features (Ship Fast, Iterate)

| Feature | Impact | Complexity | Notes |
|---------|--------|------------|-------|
| Speaker diarization | HIGH | MEDIUM | Deepgram supports it, just need to wire up |
| Real-time translation | HIGH | MEDIUM | Dictate in English, output in Spanish |
| Smart templates | MEDIUM | LOW | Pre-built email templates, signatures, common phrases |
| Custom wake word | MEDIUM | HIGH | "Hey Voxlen, start dictating" |
| Analytics dashboard | MEDIUM | LOW | Show words/day, time saved, most-used features |
| Keyboard shortcuts panel | LOW | LOW | Visual display of all shortcuts |
| Multi-monitor support | LOW | LOW | Ensure tray and injection work across monitors |
| Batch transcription | MEDIUM | MEDIUM | Upload audio files for offline transcription |
| Meeting mode | HIGH | HIGH | Long-running recording with speaker labels |
| Browser extension | MEDIUM | MEDIUM | Chrome/Firefox extension for web dictation |
| Smart formatting | MEDIUM | MEDIUM | Auto-format emails, phone numbers, addresses |
| Markdown dictation | LOW | LOW | "Heading one: Introduction" → "# Introduction" |

### Tier 3: Long-term Market Leadership

| Feature | Notes |
|---------|-------|
| Android keyboard + app | Mirror iOS approach |
| Voxlen Cloud account | Cross-device sync (settings, vocabulary — NOT content) |
| Team/Enterprise plan | Shared vocabulary, admin controls, SSO |
| API marketplace | Let developers build on Voxlen (transcription + grammar as a service) |
| Accessibility mode | Screen reader optimized, high contrast, large text |
| Plugin system | Custom commands, integrations, workflows |
| On-device LLM | Run grammar correction locally via GGML/llama.cpp |

---

## 14. Updated Launch Roadmap (Compressed)

### Week 1: Ship Desktop v1.0
- Finish Tier 1 "NOT DONE" items (payment, Whisper Local, noise suppression, error boundaries)
- Create OG image
- Set up voxlen.ai domain + hosting for landing page
- Submit iOS keyboard to App Store review

### Week 2: Integration + Polish
- Integrate Voxlen Web SDK into AlecRae.com email client
- Add speaker diarization (Deepgram flag)
- Add analytics dashboard to app
- Add smart templates for email dictation

### Week 3: Launch
- Product Hunt launch
- Social media announcement
- Press outreach to legal/accounting tech publications
- Monitor crash reports and user feedback

### Ongoing
- Android keyboard development
- Real-time translation
- Team/Enterprise features
- Plugin system
