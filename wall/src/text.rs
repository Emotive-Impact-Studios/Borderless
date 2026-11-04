//! Text for the Wall (glyphon on wgpu). Shaped buffers are cached by content
//! and size, so a steady Wall reshapes nothing between frames.
use glyphon::{Attrs, Buffer, Cache, Color, Family, FontSystem, Metrics, Resolution, Shaping, SwashCache, TextArea, TextAtlas, TextBounds, TextRenderer, Viewport, Weight, Wrap};
use std::collections::HashMap;

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum Face {
    Sans,
    Mono,
}

#[derive(Clone, PartialEq, Eq, Hash)]
struct Key {
    text: String,
    size: u32,
    line: u32,
    weight: u16,
    width: u32,
    face: Face,
}

pub struct Label {
    key: Key,
    pub left: f32,
    pub top: f32,
    pub bounds: [f32; 4],
    pub colour: [f32; 4],
}

pub struct Text {
    fonts: FontSystem,
    swash: SwashCache,
    viewport: Viewport,
    atlas: TextAtlas,
    renderers: Vec<TextRenderer>,
    device: wgpu::Device,
    buffers: HashMap<Key, (Buffer, bool)>,
    sans: String,
}

impl Text {
    pub fn new(device: &wgpu::Device, queue: &wgpu::Queue, format: wgpu::TextureFormat) -> Self {
        let fonts = FontSystem::new();
        // The design-system font stack, but only families with real bold faces:
        // the variable system font is not split into weights by fontdb, and a
        // missing weight would fall back to an unrelated font.
        let db = fonts.db();
        let has = |name: &str, weight: u16| db.faces().any(|f| f.weight.0 == weight && f.families.iter().any(|(n, _)| n == name));
        let sans = ["SF Pro Text", "SF Pro", "Inter", "Segoe UI Variable", "Segoe UI", "Cantarell", "Noto Sans"]
            .into_iter()
            .find(|name| has(name, 400) && has(name, 600) && has(name, 700))
            .unwrap_or("sans-serif")
            .to_owned();
        let cache = Cache::new(device);
        let viewport = Viewport::new(device, &cache);
        let atlas = TextAtlas::new(device, queue, &cache, format);
        Self { fonts, swash: SwashCache::new(), viewport, atlas, renderers: Vec::new(), device: device.clone(), buffers: HashMap::new(), sans }
    }

    /// Lays out `text` within `width` pixels and returns its label and size.
    #[allow(clippy::too_many_arguments)]
    pub fn label(&mut self, text: &str, size: f32, line: f32, weight: u16, width: f32, face: Face, colour: [f32; 4]) -> (Label, f32, f32) {
        let key = Key { text: text.to_owned(), size: (size * 4.0) as u32, line: (line * 4.0) as u32, weight, width: width.max(1.0) as u32, face };
        if !self.buffers.contains_key(&key) {
            let mut buffer = Buffer::new(&mut self.fonts, Metrics::new(size, line));
            buffer.set_wrap(&mut self.fonts, Wrap::WordOrGlyph);
            buffer.set_size(&mut self.fonts, Some(width.max(1.0)), None);
            let family = match face {
                Face::Sans if self.sans == "sans-serif" => Family::SansSerif,
                Face::Sans => Family::Name(&self.sans),
                Face::Mono => Family::Monospace,
            };
            buffer.set_text(&mut self.fonts, text, &Attrs::new().family(family).weight(Weight(weight)), Shaping::Advanced);
            buffer.shape_until_scroll(&mut self.fonts, false);
            self.buffers.insert(key.clone(), (buffer, true));
        }
        let entry = self.buffers.get_mut(&key).unwrap();
        entry.1 = true;
        let (mut w, mut h) = (0.0f32, 0.0f32);
        for run in entry.0.layout_runs() {
            w = w.max(run.line_w);
            h = run.line_top + run.line_height;
        }
        (Label { key, left: 0.0, top: 0.0, bounds: [0.0, 0.0, f32::MAX, f32::MAX], colour }, w, h)
    }

    /// One text renderer per paint layer, so each window's text is drawn
    /// with that window and never shows through a window above it.
    pub fn prepare(&mut self, queue: &wgpu::Queue, width: u32, height: u32, layers: &[Vec<Label>]) {
        self.viewport.update(queue, Resolution { width, height });
        while self.renderers.len() < layers.len() {
            self.renderers.push(TextRenderer::new(&mut self.atlas, &self.device, wgpu::MultisampleState::default(), None));
        }
        for (renderer, labels) in self.renderers.iter_mut().zip(layers) {
            let areas = labels.iter().filter_map(|l| {
                let (buffer, _) = self.buffers.get(&l.key)?;
                let c = l.colour.map(|v| (v.clamp(0.0, 1.0) * 255.0) as u8);
                Some(TextArea {
                    buffer,
                    left: l.left,
                    top: l.top,
                    scale: 1.0,
                    bounds: TextBounds { left: l.bounds[0] as i32, top: l.bounds[1] as i32, right: l.bounds[2] as i32, bottom: l.bounds[3] as i32 },
                    default_color: Color::rgba(c[0], c[1], c[2], c[3]),
                    custom_glyphs: &[],
                })
            });
            if let Err(e) = renderer.prepare(&self.device, queue, &mut self.fonts, &mut self.atlas, &self.viewport, areas, &mut self.swash) {
                log::warn!("Text not prepared: {e}");
            }
        }
    }

    pub fn render(&self, layer: usize, pass: &mut wgpu::RenderPass<'_>) {
        if let Some(renderer) = self.renderers.get(layer) {
            let _ = renderer.render(&self.atlas, &self.viewport, pass);
        }
    }

    /// Drops buffers that were not used this frame.
    pub fn trim(&mut self) {
        self.buffers.retain(|_, (_, used)| std::mem::take(used));
        self.atlas.trim();
    }
}
