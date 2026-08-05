# Changelog

## [Unreleased]

### Planned
- macOS meeting capture backend (ScreenCaptureKit)
- iOS on-device STT fallback (restore an SFSpeechRecognizer path)
- Android keyboard extension (skeleton exists, not shipped)
- Clio API integration (matters pull + time entry push)
- Code signing + auto-updater (builds are currently unsigned; no auto-update ships)

## [1.2.0] - 2026-07-18

### Added
- **Whisper Local**: fully on-device transcription via whisper-rs, with an in-app model manager (tiny/base/small English + large-v3-turbo multilingual, downloaded on demand from Hugging Face)
- **On-device grammar**: Tier-1 rules engine plus Tier-2 local LLM polish (Qwen3-4B via llama.cpp) — Privileged Mode now corrects instead of no-op, entirely offline
- **Bot-free meeting capture** (Windows): WASAPI loopback + mic dual-channel recording with You/Remote diarization, Rust-side consent gate and indicator window, Whisper Local forced; task/deadline extraction from meeting transcripts
- **Ambient billing**: session-end draft time entries with 0.1-hour round-up, per-client rates, LEDES 1998B and Clio CSV exports, contextual matter auto-match
- **Secretary review queue**: file-based review packets over firm shared storage (`voxlen-review/`), statuses pending_review/in_review/finalized — no Voxlen servers involved
- **Auto-documents**: opt-in pipeline writing each dictation to a per-client/per-matter `.docx` with atomic writes
- **Always-Ready mode**: tray-resident hands-free dictation with a local voice-activity gate
- **Dragon vocabulary import** (.txt/.voc) into custom vocabulary + flywheel
- **Stripe checkout**: `/api/checkout`, signature-verified `/api/stripe-webhook`, and KV-backed plan entitlements on the landing site
- Onboarding "Your practice" step (default rate, rounding, first client)

### Changed
- **API keys moved to the OS keychain** (keyring crate with Windows Credential Manager / macOS Keychain / Linux Secret Service backends) — no more plaintext keys
- Completed the Marco Reid Voice → Voxlen rebrand across app, configs, and keyring entries
- Landing page redesign (legal letterhead editorial identity) and honesty pass on all product claims

### Fixed
- Real pause/resume (audio gated at the capture callback, Deepgram KeepAlive)
- Numerous reliability fixes: mic recovery, clipboard restore, session dedupe, settings-wipe on launch, hot-mic lifecycle, streaming disconnect handling

## [1.1.0] - 2026-06-12

### Added
- **Voxlen account mode**: STT, grammar, and translation proxied through zero-retention `voxlen.ai/api` endpoints (Vercel functions) with token-based desktop auth — no BYOK required; BYOK retained as a fallback
- **Real-time translation** of dictated text (Claude/OpenAI)
- **Speaker diarization** toggle (Deepgram)
- **Analytics dashboard**, **Flywheel panel** (local-only learned vocabulary, correction patterns, metrics), and per-client matter tracking with billable time
- **Clause library** with custom clause CRUD, legal voice commands, Latin phrase recognition, and legal smart formatting
- **Privileged Mode** enforcement and confidence highlighting
- Noise suppression + gain normalization in the capture pipeline
- 19 SEO landing pages, premium landing redesign, ROI calculator, Google OAuth sign-in, user/admin dashboards
- iOS keyboard: Voxlen account key support and streaming dictation hardening
- Vitest suite plus expanded store/lib coverage

### Changed
- Rebranded from Marco Reid Voice to Voxlen (app, landing, iOS, localStorage keys)
- STT upgraded to Deepgram **Nova-3**; cloud grammar upgraded to **Claude Sonnet 4.6**; Deepgram model-training opt-out (`mip_opt_out=true`) on every request
- Wired Deepgram WebSocket streaming as the default engine with reconnect/temp-key refresh

### Fixed
- Large reliability pass: React #185 crashes, settings propagation to the Rust engine layer, duplicate history/billing entries, prompt-injection hardening in grammar/translate, iOS force-unwrap crashes

## [1.0.5] - 2026-04-17

### Fixed
- **Rust compile (all 4 CI platforms)**: resolved the compile errors that blocked every prior release (v1.0.0 through v1.0.4 never produced installers):
  - Added missing `use tauri::Emitter` in `src-tauri/src/lib.rs` so `WebviewWindow::emit()` resolves.
  - Fixed a `parking_lot::RwLock` read guard being held across `.await` in `src-tauri/src/stt/processor.rs` — the future became non-`Send` and wouldn't spawn on `tokio::spawn`. Config is now cloned out before the await.
  - Added a module-level `transcribe_audio()` helper in `src-tauri/src/stt/mod.rs` so the processor can transcribe without re-entering the lock.
  - Rewrote `commands::audio::get_selected_device` to land the read-guard result into a local before constructing the `Result`, fixing a borrow-check lifetime error.
- Fixes originally identified by Copilot's build-repair agent on `copilot/fix-build-errors`; re-applied here onto mainline.

## [1.0.4] - 2026-04-16

### Changed
- CI: replaced `tauri-action` with explicit `npm run tauri -- build` + `softprops/action-gh-release@v2`. Cargo/vite failures now surface directly in the workflow log instead of being wrapped inside `tauri-action`'s "Command … failed with exit code 1".
- CI: upload build artifacts on every run (including failed runs) via `actions/upload-artifact@v4`, with 7-day retention, so debugging a red build no longer requires re-running.
- CI: x86_64-apple-darwin now builds on `macos-13` (native Intel) rather than cross-compiling from the Apple Silicon `macos-latest` runner.

## [1.0.3] - 2026-04-16

### Changed
- CI: pinned `tauri-action` to `v0.5.20` for reproducible builds (was floating `@v0`).
- CI: added pre-build diagnostics step (toolchain versions, standalone frontend compile) so build failures surface the real error rather than a wrapped exit code.
- CI: set `RUST_BACKTRACE=1` + colour on for Cargo during the tauri-action invocation.
- Generic release body text (was stale v1.0.1 reference).

## [1.0.2] - 2026-04-16

### Added
- Law-firm visual polish across every surface (oxford navy + brass + Fraunces display). Replaces the earlier high-contrast "neon" treatment with a restrained editorial aesthetic.
- Aggressive legal compliance pack in `legal/`:
  - End User Licence Agreement (proprietary)
  - Terms of Service (NZ-governed, NZIAC arbitration, class-action waiver)
  - Privacy Policy (GDPR / UK GDPR / NZ Privacy Act / APPs / CCPA-CPRA / FADP)
  - Acceptable Use Policy
  - Data Processing Addendum + SCC/UK-IDTA appendix
  - Sub-processors list
  - Third-party notices
  - Copyright / trademark / DMCA policy
- Onboarding consent gating: two required checkboxes (legal acceptance + professional authority/review confirmation) plus plaintext-at-rest advisory before first use.
- Settings → Legal & compliance panel linking every document.
- `legalAcceptedVersion` + `legalAcceptedAt` persisted to settings for future policy-version re-prompts.

### Changed
- LICENSE: proprietary commercial licence notice (was MIT).
- README: licence section now points at the full `legal/` directory.

## [1.0.1] - 2026-04-16

### Changed
- Version bump for fresh release tag (no code changes beyond version strings; the 1.0.0 tag existed from earlier failed CI runs without any published installers).

## [1.0.0] - 2026-04-09

### Added
- Real-time voice dictation with Deepgram streaming (sub-300ms latency)
- OpenAI Whisper cloud transcription engine
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

*Note: 1.0.0 never shipped installers (see 1.0.1/1.0.5), and no auto-updater has ever shipped in any version.*
