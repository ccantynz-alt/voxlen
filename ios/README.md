# Voxlen iOS Keyboard Extension

AI-powered voice dictation and grammar correction keyboard for iPhone and iPad, supporting 20+ languages. Powered by Deepgram Nova-3 for real-time speech-to-text.

> **Status: source drop, no Xcode project committed.** This directory contains the Swift sources for the container app (`VoxApp/`) and the keyboard extension (`VoxKeyboardExtension/`), but no `.xcodeproj`/`.xcworkspace`. You must assemble the project in Xcode (steps below) before anything builds — the CI iOS job detects the missing project and skips.

## Setup in Xcode

1. Open Xcode and create a new project: **File > New > Project**
2. Choose **App** template, name it `VoxKeyboard`
3. Add a new target: **File > New > Target > Custom Keyboard Extension**
4. Name it `VoxKeyboardExtension`
5. Copy the Swift files from this directory into the appropriate targets
6. Enable **App Groups** capability for both targets with group: `group.com.voxlen.app`
7. Enable **RequestsOpenAccess** in the keyboard extension's Info.plist (already configured)

## Configuration

The primary setup is a **Voxlen account key** (copied from the voxlen.ai dashboard) entered in the container app's settings. With an account key, the keyboard exchanges it for short-lived Deepgram tokens via `voxlen.ai/api/deepgram-token` for dictation — no provider keys needed.

Alternatively (BYOK), users can supply their own keys:

- **Deepgram API key** — for voice dictation (Nova-3 real-time streaming). Get one at [console.deepgram.com](https://console.deepgram.com).
- **Claude or OpenAI API key** — for the "Polish" grammar correction feature (the code calls `claude-sonnet-4-6` for Anthropic, or `gpt-4o-mini` for OpenAI).

Keys are stored locally on-device via App Groups and are never sent to Voxlen servers (the account-mode token exchange transits the zero-retention voxlen.ai endpoint).

### Offline fallback: currently non-functional

The settings UI offers an "Apple Speech" engine option, but the on-device `SFSpeechRecognizer` path is currently a stub — selecting it prompts the user to configure Deepgram instead. Restoring a real Apple Speech on-device path is an open task; do not advertise offline dictation on iOS.

## Building

Once the Xcode project is assembled:

```bash
# Build for simulator
xcodebuild -scheme VoxKeyboard -destination 'platform=iOS Simulator,name=iPhone 15' build

# Build for device
xcodebuild -scheme VoxKeyboard -destination 'generic/platform=iOS' archive
```

## App Store Submission

1. In Xcode: **Product > Archive**
2. Open **Window > Organizer**
3. Click **Distribute App** and follow the prompts
4. Submit for review in App Store Connect

## How It Works

- The main app (`VoxApp`) provides settings management and key configuration (Voxlen account key or BYOK)
- The keyboard extension (`VoxKeyboardExtension`) is a custom keyboard
- Settings are shared via App Groups (`group.com.voxlen.app`)
- Voice dictation streams microphone audio to Deepgram Nova-3 over WebSocket (with `mip_opt_out=true` to opt out of model training) for low-latency, real-time transcription in 20+ languages
- The "Polish" button in the keyboard bar sends text to Claude/OpenAI for grammar correction
- Corrected text replaces the original directly in any text field

## iPad Support

The keyboard extension works on both iPhone and iPad. The layout adapts automatically to the larger iPad screen, providing a comfortable dictation and editing experience on all iOS devices.

## API Usage & Cost (BYOK mode, rough estimates)

Grammar correction uses Claude Sonnet 4.6 (roughly $3 per 1M input tokens / $15 per 1M output tokens at the time of writing — check current Anthropic pricing):

- Average text correction: ~100 tokens round-trip ≈ well under $0.001 per correction
- 1000 corrections per month ≈ under $1/month

Deepgram Nova-3 voice dictation is roughly $0.0043–0.0077 per minute pay-as-you-go (check current Deepgram pricing):

- 10 minutes of dictation per day ≈ $1.50–2.50/month

Combined typical usage stays in the low single dollars per month. With a Voxlen account, usage is covered by the plan instead.
