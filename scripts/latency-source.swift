// Real on-screen timestamp fixture for optical/software capture measurements.
// This draws an ordinary macOS window; it never injects frames into Borderless.
import AppKit
import QuartzCore

final class ClockView: NSView {
    @objc func refreshFrame() { needsDisplay = true }
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
        // Draw readable digits directly. AppKit's per-frame NSString drawing
        // crashed inside Core Text while constructing font attributes on macOS 14.
        let masks = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f]
        let segments = [NSRect(x: 4, y: 0, width: 18, height: 4),
                        NSRect(x: 22, y: 4, width: 4, height: 18),
                        NSRect(x: 22, y: 26, width: 4, height: 18),
                        NSRect(x: 4, y: 44, width: 18, height: 4),
                        NSRect(x: 0, y: 26, width: 4, height: 18),
                        NSRect(x: 0, y: 4, width: 4, height: 18),
                        NSRect(x: 4, y: 22, width: 18, height: 4)]
        NSColor.black.setFill()
        for (index, digit) in String(ms).utf8.enumerated() {
            let mask = masks[Int(digit - 48)]
            for (bit, segment) in segments.enumerated() where mask & (1 << bit) != 0 {
                segment.offsetBy(dx: left + CGFloat(index) * 34, dy: 205).fill()
            }
        }
        let x = CGFloat(ms % 2000) / 2000 * (bounds.width - 100)
        NSColor.systemPurple.setFill(); NSRect(x: x, y: 340, width: 100, height: 100).fill()
    }
}
let app = NSApplication.shared
// A fixed pixel-size window isolates steady-state delivery from macOS Space transitions.
let fixedHD = Bundle.main.object(forInfoDictionaryKey: "BorderlessFixedHD") as? Bool == true
let size = fixedHD ? NSSize(width: 1920, height: 1080) : NSSize(width: 1280, height: 720)
if fixedHD && NSScreen.screens.count < 2 {
    fatalError("The fixed HD check requires a secondary display.")
}
app.setActivationPolicy(fixedHD ? .accessory : .regular)
let origin = fixedHD ? NSScreen.screens[1].frame.origin : NSPoint(x: 80, y: 100)
let style: NSWindow.StyleMask = fixedHD ? [.borderless] : [.titled, .closable, .miniaturizable, .resizable]
let window = NSWindow(contentRect: NSRect(origin: origin, size: size), styleMask: style, backing: .buffered, defer: false)
window.title = fixedHD ? "Borderless fixed HD source" : "Borderless latency source"
let view = ClockView(frame: window.contentView!.bounds)
view.autoresizingMask = [.width, .height]
window.contentView = view
// Drive the fixture from the display refresh so an unsynchronised timer
// does not undersample the very frame cadence the receiver is measuring.
let sourceScreen = fixedHD ? NSScreen.screens[1] : (window.screen ?? NSScreen.screens[0])
if #available(macOS 14, *) {
    let link = sourceScreen.displayLink(target: view, selector: #selector(ClockView.refreshFrame))
    link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 60, preferred: 60)
    link.add(to: .main, forMode: .common)
} else {
    let timer = Timer(timeInterval: 1.0 / 60, repeats: true) { _ in view.needsDisplay = true }
    RunLoop.main.add(timer, forMode: .common)
}
if fixedHD {
    window.setFrame(NSRect(origin: origin, size: size), display: true)
    // Keep the receiver visible when both windows occupy the room display.
    window.orderBack(nil)
} else {
    window.makeKeyAndOrderFront(nil)
    app.activate(ignoringOtherApps: true)
}
app.run()
