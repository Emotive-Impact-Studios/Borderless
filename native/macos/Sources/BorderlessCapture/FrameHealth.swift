import Foundation
import CBorderlessCore

public enum FrameHealth: UInt32 {
    case stopped = 0, starting = 1, receiving = 2, stale = 3, invalid = 4
    public static func evaluate(active: Bool, started: UInt64, last: UInt64,
                                frames: UInt64, now: UInt64, timeout: UInt64 = 10_000) -> FrameHealth {
        precondition(bl_core_abi_version() == 1, "Unsupported Borderless core ABI")
        return FrameHealth(rawValue: bl_capture_status(active ? 1 : 0, started, last, frames, now, timeout)) ?? .invalid
    }
}

public func monotonicMilliseconds() -> UInt64 {
    DispatchTime.now().uptimeNanoseconds / 1_000_000
}
