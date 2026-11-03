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
    @StateObject private var publisher = WindowPublisher()
    @State private var joining = false
    @State private var roomLink = ""
    @State private var participantName = "Mac"
    @State private var roomCode = ""
    var body: some Scene {
        WindowGroup("Borderless · Native capture") {
            VStack(spacing: 0) {
                HStack {
                    Text("Borderless").font(.headline)
                    Spacer()
                    Button(publisher.joined ? "Room connected" : "Join room…") { joining = true }
                        .disabled(publisher.busy || publisher.sharing)
                    Menu("Choose window…") {
                        Button("Window list…") { Task { await capture.chooseWindowFromList() } }
                        Button("macOS picker…") { capture.chooseSource() }
                    }.disabled(publisher.sharing)
                    Button("Stop sharing") { Task { await publisher.stop(); await capture.stop() } }
                        .disabled(!capture.active && !publisher.sharing)
                }.padding()
                Preview(layer: capture.preview).frame(minWidth: 640, minHeight: 360)
                    .background(Color.black)
                HStack { Text(capture.status).font(.callout); Spacer() }.padding([.horizontal, .top])
                HStack {
                    Text("Diagnostics · \(capture.diagnostics.summary)")
                        .font(.caption.monospaced()).textSelection(.enabled)
                    Spacer()
                }.padding([.horizontal, .bottom])
                HStack {
                    Text(publisher.status).font(.callout).foregroundStyle(.secondary)
                    Spacer()
                    Button("Send to Wall") { Task { await publisher.share(capture) } }
                        .buttonStyle(.borderedProminent)
                        .disabled(!publisher.joined || publisher.sharing || publisher.busy || !capture.active || capture.frames == 0)
                }.padding(BL.Space.s5)
            }.sheet(isPresented: $joining) {
                Form {
                    Text("Join the room").font(.headline)
                    TextField("Room invitation link", text: $roomLink)
                    TextField("Your name", text: $participantName)
                    SecureField("Room code", text: $roomCode)
                    Text(publisher.status).foregroundStyle(.secondary)
                    HStack {
                        Button("Cancel") { joining = false }.disabled(publisher.busy)
                        Button("Join room") {
                            Task {
                                await publisher.join(link: roomLink, name: participantName, code: roomCode)
                                if publisher.joined { roomCode = ""; joining = false }
                            }
                        }.disabled(publisher.busy || roomLink.isEmpty || roomCode.isEmpty || participantName.isEmpty)
                    }
                }.padding(BL.Space.s6)
            }.sheet(isPresented: $capture.choosingWindow, onDismiss: { capture.cancelWindowSelection() }) {
                Form {
                    Text("Choose a window").font(.headline)
                    Text("Only the selected window will appear in this local preview.")
                        .foregroundStyle(.secondary)
                    List(capture.availableWindows) { window in
                        Button {
                            Task { await capture.selectWindow(window.id) }
                        } label: {
                            VStack(alignment: .leading) {
                                Text(window.title)
                                Text(window.application).font(.caption).foregroundStyle(.secondary)
                            }
                        }.buttonStyle(.plain)
                    }
                    Button("Cancel") { capture.cancelWindowSelection() }.keyboardShortcut(.cancelAction)
                }.padding()
            }.onChange(of: capture.active) { _, active in
                if !active && publisher.sharing { Task { await publisher.stop() } }
            }.onDisappear { Task { await publisher.stop(); await capture.stop() } }
        }
    }
}
