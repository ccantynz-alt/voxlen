# Voxlen — Standing Orders

## Product Context

Voxlen is an AI-powered voice dictation product (Tauri v2 + React/TypeScript desktop app, iOS keyboard, Web SDK, landing page). Target market: professionals including lawyers and accountants. Must be the most advanced dictation product on the market.

## ZERO IDLE TIME — The #1 Rule

Lost coding time = lost revenue. There is no acceptable reason to sit idle.

- **If a task is done and no new instruction exists:** Scan the codebase for broken things, incomplete features, or improvements. Fix them.
- **If everything is caught up:** Advance at least one thing. Add a feature, improve performance, harden security, expand test coverage.
- **If truly nothing needs building:** Research the competitive landscape and submit improvement ideas to Craig.
- **Every session must produce at least one meaningful advancement.**

## Operating Principles — ALWAYS ACTIVE

1. **Fix what you find.** If you encounter a bug, broken link, type error, missing error handling, dead code path, or anything that doesn't work — fix it immediately. Don't document it for later. Don't ask permission. Just fix it.

2. **Add features proactively.** If you see an opportunity to add an advanced feature that makes the product better (better UX, better performance, new capability), implement it. The product needs to do everything.

3. **Ship, don't plan.** Bias toward implementation over documentation. Write code, not reports. The only exception is when the user explicitly asks for an audit or plan.

4. **Commit frequently.** Don't let work pile up. Commit after each meaningful change with descriptive messages. Push to the working branch.

5. **Privacy is sacred.** This product serves lawyers and accountants. Never implement anything that sends user content (audio, transcripts, documents) to Voxlen-operated servers. All learning/flywheel data stays on-device.

6. **Test your work.** Run `tsc --noEmit` after TypeScript changes. Run `cargo check` after Rust changes. Don't push broken code.

7. **Honour our customers.** They are paying for this product. Give them the best possible product. Every decision should ask: "Does this make Voxlen the most advanced dictation tool on the market?"

## Flywheel Philosophy

The product must always be learning and advancing. The flywheel (`src/stores/flywheel.ts`) captures vocabulary, correction patterns, and usage metrics — all locally, never sent to any server. This data feeds back into grammar correction and UX optimization. The flywheel is always on, always improving the experience.

Legal implications for lawyer/accountant users need review, but the flywheel stays in place. Privacy-safe by design: only word-level patterns stored, never document content.

## Future: GateTest Integration

GateTest is a separate product (testing loop) that will be integrated later. It continuously tests the product, identifies failures, auto-fixes them, and resubmits. Placeholder for future integration — do not implement yet, but keep architecture open for it.

## Architecture Quick Reference

- **Desktop app:** Tauri v2, Rust backend (`src-tauri/`), React/TS frontend (`src/`)
- **State management:** Zustand stores (`src/stores/`)
- **STT engines:** Deepgram Nova-3 (streaming, default), OpenAI Whisper (cloud), Whisper Local (on-device, whisper-rs)
- **Hands-free modes:** Always-Ready (`src-tauri/src/stt/gate.rs`, VAD-gated cloud sessions) + hardware mic-switch mode (`src-tauri/src/stt/switch.rs`, physical mute/power switch on external mics starts/stops dictation via digital-silence detection; works with every engine incl. privileged local)
- **Legal vocabulary pack:** `src/lib/legalVocab.ts` — jurisdiction-aware legal keyterm boost merged into STT config when Legal Mode is on (user/client/flywheel terms win the 100-keyterm budget)
- **Grammar engines:** cloud (Claude Sonnet 4.6 / GPT-4o-mini, voxlen.ai proxy or BYOK), local rules (`src-tauri/src/grammar/rules.rs`), local LLM (Qwen3-4B via llama-cpp-2, `dynamic-link` feature — static ggml collides with whisper-rs at link time)
- **Meeting capture:** `src-tauri/src/meeting/` — WASAPI loopback + mic dual-channel (= You/Remote diarization), Whisper Local forced, Rust-side consent gate + indicator window
- **Billing:** `src/lib/billing.ts` (round-UP 0.1hr convention) + clients store draft/approve entries + LEDES 1998B/Clio CSV export
- **Auto-documents:** `src/lib/autoDoc.ts` + `src-tauri/src/commands/documents.rs` (per-matter .docx, atomic writes, opt-in Documents settings card)
- **Review workflow:** `src/lib/reviewPacket.ts` + `src/stores/review.ts` + `src-tauri/src/commands/review.rs` (file-based secretary queue under `<shared>/voxlen-review/`, statuses `pending_review`/`in_review`/`finalized`)
- **Text injection:** OS-level keyboard simulation (osascript/SendInput/xdotool)
- **iOS keyboard:** Swift, `ios/VoxKeyboard/`
- **Web SDK:** `sdk/` — embeddable JS library for AlecRae.com integration
- **Landing page:** `landing/` — Vite + React + Tailwind
- **Flywheel:** `src/stores/flywheel.ts` — local-only learning (vocabulary, correction patterns, metrics)
- **Clients:** `src/stores/clients.ts` — per-client matter tracking with billable time

## Known Remaining Gaps (Fix These When You Can)

- [x] Whisper Local offline mode (whisper-rs + on-demand model manager) ✓ — build needs LLVM 18 + CMake (LIBCLANG_PATH/CMAKE user env vars are set on this machine)
- [x] API key secure storage — keyring crate with windows-native/apple-native backends (Credential Manager / macOS Keychain) ✓
- [x] Local grammar (Tier 1 rules + Tier 2 Qwen3-4B on-device) — privileged mode now corrects instead of no-op ✓
- [x] Ambient billing — session-end draft time entries, 0.1hr rounding, LEDES/Clio export, matter auto-match ✓
- [x] Bot-free meeting capture (Windows loopback, consent-gated) + task/deadline extraction ✓
- [ ] macOS meeting capture backend (ScreenCaptureKit; `meeting_capture_supported()` gates it)
- [ ] iOS local STT — the Apple Speech fallback is currently a stub (removed in commit `77d9e93` when Deepgram STT landed), so the `requiresOnDeviceRecognition` quick-win note no longer applies; the real task is restoring an `SFSpeechRecognizer` on-device path
- [x] Android keyboard extension — `android/app/.../keyboard/` (VoxlenKeyboardService + Deepgram/Grammar clients, ~850 lines Kotlin) ✓
- [x] Stripe payment links — `/api/checkout`, `/api/stripe-webhook`, and KV plan entitlement shipped 2026-07-18 ✓ (only real `STRIPE_*` env vars in Vercel remain — ops task, not code)
- [x] API proxy backend — serverless functions under `landing/api/` (`stt`, `grammar`, `translate`, `deepgram-token`, `me`, `generate-key`, …) hold provider keys on voxlen.ai/api ✓ (dedicated api.voxlen.com host remains optional ops work)
- [ ] Clio API integration (matters pull + time entry push) — export formats shipped as the base
- [x] Noise suppression — high-pass filter + noise gate in capture pipeline ✓
- [x] Payment system — Stripe integration on landing page ✓
- [x] React error boundaries ✓
- [x] OG image for landing page ✓
- [x] Cookie consent banner (GDPR) ✓
- [x] Speaker diarization ✓
- [x] Real-time translation ✓
- [x] Analytics dashboard ✓
- [x] Tests (259 TS + 43 Rust) ✓
- [x] Flywheel UI panel ✓
- [x] Per-client matter tracking + billable time ✓
- [x] SEO landing pages (19 static pages, 40k+ searches/month targeted) ✓

## Commit Convention

```
feat: description (new features)
fix: description (bug fixes)
refactor: description (code improvements)
docs: description (documentation only)
```

## Do NOT

- Store user content on any server
- Add unnecessary abstractions or over-engineer
- Create documentation files unless asked
- Sit idle when there's work to do
