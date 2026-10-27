import Foundation

/// Reads files under the repository's shared/ directory, the contract the
/// Swift and TypeScript sides are both tested against.
enum SharedFixtures {
    static let repoRoot: URL = {
        var url = URL(fileURLWithPath: #filePath)
        // Tests/VoxlenCoreTests/SharedFixtures.swift → ios/VoxlenKit → repo root
        for _ in 0..<5 { url.deleteLastPathComponent() }
        return url
    }()

    static func data(_ path: String) throws -> Data {
        try Data(contentsOf: repoRoot.appendingPathComponent(path))
    }
}
