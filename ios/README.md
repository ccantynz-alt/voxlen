# Voxlen for iOS

The Voxlen app and the Voxlen keyboard. Phase 1 is a keyboard that types like the system keyboard and has a **Fix** button: it proofreads the selection, or the sentence before the cursor, and applies only validated edits, with Undo. Dictation (the mic key) is Phase 2.

## Layout

| Path | What |
|---|---|
| `project.yml` | XcodeGen spec. The Xcode project is generated from it and not committed. |
| `App/` | SwiftUI container app: keyboard setup with live status, account or API key, locale, protected terms. |
| `Keyboard/` | UIKit keyboard extension: typing, the Fix bar, Undo. |
| `VoxlenKit/` | Swift package shared by both. `VoxlenCore` is Foundation-only and extension-safe; `VoxlenSecrets` is the shared keychain. |

## Build

```bash
brew install xcodegen
cd ios
VOXLEN_DEVELOPMENT_TEAM=<your Apple team ID> xcodegen generate
open Voxlen.xcodeproj
```

Without `VOXLEN_DEVELOPMENT_TEAM` the project builds unsigned (simulator only). Bundle IDs: `com.voxlen.app` and `com.voxlen.app.keyboard`; both need the App Group `group.com.voxlen.app` on your team.

Tests for the shared logic run anywhere Swift runs on macOS:

```bash
swift test --package-path ios/VoxlenKit
```

CI builds the app and runs these tests on GitHub's hosted macOS runners (`.github/workflows/ios.yml`). `.gluecron/workflows/ios.yml` does the same on Voxlen's own Mac once it is a Gluecron runner.

## How Fix works

1. The keyboard picks the selection, or the sentence ending at the cursor (`TextTargeting`; decimals and legal abbreviations such as "v." and "Pty." do not end a sentence).
2. It sends that span to `voxlen.ai/api/grammar-fix` (Voxlen account) or straight to Anthropic (the user's own key).
3. The model returns **edits**, not rewritten text. Each must occur exactly once in the span, may not change a number, and may not touch a protected term (`EditValidator`, the same rules as the server, pinned by `shared/grammar-fix/`).
4. The keyboard retypes only from the first changed character, after checking the text has not changed meanwhile, and offers Undo. A change touching more than 35% of the text is shown for approval instead of applied.

Typing works without Full Access, as App Review guideline 4.4.1 requires; Fix needs it to reach the network. Nothing the user types is logged.
