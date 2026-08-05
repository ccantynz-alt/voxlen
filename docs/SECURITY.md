# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in Voxlen, please report it privately rather than filing a public issue.

**Contact:** `security@voxlen.ai`

Please include:

- A description of the issue and its impact.
- Steps to reproduce (or a proof-of-concept).
- The Voxlen version and your operating system.
- Whether you would like to be credited.

We will acknowledge receipt within 3 business days and aim to provide an initial assessment within 7 days. Coordinated disclosure timelines are negotiable based on severity.

## Supported versions

| Version  | Supported          |
| -------- | ------------------ |
| 1.2.x    | Yes                |
| < 1.2    | No                 |

Security fixes are shipped in the next 1.2.x patch release. Because there is currently no auto-updater (see below), users must download the fixed installer from the GitHub Releases page.

## Scope

In scope:

- The desktop app (`src-tauri/` and `src/`)
- The iOS keyboard extension (`ios/`)
- The Web SDK (`sdk/`)
- The marketing landing page (`landing/`), including the Vercel serverless API endpoints under `landing/api/` (auth/token issuance, STT/grammar/translate proxying, Stripe checkout and webhook, waitlist)

Out of scope:

- Vulnerabilities in upstream providers (Deepgram, OpenAI, Anthropic, Stripe, Resend, Vercel). Report those to the vendor.
- Issues requiring a compromised OS, physical access, or user-disabled protections.

## Known security-relevant design notes

Please read these before reporting — they are documented trade-offs, not undisclosed issues:

- **API keys are stored in the OS keychain**, not on disk. The desktop app uses the `keyring` crate with platform-native backends (`src-tauri/src/commands/keyring.rs`): Windows Credential Manager, macOS Keychain, and the Secret Service (libsecret) on Linux. Keys are hydrated from the keychain into process memory at startup and are never written to `settings.json`.
- **Other data is stored in plaintext at rest**, protected only by your user account's file-system permissions:
  - `history.json` — up to 500 dictation sessions with full transcripts;
  - per-matter `.docx` auto-documents (opt-in, written to a user-chosen documents folder);
  - review-queue packet files under the configured `voxlen-review/` shared folder;
  - meeting-capture transcripts.

  Users can delete sessions or clear history from the History panel; auto-documents and review packets are ordinary files you can delete directly. Consider full-disk encryption for regulated material.
- **Audio and text are sent to the providers you configure.** In BYOK mode traffic goes directly to the provider; in Voxlen-account mode requests transit the zero-retention `voxlen.ai/api` endpoints to reach the providers. Voxlen does not log or store this content. The upstream vendor's privacy policy applies to any data sent to them.
- **No telemetry** is collected by Voxlen.

## Release signing and updates

Release binaries are currently **unsigned**. Windows SmartScreen and macOS Gatekeeper will warn about an unknown publisher on first launch — this is noted in the GitHub release notes for every version. There is **no auto-updater**: the Tauri updater plugin is not enabled in `src-tauri/tauri.conf.json` and no update endpoint exists, so updates are delivered only as new installers on the Releases page. Code signing and a signed auto-update channel are planned; see `docs/RELEASE.md`.
