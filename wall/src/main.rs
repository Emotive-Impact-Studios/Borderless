//! Borderless native Wall (milestone 2N). A full-screen wgpu renderer that
//! follows the hub's room state. It has no authority of its own.
mod arrival;
mod media;
mod model;
mod render;
mod room;
mod text;
mod tokens;

use arrival::Arrivals;
use model::{Kind, Room, Surface};
use render::{Globals, Renderer, Shape};
use room::RoomEvent;
use std::{collections::HashMap, sync::Arc, time::Instant};
use text::{Face, Label, Text};
use tokens::{Rgba, Theme, Tokens};
use winit::{
    application::ApplicationHandler,
    event::{ElementState, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop, EventLoopProxy},
    keyboard::{Key, NamedKey},
    window::{Fullscreen, Window, WindowId},
};

const GLIDE_MS: f32 = 400.0;

struct Glide {
    from: [f32; 4],
    to: [f32; 4],
    started: Instant,
}

/// cubic-bezier(0.45, 0, 0.2, 1): the design system's glide easing.
fn glide(t: f32) -> f32 {
    let (x1, y1, x2, y2) = (0.45f32, 0.0f32, 0.2f32, 1.0f32);
    let bez = |a: f32, b: f32, s: f32| 3.0 * (1.0 - s) * (1.0 - s) * s * a + 3.0 * (1.0 - s) * s * s * b + s * s * s;
    let (mut lo, mut hi) = (0.0f32, 1.0f32);
    for _ in 0..24 {
        let mid = (lo + hi) / 2.0;
        if bez(x1, x2, mid) < t {
            lo = mid
        } else {
            hi = mid
        }
    }
    bez(y1, y2, (lo + hi) / 2.0)
}

struct Options {
    target: Option<room::Target>,
    display: Option<usize>,
    windowed: bool,
}

struct App {
    options: Options,
    proxy: EventLoopProxy<RoomEvent>,
    window: Option<Arc<Window>>,
    renderer: Option<Renderer>,
    text: Option<Text>,
    tokens: Tokens,
    room: Room,
    status: String,
    glides: HashMap<String, Glide>,
    started: Instant,
    pictures: HashMap<String, render::Picture>,
    requested: std::collections::HashSet<String>,
    ask: Option<std::sync::mpsc::Sender<String>>,
    arrivals: Arrivals,
    loaded: bool,
    /// On-screen pairing: the pasted invitation and any message.
    pairing: Option<(String, String)>,
    command_key: bool,
    media: media::Media,
    session: Option<Arc<room::Session>>,
    /// Each live window's newest frame on the GPU, and its connection state.
    videos: HashMap<String, Option<render::Video>>,
    live_state: HashMap<String, String>,
    /// Live frames shown since the last rate report (logged at info level).
    shown: (u32, Instant),
}

fn mix(a: Rgba, b: Rgba, t: f32) -> Rgba {
    std::array::from_fn(|i| a[i] + (b[i] - a[i]) * t)
}

fn current_rect(glides: &HashMap<String, Glide>, s: &Surface, now: Instant) -> ([f32; 4], bool) {
    match glides.get(&s.id) {
        Some(g) => {
            let t = (now.duration_since(g.started).as_secs_f32() * 1000.0 / GLIDE_MS).min(1.0);
            let k = glide(t);
            (std::array::from_fn(|i| g.from[i] + (g.to[i] - g.from[i]) * k), t < 1.0)
        }
        None => (s.rect, false),
    }
}

impl App {
    fn connect(&mut self, t: room::Target) {
        room::remember(&t, self.options.display);
        let proxy = self.proxy.clone();
        self.ask = Some(room::run(t, move |e| {
            let _ = proxy.send_event(e);
        }));
    }

    /// Keys on the pairing screen: paste, clear and confirm. Nothing else.
    fn pairing_key(&mut self, key: &Key) {
        let Some((input, message)) = &mut self.pairing else { return };
        match key {
            Key::Character(c) if self.command_key && c.eq_ignore_ascii_case("v") => {
                match arboard::Clipboard::new().and_then(|mut c| c.get_text()) {
                    Ok(text) => *input = text.trim().chars().take(2048).collect(),
                    Err(_) => *message = "Nothing to paste. Copy the Wall invitation first.".into(),
                }
            }
            Key::Named(NamedKey::Backspace) | Key::Named(NamedKey::Delete) => input.clear(),
            // Choose the screen: 1 is the main display, 2 the next, and so on.
            Key::Character(c) if !self.command_key && c.len() == 1 && ("1"..="9").contains(&c.as_str()) => {
                let index = c.parse::<usize>().unwrap_or(1) - 1;
                if let Some(window) = &self.window {
                    let monitors: Vec<_> = window.available_monitors().collect();
                    match monitors.get(index) {
                        Some(m) => {
                            if !self.options.windowed {
                                window.set_fullscreen(Some(Fullscreen::Borderless(Some(m.clone()))));
                            }
                            self.options.display = Some(index);
                            *message = format!("This Wall will open on screen {}. Paste the invitation, then press Return.", index + 1);
                        }
                        None => *message = format!("There are {} screens. Press a number from 1 to {}.", monitors.len(), monitors.len()),
                    }
                }
            }
            Key::Named(NamedKey::Enter) => match room::target(input) {
                Ok(t) => {
                    self.pairing = None;
                    self.connect(t);
                }
                Err(e) => *message = e,
            },
            _ => {}
        }
    }

    /// Keeps one media connection per live window the Wall may show.
    fn sync_media(&mut self) {
        let Some(session) = self.session.clone() else { return };
        let ids: Vec<String> = self.room.surfaces.iter().filter(|s| matches!(s.kind, Kind::Live)).map(|s| s.id.clone()).collect();
        let csrf = self.room.csrf.clone();
        let proxy = self.proxy.clone();
        self.media.sync(&ids, Arc::new(move |id| session.media_grant(id, &csrf)), Arc::new(move || {
            let _ = proxy.send_event(RoomEvent::Frame);
        }));
        self.videos.retain(|id, _| ids.contains(id));
        self.live_state.retain(|id, _| ids.contains(id));
    }

    fn apply(&mut self, next: Room) {
        let now = Instant::now();
        let reduced = std::env::var_os("BORDERLESS_REDUCED_MOTION").is_some();
        for s in &next.surfaces {
            if let Some(old) = self.room.surfaces.iter().find(|o| o.id == s.id) {
                if old.rect != s.rect && !reduced {
                    let (from, _) = current_rect(&self.glides, old, now);
                    self.glides.insert(s.id.clone(), Glide { from, to: s.rect, started: now });
                }
            }
        }
        self.glides.retain(|id, _| next.surfaces.iter().any(|s| &s.id == id));
        // New windows arrive with the design-system arrival; a phone throw's
        // window is carried in by the vortex from its spark. The first
        // snapshot after connecting is the existing Wall, not an arrival.
        if self.loaded {
            let wall = self.renderer.as_ref().map(|r| [r.config.width as f32, r.config.height as f32]).unwrap_or([1920.0, 1080.0]);
            for s in next.surfaces.iter().filter(|s| !self.room.surfaces.iter().any(|o| o.id == s.id)) {
                self.arrivals.landed(&s.id, &s.owner_id, &s.title, wall, now, reduced);
            }
        }
        self.loaded = true;
        // Ask for each new room image once; drop images no longer on the Wall.
        let wanted: std::collections::HashSet<String> = next
            .surfaces
            .iter()
            .filter_map(|s| match &s.kind {
                Kind::File { asset_id, mime, .. } if mime.starts_with("image/") => Some(asset_id.clone()),
                _ => None,
            })
            .collect();
        for id in &wanted {
            if self.requested.insert(id.clone()) {
                if let Some(ask) = &self.ask {
                    let _ = ask.send(id.clone());
                }
            }
        }
        self.pictures.retain(|id, _| wanted.contains(id));
        self.requested.retain(|id| wanted.contains(id));
        self.room = next;
    }

    fn draw(&mut self) {
        let Some(window) = self.window.clone() else { return };
        let now = Instant::now();
        let theme = self.tokens.theme(self.room.theme.as_deref());
        let (w, h) = {
            let c = &self.renderer.as_ref().unwrap().config;
            (c.width as f32, c.height as f32)
        };
        let reduced = std::env::var_os("BORDERLESS_REDUCED_MOTION").is_some();
        let effects = self.arrivals.tidy(now, reduced);
        // Upload only the newest frame of each live window; older ones were superseded.
        for s in self.room.surfaces.iter().filter(|s| matches!(s.kind, Kind::Live)) {
            let Some(slot) = self.media.slot(&s.id) else { continue };
            let (frame, state) = {
                let mut slot = slot.lock().unwrap();
                (slot.frame.take(), slot.state.clone())
            };
            self.live_state.insert(s.id.clone(), state);
            if let (Some(frame), Some(renderer)) = (frame, &self.renderer) {
                renderer.video_frame(self.videos.entry(s.id.clone()).or_insert(None), &frame);
                self.shown.0 += 1;
            }
        }
        let videos = &self.videos;
        let live_state = &self.live_state;
        let text = self.text.as_mut().unwrap();
        let pictures = &self.pictures;
        let view = View { video: &|id| videos.get(id).is_some_and(Option::is_some), live_state, room: &self.room, status: &self.status, glides: &self.glides, arrivals: &self.arrivals, reduced, loaded: &|id| pictures.contains_key(id), radius_token: self.tokens.radius_window, epoch: self.started };
        let (shapes, layers, labels, placed, moving) = match &self.pairing {
            Some((input, message)) => pairing_scene(input, message, text, &theme, w, h),
            None => scene(&view, text, &theme, w, h, now),
        };
        let animating = moving || effects;
        let renderer = self.renderer.as_mut().unwrap();
        text.prepare(&renderer.queue, w as u32, h as u32, &labels);
        // Live windows are marked "video:<id>" in the scene's per-layer media.
        let layer_pictures: Vec<Option<&render::Picture>> = placed
            .iter()
            .map(|p| {
                p.as_ref().filter(|(id, ..)| !id.starts_with("video:")).and_then(|(id, clip, radius, opacity)| {
                    let picture = self.pictures.get(id)?;
                    renderer.place(picture, *clip, *radius, *opacity);
                    Some(picture)
                })
            })
            .collect();
        let layer_videos: Vec<Option<&render::Video>> = placed
            .iter()
            .map(|p| {
                p.as_ref().and_then(|(id, clip, radius, opacity)| {
                    let video = self.videos.get(id.strip_prefix("video:")?)?.as_ref()?;
                    renderer.place_video(video, *clip, *radius, *opacity);
                    Some(video)
                })
            })
            .collect();
        let globals = Globals { size: [w, h], scale: h / 1080.0, time: now.duration_since(self.started).as_secs_f32(), wall: theme.wall, wash_a: theme.wash_a, wash_b: theme.wash_b, grid: theme.grid };
        let text_ref = &*text;
        if let Err(e) = renderer.frame(globals, &shapes, &layers, &layer_pictures, &layer_videos, !animating, &mut |i, pass| text_ref.render(i, pass)) {
            log::warn!("Frame skipped: {e}");
        }
        text.trim();
        let elapsed = self.shown.1.elapsed().as_secs_f32();
        if elapsed >= 5.0 {
            if self.shown.0 > 0 {
                log::info!("Live frames shown: {:.1} per second", self.shown.0 as f32 / elapsed);
            }
            self.shown = (0, Instant::now());
        }
        if animating {
            window.request_redraw();
        }
    }
}

/// Shapes, their paint layers (one per window, then the Wall's own chrome),
/// each layer's text, and whether anything is still moving.
type Frame = (Vec<Shape>, Vec<std::ops::Range<u32>>, Vec<Vec<Label>>, Vec<Option<(String, [f32; 4], f32, f32)>>, bool);

/// Everything the scene reads, besides text layout and the look.
struct View<'a> {
    video: &'a dyn Fn(&str) -> bool,
    live_state: &'a HashMap<String, String>,
    room: &'a Room,
    status: &'a str,
    glides: &'a HashMap<String, Glide>,
    arrivals: &'a Arrivals,
    reduced: bool,
    loaded: &'a dyn Fn(&str) -> bool,
    radius_token: f32,
    epoch: Instant,
}

/// Builds one frame's shapes and labels in paint order, following the
/// design-system window anatomy: content, then the glass ornament below it.
#[allow(clippy::too_many_arguments)]
fn scene(v: &View<'_>, text: &mut Text, theme: &Theme, w: f32, h: f32, now: Instant) -> Frame {
    let (room, status, glides, loaded, radius_token) = (v.room, v.status, v.glides, v.loaded, v.radius_token);
    let scale = h / 1080.0;
    let mut shapes = Vec::new();
    let mut layers: Vec<std::ops::Range<u32>> = Vec::new();
    let mut texts: Vec<Vec<Label>> = Vec::new();
    let mut pictures = Vec::new();
    let mut animating = false;
    let radius = radius_token * scale;
    let glass_edge = [1.0, 1.0, 1.0, if theme.dark { 0.12 } else { 0.55 }];
    // Until the backdrop blur pass lands, glass is drawn more opaque and
    // without a shadow underneath, which would otherwise show through it grey.
    let mut glass = theme.glass;
    glass[3] = glass[3].max(if theme.dark { 0.72 } else { 0.82 });
    for s in &room.surfaces {
        let first = shapes.len() as u32;
        let mut labels = Vec::new();
        let mut picture = None;
        let (r, moving) = current_rect(glides, s, now);
        animating |= moving;
        let owner = theme.owner(&s.owner_id, s.colour.as_deref());
        let (x, y, sw, sh) = (r[0] * w, r[1] * h, r[2] * w, r[3] * h);
        let ornament_h = 36.0 * scale;
        let gap = 8.0 * scale;
        let ch = (sh - ornament_h - gap).max(24.0 * scale);
        let live = matches!(s.kind, Kind::Live);
        let fill = if matches!(s.kind, Kind::Note { .. }) { mix(theme.surface, owner, 0.07) } else { theme.surface };
        shapes.push(Shape { rect: [x, y, sw, ch], fill, ring: if live { owner } else { [0.0; 4] }, params: [radius, if live { 2.5 * scale } else { 0.0 }, 0.16, 28.0 * scale] });
        let pad = 32.0 * scale;
        let inner = (sw - pad * 2.0).max(1.0);
        let clip = [x, y, x + sw, y + ch];
        let mut put = |text: &mut Text, value: &str, size: f32, line: f32, weight: u16, face: Face, colour: Rgba, top: f32| -> f32 {
            let (mut label, _, lh) = text.label(value, size, line, weight, inner, face, colour);
            label.left = x + pad;
            label.top = top;
            label.bounds = clip;
            labels.push(label);
            lh
        };
        match &s.kind {
            Kind::Note { text: body } => {
                shapes.push(Shape { rect: [x, y + radius * 0.5, 6.0 * scale, ch - radius], fill: owner, ring: [0.0; 4], params: [3.0 * scale, 0.0, 0.0, 0.0] });
                let mut top = y + pad;
                top += put(text, &s.title, 44.0 * scale, 52.0 * scale, 700, Face::Sans, theme.ink, top) + 12.0 * scale;
                put(text, body, 28.0 * scale, 38.0 * scale, 400, Face::Sans, theme.ink, top);
            }
            Kind::Link { url, host, site, description, pending } => {
                shapes.push(Shape { rect: [x + radius * 0.5, y, sw - radius, 4.0 * scale], fill: owner, ring: [0.0; 4], params: [2.0 * scale, 0.0, 0.0, 0.0] });
                let mut top = y + pad;
                let site_line = if site.is_empty() { host.clone() } else { format!("{site} · {host}") };
                top += put(text, &site_line, 18.0 * scale, 24.0 * scale, 400, Face::Sans, theme.ink_muted, top) + 8.0 * scale;
                let title = if *pending { "Opening preview…" } else { s.title.as_str() };
                top += put(text, title, 44.0 * scale, 52.0 * scale, 700, Face::Sans, if *pending { theme.ink_muted } else { theme.ink }, top) + 8.0 * scale;
                if !description.is_empty() {
                    top += put(text, description, 18.0 * scale, 24.0 * scale, 400, Face::Sans, theme.ink_muted, top) + 8.0 * scale;
                }
                put(text, url, 18.0 * scale, 24.0 * scale, 500, Face::Mono, theme.accent, top);
            }
            Kind::File { mime, asset_id, .. } if mime.starts_with("image/") && loaded(asset_id) => {
                picture = Some((asset_id.clone(), [x, y, sw, ch], radius, 1.0));
            }
            Kind::File { mime, .. } => {
                let kind = if mime.starts_with("image/") { "Image" } else if mime == "application/pdf" { "PDF" } else if mime.starts_with("video/") { "Video" } else { "File" };
                put(text, kind, 22.0 * scale, 28.0 * scale, 600, Face::Sans, theme.ink_muted, y + ch / 2.0 - 14.0 * scale);
            }
            Kind::Live => {
                let state = v.live_state.get(&s.id).map(String::as_str).unwrap_or("Connecting");
                if (v.video)(&s.id) {
                    picture = Some((format!("video:{}", s.id), [x, y, sw, ch], radius, 1.0));
                }
                if state != "Live" {
                    // Paused, reconnecting or waiting: say so over the last frame.
                    let (mut l, lw, _) = text.label(state, 22.0 * scale, 28.0 * scale, 600, inner, Face::Sans, theme.ink);
                    let pill = [x + (sw - lw) / 2.0 - 16.0 * scale, y + ch / 2.0 - 22.0 * scale, lw + 32.0 * scale, 44.0 * scale];
                    shapes.push(Shape { rect: pill, fill: glass, ring: glass_edge, params: [22.0 * scale, 1.0, 0.0, 0.0] });
                    l.left = pill[0] + 16.0 * scale;
                    l.top = pill[1] + 8.0 * scale;
                    l.bounds = clip;
                    labels.push(l);
                }
            }
        }
        // Ornament: glass capsule under the window with title and owner.
        let (mut tl, tw, _) = text.label(&s.title, 20.0 * scale, 24.0 * scale, 600, sw * 0.7, Face::Sans, theme.ink);
        let (mut ol, ow_text, _) = text.label(&s.owner_name, 20.0 * scale, 24.0 * scale, 400, sw * 0.3, Face::Sans, theme.ink_muted);
        let ow = (tw + ow_text + 40.0 * scale).min(sw);
        let (ox, oy) = (x + (sw - ow) / 2.0, y + ch + gap);
        shapes.push(Shape { rect: [ox, oy, ow, ornament_h], fill: glass, ring: glass_edge, params: [ornament_h / 2.0, 1.0, 0.0, 0.0] });
        let ty = oy + (ornament_h - 24.0 * scale) / 2.0;
        let bounds = [ox, oy, ox + ow, oy + ornament_h];
        tl.left = ox + 16.0 * scale;
        tl.top = ty;
        tl.bounds = bounds;
        ol.left = tl.left + tw + 8.0 * scale;
        ol.top = ty;
        ol.bounds = bounds;
        labels.push(tl);
        labels.push(ol);
        // Arrival: fade and settle the whole window around its centre.
        let (opacity, grow) = v.arrivals.appearance(&s.id, now, v.reduced);
        if opacity < 1.0 || grow != 1.0 {
            let (cx, cy) = (x + sw / 2.0, y + sh / 2.0);
            let at = |px: f32, py: f32| (cx + (px - cx) * grow, cy + (py - cy) * grow);
            for shape in &mut shapes[first as usize..] {
                let (nx, ny) = at(shape.rect[0], shape.rect[1]);
                shape.rect = [nx, ny, shape.rect[2] * grow, shape.rect[3] * grow];
                shape.fill[3] *= opacity;
                shape.ring[3] *= opacity;
                shape.params[2] *= opacity;
            }
            for label in &mut labels {
                let (nx, ny) = at(label.left, label.top);
                label.left = nx;
                label.top = ny;
                let (b0, b1) = at(label.bounds[0], label.bounds[1]);
                let (b2, b3) = at(label.bounds[2], label.bounds[3]);
                label.bounds = [b0, b1, b2, b3];
                label.colour[3] *= opacity;
            }
            if let Some(p) = &mut picture {
                let (nx, ny) = at(p.1[0], p.1[1]);
                p.1 = [nx, ny, p.1[2] * grow, p.1[3] * grow];
                p.3 = opacity;
            }
        }
        layers.push(first..shapes.len() as u32);
        texts.push(labels);
        pictures.push(picture);
    }
    // Phone throws: sparks with real progress, vortex particles, ripples.
    let first = shapes.len() as u32;
    let mut labels = Vec::new();
    effects(v, text, theme, w, h, now, &mut shapes, &mut labels, glass, glass_edge);
    layers.push(first..shapes.len() as u32);
    texts.push(labels);
    pictures.push(None);
    let first = shapes.len() as u32;
    let mut labels = Vec::new();
    if room.surfaces.is_empty() {
        let (mut heading, hw, _) = text.label("Room for everyone's work.", 56.0 * scale, 64.0 * scale, 700, w, Face::Sans, theme.ink);
        heading.left = (w - hw) / 2.0;
        heading.top = h / 2.0 - 48.0 * scale;
        labels.push(heading);
        let (mut sub, subw, _) = text.label("Send a file or live window to the Wall.", 22.0 * scale, 28.0 * scale, 400, w, Face::Sans, theme.ink_muted);
        sub.left = (w - subw) / 2.0;
        sub.top = h / 2.0 + 28.0 * scale;
        labels.push(sub);
    }
    // Room card, bottom right: name and connection; fades when the Wall is busy.
    let (name, nw, _) = text.label(&room.name, 18.0 * scale, 22.0 * scale, 600, 600.0 * scale, Face::Sans, theme.ink);
    let (state, stw, _) = text.label(status, 15.0 * scale, 20.0 * scale, 400, 600.0 * scale, Face::Sans, theme.ink_muted);
    let cw = nw.max(stw) + 32.0 * scale;
    let card = [w - cw - 24.0 * scale, h - 76.0 * scale, cw, 52.0 * scale];
    let busy = room.surfaces.len() >= 3;
    let mut card_fill = glass;
    if busy {
        card_fill[3] *= 0.4;
    }
    shapes.push(Shape { rect: card, fill: card_fill, ring: glass_edge, params: [16.0 * scale, 1.0, 0.0, 0.0] });
    for (mut l, top) in [(name, card[1] + 6.0 * scale), (state, card[1] + 28.0 * scale)] {
        l.left = card[0] + 16.0 * scale;
        l.top = top;
        if busy {
            l.colour[3] *= 0.4;
        }
        labels.push(l);
    }
    layers.push(first..shapes.len() as u32);
    texts.push(labels);
    pictures.push(None);
    (shapes, layers, texts, pictures, animating)
}

impl ApplicationHandler<RoomEvent> for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }
        let monitors: Vec<_> = event_loop.available_monitors().collect();
        let monitor = self.options.display.and_then(|i| monitors.get(i).cloned()).or_else(|| event_loop.primary_monitor());
        let mut attributes = Window::default_attributes().with_title("Borderless Wall");
        if self.options.windowed {
            attributes = attributes.with_inner_size(winit::dpi::LogicalSize::new(1280.0, 720.0));
            if let Some(m) = &monitor {
                attributes = attributes.with_position(m.position());
            }
        } else {
            attributes = attributes.with_fullscreen(Some(Fullscreen::Borderless(monitor)));
        }
        let window = Arc::new(event_loop.create_window(attributes).expect("Wall window"));
        window.set_cursor_visible(self.options.windowed);
        let renderer = pollster::block_on(Renderer::new(window.clone())).expect("GPU renderer");
        self.text = Some(Text::new(&renderer.device, &renderer.queue, renderer.config.format));
        self.renderer = Some(renderer);
        self.window = Some(window.clone());
        match self.options.target.clone() {
            Some(t) => self.connect(t),
            None => self.pairing = Some((String::new(), "Paste the Wall invitation from the leader's Console (⌘V or Ctrl+V), then press Return. Press 1, 2 or 3 to choose the screen.".into())),
        }
        window.request_redraw();
    }

    fn user_event(&mut self, _: &ActiveEventLoop, event: RoomEvent) {
        match event {
            RoomEvent::State(room) => {
                if room.ended {
                    self.status = "This room has ended.".into();
                    self.apply(Room { surfaces: vec![], ..room });
                } else {
                    self.apply(room);
                }
                self.sync_media();
            }
            RoomEvent::Status(s) => self.status = s,
            RoomEvent::Picture(p) => {
                if let Some(r) = &self.renderer {
                    let picture = r.upload(p.width, p.height, &p.rgba);
                    self.pictures.insert(p.asset, picture);
                }
            }
            RoomEvent::Live(message) => self.arrivals.event(&message, Instant::now()),
            RoomEvent::Session(session) => {
                self.session = Some(session);
                self.sync_media();
            }
            RoomEvent::Frame => {}
        }
        if let Some(w) = &self.window {
            w.request_redraw();
        }
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::ModifiersChanged(m) => self.command_key = m.state().super_key() || m.state().control_key(),
            WindowEvent::KeyboardInput { event, .. } if event.state == ElementState::Pressed => {
                if event.logical_key == Key::Named(NamedKey::Escape) && self.options.windowed {
                    event_loop.exit();
                } else if self.pairing.is_some() {
                    self.pairing_key(&event.logical_key);
                    if let Some(w) = &self.window {
                        w.request_redraw();
                    }
                }
            }
            WindowEvent::Resized(size) => {
                if let Some(r) = &mut self.renderer {
                    r.resize(size.width, size.height);
                }
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }
            WindowEvent::RedrawRequested => self.draw(),
            _ => {}
        }
    }
}

fn main() {
    env_logger::init();
    let args: Vec<String> = std::env::args().skip(1).collect();
    let value = |flag: &str| args.iter().position(|a| a == flag).and_then(|i| args.get(i + 1)).cloned();
    // With no link, the Wall resumes its last room, or shows on-screen pairing.
    let (target, last_display) = match value("--pair").or_else(|| value("--room")) {
        Some(link) => {
            let mut t = room::target(&link).unwrap_or_else(|e| {
                eprintln!("{e}");
                std::process::exit(2);
            });
            if value("--room").is_some() {
                t.pair = None;
            }
            (Some(t), None)
        }
        None => match room::last() {
            Some((t, d)) => (Some(t), d),
            None => (None, None),
        },
    };
    let display = value("--display").and_then(|v| v.parse().ok()).or(last_display);
    let options = Options { target, display, windowed: args.iter().any(|a| a == "--windowed") };
    let event_loop = EventLoop::<RoomEvent>::with_user_event().build().expect("event loop");
    event_loop.set_control_flow(ControlFlow::Wait);
    let mut app = App {
        options,
        proxy: event_loop.create_proxy(),
        window: None,
        renderer: None,
        text: None,
        tokens: Tokens::load(),
        room: Room { name: "Borderless".into(), ..Default::default() },
        status: "Connecting to the room…".into(),
        glides: HashMap::new(),
        started: Instant::now(),
        pictures: HashMap::new(),
        requested: Default::default(),
        ask: None,
        arrivals: Arrivals::default(),
        loaded: false,
        pairing: None,
        command_key: false,
        media: media::Media::new(),
        session: None,
        videos: HashMap::new(),
        live_state: HashMap::new(),
        shown: (0, Instant::now()),
    };
    event_loop.run_app(&mut app).expect("Wall event loop");
}

/// The arrival effects layer, drawn above every window.
#[allow(clippy::too_many_arguments)]
fn effects(v: &View<'_>, text: &mut Text, theme: &Theme, w: f32, h: f32, now: Instant, shapes: &mut Vec<Shape>, labels: &mut Vec<Label>, glass: Rgba, glass_edge: Rgba) {
    let scale = h / 1080.0;
    let circle = |x: f32, y: f32, r: f32, colour: Rgba| Shape { rect: [x - r, y - r, r * 2.0, r * 2.0], fill: colour, ring: [0.0; 4], params: [r, 0.0, 0.0, 0.0] };
    let fade = |c: Rgba, a: f32| [c[0], c[1], c[2], c[3] * a];
    let mut ids: Vec<&String> = v.arrivals.pending.keys().collect();
    ids.sort();
    for id in ids {
        let p = &v.arrivals.pending[id];
        let owner = theme.owner(&p.owner_id, p.colour.as_deref());
        let (x, y) = (p.aim * w, 0.42 * h);
        let life = match p.leaving {
            Some(l) => 1.0 - (now.duration_since(l).as_secs_f32() / 0.4).min(1.0),
            None => 1.0,
        };
        let failed = p.failed.is_some();
        // Breathing spark (design-system bl-spark), halo first.
        let breathe = if v.reduced || failed { 1.0 } else { 1.0 + 0.25 * (1.0 + (now.duration_since(v.epoch).as_secs_f32() * std::f32::consts::TAU / 1.4).sin()) };
        for (radius, alpha) in [(30.0, 0.10), (20.0, 0.18), (12.0, 0.35)] {
            shapes.push(circle(x, y, radius * scale * breathe, fade(owner, alpha * life * if failed { 0.4 } else { 1.0 })));
        }
        shapes.push(circle(x, y, 7.0 * scale, fade(owner, life * if failed { 0.4 } else { 1.0 })));
        // Progress ring from real bytes received: 48 beads around the spark.
        if !failed {
            for i in 0..48 {
                let k = i as f32 / 48.0;
                let lit = k < p.progress;
                let a = -std::f32::consts::FRAC_PI_2 + k * std::f32::consts::TAU;
                let r = 24.0 * scale;
                shapes.push(circle(x + a.cos() * r, y + a.sin() * r, 1.6 * scale, fade(owner, life * if lit { 0.9 } else { 0.15 })));
            }
        }
        let caption = if failed { format!("{} did not arrive", p.name) } else { format!("{} · {}", p.owner_name, p.name) };
        let (mut label, lw, _) = text.label(&caption, 18.0 * scale, 24.0 * scale, 500, w * 0.4, Face::Sans, fade(theme.ink, life));
        let card = [x - (lw + 24.0 * scale) / 2.0, y + 36.0 * scale, lw + 24.0 * scale, 32.0 * scale];
        shapes.push(Shape { rect: card, fill: fade(glass, life), ring: fade(glass_edge, life), params: [10.0 * scale, 1.0, 0.0, 0.0] });
        label.left = card[0] + 12.0 * scale;
        label.top = card[1] + 4.0 * scale;
        labels.push(label);
    }
    for burst in &v.arrivals.bursts {
        let owner = theme.owner(&burst.owner_id, burst.colour.as_deref());
        let Some(s) = v.room.surfaces.iter().find(|s| s.id == burst.surface) else { continue };
        let (r, _) = current_rect(v.glides, s, now);
        let content = [r[0] * w, r[1] * h, r[2] * w, (r[3] * h - 44.0 * scale).max(24.0 * scale)];
        let elapsed = now.duration_since(burst.started).as_secs_f32() * 1000.0;
        if elapsed < arrival::VORTEX_MS {
            for particle in Arrivals::particles(burst, content, now) {
                if particle.alpha > 0.01 {
                    shapes.push(circle(particle.x, particle.y, particle.size * scale, fade(owner, particle.alpha)));
                }
            }
        }
        // Landing ripple: two rings from the window's centre (bl-ripple).
        let (cx, cy) = (content[0] + content[2] / 2.0, content[1] + content[3] / 2.0);
        for delay in [arrival::REVEAL_MS, arrival::REVEAL_MS + 140.0] {
            let t = (elapsed - delay) / 900.0;
            if (0.0..1.0).contains(&t) {
                let e = 1.0 - (1.0 - t).powi(3);
                let radius = (10.0 + 170.0 * e) * scale;
                shapes.push(Shape { rect: [cx - radius, cy - radius, radius * 2.0, radius * 2.0], fill: [0.0; 4], ring: fade(owner, 0.6 * (1.0 - t)), params: [radius, 2.0 * scale, 0.0, 0.0] });
            }
        }
    }
}

/// The Wall's own pairing screen: a glass panel on the canvas.
fn pairing_scene(input: &str, message: &str, text: &mut Text, theme: &Theme, w: f32, h: f32) -> Frame {
    let scale = h / 1080.0;
    let (pw, ph) = (880.0 * scale, 360.0 * scale);
    let (px, py) = ((w - pw) / 2.0, (h - ph) / 2.0);
    let mut glass = theme.glass;
    glass[3] = glass[3].max(0.86);
    let mut shapes = vec![Shape { rect: [px, py, pw, ph], fill: glass, ring: [1.0, 1.0, 1.0, 0.5], params: [28.0 * scale, 1.0, 0.12, 32.0 * scale] }];
    let field = [px + 48.0 * scale, py + 150.0 * scale, pw - 96.0 * scale, 64.0 * scale];
    shapes.push(Shape { rect: field, fill: theme.surface, ring: theme.accent, params: [14.0 * scale, if input.is_empty() { 0.0 } else { 2.0 * scale }, 0.0, 0.0] });
    let mut labels = Vec::new();
    let mut put = |text: &mut Text, value: &str, size: f32, weight: u16, colour: Rgba, left: f32, top: f32, width: f32| {
        let (mut l, _, _) = text.label(value, size, size * 1.3, weight, width, Face::Sans, colour);
        l.left = left;
        l.top = top;
        labels.push(l);
    };
    put(text, "Open your Wall", 44.0 * scale, 700, theme.ink, px + 48.0 * scale, py + 48.0 * scale, pw - 96.0 * scale);
    // Show where the invitation leads, never the one-use token itself.
    let shown = match room::target(input) {
        Ok(t) => format!("{}  ·  room {}{}", t.base, t.room, if t.pair.is_some() { "  ·  invitation ready" } else { "" }),
        Err(_) if input.is_empty() => "Wall invitation link".into(),
        Err(_) => "This is not a Wall invitation".into(),
    };
    put(text, &shown, 22.0 * scale, 500, if input.is_empty() { theme.ink_muted } else { theme.ink }, field[0] + 20.0 * scale, field[1] + 18.0 * scale, field[2] - 40.0 * scale);
    put(text, message, 20.0 * scale, 400, theme.ink_muted, px + 48.0 * scale, py + 250.0 * scale, pw - 96.0 * scale);
    let layers: Vec<std::ops::Range<u32>> = std::iter::once(0..shapes.len() as u32).collect();
    (shapes, layers, vec![labels], vec![None], false)
}

#[cfg(test)]
mod tests {
    #[test]
    fn glide_easing_starts_and_ends_in_place() {
        assert!(super::glide(0.0).abs() < 1e-3);
        assert!((super::glide(1.0) - 1.0).abs() < 1e-3);
        assert!(super::glide(0.5) > 0.4 && super::glide(0.5) < 0.9);
    }
}
