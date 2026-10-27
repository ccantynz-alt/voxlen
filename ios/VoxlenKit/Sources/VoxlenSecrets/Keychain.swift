import Foundation
import Security

/// Secrets shared by the app and its keyboard through the App Group's
/// keychain access group. Nothing secret ever goes in App Group defaults.
public enum SecretKey: String, CaseIterable, Sendable {
    /// Voxlen account token (voxlen.ai), used for the account route.
    case voxlenAccountToken = "voxlen.accountToken"
    /// The user's own Anthropic API key, for the BYOK route.
    case anthropicAPIKey = "anthropic.apiKey"
}

public struct KeychainError: Error, Equatable, Sendable {
    public let status: OSStatus
}

public enum Keychain {
    static let service = "com.voxlen.app.secrets"
    static let accessGroup = "group.com.voxlen.app"

    public static func read(_ key: SecretKey) -> String? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Stores `value`, or deletes the item when `value` is empty.
    public static func write(_ value: String, for key: SecretKey) throws {
        guard !value.isEmpty else { return try delete(key) }
        let data = Data(value.utf8)
        let query = baseQuery(key)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var add = query
            add[kSecValueData as String] = data
            // The keyboard runs while the phone is unlocked; the item never
            // leaves this device in a backup.
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let added = SecItemAdd(add as CFDictionary, nil)
            guard added == errSecSuccess else { throw KeychainError(status: added) }
        } else if status != errSecSuccess {
            throw KeychainError(status: status)
        }
    }

    public static func delete(_ key: SecretKey) throws {
        let status = SecItemDelete(baseQuery(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainError(status: status) }
    }

    private static func baseQuery(_ key: SecretKey) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
        // The simulator has no provisioned access groups: querying one there
        // fails with errSecMissingEntitlement.
        #if !targetEnvironment(simulator)
        query[kSecAttrAccessGroup as String] = accessGroup
        #endif
        return query
    }
}
