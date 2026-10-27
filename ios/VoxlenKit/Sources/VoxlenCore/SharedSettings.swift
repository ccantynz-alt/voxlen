import Foundation

public enum AppGroup {
    public static let identifier = "group.com.voxlen.app"
}

/// Where grammar fixes go.
public enum FixRoute: String, CaseIterable, Codable, Sendable {
    /// Through the user's Voxlen account (voxlen.ai/api/grammar-fix).
    case account
    /// Straight to Anthropic with the user's own API key.
    case anthropicKey
}

/// Non-secret settings shared by the app and the keyboard through the App
/// Group. Secrets live in the keychain (VoxlenSecrets), never here.
///
/// The keyboard can only read and write the App Group with Full Access on;
/// without it these reads return the defaults, which is the safe behaviour.
public struct SharedSettings: @unchecked Sendable {
    // UserDefaults is documented thread-safe; @unchecked covers SDKs that do
    // not yet mark it Sendable.
    private let defaults: UserDefaults

    public init(defaults: UserDefaults? = UserDefaults(suiteName: AppGroup.identifier)) {
        self.defaults = defaults ?? .standard
    }

    enum Key {
        static let locale = "fix.locale"
        static let protectedTerms = "fix.protectedTerms"
        static let route = "fix.route"
        static let anthropicModel = "fix.anthropicModel"
        static let keyboardLastSeen = "keyboard.lastSeen"
        static let keyboardHasFullAccess = "keyboard.hasFullAccess"
    }

    public var locale: FixLocale {
        get { defaults.string(forKey: Key.locale).flatMap(FixLocale.init(rawValue:)) ?? .matching(.current) }
        nonmutating set { defaults.set(newValue.rawValue, forKey: Key.locale) }
    }

    /// Names, matter terms and defined terms the fix must never touch.
    public var protectedTerms: [String] {
        get { defaults.stringArray(forKey: Key.protectedTerms) ?? [] }
        nonmutating set { defaults.set(FixPrompt.normalizeProtectedTerms(newValue), forKey: Key.protectedTerms) }
    }

    public var route: FixRoute {
        get { defaults.string(forKey: Key.route).flatMap(FixRoute.init(rawValue:)) ?? .account }
        nonmutating set { defaults.set(newValue.rawValue, forKey: Key.route) }
    }

    /// Model for the BYOK route. The account route's model is a server setting.
    public var anthropicModel: String {
        get { defaults.string(forKey: Key.anthropicModel) ?? AnthropicFixer.defaultModel }
        nonmutating set { defaults.set(newValue, forKey: Key.anthropicModel) }
    }

    // MARK: Keyboard heartbeat

    /// Written by the keyboard each time it appears. A write needs Full
    /// Access, so a recent heartbeat proves both "enabled" and "Full Access".
    public func recordKeyboardHeartbeat(hasFullAccess: Bool, at date: Date = Date()) {
        defaults.set(date.timeIntervalSince1970, forKey: Key.keyboardLastSeen)
        defaults.set(hasFullAccess, forKey: Key.keyboardHasFullAccess)
    }

    public var keyboardLastSeen: Date? {
        let seconds = defaults.double(forKey: Key.keyboardLastSeen)
        return seconds > 0 ? Date(timeIntervalSince1970: seconds) : nil
    }

    public var keyboardHasFullAccess: Bool { defaults.bool(forKey: Key.keyboardHasFullAccess) }
}
