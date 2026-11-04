//! Shared native geometry and frame-readiness policy. This library creates no displays.
//! C ABI v1 uses values only: no pointer ownership, allocation or unwinding across FFI.

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PointResult {
    pub x: f64,
    pub y: f64,
    pub valid: u32,
}

impl PointResult {
    const INVALID: Self = Self {
        x: 0.0,
        y: 0.0,
        valid: 0,
    };
}

#[no_mangle]
pub extern "C" fn bl_core_abi_version() -> u32 {
    1
}

/// Map a desktop point to an unrotated content UV. Bounds and point use the same
/// OS logical coordinate system (not mixed points/pixels). Rotation is clockwise.
/// Out-of-display and non-finite values fail; they must not initiate a handoff.
#[no_mangle]
pub extern "C" fn bl_display_uv(
    origin_x: f64,
    origin_y: f64,
    width: f64,
    height: f64,
    point_x: f64,
    point_y: f64,
    rotation: u32,
) -> PointResult {
    if ![origin_x, origin_y, width, height, point_x, point_y]
        .iter()
        .all(|x| x.is_finite())
        || width <= 0.0
        || height <= 0.0
    {
        return PointResult::INVALID;
    }
    let u = (point_x - origin_x) / width;
    let v = (point_y - origin_y) / height;
    if !(0.0..=1.0).contains(&u) || !(0.0..=1.0).contains(&v) {
        return PointResult::INVALID;
    }
    let (x, y) = match rotation {
        0 => (u, v),
        90 => (v, 1.0 - u),
        180 => (1.0 - u, 1.0 - v),
        270 => (1.0 - v, u),
        _ => return PointResult::INVALID,
    };
    PointResult { x, y, valid: 1 }
}

/// 0 stopped, 1 awaiting first complete frame, 2 receiving, 3 timed out/stalled,
/// 4 invalid clock/configuration. Clock is monotonic milliseconds in one process.
/// `last_frame_ms` is meaningful only when `complete_frames > 0`.
/// An idle ScreenCaptureKit source may send no new complete frames: status 3
/// means no recent complete frame, not proof that a static image is corrupt.
#[no_mangle]
pub extern "C" fn bl_capture_status(
    active: u32,
    started_ms: u64,
    last_frame_ms: u64,
    complete_frames: u64,
    now_ms: u64,
    timeout_ms: u64,
) -> u32 {
    if active == 0 {
        return 0;
    }
    if active != 1
        || timeout_ms == 0
        || now_ms < started_ms
        || (complete_frames > 0 && (last_frame_ms < started_ms || last_frame_ms > now_ms))
    {
        return 4;
    }
    let baseline = if complete_frames == 0 {
        started_ms
    } else {
        last_frame_ms
    };
    if now_ms - baseline >= timeout_ms {
        3
    } else if complete_frames == 0 {
        1
    } else {
        2
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn negative_desktop_origin_and_rotation() {
        assert_eq!(
            bl_display_uv(-1920.0, -1080.0, 1920.0, 1080.0, -1440.0, -810.0, 0),
            PointResult {
                x: 0.25,
                y: 0.25,
                valid: 1
            }
        );
        assert_eq!(
            bl_display_uv(-1920.0, 0.0, 1920.0, 1080.0, -1440.0, 270.0, 90),
            PointResult {
                x: 0.25,
                y: 0.75,
                valid: 1
            }
        );
    }
    #[test]
    fn scale_independence_when_units_match() {
        assert_eq!(
            bl_display_uv(0.0, 0.0, 1920.0, 1080.0, 960.0, 540.0, 270),
            bl_display_uv(0.0, 0.0, 3840.0, 2160.0, 1920.0, 1080.0, 270)
        );
    }
    #[test]
    fn all_rotations_have_expected_corners() {
        for (r, x, y) in [
            (0, 0.0, 0.0),
            (90, 0.0, 1.0),
            (180, 1.0, 1.0),
            (270, 1.0, 0.0),
        ] {
            assert_eq!(
                bl_display_uv(0.0, 0.0, 100.0, 50.0, 0.0, 0.0, r),
                PointResult { x, y, valid: 1 }
            );
        }
    }
    #[test]
    fn rejects_invalid_or_outside_geometry() {
        for width in [0.0, -1.0, f64::NAN, f64::INFINITY] {
            assert_eq!(bl_display_uv(0.0, 0.0, width, 100.0, 0.0, 0.0, 0).valid, 0);
        }
        assert_eq!(
            bl_display_uv(0.0, 0.0, 100.0, 100.0, 101.0, 0.0, 0).valid,
            0
        );
        assert_eq!(bl_display_uv(0.0, 0.0, 100.0, 100.0, 0.0, 0.0, 45).valid, 0);
    }
    #[test]
    fn connected_without_frames_is_not_live() {
        assert_eq!(bl_capture_status(1, 100, 0, 0, 200, 1000), 1);
        assert_eq!(bl_capture_status(1, 100, 0, 0, 1100, 1000), 3);
    }
    #[test]
    fn frame_arrival_stall_and_recovery() {
        assert_eq!(bl_capture_status(1, 100, 200, 1, 201, 1000), 2);
        assert_eq!(bl_capture_status(1, 100, 200, 1, 1200, 1000), 3);
        assert_eq!(bl_capture_status(1, 100, 1201, 2, 1201, 1000), 2);
    }
    #[test]
    fn invalid_clock_cannot_underflow() {
        assert_eq!(bl_capture_status(1, 100, 0, 0, 99, 1000), 4);
        assert_eq!(bl_capture_status(1, 100, 200, 1, 150, 1000), 4);
        assert_eq!(bl_capture_status(1, 100, 99, 1, 150, 1000), 4);
        assert_eq!(bl_capture_status(1, 100, 100, 1, 150, 0), 4);
    }
    #[test]
    fn stop_overrides_old_frames() {
        assert_eq!(bl_capture_status(0, 100, 200, 100, 900, 1000), 0);
        assert_eq!(bl_core_abi_version(), 1);
    }
}
