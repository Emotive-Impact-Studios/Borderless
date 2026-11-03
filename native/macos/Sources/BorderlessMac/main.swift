import SwiftUI
import AVFoundation
import BorderlessCapture

struct Preview: NSViewRepresentable {
    let layer: AVSampleBufferDisplayLayer
    func makeNSView(context: Context) -> NSView {
        let view = NSView(); view.wantsLayer = true; view.layer = layer; return view
    }
    func updateNSView(_ nsView: NSView, context: Context) {}
}

@main struct BorderlessMacApp: App {
    @StateObject private var capture = CaptureService()
    var body: some Scene {
        WindowGroup("Borderless · Native capture") {
            VStack(spacing: 0) {
                HStack {
                    Text("Borderless").font(.headline)
                    Spacer()
                    Button("Choose source…") { capture.chooseSource() }
                    Button("Stop sharing") { Task { await capture.stop() } }.disabled(!capture.active)
                }.padding()
                Preview(layer: capture.preview).frame(minWidth: 640, minHeight: 360)
                    .background(Color.black)
                HStack { Text(capture.status).font(.callout); Spacer() }.padding([.horizontal, .top])
                HStack {
                    Text("Diagnostics · \(capture.diagnostics.summary)")
                        .font(.caption.monospaced()).textSelection(.enabled)
                    Spacer()
                }.padding([.horizontal, .bottom])
                Text("Native adapter verification · local preview only · no room transmission yet")
                    .font(.caption).foregroundStyle(.secondary).padding(.bottom)
            }.onDisappear { Task { await capture.stop() } }
        }
    }
}
