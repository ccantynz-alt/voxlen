# Contributing to Voxlen

Thanks for your interest in contributing. This document covers the conventions we follow and how to get a dev environment running.

## Dev setup

```bash
git clone https://github.com/ccantynz-alt/voxlen.git
cd voxlen
npm install
npm run tauri dev
```

See the root [README](../README.md) for platform-specific prerequisites.

For the landing page, work inside `landing/` — see [landing/README.md](../landing/README.md).

## Branch naming

Branch names use the pattern:

```
<type>/<short-kebab-summary>
```

Where `<type>` is one of: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`.

Examples: `feat/whisper-local-engine`, `fix/deepgram-reconnect-race`, `docs/api-reference`.

## Commit convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

Examples:

- `feat(stt): add Whisper Local engine`
- `fix(grammar): retry once on transient 5xx from Anthropic`
- `docs(api): document history commands`

Breaking changes: append `!` after the type/scope and include a `BREAKING CHANGE:` footer.

## Pull requests

- Target `main`. Rebase, don't merge, to keep history linear.
- Keep PRs focused. If you touch multiple concerns, split them.
- Include a short description of the change, a screenshot or recording for UI tweaks, and a test plan.
- Link the issue you are closing (`Closes #123`).
- CI must be green before a PR is eligible for merge.
- Do **not** commit secrets. API keys belong in the in-app Settings panel or `.env` files outside the repo.

## Testing

The repo ships real test suites — run them before pushing:

- `npm test` — frontend unit tests (vitest; 250 tests). `npm run test:watch` for watch mode.
- `npx tsc --noEmit` — TypeScript type-check (also part of CI).
- `npm run rust:check` — `cargo check` for the Rust backend.
- `npm run rust:test` — `cargo test` for the Rust backend (37 tests). Building the Rust backend requires LLVM 18 (`LIBCLANG_PATH`) and CMake for whisper-rs / llama-cpp-2.
- The SDK has its own suite: `cd sdk && npm test`.
- Exercise UI changes manually via `npm run tauri dev`.

CI (`.github/workflows/build.yml`) runs the type-check plus both test suites on every push.

## Code style

- **Rust:** `cargo fmt` + `cargo clippy --all-targets` should be clean.
- **TypeScript/React:** match existing patterns. Components live under `src/components/<domain>/`. Zustand stores go under `src/stores/`.
- Keep public Rust command signatures documented in [API.md](./API.md) when you add or change them.

## Releases

See [RELEASE.md](./RELEASE.md) for the release process (builds are currently unsigned and there is no auto-updater).

## Reporting bugs

File an issue with clear reproduction steps and your platform (OS + version, Voxlen version). For security-sensitive reports, follow [SECURITY.md](./SECURITY.md) instead.
