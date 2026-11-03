// Real on-screen timestamp fixture for optical/software capture measurements.
// This draws an ordinary macOS window; it never injects frames into Borderless.
import AppKit

final class ClockView: NSView {
    override var isFlipped: Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        NSColor.white.setFill(); bounds.fill()
        let ms = UInt64(Date().timeIntervalSince1970 * 1000)
        let cell: CGFloat = 18, left: CGFloat = 36, top: CGFloat = 100
        NSColor.red.setFill(); NSRect(x: left, y: top, width: cell * 3, height: 60).fill()
        for bit in 0..<48 {
            ((ms >> (47 - bit)) & 1 == 1 ? NSColor.white : NSColor.black).setFill()
            NSRect(x: left + CGFloat(bit + 3) * cell, y: top, width: cell, height: 60).fill()
        }
        NSColor.blue.setFill(); NSRect(x: left + 51 * cell, y: top, width: cell * 3, height: 60).fill()
        let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedSystemFont(ofSize: 34, weight: .medium), .foregroundColor: NSColor.black]
        "Borderless real-window latency fixture".draw(at: NSPoint(x: left, y: 28), withAttributes: attributes)
        "\(ms) ms · source paint time".draw(at: NSPoint(x: left, y: 205), withAttributes: attributes)
        "ScreenCaptureKit → LiveKit → Tauri".draw(at: NSPoint(x: left, y: 265), withAttributes: attributes)
        let x = CGFloat(ms % 2000) / 2000 * (bounds.width - 100)
        NSColor.systemPurple.setFill(); NSRect(x: x, y: 340, width: 100, height: 100).fill()
    }
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let window = NSWindow(contentRect: NSRect(x: 80, y: 100, width: 1280, height: 720), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
window.title = "Borderless latency source"
let view = ClockView(frame: window.contentView!.bounds)
view.autoresizingMask = [.width, .height]
window.contentView = view
let timer = Timer(timeInterval: 1.0 / 60, repeats: true) { _ in view.needsDisplay = true }
RunLoop.main.add(timer, forMode: .common)
window.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)
app.run()
