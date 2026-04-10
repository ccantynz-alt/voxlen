# Voxlen iOS Keyboard Extension

AI-powered grammar correction keyboard for iPhone and iPad.

## Setup in Xcode

1. Open Xcode and create a new project: **File > New > Project**
2. Choose **App** template, name it `VoxKeyboard`
3. Add a new target: **File > New > Target > Custom Keyboard Extension**
4. Name it `VoxKeyboardExtension`
5. Copy the Swift files from this directory into the appropriate targets
6. Enable **App Groups** capability for both targets with group: `group.com.voxlen.keyboard`
7. Enable **RequestsOpenAccess** in the keyboard extension's Info.plist (already configured)

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

- The main app (`VoxApp`) provides settings management
- The keyboard extension (`VoxKeyboardExtension`) is a custom keyboard
- Settings are shared via App Groups (`group.com.voxlen.keyboard`)
- The "Polish" button in the keyboard bar sends text to Claude/OpenAI for grammar correction
- Corrected text replaces the original directly in any text field

## API Usage & Cost

Using Claude Haiku for grammar correction:
- ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- Average text correction: ~100 tokens = ~$0.00003 per correction
- 1000 corrections per month = ~$0.03/month
- This is **100x cheaper** than a Grammarly subscription ($12/month)
