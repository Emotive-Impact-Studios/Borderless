import AppKit
import AVFoundation
import ScreenCaptureKit

/// Counts every callback before filtering, so a zero-frame capture shows where frames stop.
/// Counts only: never pixels, window titles or content.
public struct CaptureDiagnostics: Equatable, Sendable {
    public var callbacks: UInt64 = 0
    public var otherOutputs: UInt64 = 0
    public var invalidBuffers: UInt64 = 0
    public var missingStatus: UInt64 = 0
    public var missingImage: UInt64 = 0
    public var statuses: [String: UInt64] = [:]
    public init() {}
    public var summary: String {
        let byStatus = statuses.keys.sorted().map { "\($0) \(statuses[$0]!)" }.joined(separator: ", ")
        return "callbacks \(callbacks) · statuses [\(byStatus.isEmpty ? "none" : byStatus)] · invalid \(invalidBuffers) · no status \(missingStatus) · no image \(missingImage) · other outputs \(otherOutputs)"
    }
}

func frameStatusName(_ status: SCFrameStatus?) -> String {
    switch status {
    case .complete: return "complete"
    case .idle: return "idle"
    case .blank: return "blank"
    case .suspended: return "suspended"
    case .started: return "started"
    case .stopped: return "stopped"
    default: return "unknown"
    }
}

/// Latest-frame mailbox bounds retained pixel buffers to one, regardless of UI speed.
/// Future encoder integration consumes frames on this boundary without serialising pixels to JSON.
private final class FrameMailbox: NSObject, SCStreamOutput {
    private let lock = NSLock()
    private var latest: CMSampleBuffer?
    private var count: UInt64 = 0
    private var last: UInt64 = 0
    private var diagnostics = CaptureDiagnostics()
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        lock.lock(); defer { lock.unlock() }
        diagnostics.callbacks &+= 1
        guard type == .screen else { diagnostics.otherOutputs &+= 1; return }
        guard sampleBuffer.isValid else { diagnostics.invalidBuffers &+= 1; return }
        guard let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
              let value = attachments.first?[.status] as? Int else { diagnostics.missingStatus &+= 1; return }
        let status = SCFrameStatus(rawValue: value)
        diagnostics.statuses[frameStatusName(status), default: 0] &+= 1
        guard status == .complete else { return }
        guard let image = sampleBuffer.imageBuffer,
              CVPixelBufferGetWidth(image) > 0, CVPixelBufferGetHeight(image) > 0 else { diagnostics.missingImage &+= 1; return }
        latest = sampleBuffer
        count &+= 1
        last = monotonicMilliseconds()
    }
    func take() -> (CMSampleBuffer?, UInt64, UInt64, CaptureDiagnostics) {
        lock.lock(); defer { lock.unlock() }
        let result = (latest, count, last, diagnostics)
        latest = nil
        return result
    }
}

public struct CaptureWindow: Identifiable {
    public let id: CGWindowID
    public let application: String
    public let title: String
}

/// Reusable native capture adapter. No network transmission or virtual display is implied.
@MainActor public final class CaptureService: NSObject, ObservableObject, SCContentSharingPickerObserver, SCStreamDelegate {
    @Published public private(set) var status = "Choose a window to share"
    @Published public private(set) var frames: UInt64 = 0
    @Published public private(set) var active = false
    /// Typed state for room integration. Never parse `status`, which is display text.
    @Published public private(set) var health: FrameHealth = .stopped
    /// True when capture ended because no complete frame arrived before the deadline.
    @Published public private(set) var failed = false
    @Published public private(set) var diagnostics = CaptureDiagnostics()
    public let preview = AVSampleBufferDisplayLayer()
    private var stream: SCStream?
    private var mailbox: FrameMailbox?
    private var timer: Timer?
    private var started: UInt64 = 0
    private var generation: UInt64 = 0
    private let queue = DispatchQueue(label: "studio.emotive.borderless.capture", qos: .userInteractive)
    @Published public var choosingWindow = false
    @Published public private(set) var availableWindows: [CaptureWindow] = []
    private var sourceWindows: [CGWindowID: SCWindow] = [:]
    private var sourceRequest: UInt64 = 0

    public override init() {
        super.init()
        preview.videoGravity = .resizeAspect
        SCContentSharingPicker.shared.add(self)
    }

    public func chooseSource() {
        cancelWindowSelection()
        let picker = SCContentSharingPicker.shared
        var configuration = SCContentSharingPickerConfiguration()
        configuration.allowedPickerModes = [.singleWindow, .singleDisplay]
        configuration.allowsChangingSelectedContent = false
        picker.defaultConfiguration = configuration
        picker.isActive = true
        status = "Select a window in the macOS sharing picker"
        // Enter window selection directly rather than its intermediate menu.
        picker.present(using: .window)
    }

    /// Alternative native source selection for systems where the sharing picker
    /// does not respond. macOS permission is still mandatory; no capture starts
    /// until the person selects a window from the menu.
    public func chooseWindowFromList() async {
        sourceRequest &+= 1
        let request = sourceRequest
        guard CGPreflightScreenCaptureAccess() else {
            status = "Window list needs Screen Recording access for Borderless Native in System Settings"
            return
        }
        status = "Finding available windows…"
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            guard request == sourceRequest else { return }
            let windows = content.windows.filter {
                $0.windowLayer == 0 && $0.owningApplication != nil &&
                $0.owningApplication?.processID != ProcessInfo.processInfo.processIdentifier &&
                $0.frame.width > 0 && $0.frame.height > 0
            }.sorted { ($0.owningApplication?.applicationName ?? "") < ($1.owningApplication?.applicationName ?? "") }
            guard !windows.isEmpty else { status = "Open a window in another app, then try again"; return }
            sourceWindows = Dictionary(uniqueKeysWithValues: windows.map { ($0.windowID, $0) })
            availableWindows = windows.map {
                CaptureWindow(id: $0.windowID, application: $0.owningApplication?.applicationName ?? "Application",
                              title: $0.title.flatMap { $0.isEmpty ? nil : $0 } ?? "Untitled window")
            }
            status = "Choose a window to preview locally"
            choosingWindow = true
        } catch {
            guard request == sourceRequest else { return }
            status = "Windows unavailable: \(error.localizedDescription)"
        }
    }

    public func selectWindow(_ id: CGWindowID) async {
        guard choosingWindow, let window = sourceWindows[id], CGPreflightScreenCaptureAccess() else { return }
        cancelWindowSelection()
        await start(filter: SCContentFilter(desktopIndependentWindow: window), fromPicker: false)
    }

    public func cancelWindowSelection() {
        sourceRequest &+= 1
        choosingWindow = false
        availableWindows = []
        sourceWindows = [:]
    }

    public func stop() async {
        cancelWindowSelection()
        _ = await endCapture(deactivatePicker: true)
    }

    private func endCapture(deactivatePicker: Bool) async -> UInt64 {
        generation &+= 1
        let token = generation
        timer?.invalidate(); timer = nil
        let previous = stream
        stream = nil; mailbox = nil; active = false; health = .stopped
        if deactivatePicker { SCContentSharingPicker.shared.isActive = false }
        preview.flushAndRemoveImage()
        status = "Sharing stopped"
        if let previous { try? await previous.stopCapture() }
        return token
    }

    private func start(filter: SCContentFilter, fromPicker: Bool = true) async {
        guard fromPicker ? SCContentSharingPicker.shared.isActive : CGPreflightScreenCaptureAccess() else { return }
        // The picker owns the selected filter's authorisation. Keep it active
        // while replacing the previous capture; deactivation invalidates that grant.
        let token = await endCapture(deactivatePicker: !fromPicker)
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
            stream = capture; mailbox = sink; frames = 0; failed = false; diagnostics = CaptureDiagnostics()
            started = monotonicMilliseconds(); active = true; health = .starting; status = "Starting capture…"
            SCContentSharingPicker.shared.isActive = fromPicker
            try await capture.startCapture()
            guard token == generation else { try? await capture.stopCapture(); return }
            timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 15.0, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.refresh() }
            }
        } catch {
            guard token == generation else { return }
            let stoppedGeneration = await endCapture(deactivatePicker: true)
            guard stoppedGeneration == generation else { return }
            status = "Capture could not start: \(error.localizedDescription)"
        }
    }

    private func refresh() {
        guard active, let mailbox else { return }
        let (sample, count, last, counts) = mailbox.take()
        frames = count
        diagnostics = counts
        let current = FrameHealth.evaluate(active: active, started: started, last: last, frames: count, now: monotonicMilliseconds())
        health = current
        switch current {
        case .receiving: status = "Receiving native frames · \(count)"
        case .starting: status = "Waiting for the first frame…"
        case .stale where count == 0:
            // Connected without a complete frame is a capture failure (PRD F03), not a live share.
            let timedOutGeneration = generation
            timer?.invalidate(); timer = nil
            Task { @MainActor [weak self] in
                guard let self, self.generation == timedOutGeneration, self.active else { return }
                let stoppedGeneration = await self.endCapture(deactivatePicker: true)
                guard stoppedGeneration == self.generation else { return }
                self.failed = true
                self.health = .stale
                self.status = "Capture failed: no complete frames within 10 seconds"
            }
            return
        case .stale: status = "No recent frame · source may be idle or unavailable"
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
            let stoppedGeneration = await self.endCapture(deactivatePicker: true)
            guard stoppedGeneration == self.generation else { return }
            self.status = "Source stopped: \(error.localizedDescription)"
        }
    }
}
