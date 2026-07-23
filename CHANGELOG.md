# Changelog

## [Unreleased]

### Added
- **Hardware mic-switch mode**: the physical mute/power switch on an external mic (Razer, Yeti, Elgato Wave…) now starts and stops dictation directly — flip on to dictate, flip off to finalize. Detection is digital-silence based, works with every STT engine (including privileged fully-local), and survives mics whose switch powers the USB interface off.
- **Legal vocabulary pack**: Legal Mode now boosts recognition of ~90 legal terms of art (Latin phrases, procedure, property, probate) plus jurisdiction-specific courts and instruments (UK/US/AU/CA/NZ) via Deepgram Nova-3 keyterm prompting. User, client-matter, and flywheel-learned terms always win the keyterm budget.

### Fixed
- Documentation truth-up: Nova-2 → Nova-3 references, grammar model (Claude Sonnet 4.6, not Haiku), keychain key storage (no longer plaintext), unwired auto-updater claims, test-suite docs, SDK example, and stale gap-list entries (Android keyboard and API proxy are shipped).

## [1.2.0] - 2026-07

### Added
- Legal secretary review queue: file-based firm-storage sync (`pending_review` → `in_review` → `finalized`), zero Voxlen servers.
- Auto-document pipeline: every dictation can write a per-client/matter `.docx` (atomic writes, opt-in).
- Dragon vocabulary import (`.txt`/`.voc`) into custom vocabulary + flywheel.
- Stripe checkout, signature-verified webhook, and KV plan entitlement on the landing site.
- Onboarding "Your practice" step: default rate, rounding, first client.

### Changed
- Completed the Marco Reid Voice → Voxlen rebrand.
- Web SDK Voxlen-API mode now targets the real voxlen.ai contract.

## [1.1.0] - 2026-06

### Added
- Fully offline Whisper Local engine (whisper-rs) with on-demand model manager.
- On-device grammar: Tier-1 rules engine + Tier-2 Qwen3-4B LLM (llama.cpp) — Privileged Mode now corrects locally instead of no-op.
- Bot-free meeting transcription: WASAPI loopback + mic dual-channel capture with Rust-side consent gate and indicator window; task/deadline extraction.
- Ambient billing: session-end draft time entries, 0.1 hr rounding, LEDES 1998B/Clio CSV export, matter auto-match.
- API keys moved to the OS keychain (Windows Credential Manager / macOS Keychain) via the `keyring` crate.
- Deepgram Nova-3 (upgraded from Nova-2), speaker diarization, real-time translation, analytics dashboard, flywheel UI panel, per-client matter tracking, SEO landing pages.

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
- Real-time voice dictation with Deepgram Nova-2 streaming (sub-300ms latency)
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
