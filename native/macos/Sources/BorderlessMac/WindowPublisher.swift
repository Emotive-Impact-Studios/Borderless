import Foundation
import Combine
import BorderlessCapture
import BorderlessRoom
import LiveKit

/// One explicit capture, one hub-owned stream and one SDK track. The hub remains
/// authoritative; a media reconnect always asks it for a fresh grant.
@MainActor final class WindowPublisher: ObservableObject {
    @Published private(set) var status = "Join a room to send your selected window"
    @Published private(set) var joined = false
    @Published private(set) var sharing = false
    @Published private(set) var busy = false
    private var hub: HubSession?
    private var mediaRoom: LiveKit.Room?
    private var mediaName: String?
    private var streamID: String?
    private var track: LocalVideoTrack?
    private var monitor: Task<Void, Never>?
    private var generation = 0
    private var stopping = false
    private weak var capture: CaptureService?

    func join(link: String, name: String, code: String) async {
        guard !busy, !sharing else { return }
        generation += 1; let attempt = generation
        busy = true; defer { if generation == attempt { busy = false } }
        hub?.close(); hub = nil; joined = false
        do {
            let address = try HubSession.address(from: link)
            let client = try HubSession(origin: address.origin, roomID: address.roomID)
            hub = client
            client.disconnected = { [weak self] in
                Task { @MainActor in await self?.lostRoom() }
            }
            client.changed = { [weak self] state in
                guard let self else { return }
                if state.ended || (self.sharing && self.streamID.map { id in !state.streams.contains { $0.id == id } } == true) {
                    Task { @MainActor in await self.lostRoom() }
                }
            }
            try await client.join(name: name, code: code)
            guard generation == attempt else { client.close(); return }
            joined = true
            status = "Connected to \(client.snapshot?.name ?? "the room")"
        } catch {
            guard generation == attempt else { return }
            hub?.close(); hub = nil
            status = error.localizedDescription
        }
    }

    func share(_ capture: CaptureService) async {
        guard joined, !busy, !sharing, capture.active, capture.frames > 0, let hub else { return }
        generation += 1; let attempt = generation
        busy = true; sharing = true; self.capture = capture
        status = "Sending selected window…"
        do {
            let id = try await hub.startStream(title: "\(hub.snapshot?.name ?? "Borderless") · Mac window")
            guard generation == attempt else { try? await hub.stopStream(id); return }
            streamID = id
            try await connect(id: id, hub: hub, attempt: attempt)
            guard generation == attempt else { return }
            busy = false
            status = "Publishing to the Wall · receiver playback not yet confirmed"
            monitor = Task { [weak self] in
                while !Task.isCancelled {
                    do {
                        try await Task.sleep(for: .seconds(2))
                        guard let self, self.generation == attempt else { return }
                        guard capture.active else { self.monitor = nil; await self.stop(); return }
                        try await self.connect(id: id, hub: hub, attempt: attempt)
                    } catch {
                        guard let self, self.generation == attempt, !Task.isCancelled else { return }
                        self.monitor = nil // Do not cancel this task before its Stop request.
                        await self.stop()
                        self.status = "Sharing ended: \(error.localizedDescription)"
                        return
                    }
                }
            }
        } catch {
            guard generation == attempt else { return }
            await stop()
            hub.close(); self.hub = nil; joined = false
            status = "Could not share: \(error.localizedDescription)"
        }
    }

    private func connect(id: String, hub: HubSession, attempt: Int) async throws {
        let grant = try await hub.media(id)
        guard generation == attempt else { return }
        guard grant.publisher else { throw HubError.message("The hub did not authorise publishing.") }
        guard let url = URL(string: grant.url), ["wss", "ws"].contains(url.scheme ?? ""),
              url.user == nil, url.password == nil,
              url.scheme == "wss" || ["127.0.0.1", "localhost", "[::1]"].contains(url.host ?? "") else {
            throw HubError.message("The hub returned an insecure media address.")
        }
        if mediaName == grant.room, mediaRoom?.connectionState == .connected { return }
        let old = mediaRoom, oldTrack = track
        capture?.setFrameConsumer(nil)
        mediaRoom = nil; mediaName = nil; track = nil
        await old?.disconnect()
        try? await oldTrack?.stop()
        guard generation == attempt else { return }
        // A retired SDK room owns its track/transceiver lifecycle. A new
        // authorised media generation gets a fresh track, seeded from real capture.
        let track = LocalVideoTrack.createBufferTrack(options: BufferCaptureOptions(fps: 60))
        self.track = track
        try await track.start()
        guard generation == attempt else { try? await track.stop(); return }
        if let capturer = track.capturer as? BufferCapturer {
            capture?.setFrameConsumer { sample in capturer.capture(sample) }
        }
        let room = LiveKit.Room()
        mediaRoom = room
        try await room.connect(url: grant.url, token: grant.token)
        guard generation == attempt else { await room.disconnect(); return }
        _ = try await room.localParticipant.publish(videoTrack: track,
            options: VideoPublishOptions(
                screenShareEncoding: VideoEncoding(maxBitrate: 8_000_000, maxFps: 60),
                simulcast: false, preferredCodec: .h264))
        guard generation == attempt else { await room.disconnect(); return }
        mediaName = grant.room
    }

    func stop() async {
        guard !stopping else { return }
        stopping = true; busy = true
        defer { stopping = false; busy = false }
        generation += 1
        monitor?.cancel(); monitor = nil
        let oldHub = hub, id = streamID, room = mediaRoom, video = track, wasSharing = sharing
        streamID = nil; mediaRoom = nil; mediaName = nil; track = nil
        sharing = false
        capture?.setFrameConsumer(nil)
        if wasSharing && id == nil {
            oldHub?.close(); hub = nil; joined = false
        }
        // Retire the room concurrently with local/SDK teardown: a slow OS stop
        // must not delay removal at the receivers.
        let selectedCapture = capture
        let localStop = Task { await selectedCapture?.stop() }
        let mediaStop = Task { await room?.disconnect(); try? await video?.stop() }
        if let id, let oldHub {
            do { try await oldHub.stopStream(id) }
            catch {
                // Closing the owning connection also retires its stream. Never
                // leave a possibly active advertisement after a failed Stop.
                oldHub.close(); joined = false; hub = nil
                await localStop.value; await mediaStop.value
                status = "Local sharing stopped; room disconnected while confirming Stop"
                return
            }
        }
        await localStop.value; await mediaStop.value
        status = joined ? "Sharing stopped" : "Room disconnected"
    }

    private func lostRoom() async {
        joined = false
        await stop()
        hub?.close(); hub = nil
        status = "Room connection ended. Join again to share."
    }
}
