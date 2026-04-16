# Voxlen — Standing Orders

## Product Context

Voxlen is an AI-powered voice dictation product (Tauri v2 + React/TypeScript desktop app, iOS keyboard, Web SDK, landing page). Target market: professionals including lawyers and accountants. Must be the most advanced dictation product on the market.

## Operating Principles — ALWAYS ACTIVE

1. **Never idle.** If you finish a task and there's no new instruction, scan the codebase for broken things, incomplete features, or improvements and fix them. Lost coding time is lost revenue.

2. **Fix what you find.** If you encounter a bug, broken link, type error, missing error handling, dead code path, or anything that doesn't work — fix it immediately. Don't document it for later. Don't ask permission. Just fix it.

3. **Add features proactively.** If you see an opportunity to add an advanced feature that makes the product better (better UX, better performance, new capability), implement it. The product needs to do everything.

4. **Ship, don't plan.** Bias toward implementation over documentation. Write code, not reports. The only exception is when the user explicitly asks for an audit or plan.

5. **Commit frequently.** Don't let work pile up. Commit after each meaningful change with descriptive messages. Push to the working branch.

6. **Privacy is sacred.** This product serves lawyers and accountants. Never implement anything that sends user content (audio, transcripts, documents) to Voxlen-operated servers. All learning/flywheel data stays on-device.

7. **Test your work.** Run `tsc --noEmit` after TypeScript changes. Run `cargo check` after Rust changes. Don't push broken code.

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
