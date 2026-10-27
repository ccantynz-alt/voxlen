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

## Market Bar (2026-10 market crawl; full scorecard: reports/AI dictation keyboard market 2026.md, local only)

Voxlen restarted 2026-10 after months on hold: build to this bar, and replace older code rather than patching it when it falls short.

**Position:** the obvious Dragon successor (cloud Dragon Professional/Legal Anywhere reportedly stop selling 2026-12-31, switch off 2027-12-31; no Nuance product on Mac/iPhone) that is also good enough for everyday consumers. Win on verifiable privacy + legal-safe output + professional workflow on every device, not on out-spending Wispr Flow ($2B, cloud-only, trust incidents).

**Headline targets (pass/fail):**
- Accuracy: default cloud streaming engine ≤ 3.6% AA-WER Streaming (Nova-3 is ~6.7–7.4%: replace it as default); Parakeet-class on-device default on Mac/Windows (whisper-rs is ~10× slower).
- Integrity: 0 altered citations, case names, amounts or dates; grammar fix returns validated edits only (`/api/grammar-fix`, `shared/grammar-fix/`).
- Latency: end-of-speech → inserted text p50 ≤ 400 ms, p95 ≤ 700 ms with cleanup; first dictation after idle ≤ 1.5 s; 0 silent failures.
- Reliability: 0 lost dictations (local encrypted recovery buffer); ≥ 99.8% crash-free sessions; 0 target-app freezes; desktop idle RAM ≤ 250 MB.
- Privacy: private by default on every tier; offline Privileged Mode with full features, enforceable by a firm admin; SOC 2 Type II from an established auditor within 12 months of launch; meeting capture with all-party consent and no stored voiceprints.
- Mobile: iOS keyboard types and fixes grammar without Full Access; on-device STT via SpeechAnalyzer (not SFSpeechRecognizer); no private APIs (iOS 26.4 removed auto-return to the host app). Android records directly in the IME and commits via InputConnection, never the clipboard.
- Wedge: Dragon migration kit before 2026-12-31; Clio App Directory listing within 6 months of launch; validate the accounting wedge (20 interviews, 5 pilots) before marketing it.
- Pricing: free unlimited on-device dictation; Pro $12/mo annual ($15 monthly); Professional $25–29/user/mo.

## Architecture Map

- **Desktop:** Tauri v2 — Rust in `src-tauri/`, React/TS in `src/`, Zustand stores in `src/stores/`
- **STT:** Deepgram Nova-3 (streaming, default), OpenAI Whisper (cloud), Whisper Local (whisper-rs, on-device)
- **Grammar:** cloud (Claude Sonnet 4.6 / GPT-4o-mini via voxlen.ai proxy or BYOK); local rules `src-tauri/src/grammar/rules.rs`; local LLM Qwen3-4B via llama-cpp-2 (`dynamic-link` feature — static ggml collides with whisper-rs at link time)
- **Meeting capture:** `src-tauri/src/meeting/` — WASAPI loopback + mic dual-channel diarization, Whisper Local forced, Rust-side consent gate + indicator window
- **Billing:** `src/lib/billing.ts` (round-UP 0.1hr) + clients store drafts + LEDES 1998B/Clio CSV export; clients/matters in `src/stores/clients.ts`
- **Auto-documents:** `src/lib/autoDoc.ts` + `src-tauri/src/commands/documents.rs` (per-matter .docx, atomic writes, opt-in)
- **Review workflow:** `src/lib/reviewPacket.ts` + `src/stores/review.ts` + `src-tauri/src/commands/review.rs` (file queue under `<shared>/voxlen-review/`, statuses `pending_review`/`in_review`/`finalized`)
- **Text injection:** OS keyboard simulation (osascript / SendInput / xdotool)
- **Mobile:** iOS in `ios/`: XcodeGen spec `project.yml` (project is generated, not committed), SwiftUI app `App/`, UIKit keyboard `Keyboard/`, shared Swift package `VoxlenKit/` (VoxlenCore: Foundation-only, tested with `swift test`; VoxlenSecrets: keychain). Bundle IDs `com.voxlen.app` / `com.voxlen.app.keyboard`, App Group `group.com.voxlen.app`. Built and tested on GitHub's hosted macOS runners (`.github/workflows/ios.yml`) until Gluecron has a Mac runner. Android keyboard builds in CI (debug+release APKs)
- **Grammar fix contract:** `shared/grammar-fix/` (edit-validation cases + prompt) pins the server (`landing/api/_grammar-fix.ts`) and iOS (`VoxlenCore`) to identical behaviour; change both sides together
- **Web SDK / Landing:** `sdk/` (embeddable JS); `landing/` (Vite + React + Tailwind, Vercel auto-deploys from main)
- **CI:** Gluecron gate `.gluecron/workflows/ci.yml` (shared runner: Node 22, no Rust/Java); `.gluecron/workflows/ios.yml` targets the Xcode Mac runner (`[self-hosted, macos, xcode]`); GitHub `.github/workflows/` for Rust tests, Tauri releases, Android APKs
- **Future:** GateTest (auto-test/fix loop) integrates later — keep architecture open, do not implement yet.

## Open Gaps (fix when you can)

- macOS meeting capture backend (ScreenCaptureKit; `meeting_capture_supported()` gates it)
- iOS Phase 2: mic key via app-hop session (audio in the app, keyboard signals via App Group + Darwin notifications), on-device STT with SpeechAnalyzer; app icon/asset catalog; Sign in with Apple/Google instead of pasting an account key
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
