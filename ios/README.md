# Marco Reid Voice iOS Keyboard Extension

AI-powered voice dictation and grammar correction keyboard for iPhone and iPad, supporting 20+ languages. Powered by Deepgram Nova-2 for real-time speech-to-text.

## Setup in Xcode

1. Open Xcode and create a new project: **File > New > Project**
2. Choose **App** template, name it `VoxKeyboard`
3. Add a new target: **File > New > Target > Custom Keyboard Extension**
4. Name it `VoxKeyboardExtension`
5. Copy the Swift files from this directory into the appropriate targets
6. Enable **App Groups** capability for both targets with group: `group.com.marcoreid.voice`
7. Enable **RequestsOpenAccess** in the keyboard extension's Info.plist (already configured)

## Configuration

To use voice dictation and grammar correction, users need to provide their own API keys in the app settings:

- **Deepgram API key** — Required for voice dictation. Get one at [console.deepgram.com](https://console.deepgram.com). Deepgram Nova-2 provides the real-time speech-to-text engine.
- **Claude or OpenAI API key** — Required for grammar correction. Provide a Claude API key (Anthropic) or an OpenAI API key to power the "Polish" grammar correction feature.

Keys are stored locally on-device via App Groups and are never sent to Marco Reid servers.

## Building

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

- The main app (`VoxApp`) provides settings management and API key configuration
- The keyboard extension (`VoxKeyboardExtension`) is a custom keyboard
- Settings are shared via App Groups (`group.com.marcoreid.voice`)
- Voice dictation uses Deepgram Nova-2 via WebSocket streaming for low-latency, real-time transcription in 20+ languages
- The "Polish" button in the keyboard bar sends text to Claude/OpenAI for grammar correction
- Corrected text replaces the original directly in any text field

## iPad Support

The keyboard extension works on both iPhone and iPad. The layout adapts automatically to the larger iPad screen, providing a comfortable dictation and editing experience on all iOS devices.

## API Usage & Cost

Using Claude Haiku for grammar correction:
- ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- Average text correction: ~100 tokens = ~$0.00003 per correction
- 1000 corrections per month = ~$0.03/month
- This is **100x cheaper** than a Grammarly subscription ($12/month)

Using Deepgram Nova-2 for voice dictation:
- $0.0043 per minute (pay-as-you-go)
- 10 minutes of dictation per day = ~$1.29/month
- Combined with grammar correction, total cost stays well under $2/month for typical usage
