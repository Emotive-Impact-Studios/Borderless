import AppKit
import AVFoundation
import ScreenCaptureKit

/// Latest-frame mailbox bounds retained pixel buffers to one, regardless of UI speed.
/// Future encoder integration consumes frames on this boundary without serialising pixels to JSON.
private final class FrameMailbox: NSObject, SCStreamOutput {
    private let lock = NSLock()
    private var latest: CMSampleBuffer?
    private var count: UInt64 = 0
    private var last: UInt64 = 0
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid,
              let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let value = attachments.first?[.status] as? Int,
              SCFrameStatus(rawValue: value) == .complete,
              let image = sampleBuffer.imageBuffer,
              CVPixelBufferGetWidth(image) > 0, CVPixelBufferGetHeight(image) > 0 else { return }
        lock.lock(); defer { lock.unlock() }
        latest = sampleBuffer
        count &+= 1
        last = monotonicMilliseconds()
    }
    func take() -> (CMSampleBuffer?, UInt64, UInt64) {
        lock.lock(); defer { lock.unlock() }
        let result = (latest, count, last)
        latest = nil
        return result
    }
}

/// Reusable native capture adapter. No network transmission or virtual display is implied.
@MainActor public final class CaptureService: NSObject, ObservableObject, SCContentSharingPickerObserver, SCStreamDelegate {
    @Published public private(set) var status = "Choose a window to share"
    @Published public private(set) var frames: UInt64 = 0
    @Published public private(set) var active = false
    public let preview = AVSampleBufferDisplayLayer()
    private var stream: SCStream?
    private var mailbox: FrameMailbox?
    private var timer: Timer?
    private var started: UInt64 = 0
    private var generation: UInt64 = 0
    private let queue = DispatchQueue(label: "studio.emotive.borderless.capture", qos: .userInteractive)

    public override init() {
        super.init()
        preview.videoGravity = .resizeAspect
        SCContentSharingPicker.shared.add(self)
    }

    public func chooseSource() {
        let picker = SCContentSharingPicker.shared
        var configuration = SCContentSharingPickerConfiguration()
        configuration.allowedPickerModes = [.singleWindow, .singleDisplay]
        configuration.allowsChangingSelectedContent = false
        picker.defaultConfiguration = configuration
        picker.isActive = true
        picker.present()
    }

    public func stop() async {
        _ = await endCapture(deactivatePicker: true)
    }

    private func endCapture(deactivatePicker: Bool) async -> UInt64 {
        generation &+= 1
        let token = generation
        timer?.invalidate(); timer = nil
        let previous = stream
        stream = nil; mailbox = nil; active = false
        if deactivatePicker { SCContentSharingPicker.shared.isActive = false }
        preview.flushAndRemoveImage()
        status = "Sharing stopped"
        if let previous { try? await previous.stopCapture() }
        return token
    }

    private func start(filter: SCContentFilter) async {
        guard SCContentSharingPicker.shared.isActive else { return }
        // The picker owns the selected filter's authorisation. Keep it active
        // while replacing the previous capture; deactivation invalidates that grant.
        let token = await endCapture(deactivatePicker: false)
        // Stopping the old stream yields the actor. A later Stop or selection
        // must win; never start this obsolete selection after that await.
        guard token == generation else { return }
        let configuration = SCStreamConfiguration()
        let width = max(2, min(1920, Int(filter.contentRect.width * Double(filter.pointPixelScale))))
        let ratio = filter.contentRect.height / max(1, filter.contentRect.width)
        configuration.width = width - width % 2
        let height = max(2, min(2160, Int(Double(width) * ratio)))
        configuration.height = height - height % 2
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        configuration.queueDepth = 3
        configuration.pixelFormat = kCVPixelFormatType_32BGRA
        configuration.capturesAudio = false
        configuration.showsCursor = true
        let sink = FrameMailbox()
        let capture = SCStream(filter: filter, configuration: configuration, delegate: self)
        do {
            try capture.addStreamOutput(sink, type: .screen, sampleHandlerQueue: queue)
            stream = capture; mailbox = sink; frames = 0
            started = monotonicMilliseconds(); active = true; status = "Starting capture…"
            SCContentSharingPicker.shared.isActive = true
            try await capture.startCapture()
            guard token == generation else { try? await capture.stopCapture(); return }
            timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 15.0, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.refresh() }
            }
        } catch {
            guard token == generation else { return }
            await stop()
            status = "Capture could not start: \(error.localizedDescription)"
        }
    }

    private func refresh() {
        guard active, let mailbox else { return }
        let (sample, count, last) = mailbox.take()
        frames = count
        let health = FrameHealth.evaluate(active: active, started: started, last: last, frames: count, now: monotonicMilliseconds())
        switch health {
        case .receiving: status = "Receiving native frames · \(count)"
        case .starting: status = "Waiting for the first frame…"
        case .stale: status = count == 0 ? "No frames received — stop and choose the source again" : "No recent frame — source may be idle or unavailable"
        case .stopped: status = "Sharing stopped"
        case .invalid: status = "Capture timing error"
        }
        if let sample {
            if preview.status == .failed { preview.flush() }
            if preview.isReadyForMoreMediaData { preview.enqueue(sample) }
        }
    }

    public nonisolated func contentSharingPicker(_ picker: SCContentSharingPicker, didUpdateWith filter: SCContentFilter, for stream: SCStream?) {
        Task { @MainActor [weak self] in await self?.start(filter: filter) }
    }
    public nonisolated func contentSharingPicker(_ picker: SCContentSharingPicker, didCancelFor stream: SCStream?) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            if !self.active { self.status = "Selection cancelled"; SCContentSharingPicker.shared.isActive = false }
        }
    }
    public nonisolated func contentSharingPickerStartDidFailWithError(_ error: Error) {
        Task { @MainActor [weak self] in self?.status = "Source picker unavailable: \(error.localizedDescription)" }
    }
    public nonisolated func stream(_ stream: SCStream, didStopWithError error: Error) {
        Task { @MainActor [weak self] in
            guard let self, self.stream === stream else { return }
            await self.stop()
            self.status = "Source stopped: \(error.localizedDescription)"
        }
    }
}
