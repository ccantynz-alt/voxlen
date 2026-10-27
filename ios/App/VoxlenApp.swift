import SwiftUI
import VoxlenCore
import VoxlenSecrets

@main
struct VoxlenApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(model)
                .onChange(of: scenePhase) { _, phase in
                    // Coming back from Settings is when the keyboard state changes.
                    if phase == .active { model.refresh() }
                }
        }
    }
}

@MainActor
@Observable
final class AppModel {
    private let settings = SharedSettings()

    private(set) var keyboardSeen = false
    private(set) var keyboardHasFullAccess = false
    private(set) var hasAccountToken = false
    private(set) var hasAnthropicKey = false
    var secretError: String?

    var route: FixRoute {
        didSet { settings.route = route }
    }

    var locale: FixLocale {
        didSet { settings.locale = locale }
    }

    var protectedTerms: [String] {
        didSet { settings.protectedTerms = protectedTerms }
    }

    init() {
        route = settings.route
        locale = settings.locale
        protectedTerms = settings.protectedTerms
        refresh()
    }

    func refresh() {
        keyboardSeen = settings.keyboardLastSeen != nil
        keyboardHasFullAccess = keyboardSeen && settings.keyboardHasFullAccess
        hasAccountToken = Keychain.read(.voxlenAccountToken) != nil
        hasAnthropicKey = Keychain.read(.anthropicAPIKey) != nil
    }

    var isConnected: Bool {
        switch route {
        case .account: hasAccountToken
        case .anthropicKey: hasAnthropicKey
        }
    }

    func save(_ value: String, for key: SecretKey) {
        do {
            try Keychain.write(value.trimmingCharacters(in: .whitespacesAndNewlines), for: key)
            secretError = nil
        } catch let error as KeychainError {
            secretError = "Couldn't save to the keychain (error \(error.status))."
        } catch {
            secretError = "Couldn't save to the keychain."
        }
        refresh()
    }

    func remove(_ key: SecretKey) {
        try? Keychain.delete(key)
        refresh()
    }

    func addTerm(_ term: String) {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !protectedTerms.contains(trimmed) else { return }
        protectedTerms.append(trimmed)
    }
}
