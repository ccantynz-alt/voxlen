import SwiftUI

@main
struct MarcoReidVoiceApp: App {
    @StateObject private var settingsManager = SettingsManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(settingsManager)
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var settings: SettingsManager

    private var keysConfigured: Bool {
        !settings.apiKey.isEmpty && !settings.deepgramApiKey.isEmpty
    }

    private var partialKeysConfigured: Bool {
        !settings.apiKey.isEmpty || !settings.deepgramApiKey.isEmpty
    }

    var body: some View {
        NavigationView {
            List {
                // MARK: - Header
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "mic.fill")
                                .font(.system(size: 32))
                                .foregroundColor(.blue)
                                .frame(width: 56, height: 56)
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(12)

                            VStack(alignment: .leading) {
                                Text("Marco Reid Voice Keyboard")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                Text("AI-Powered Grammar Correction")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            Spacer()

                            // Status indicator
                            if keysConfigured {
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.title2)
                                    .foregroundColor(.green)
                            } else if partialKeysConfigured {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.title2)
                                    .foregroundColor(.orange)
                            } else {
                                Image(systemName: "xmark.seal.fill")
                                    .font(.title2)
                                    .foregroundColor(.red)
                            }
                        }
                        .padding(.vertical, 8)

                        if !settings.isKeyboardEnabled {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)
                                VStack(alignment: .leading) {
                                    Text("Keyboard Not Enabled")
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                    Text("Go to Settings > General > Keyboard > Keyboards > Add New Keyboard > Marco Reid Voice")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding()
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(10)
                        }

                        // API key status summary
                        if !keysConfigured {
                            HStack {
                                Image(systemName: "key.fill")
                                    .foregroundColor(.orange)
                                VStack(alignment: .leading) {
                                    Text("API Keys Required")
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                    Text(apiKeyStatusMessage)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding()
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(10)
                        }
                    }
                }

                // MARK: - Grammar AI
                Section {
                    Toggle("Auto-Correct Grammar", isOn: $settings.autoCorrectEnabled)

                    Picker("Writing Style", selection: $settings.writingStyle) {
                        Text("Professional").tag(WritingStyle.professional)
                        Text("Casual").tag(WritingStyle.casual)
                        Text("Academic").tag(WritingStyle.academic)
                        Text("Creative").tag(WritingStyle.creative)
                        Text("Technical").tag(WritingStyle.technical)
                    }

                    Toggle("Preserve My Tone", isOn: $settings.preserveTone)
                } header: {
                    Label("Grammar AI", systemImage: "brain.head.profile")
                }

                // MARK: - Voice Dictation
                Section {
                    Picker("STT Engine", selection: $settings.sttEngine) {
                        Text("Deepgram Nova-2").tag(STTEngine.deepgram)
                        Text("Apple Speech").tag(STTEngine.apple)
                    }

                    if settings.sttEngine == .deepgram {
                        SecureField("Deepgram API Key", text: $settings.deepgramApiKey)
                            .textContentType(.password)
                    }

                    Picker("Language", selection: $settings.language) {
                        Text("English").tag("en")
                        Text("Spanish").tag("es")
                        Text("French").tag("fr")
                        Text("German").tag("de")
                        Text("Portuguese").tag("pt")
                        Text("Italian").tag("it")
                        Text("Dutch").tag("nl")
                        Text("Japanese").tag("ja")
                        Text("Korean").tag("ko")
                        Text("Chinese").tag("zh")
                        Text("Arabic").tag("ar")
                        Text("Hindi").tag("hi")
                        Text("Russian").tag("ru")
                        Text("Polish").tag("pl")
                        Text("Turkish").tag("tr")
                        Text("Swedish").tag("sv")
                        Text("Norwegian").tag("no")
                        Text("Danish").tag("da")
                        Text("Finnish").tag("fi")
                        Text("Indonesian").tag("id")
                    }
                } header: {
                    Label("Voice Dictation", systemImage: "waveform")
                } footer: {
                    Text("Deepgram Nova-2 provides superior accuracy. Get your API key at console.deepgram.com")
                }

                // MARK: - AI Provider
                Section {
                    Picker("Provider", selection: $settings.aiProvider) {
                        Text("Claude (Anthropic)").tag(AIProvider.claude)
                        Text("OpenAI GPT").tag(AIProvider.openai)
                    }

                    SecureField("API Key", text: $settings.apiKey)
                        .textContentType(.password)
                } header: {
                    Label("AI Provider", systemImage: "cpu")
                }

                // MARK: - Features
                Section {
                    Toggle("Auto-Punctuation", isOn: $settings.autoPunctuation)
                    Toggle("Smart Capitalization", isOn: $settings.smartCapitalization)
                    Toggle("Emoji Suggestions", isOn: $settings.emojiSuggestions)
                } header: {
                    Label("Features", systemImage: "sparkles")
                }

                // MARK: - What's New
                Section {
                    WhatsNewRow(icon: "waveform.badge.mic", text: "Deepgram Nova-2 voice engine — 95%+ accuracy")
                    WhatsNewRow(icon: "globe", text: "20+ language support")
                    WhatsNewRow(icon: "hand.tap.fill", text: "Haptic feedback on every key")
                    WhatsNewRow(icon: "ipad.landscape", text: "iPad optimized layout")
                } header: {
                    Label("What's New", systemImage: "star.fill")
                }

                // MARK: - About
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("2.0.0")
                            .foregroundColor(.secondary)
                    }
                    Link(destination: URL(string: "https://marcoreid.com/privacy")!) {
                        HStack {
                            Image(systemName: "hand.raised.fill")
                                .foregroundColor(.blue)
                            Text("Privacy Policy")
                        }
                    }
                    Link(destination: URL(string: "https://marcoreid.com/support")!) {
                        HStack {
                            Image(systemName: "questionmark.circle.fill")
                                .foregroundColor(.blue)
                            Text("Support")
                        }
                    }
                } header: {
                    Label("About", systemImage: "info.circle")
                }
            }
            .navigationTitle("Marco Reid Voice")
        }
    }

    private var apiKeyStatusMessage: String {
        if settings.apiKey.isEmpty && settings.deepgramApiKey.isEmpty {
            return "Set your AI Provider and Deepgram API keys below to enable all features."
        } else if settings.apiKey.isEmpty {
            return "Set your AI Provider API key to enable grammar correction."
        } else {
            return "Set your Deepgram API key to enable voice dictation."
        }
    }
}

struct WhatsNewRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 24)
            Text(text)
                .font(.subheadline)
        }
    }
}

// MARK: - Enums

enum WritingStyle: String, CaseIterable {
    case professional, casual, academic, creative, technical
}

enum AIProvider: String, CaseIterable {
    case claude, openai
}

enum STTEngine: String, CaseIterable {
    case deepgram, apple
}

// MARK: - Settings Manager

class SettingsManager: ObservableObject {
    private let defaults = UserDefaults(suiteName: "group.com.marcoreid.voice")!

    @Published var isKeyboardEnabled: Bool = false
    @Published var autoCorrectEnabled: Bool {
        didSet { defaults.set(autoCorrectEnabled, forKey: "autoCorrect") }
    }
    @Published var writingStyle: WritingStyle {
        didSet { defaults.set(writingStyle.rawValue, forKey: "writingStyle") }
    }
    @Published var preserveTone: Bool {
        didSet { defaults.set(preserveTone, forKey: "preserveTone") }
    }
    @Published var aiProvider: AIProvider {
        didSet { defaults.set(aiProvider.rawValue, forKey: "aiProvider") }
    }
    @Published var apiKey: String {
        didSet { defaults.set(apiKey, forKey: "apiKey") }
    }
    @Published var autoPunctuation: Bool {
        didSet { defaults.set(autoPunctuation, forKey: "autoPunctuation") }
    }
    @Published var smartCapitalization: Bool {
        didSet { defaults.set(smartCapitalization, forKey: "smartCapitalization") }
    }
    @Published var emojiSuggestions: Bool {
        didSet { defaults.set(emojiSuggestions, forKey: "emojiSuggestions") }
    }
    @Published var sttEngine: STTEngine {
        didSet { defaults.set(sttEngine.rawValue, forKey: "sttEngine") }
    }
    @Published var deepgramApiKey: String {
        didSet { defaults.set(deepgramApiKey, forKey: "deepgramApiKey") }
    }
    @Published var language: String {
        didSet { defaults.set(language, forKey: "language") }
    }

    init() {
        self.autoCorrectEnabled = defaults.bool(forKey: "autoCorrect")
        self.writingStyle = WritingStyle(rawValue: defaults.string(forKey: "writingStyle") ?? "professional") ?? .professional
        self.preserveTone = defaults.object(forKey: "preserveTone") == nil ? true : defaults.bool(forKey: "preserveTone")
        self.aiProvider = AIProvider(rawValue: defaults.string(forKey: "aiProvider") ?? "claude") ?? .claude
        self.apiKey = defaults.string(forKey: "apiKey") ?? ""
        self.autoPunctuation = defaults.object(forKey: "autoPunctuation") == nil ? true : defaults.bool(forKey: "autoPunctuation")
        self.smartCapitalization = defaults.object(forKey: "smartCapitalization") == nil ? true : defaults.bool(forKey: "smartCapitalization")
        self.emojiSuggestions = defaults.bool(forKey: "emojiSuggestions")
        self.sttEngine = STTEngine(rawValue: defaults.string(forKey: "sttEngine") ?? "deepgram") ?? .deepgram
        self.deepgramApiKey = defaults.string(forKey: "deepgramApiKey") ?? ""
        self.language = defaults.string(forKey: "language") ?? "en"
    }
}
