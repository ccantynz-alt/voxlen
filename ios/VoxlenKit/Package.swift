// swift-tools-version: 6.0
import PackageDescription

// Shared by the Voxlen app and its keyboard extension. VoxlenCore is
// Foundation-only and extension-safe, so it builds and tests on a macOS
// host with `swift test`; anything needing UIKit lives in the app targets.
let package = Package(
    name: "VoxlenKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "VoxlenCore", targets: ["VoxlenCore"]),
        .library(name: "VoxlenSecrets", targets: ["VoxlenSecrets"]),
    ],
    targets: [
        .target(name: "VoxlenCore"),
        .target(name: "VoxlenSecrets"),
        .testTarget(name: "VoxlenCoreTests", dependencies: ["VoxlenCore"]),
    ]
)
