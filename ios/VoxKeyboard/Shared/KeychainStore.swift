import Foundation
import Security

/// Shared secret storage for the container app + keyboard extension.
/// Items are stored in the app-group keychain access group so both targets
/// read the same values — replacing the previous plaintext App Group
/// UserDefaults storage for API keys.
/// NOTE: when assembling the Xcode project, add this file to BOTH the
/// VoxApp and VoxKeyboardExtension targets.
enum KeychainStore {
    private static let service = "com.voxlen.app.keys"
    private static let accessGroup = "group.com.voxlen.app"

    static func get(_ key: String) -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ value: String, for key: String) {
        if value.isEmpty {
            delete(key)
            return
        }
        let data = Data(value.utf8)
        let query = baseQuery(for: key)
        let attributes: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    static func delete(_ key: String) {
        SecItemDelete(baseQuery(for: key) as CFDictionary)
    }

    /// One-time migration of a plaintext UserDefaults secret into the keychain.
    /// Safe to call on every launch: no-ops once the keychain has a value.
    static func migrate(_ key: String, from defaults: UserDefaults?) {
        guard get(key) == nil,
              let legacy = defaults?.string(forKey: key), !legacy.isEmpty else { return }
        set(legacy, for: key)
        defaults?.removeObject(forKey: key)
    }

    private static func baseQuery(for key: String) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        // The simulator has no provisioned access groups; querying one there
        // fails with errSecMissingEntitlement.
        #if !targetEnvironment(simulator)
        query[kSecAttrAccessGroup as String] = accessGroup
        #endif
        return query
    }
}
