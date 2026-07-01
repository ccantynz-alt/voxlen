# Release Process

This document covers cutting a Voxlen release and the one-time setup for the auto-updater signing key.

## One-time: generate the updater signing key

The Tauri updater verifies release bundles against a public key embedded in `src-tauri/tauri.conf.json`. Generate the keypair **once** for the project:

```bash
npm run tauri signer generate -- -w ~/.tauri/voxlen.key
```

This produces:

- `~/.tauri/voxlen.key`        — **private** key (protect this; never commit)
- `~/.tauri/voxlen.key.pub`    — **public** key (paste into `tauri.conf.json`)

### Wire up the public key

Open `src-tauri/tauri.conf.json` and replace the placeholder in the updater block:

```json
"updater": {
  "active": true,
  "endpoints": [
    "https://releases.voxlen.ai/{{target}}/{{current_version}}"
  ],
  "dialog": true,
  "pubkey": "PASTE_PUBLIC_KEY_HERE"
}
```

> The `releases.voxlen.ai` host is a placeholder. Replace with your actual release server before shipping.

### Wire up CI secrets

In GitHub → Settings → Secrets and variables → Actions, add:

| Secret name           | Value                                                          |
| --------------------- | -------------------------------------------------------------- |
| `TAURI_PRIVATE_KEY`   | Contents of `~/.tauri/voxlen.key` (base64 or raw text)         |
| `TAURI_KEY_PASSWORD`  | The passphrase you set when generating (empty string if none)  |
| `APPLE_CERTIFICATE`   | Apple Developer ID signing certificate (base64)                |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password                                    |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Acme Inc (TEAMID)`         |
| `APPLE_ID`            | Apple ID for notarization                                      |
| `APPLE_PASSWORD`      | App-specific password for notarization                         |
| `APPLE_TEAM_ID`       | Apple Developer team id                                        |

The `build.yml` workflow already references these names.

## Cutting a release

1. Update `CHANGELOG.md` with the new version's notes.
2. Bump `version` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` — these three must agree.
3. Commit: `chore(release): vX.Y.Z`.
4. Tag: `git tag vX.Y.Z && git push --tags`.
5. The `Build & Release Voxlen` workflow will:
   - Build for macOS (aarch64 + x86_64), Windows, and Linux.
   - Attach signed bundles to a draft GitHub Release named `Voxlen vX.Y.Z`.
6. Review the draft release, then promote it (un-draft) to trigger auto-update delivery.

## Updater endpoint

The updater polls:

```
https://releases.voxlen.ai/{{target}}/{{current_version}}
```

Your release server must respond with a signed JSON manifest per the [Tauri updater spec](https://v2.tauri.app/plugin/updater/#server-support). Until that host exists, the updater is wired but no updates will be delivered.

## Troubleshooting

- **`pubkey` mismatch at install time:** You regenerated the signing key. Ship an unsigned patch release first, or force all users to reinstall.
- **Missing Apple secrets:** The tauri-action step will fall back to unsigned bundles, which macOS Gatekeeper will reject.
- **Linux bundles failing:** Confirm the apt packages listed in `build.yml` (libwebkit2gtk-4.1-dev, libasound2-dev, libssl-dev, etc.) are present on the runner.
