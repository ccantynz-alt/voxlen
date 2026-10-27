# Voxlen — Standing Orders

AI voice dictation for professionals (lawyers, accountants). Tauri v2 + React/TS desktop app, iOS keyboard, Android keyboard, Web SDK, landing page. Goal: the most advanced dictation product on the market.

## Rules (always active)

1. **Zero idle time.** Task done and no instruction? Scan for broken/incomplete things and fix them, or advance a feature. Every session produces at least one meaningful advancement.
2. **Fix what you find.** Bugs, type errors, dead code, missing error handling — fix immediately, don't ask, don't document for later.
3. **Ship, don't plan.** Code over reports, unless an audit/plan is explicitly requested. No unnecessary abstractions. No doc files unless asked.
4. **Commit frequently** with descriptive messages; push to the working branch.
5. **Privacy is sacred.** Never send user content (audio, transcripts, documents) to Voxlen-operated servers. All flywheel/learning data stays on-device (`src/stores/flywheel.ts` — word-level patterns only, never document content, always on).
6. **Verify before pushing.** `tsc --noEmit` after TS changes; `cargo check` after Rust changes — but this machine has NO Rust toolchain (verified 2026-08-05): Rust is verified by the CI test job only.
7. **Gluecron is the merge gate.** Push every branch to both `origin` (GitHub) and `gluecron` (`https://gluecron.com/ccantynz/voxlen`) and open the PR on Gluecron too: `.gluecron/workflows/ci.yml` gates it there. Gluecron only reads `.gluecron/workflows/`; GitHub Actions still runs the Rust tests and release builds, and Vercel still deploys from GitHub `main`.

## Architecture Map

- **Desktop:** Tauri v2 — Rust in `src-tauri/`, React/TS in `src/`, Zustand stores in `src/stores/`
- **STT:** Deepgram Nova-3 (streaming, default), OpenAI Whisper (cloud), Whisper Local (whisper-rs, on-device)
- **Grammar:** cloud (Claude Sonnet 4.6 / GPT-4o-mini via voxlen.ai proxy or BYOK); local rules `src-tauri/src/grammar/rules.rs`; local LLM Qwen3-4B via llama-cpp-2 (`dynamic-link` feature — static ggml collides with whisper-rs at link time)
- **Meeting capture:** `src-tauri/src/meeting/` — WASAPI loopback + mic dual-channel diarization, Whisper Local forced, Rust-side consent gate + indicator window
- **Billing:** `src/lib/billing.ts` (round-UP 0.1hr) + clients store drafts + LEDES 1998B/Clio CSV export; clients/matters in `src/stores/clients.ts`
- **Auto-documents:** `src/lib/autoDoc.ts` + `src-tauri/src/commands/documents.rs` (per-matter .docx, atomic writes, opt-in)
- **Review workflow:** `src/lib/reviewPacket.ts` + `src/stores/review.ts` + `src-tauri/src/commands/review.rs` (file queue under `<shared>/voxlen-review/`, statuses `pending_review`/`in_review`/`finalized`)
- **Text injection:** OS keyboard simulation (osascript / SendInput / xdotool)
- **Mobile:** iOS Swift keyboard `ios/VoxKeyboard/`; Android keyboard builds in CI (debug+release APKs)
- **Web SDK / Landing:** `sdk/` (embeddable JS); `landing/` (Vite + React + Tailwind, Vercel auto-deploys from main)
- **CI:** Gluecron gate `.gluecron/workflows/ci.yml` (shared runner: Node 22, no Rust/Java); `.gluecron/workflows/ios.yml` targets the Xcode Mac runner (`[self-hosted, macos, xcode]`); GitHub `.github/workflows/` for Rust tests, Tauri releases, Android APKs
- **Future:** GateTest (auto-test/fix loop) integrates later — keep architecture open, do not implement yet.

## Open Gaps (fix when you can)

- macOS meeting capture backend (ScreenCaptureKit; `meeting_capture_supported()` gates it)
- iOS: no committed Xcode project; restore real `SFSpeechRecognizer` on-device STT (stub removed in `77d9e93`); container-app mic permission flow
- Xcode Mac as a Gluecron runner: blocked on Gluecron.com #16478 (label-only runners). Do NOT register it as a `ccantynz` account runner before that lands: an account runner takes every `runs-on: self` job across all of the account's repos and switches off the shared lane. Once it lands: register with label `xcode`, dispatch `ios.yml`
- Android keyboard: real-device testing + release signing before shipping
- Stripe: endpoints + KV entitlement shipped; only real `STRIPE_*` env vars in Vercel remain
- api.voxlen.com backend (proxy to hold provider keys + metering)
- Clio API integration (matters pull + time entry push); export formats already shipped
- Legal pack (EULA/Privacy, amended 2026-08-05) needs lawyer sign-off on processor characterization + effective dates
- Unpublish stale GitHub Pages duplicate site (Settings → Pages)
- ~40 stale merged claude/* remote branches — bulk delete pending Craig's OK

## Commit Convention

`feat:` / `fix:` / `refactor:` / `docs:` + description.
