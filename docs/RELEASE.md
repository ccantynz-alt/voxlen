# Release Process

This document describes how Voxlen releases are actually cut today. There is **no code signing and no auto-updater** in the current pipeline — see the "Future" section at the bottom.

## How releases work today

The `Build & Release Voxlen` workflow (`.github/workflows/build.yml`) runs on every push to `main`, on `release-**` branches, and on `v*` tags. It has four jobs:

1. **test** (Windows runner): `npm ci`, `npx tsc --noEmit`, `npm test` (vitest), `npm run rust:test` (cargo test).
2. **build** (matrix): macOS (aarch64), Windows, and Linux (`ubuntu-22.04`) — `npm run build` then `npm run tauri -- build`. Bundles are uploaded as workflow artifacts on every run (7-day retention) for debugging.
3. **release**: after build + test succeed, collects the installers (`.dmg`, `.app.tar.gz`, `.msi`, `.exe`, `.AppImage`, `.deb`, `.rpm`) and publishes a GitHub Release via `softprops/action-gh-release@v2`, tagged `v<version>` from `package.json`. The release is published directly (not draft).
4. **build-ios** (best-effort, `continue-on-error`): attempts an Xcode build only if an Xcode project exists under `ios/VoxKeyboard/` — currently none is committed, so this job logs a skip message.

The published installers are **unsigned**. The release body tells users to expect a Windows SmartScreen / macOS Gatekeeper unknown-publisher warning on first launch and how to proceed past it.

## Cutting a release

1. Update `CHANGELOG.md` with the new version's notes.
2. Bump `version` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` — these three must agree (also sync `package-lock.json` / `Cargo.lock`).
3. Commit: `chore(release): vX.Y.Z`.
4. Tag and push: `git tag vX.Y.Z && git push && git push --tags` (a push to `main` alone also triggers the workflow; the release step names the release from `package.json`, so the version bump is what matters).
5. Verify the workflow goes green and the GitHub Release contains installers for all three platforms.

## Troubleshooting

- **Linux bundle failures:** confirm the apt packages listed in `build.yml` (libwebkit2gtk-4.1-dev, libasound2-dev, libssl-dev, libsecret-1-dev, etc.) are installed on the runner.
- **Missing installers in the release:** check the per-platform build job artifacts — the release job copies only recognised installer extensions.
- **Version mismatch:** the release tag comes from `package.json`; if it disagrees with `tauri.conf.json`/`Cargo.toml` the bundles will carry a different version than the tag.

## Future: signing + auto-update (NOT implemented)

None of the following exists in the current pipeline; it is a roadmap sketch only:

- **Code signing:** Windows Authenticode certificate and Apple Developer ID signing + notarization (would require `APPLE_*` secrets in CI).
- **Tauri updater:** enabling `tauri-plugin-updater` with a generated signing keypair (`npm run tauri signer generate`), an embedded public key in `tauri.conf.json`, and a manifest endpoint. The `@tauri-apps/plugin-updater` npm package is present in `package.json`, but the Rust-side plugin is not registered and no updater configuration or endpoint exists, so nothing auto-updates today.
