//! Development check only: publishes a generated, moving 1080p test pattern as
//! a screen share with a hub-issued publisher grant, so the native Wall's live
//! path can be exercised without screen capture. Not real capture.
use livekit::options::TrackPublishOptions;
use livekit::prelude::*;
use livekit::webrtc::video_frame::{I420Buffer, VideoFrame, VideoRotation};
use livekit::webrtc::video_source::native::NativeVideoSource;
use livekit::webrtc::video_source::{RtcVideoSource, VideoResolution};
use std::time::{Duration, Instant};

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (url, token) = (&args[1], &args[2]);
    let seconds: u64 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(120);
    let (room, _events) = Room::connect(url, token, RoomOptions::default()).await.expect("connect");
    let (w, h) = (1920u32, 1080u32);
    let source = NativeVideoSource::new(VideoResolution { width: w, height: h }, true);
    let track = LocalVideoTrack::create_video_track("screen", RtcVideoSource::Native(source.clone()));
    room.local_participant()
        .publish_track(LocalTrack::Video(track), TrackPublishOptions { source: TrackSource::Screenshare, ..Default::default() })
        .await
        .expect("publish");
    println!("publishing test pattern");
    let start = Instant::now();
    let mut tick = tokio::time::interval(Duration::from_micros(16_667));
    let mut n: u64 = 0;
    while start.elapsed().as_secs() < seconds {
        tick.tick().await;
        let mut buffer = I420Buffer::new(w, h);
        let (sy, su, sv) = buffer.strides();
        let (y, u, v) = buffer.data_mut();
        let bar = ((n * 12) % w as u64) as u32;
        for row in 0..h {
            for col in 0..w {
                // Diagonal gradient, a sweeping bar and a frame counter block.
                let mut value = (((col + row) / 8) % 200 + 30) as u8;
                if col >= bar && col < bar + 80 { value = 235; }
                if row < 120 && col < 120 + (n % 60) as u32 * 20 { value = 16; }
                y[(row * sy + col) as usize] = value;
            }
        }
        for row in 0..h / 2 {
            for col in 0..w / 2 {
                u[(row * su + col) as usize] = (90 + (col * 80 / (w / 2))) as u8;
                v[(row * sv + col) as usize] = (170 - (row * 80 / (h / 2))) as u8;
            }
        }
        source.capture_frame(&VideoFrame { rotation: VideoRotation::VideoRotation0, timestamp_us: 0, frame_metadata: None, buffer });
        n += 1;
    }
    room.close().await.ok();
}
