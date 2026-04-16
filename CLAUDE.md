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
- **STT engines:** Deepgram Nova-2 (streaming), OpenAI Whisper (cloud), Whisper Local (not yet implemented)
- **Grammar AI:** Claude Haiku 4.5 + GPT-4o-mini via user's own API keys
- **Text injection:** OS-level keyboard simulation (osascript/SendInput/xdotool)
- **iOS keyboard:** Swift, `ios/VoxKeyboard/`
- **Web SDK:** `sdk/` — embeddable JS library for AlecRae.com integration
- **Landing page:** `landing/` — Vite + React + Tailwind
- **Flywheel:** `src/stores/flywheel.ts` — local-only learning (vocabulary, correction patterns, metrics)

## Known Remaining Gaps (Fix These When You Can)

- [ ] Whisper Local offline mode (integrate whisper-rs)
- [ ] Noise suppression (RNNoise integration in audio pipeline)
- [ ] Payment system (Stripe for Pro/Lifetime tiers)
- [ ] React error boundaries (app white-screens on component errors)
- [ ] API key secure storage (use OS keychain via tauri-plugin-keyring)
- [ ] OG image for landing page social sharing
- [ ] Cookie consent banner for GDPR
- [ ] Android keyboard extension
- [ ] Speaker diarization
- [ ] Real-time translation
- [ ] Analytics dashboard in the app
- [ ] Tests (zero test coverage currently)
- [ ] Flywheel UI panel for viewing learned vocabulary/patterns

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
