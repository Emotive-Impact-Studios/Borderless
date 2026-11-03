// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BorderlessMac",
    platforms: [.macOS(.v14)],
    products: [.library(name: "BorderlessCapture", targets: ["BorderlessCapture"]),
               .executable(name: "BorderlessMac", targets: ["BorderlessMac"])],
    targets: [
        .systemLibrary(name: "CBorderlessCore"),
        .target(name: "BorderlessCapture", dependencies: ["CBorderlessCore"],
                linkerSettings: [.unsafeFlags(["-Xlinker", "../core/target/debug/libborderless_core.a"])]),
        .executableTarget(name: "BorderlessMac", dependencies: ["BorderlessCapture"]),
        .testTarget(name: "BorderlessCaptureTests", dependencies: ["BorderlessCapture"])
    ], swiftLanguageModes: [.v5]
)
