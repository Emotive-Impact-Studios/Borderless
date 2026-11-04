//! Live windows on the native Wall through the LiveKit Rust SDK. The hub issues
//! a view-only grant per live window and per Wall; this module joins with it,
//! takes the screen-share track and hands the newest decoded frame to the
//! renderer. libwebrtc decodes H.264 with VideoToolbox on the Mac; frames are
//! converted to I420 planes and turned into colour on the GPU.
use futures_util::StreamExt;
use livekit::prelude::*;
use livekit::webrtc::video_frame::native::VideoFrameBufferExt;
use livekit::webrtc::video_frame::{I420Buffer, VideoBuffer};
use livekit::webrtc::video_stream::native::NativeVideoStream;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};

/// One decoded frame as three tightly packed planes.
pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub y: Vec<u8>,
    pub u: Vec<u8>,
    pub v: Vec<u8>,
}

#[derive(Default)]
pub struct Slot {
    pub frame: Option<Frame>,
    pub state: String,
    pub frames: u64,
}

pub type Shared = Arc<Mutex<Slot>>;
/// Asks the hub for a view grant to one live window.
pub type GrantFn = Arc<dyn Fn(&str) -> Result<Grant, String> + Send + Sync>;

pub struct Grant {
    pub url: String,
    pub token: String,
}

fn pack(i420: &I420Buffer) -> (u32, u32, Vec<u8>, Vec<u8>, Vec<u8>) {
    let (w, h) = (i420.width(), i420.height());
    let (cw, ch) = (i420.chroma_width(), i420.chroma_height());
    let (sy, su, sv) = i420.strides();
    let (dy, du, dv) = i420.data();
    let plane = |data: &[u8], stride: u32, width: u32, height: u32| {
        let mut out = Vec::with_capacity((width * height) as usize);
        for row in 0..height as usize {
            let start = row * stride as usize;
            out.extend_from_slice(&data[start..start + width as usize]);
        }
        out
    };
    (w, h, plane(dy, sy, w, h), plane(du, su, cw, ch), plane(dv, sv, cw, ch))
}

/// Keeps one LiveKit connection per live window on the Wall.
pub struct Media {
    runtime: tokio::runtime::Runtime,
    live: HashMap<String, (Shared, tokio::task::JoinHandle<()>)>,
}

impl Media {
    pub fn new() -> Self {
        let runtime = tokio::runtime::Builder::new_multi_thread().worker_threads(2).enable_all().build().expect("media runtime");
        Self { runtime, live: HashMap::new() }
    }

    pub fn slot(&self, stream: &str) -> Option<Shared> {
        self.live.get(stream).map(|(s, _)| s.clone())
    }

    /// Starts or stops connections so they match the room's live windows.
    /// `grant` asks the hub for a view grant (blocking HTTP, run off the UI thread).
    pub fn sync(&mut self, streams: &[String], grant: GrantFn, wake: Arc<dyn Fn() + Send + Sync>) {
        self.live.retain(|id, (_, task)| {
            let keep = streams.contains(id);
            if !keep {
                task.abort();
            }
            keep
        });
        for id in streams {
            if self.live.contains_key(id) {
                continue;
            }
            let slot: Shared = Arc::new(Mutex::new(Slot { state: "Connecting".into(), ..Default::default() }));
            let (task_slot, stream, grant, wake) = (slot.clone(), id.clone(), grant.clone(), wake.clone());
            let task = self.runtime.spawn(async move {
                loop {
                    let set = |s: &str| {
                        task_slot.lock().unwrap().state = s.into();
                        wake();
                    };
                    let g = {
                        let (grant, stream) = (grant.clone(), stream.clone());
                        tokio::task::spawn_blocking(move || grant(&stream)).await.unwrap_or_else(|_| Err("Media unavailable".into()))
                    };
                    let g = match g {
                        Ok(g) => g,
                        Err(e) => {
                            set(&e);
                            tokio::time::sleep(Duration::from_secs(5)).await;
                            continue;
                        }
                    };
                    // Single-layer Wall feed: keep it subscribed at full quality.
                    let mut options = RoomOptions::default();
                    options.adaptive_stream = false;
                    options.auto_subscribe = true;
                    let (room, mut events) = match Room::connect(&g.url, &g.token, options).await {
                        Ok(r) => r,
                        Err(e) => {
                            log::warn!("Live window unavailable: {e}");
                            set("Reconnecting");
                            tokio::time::sleep(Duration::from_secs(3)).await;
                            continue;
                        }
                    };
                    set("Waiting for source");
                    while let Some(event) = events.recv().await {
                        match event {
                            RoomEvent::TrackSubscribed { track: RemoteTrack::Video(track), publication, .. } if publication.source() == TrackSource::Screenshare => {
                                let (slot, wake) = (task_slot.clone(), wake.clone());
                                tokio::spawn(async move {
                                    let mut frames = NativeVideoStream::new(track.rtc_track());
                                    while let Some(frame) = frames.next().await {
                                        let buffer = frame.buffer.as_ref();
                                        let packed = if let Some(i420) = buffer.as_i420() {
                                            pack(i420)
                                        } else if let Some(native) = buffer.as_native() {
                                            pack(&native.to_i420())
                                        } else {
                                            continue;
                                        };
                                        let (width, height, y, u, v) = packed;
                                        {
                                            let mut s = slot.lock().unwrap();
                                            s.frame = Some(Frame { width, height, y, u, v });
                                            s.frames += 1;
                                            s.state = "Live".into();
                                        }
                                        wake();
                                    }
                                });
                            }
                            RoomEvent::TrackUnsubscribed { .. } => set("Waiting for source"),
                            RoomEvent::TrackMuted { .. } => set("Paused at source"),
                            RoomEvent::Disconnected { .. } => break,
                            _ => {}
                        }
                    }
                    let _ = room.close().await;
                    set("Reconnecting");
                    tokio::time::sleep(Duration::from_secs(3)).await;
                }
            });
            self.live.insert(id.clone(), (slot, task));
        }
    }
}
