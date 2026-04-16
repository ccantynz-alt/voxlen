# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in Marco Reid Voice, please report it privately rather than filing a public issue.

**Contact:** `security@marcoreid.com` (placeholder — replace with a real inbox before shipping)

Please include:

- A description of the issue and its impact.
- Steps to reproduce (or a proof-of-concept).
- The Marco Reid Voice version and your operating system.
- Whether you would like to be credited.

We will acknowledge receipt within 3 business days and aim to provide an initial assessment within 7 days. Coordinated disclosure timelines are negotiable based on severity.

## Supported versions

| Version  | Supported          |
| -------- | ------------------ |
| 1.0.x    | Yes                |
| < 1.0    | No (pre-release)   |

Security fixes are shipped in the next 1.0.x patch release. The auto-updater delivers these to all installed clients once the release is promoted out of draft.

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

- **API keys are stored in plaintext** on disk via `tauri-plugin-store` (`settings.json`). They are not encrypted at rest and are readable by any process running as the current user. Hardware-backed keystore integration is on the roadmap.
- **Transcripts are stored in plaintext** in `history.json`. Users can delete sessions or clear the history from the History panel.
- **Audio and text are sent to the providers you configure.** Marco Reid Voice itself does not proxy or log this data, but the upstream vendor's privacy policy applies to any data you send them.
- **No telemetry** is collected by Marco Reid Voice.

## Signed releases

Release binaries are signed. Auto-updater payloads are verified against the embedded public key configured in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Report any validation bypass.
