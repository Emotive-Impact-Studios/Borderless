// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BorderlessMac",
    platforms: [.macOS(.v14)],
    products: [.library(name: "BorderlessCapture", targets: ["BorderlessCapture"]),
               .executable(name: "BorderlessMac", targets: ["BorderlessMac"])],
    dependencies: [
        .package(url: "https://github.com/livekit/client-sdk-swift.git", exact: "2.14.1"),
    ],
    targets: [
        .systemLibrary(name: "CBorderlessCore"),
        .target(name: "BorderlessCapture", dependencies: ["CBorderlessCore"],
                linkerSettings: [.unsafeFlags(["-Xlinker", "../core/target/debug/libborderless_core.a"])]),
        .executableTarget(name: "BorderlessMac", dependencies: ["BorderlessCapture", .product(name: "LiveKit", package: "client-sdk-swift")]),
        .testTarget(name: "BorderlessCaptureTests", dependencies: ["BorderlessCapture"])
    ], swiftLanguageModes: [.v5]
)
