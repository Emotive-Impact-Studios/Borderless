//! Borderless native Wall (milestone 2N). A full-screen wgpu renderer that
//! follows the hub's room state. It has no authority of its own.
mod model;
mod render;
mod room;
mod text;
mod tokens;

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
    target: room::Target,
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
        let text = self.text.as_mut().unwrap();
        let pictures = &self.pictures;
        let (shapes, layers, labels, placed, animating) = scene(&self.room, &self.status, &self.glides, &|id| pictures.contains_key(id), self.tokens.radius_window, text, &theme, w, h, now);
        let renderer = self.renderer.as_mut().unwrap();
        text.prepare(&renderer.queue, w as u32, h as u32, &labels);
        let layer_pictures: Vec<Option<&render::Picture>> = placed
            .iter()
            .map(|p| {
                p.as_ref().and_then(|(id, clip, radius)| {
                    let picture = self.pictures.get(id)?;
                    renderer.place(picture, *clip, *radius, 1.0);
                    Some(picture)
                })
            })
            .collect();
        let globals = Globals { size: [w, h], scale: h / 1080.0, time: now.duration_since(self.started).as_secs_f32(), wall: theme.wall, wash_a: theme.wash_a, wash_b: theme.wash_b, grid: theme.grid };
        let text_ref = &*text;
        if let Err(e) = renderer.frame(globals, &shapes, &layers, &layer_pictures, !animating, &mut |i, pass| text_ref.render(i, pass)) {
            log::warn!("Frame skipped: {e}");
        }
        text.trim();
        if animating {
            window.request_redraw();
        }
    }
}

/// Shapes, their paint layers (one per window, then the Wall's own chrome),
/// each layer's text, and whether anything is still moving.
type Frame = (Vec<Shape>, Vec<std::ops::Range<u32>>, Vec<Vec<Label>>, Vec<Option<(String, [f32; 4], f32)>>, bool);

/// Builds one frame's shapes and labels in paint order, following the
/// design-system window anatomy: content, then the glass ornament below it.
#[allow(clippy::too_many_arguments)]
fn scene(room: &Room, status: &str, glides: &HashMap<String, Glide>, loaded: &dyn Fn(&str) -> bool, radius_token: f32, text: &mut Text, theme: &Theme, w: f32, h: f32, now: Instant) -> Frame {
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
                picture = Some((asset_id.clone(), [x, y, sw, ch], radius));
            }
            Kind::File { mime, .. } => {
                let kind = if mime.starts_with("image/") { "Image" } else if mime == "application/pdf" { "PDF" } else if mime.starts_with("video/") { "Video" } else { "File" };
                put(text, kind, 22.0 * scale, 28.0 * scale, 600, Face::Sans, theme.ink_muted, y + ch / 2.0 - 14.0 * scale);
            }
            Kind::Live => {
                put(text, "Connecting live window…", 22.0 * scale, 28.0 * scale, 600, Face::Sans, theme.ink_muted, y + ch / 2.0 - 14.0 * scale);
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
        layers.push(first..shapes.len() as u32);
        texts.push(labels);
        pictures.push(picture);
    }
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
        let proxy = self.proxy.clone();
        self.ask = Some(room::run(self.options.target.clone(), move |e| {
            let _ = proxy.send_event(e);
        }));
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
            }
            RoomEvent::Status(s) => self.status = s,
            RoomEvent::Picture(p) => {
                if let Some(r) = &self.renderer {
                    let picture = r.upload(p.width, p.height, &p.rgba);
                    self.pictures.insert(p.asset, picture);
                }
            }
            RoomEvent::Live(_) => {}
        }
        if let Some(w) = &self.window {
            w.request_redraw();
        }
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::KeyboardInput { event, .. } if event.state == ElementState::Pressed && event.logical_key == Key::Named(NamedKey::Escape) && self.options.windowed => event_loop.exit(),
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
    let link = value("--pair").or_else(|| value("--room")).unwrap_or_else(|| {
        eprintln!("Usage: borderless-wall --pair <Wall invitation link> [--display N] [--windowed]\n       borderless-wall --room <Wall link> [--display N] (reuses this Wall's saved session)");
        std::process::exit(2);
    });
    let mut target = room::target(&link).unwrap_or_else(|e| {
        eprintln!("{e}");
        std::process::exit(2);
    });
    if value("--room").is_some() {
        target.pair = None;
    }
    let options = Options { target, display: value("--display").and_then(|v| v.parse().ok()), windowed: args.iter().any(|a| a == "--windowed") };
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
    };
    event_loop.run_app(&mut app).expect("Wall event loop");
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
