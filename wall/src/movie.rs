//! Video and audio files on the native Wall, played by the platform's own
//! decoder (AVFoundation on the Mac: hardware decoding, sound through the
//! room's output). Every Wall follows the room's shared playback state.
#[cfg(target_os = "macos")]
mod imp {
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_av_foundation::{AVPlayer, AVPlayerItem, AVPlayerItemVideoOutput};
    use objc2_core_media::CMTime;
    use objc2_core_video::{CVPixelBufferGetBaseAddress, CVPixelBufferGetBytesPerRow, CVPixelBufferGetHeight, CVPixelBufferGetWidth, CVPixelBufferLockBaseAddress, CVPixelBufferLockFlags, CVPixelBufferUnlockBaseAddress};
    use objc2_foundation::{NSDictionary, NSNumber, NSString, NSURL};

    pub struct Movie {
        player: Retained<AVPlayer>,
        item: Retained<AVPlayerItem>,
        output: Retained<AVPlayerItemVideoOutput>,
    }

    impl Movie {
        pub fn open(path: &std::path::Path) -> Option<Self> {
            let mtm = MainThreadMarker::new()?;
            let url = NSURL::fileURLWithPath(&NSString::from_str(path.to_str()?));
            // kCVPixelBufferPixelFormatTypeKey = kCVPixelFormatType_32BGRA
            let key = NSString::from_str("PixelFormatType");
            let value: Retained<AnyObject> = NSNumber::new_u32(0x4247_5241).into();
            let attributes = NSDictionary::from_retained_objects(&[&*key], &[value]);
            unsafe {
                let item = AVPlayerItem::playerItemWithURL(&url, mtm);
                let output = AVPlayerItemVideoOutput::initWithPixelBufferAttributes(AVPlayerItemVideoOutput::alloc(), Some(&attributes));
                item.addOutput(&output);
                let player = AVPlayer::playerWithPlayerItem(Some(&item), mtm);
                Some(Self { player, item, output })
            }
        }

        /// Follows the room: seek when more than half a second out, then play or
        /// pause. Returns true when it changed anything, so the Wall keeps
        /// drawing until the new frame arrives.
        pub fn follow(&self, playing: bool, position: f64) -> bool {
            let mut changed = false;
            unsafe {
                let now = self.item.currentTime().seconds();
                if !now.is_finite() || (now - position).abs() > 0.5 {
                    let zero = CMTime::with_seconds(0.0, 600);
                    self.player.seekToTime_toleranceBefore_toleranceAfter(CMTime::with_seconds(position, 600), zero, zero);
                    changed = true;
                }
                if playing && self.player.rate() == 0.0 {
                    self.player.play();
                    changed = true;
                } else if !playing && self.player.rate() != 0.0 {
                    self.player.pause();
                    changed = true;
                }
            }
            changed
        }

        /// The newest decoded frame as tightly packed BGRA, if there is a new one.
        pub fn frame(&self) -> Option<(u32, u32, Vec<u8>)> {
            unsafe {
                let time = self.item.currentTime();
                if !self.output.hasNewPixelBufferForItemTime(time) {
                    return None;
                }
                let buffer = self.output.copyPixelBufferForItemTime_itemTimeForDisplay(time, std::ptr::null_mut())?;
                if CVPixelBufferLockBaseAddress(&buffer, CVPixelBufferLockFlags::ReadOnly) != 0 {
                    return None;
                }
                let (w, h, stride) = (CVPixelBufferGetWidth(&buffer), CVPixelBufferGetHeight(&buffer), CVPixelBufferGetBytesPerRow(&buffer));
                let base = CVPixelBufferGetBaseAddress(&buffer) as *const u8;
                let mut out = Vec::with_capacity(w * h * 4);
                if !base.is_null() {
                    for row in 0..h {
                        out.extend_from_slice(std::slice::from_raw_parts(base.add(row * stride), w * 4));
                    }
                }
                CVPixelBufferUnlockBaseAddress(&buffer, CVPixelBufferLockFlags::ReadOnly);
                (out.len() == w * h * 4).then_some((w as u32, h as u32, out))
            }
        }
    }

    impl Drop for Movie {
        fn drop(&mut self) {
            unsafe { self.player.pause() };
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    /// Media Foundation (Windows) and GStreamer (Linux) players are still to build.
    pub struct Movie;
    impl Movie {
        pub fn open(_: &std::path::Path) -> Option<Self> {
            None
        }
        pub fn follow(&self, _: bool, _: f64) -> bool {
            false
        }
        pub fn frame(&self) -> Option<(u32, u32, Vec<u8>)> {
            None
        }
    }
}

pub use imp::Movie;
