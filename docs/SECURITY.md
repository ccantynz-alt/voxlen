# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in Voxlen, please report it privately rather than filing a public issue.

**Contact:** `security@voxlen.ai` (placeholder — replace with a real inbox before shipping)

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
| 1.0.x–1.1.x | Upgrade to 1.2.x |
| < 1.0    | No (pre-release)   |

Security fixes are shipped in the next 1.2.x patch release. Auto-update is not yet wired (no updater plugin is registered); until it is, users must install patch releases manually.

## Scope

In scope:

- The desktop app (`src-tauri/` and `src/`)
- The iOS keyboard extension (`ios/`)
- The marketing landing page (`landing/`) — limited to XSS and content-injection classes of bugs

Out of scope:

- Vulnerabilities in upstream providers (Deepgram, OpenAI, Anthropic). Report those to the vendor.
- Issues requiring a compromised OS, physical access, or user-disabled protections.

## Known security-relevant design notes

Please read these before reporting — they are documented trade-offs, not undisclosed issues:

- **API keys are stored in the OS keychain** (Windows Credential Manager, macOS Keychain, Linux Secret Service) via the `keyring` crate — never in plain JSON. Non-secret settings remain in `settings.json` via `tauri-plugin-store`.
- **Transcripts are stored in plaintext** in `history.json`. Users can delete sessions or clear the history from the History panel.
- **Audio and text are sent to the providers you configure.** Voxlen itself does not proxy or log this data, but the upstream vendor's privacy policy applies to any data you send them.
- **No telemetry** is collected by Voxlen.

## Signed releases

Release binaries are signed. The auto-updater is **not yet wired** — `tauri.conf.json` has no updater block and the updater plugin is not registered. When it lands, updater payloads will be verified against an embedded public key; see [RELEASE.md](./RELEASE.md).
