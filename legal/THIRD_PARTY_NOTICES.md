# Third-Party Notices

**Marco Reid Voice**
**Last updated: 16 April 2026**

Marco Reid Voice incorporates open-source components listed below. Those
components remain subject to their original licences. Nothing in the Marco
Reid licence terms modifies, overrides, or limits those licences. The
relevant licence texts are included with each component's package in the
installed distribution.

No component used by Marco Reid Voice carries a copyleft obligation (GPL,
LGPL, AGPL, MPL, or similar) that would require Marco Reid to publish the
source code of Marco Reid Voice itself. All components are under permissive
licences (MIT, Apache-2.0, BSD variants, ISC, or Unlicense). Where a
component is dual-licensed, Marco Reid elects the most permissive option.

## Desktop application — Rust dependencies (`src-tauri/Cargo.toml`)

| Crate                             | Licence            | Purpose                                  |
| --------------------------------- | ------------------ | ---------------------------------------- |
| `tauri` (v2)                      | Apache-2.0 / MIT   | Desktop application framework            |
| `tauri-plugin-global-shortcut`    | Apache-2.0 / MIT   | Global keyboard shortcuts                |
| `tauri-plugin-notification`       | Apache-2.0 / MIT   | Desktop notifications                    |
| `tauri-plugin-store`              | Apache-2.0 / MIT   | Persistent local key-value store         |
| `tauri-plugin-shell`              | Apache-2.0 / MIT   | Shell / open-external-URL bridge         |
| `tauri-plugin-dialog`             | Apache-2.0 / MIT   | Native file dialogs                     |
| `tauri-plugin-fs`                 | Apache-2.0 / MIT   | File-system access                       |
| `serde`, `serde_json`             | Apache-2.0 / MIT   | Serialisation                            |
| `tokio`                           | MIT                | Async runtime                            |
| `cpal`                            | Apache-2.0 / MIT   | Cross-platform audio capture             |
| `hound`                           | Apache-2.0         | WAV encoding                             |
| `ringbuf`                         | MIT / Apache-2.0   | Lock-free ring buffer                    |
| `rubato`                          | MIT                | Sample-rate conversion                   |
| `reqwest`                         | Apache-2.0 / MIT   | HTTP client                              |
| `tokio-tungstenite`               | MIT                | WebSocket client                         |
| `base64`                          | Apache-2.0 / MIT   | Base64 codec                             |
| `uuid`                            | Apache-2.0 / MIT   | UUID generation                          |
| `chrono`                          | Apache-2.0 / MIT   | Date/time                                |
| `log`, `env_logger`               | Apache-2.0 / MIT   | Logging                                  |
| `anyhow`                          | Apache-2.0 / MIT   | Error ergonomics                         |
| `thiserror`                       | Apache-2.0 / MIT   | Error macros                             |
| `parking_lot`                     | Apache-2.0 / MIT   | Synchronisation primitives               |
| `crossbeam-channel`               | Apache-2.0 / MIT   | Channel primitives                       |
| `bytemuck`                        | Apache-2.0 / MIT / Zlib | Safe transmutation                  |
| `futures-util`                    | Apache-2.0 / MIT   | Futures utilities                        |
| `rodio`                           | Apache-2.0 / MIT   | Audio playback                           |
| `cocoa`, `objc`, `core-foundation`, `core-graphics` (macOS) | Apache-2.0 / MIT | Apple platform bindings |
| `windows` (Windows)               | Apache-2.0 / MIT   | Windows platform bindings                |

## Desktop application — npm dependencies (`package.json`)

| Package                                | Licence          | Purpose                          |
| -------------------------------------- | ---------------- | -------------------------------- |
| `react`, `react-dom`                   | MIT              | UI framework                     |
| `@radix-ui/*`                          | MIT              | Accessible UI primitives         |
| `@tauri-apps/api`, `@tauri-apps/plugin-*` | Apache-2.0 / MIT | Tauri JS bindings             |
| `clsx`, `tailwind-merge`               | MIT              | Class composition                |
| `framer-motion`                        | MIT              | Animation                        |
| `lucide-react`                         | ISC              | Icons                            |
| `zustand`                              | MIT              | State management                 |
| `tailwindcss`, `autoprefixer`, `postcss` | MIT            | Styling                          |
| `vite`, `@vitejs/plugin-react`, `typescript` | MIT        | Build tooling                    |

## Typefaces

Marco Reid Voice uses the following typefaces. Webfont files or references
are bundled subject to their licences:

- **Fraunces** — SIL Open Font Licence 1.1.
- **Inter** — SIL Open Font Licence 1.1.
- **JetBrains Mono** — SIL Open Font Licence 1.1.

## Full licence texts

Complete licence texts for each component are included in the vendored
`node_modules/*/LICENSE` files (JS ecosystem) and the crate registry
(`~/.cargo/registry/...`) for the Rust ecosystem, and are reproduced in the
installed distribution under `about/third_party_notices.txt`.

## Audit

To regenerate this list from the current lock files, run:

```sh
# JavaScript dependencies
npx license-checker --summary --production

# Rust dependencies
cargo license --all-features --direct-deps-only
```

## Reporting an omission

Licensing or attribution concerns: `legal@marcoreid.com`.
