import SwiftUI

@main
struct VoxApp: App {
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

    var body: some View {
        NavigationView {
            List {
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
                                Text("Vox Keyboard")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                Text("AI-Powered Grammar Correction")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
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
                                    Text("Go to Settings > General > Keyboard > Keyboards > Add New Keyboard > Vox")
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

                Section("Grammar AI") {
                    Toggle("Auto-Correct Grammar", isOn: $settings.autoCorrectEnabled)

                    Picker("Writing Style", selection: $settings.writingStyle) {
                        Text("Professional").tag(WritingStyle.professional)
                        Text("Casual").tag(WritingStyle.casual)
                        Text("Academic").tag(WritingStyle.academic)
                        Text("Creative").tag(WritingStyle.creative)
                        Text("Technical").tag(WritingStyle.technical)
                    }

                    Toggle("Preserve My Tone", isOn: $settings.preserveTone)
                }

                Section("AI Provider") {
                    Picker("Provider", selection: $settings.aiProvider) {
                        Text("Claude (Anthropic)").tag(AIProvider.claude)
                        Text("OpenAI GPT").tag(AIProvider.openai)
                    }

                    SecureField("API Key", text: $settings.apiKey)
                        .textContentType(.password)
                }

                Section("Features") {
                    Toggle("Auto-Punctuation", isOn: $settings.autoPunctuation)
                    Toggle("Smart Capitalization", isOn: $settings.smartCapitalization)
                    Toggle("Emoji Suggestions", isOn: $settings.emojiSuggestions)
                }

                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    Link("Privacy Policy", destination: URL(string: "https://vox.app/privacy")!)
                    Link("Support", destination: URL(string: "https://vox.app/support")!)
                }
            }
            .navigationTitle("Vox")
        }
    }
}

enum WritingStyle: String, CaseIterable {
    case professional, casual, academic, creative, technical
}

enum AIProvider: String, CaseIterable {
    case claude, openai
}

class SettingsManager: ObservableObject {
    private let defaults = UserDefaults(suiteName: "group.com.vox.keyboard")!

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

    init() {
        self.autoCorrectEnabled = defaults.bool(forKey: "autoCorrect")
        self.writingStyle = WritingStyle(rawValue: defaults.string(forKey: "writingStyle") ?? "professional") ?? .professional
        self.preserveTone = defaults.object(forKey: "preserveTone") == nil ? true : defaults.bool(forKey: "preserveTone")
        self.aiProvider = AIProvider(rawValue: defaults.string(forKey: "aiProvider") ?? "claude") ?? .claude
        self.apiKey = defaults.string(forKey: "apiKey") ?? ""
        self.autoPunctuation = defaults.object(forKey: "autoPunctuation") == nil ? true : defaults.bool(forKey: "autoPunctuation")
        self.smartCapitalization = defaults.object(forKey: "smartCapitalization") == nil ? true : defaults.bool(forKey: "smartCapitalization")
        self.emojiSuggestions = defaults.bool(forKey: "emojiSuggestions")
    }
}
