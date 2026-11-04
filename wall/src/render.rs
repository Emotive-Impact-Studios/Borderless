//! wgpu renderer: one full-screen canvas pass and one instanced pass of
//! rounded, shadowed shapes. Metal on Mac, Direct3D 12 on Windows, Vulkan on Linux.
use std::sync::Arc;
use wgpu::util::DeviceExt;
use winit::window::Window;

#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct Shape {
    pub rect: [f32; 4],
    pub fill: [f32; 4],
    pub ring: [f32; 4],
    /// radius, ring width, shadow strength, shadow blur (pixels)
    pub params: [f32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct Globals {
    pub size: [f32; 2],
    pub scale: f32,
    pub time: f32,
    pub wall: [f32; 4],
    pub wash_a: [f32; 4],
    pub wash_b: [f32; 4],
    pub grid: [f32; 4],
}

fn bytes<T: Copy>(v: &[T]) -> &[u8] {
    // SAFETY: Shape and Globals are repr(C) plain floats with no padding holes read as uninitialised.
    unsafe { std::slice::from_raw_parts(v.as_ptr() as *const u8, std::mem::size_of_val(v)) }
}

pub struct Renderer {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    pub config: wgpu::SurfaceConfiguration,
    globals: wgpu::Buffer,
    bind: wgpu::BindGroup,
    background: wgpu::RenderPipeline,
    shapes: wgpu::RenderPipeline,
    instances: wgpu::Buffer,
    capacity: usize,
    images: wgpu::RenderPipeline,
    last_capture: std::time::Instant,
    captured: u32,
    image_layout: wgpu::BindGroupLayout,
    sampler: wgpu::Sampler,
}

/// A room image on the GPU, with its own placement uniform.
pub struct Picture {
    bind: wgpu::BindGroup,
    placement: wgpu::Buffer,
    pub width: u32,
    pub height: u32,
}

impl Renderer {
    pub async fn new(window: Arc<Window>) -> Result<Self, String> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor::default());
        let surface = instance.create_surface(window.clone()).map_err(|e| e.to_string())?;
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions { power_preference: wgpu::PowerPreference::HighPerformance, compatible_surface: Some(&surface), force_fallback_adapter: false })
            .await
            .map_err(|e| e.to_string())?;
        let (device, queue) = adapter.request_device(&wgpu::DeviceDescriptor { label: Some("Borderless Wall"), ..Default::default() }).await.map_err(|e| e.to_string())?;
        let caps = surface.get_capabilities(&adapter);
        // Blend in sRGB space like the browser front end does.
        let format = caps.formats.iter().copied().find(|f| !f.is_srgb()).unwrap_or(caps.formats[0]);
        let size = window.inner_size();
        let present_mode = if caps.present_modes.contains(&wgpu::PresentMode::Mailbox) { wgpu::PresentMode::Mailbox } else { wgpu::PresentMode::Fifo };
        let config = wgpu::SurfaceConfiguration {
            usage: if capture_path().is_some() { wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC } else { wgpu::TextureUsages::RENDER_ATTACHMENT },
            format,
            width: size.width.max(1),
            height: size.height.max(1),
            present_mode,
            desired_maximum_frame_latency: 1,
            alpha_mode: caps.alpha_modes[0],
            view_formats: vec![],
        };
        surface.configure(&device, &config);
        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some("wall"), source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()) });
        let globals = device.create_buffer(&wgpu::BufferDescriptor { label: Some("globals"), size: std::mem::size_of::<Globals>() as u64, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[wgpu::BindGroupLayoutEntry { binding: 0, visibility: wgpu::ShaderStages::VERTEX_FRAGMENT, ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None }, count: None }],
        });
        let bind = device.create_bind_group(&wgpu::BindGroupDescriptor { label: None, layout: &layout, entries: &[wgpu::BindGroupEntry { binding: 0, resource: globals.as_entire_binding() }] });
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: None, bind_group_layouts: &[&layout], push_constant_ranges: &[] });
        let image_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("picture"),
            entries: &[
                wgpu::BindGroupLayoutEntry { binding: 0, visibility: wgpu::ShaderStages::VERTEX_FRAGMENT, ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 1, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }, count: None },
                wgpu::BindGroupLayoutEntry { binding: 2, visibility: wgpu::ShaderStages::FRAGMENT, ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering), count: None },
            ],
        });
        let image_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: None, bind_group_layouts: &[&layout, &image_layout], push_constant_ranges: &[] });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor { mag_filter: wgpu::FilterMode::Linear, min_filter: wgpu::FilterMode::Linear, mipmap_filter: wgpu::FilterMode::Linear, ..Default::default() });
        let target = [Some(wgpu::ColorTargetState { format, blend: Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING), write_mask: wgpu::ColorWrites::ALL })];
        let background = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("background"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState { module: &module, entry_point: Some("bg_vs"), buffers: &[], compilation_options: Default::default() },
            fragment: Some(wgpu::FragmentState { module: &module, entry_point: Some("bg_fs"), targets: &target, compilation_options: Default::default() }),
            primitive: Default::default(),
            depth_stencil: None,
            multisample: Default::default(),
            multiview: None,
            cache: None,
        });
        let attributes = wgpu::vertex_attr_array![0 => Float32x4, 1 => Float32x4, 2 => Float32x4, 3 => Float32x4];
        let shapes = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("shapes"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &module,
                entry_point: Some("shape_vs"),
                buffers: &[wgpu::VertexBufferLayout { array_stride: std::mem::size_of::<Shape>() as u64, step_mode: wgpu::VertexStepMode::Instance, attributes: &attributes }],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState { module: &module, entry_point: Some("shape_fs"), targets: &target, compilation_options: Default::default() }),
            primitive: wgpu::PrimitiveState { topology: wgpu::PrimitiveTopology::TriangleStrip, ..Default::default() },
            depth_stencil: None,
            multisample: Default::default(),
            multiview: None,
            cache: None,
        });
        let images = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("images"),
            layout: Some(&image_pipeline_layout),
            vertex: wgpu::VertexState { module: &module, entry_point: Some("image_vs"), buffers: &[], compilation_options: Default::default() },
            fragment: Some(wgpu::FragmentState { module: &module, entry_point: Some("image_fs"), targets: &target, compilation_options: Default::default() }),
            primitive: wgpu::PrimitiveState { topology: wgpu::PrimitiveTopology::TriangleStrip, ..Default::default() },
            depth_stencil: None,
            multisample: Default::default(),
            multiview: None,
            cache: None,
        });
        let capacity = 1024;
        let instances = device.create_buffer(&wgpu::BufferDescriptor { label: Some("shapes"), size: (capacity * std::mem::size_of::<Shape>()) as u64, usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        Ok(Self { device, queue, surface, config, globals, bind, background, shapes, instances, capacity, images, last_capture: std::time::Instant::now(), captured: 0, image_layout, sampler })
    }

    /// Uploads a decoded sRGB image. Sampled as stored, matching the
    /// sRGB-space blending of the rest of the Wall.
    pub fn upload(&self, width: u32, height: u32, rgba: &[u8]) -> Picture {
        let size = wgpu::Extent3d { width, height, depth_or_array_layers: 1 };
        let texture = self.device.create_texture(&wgpu::TextureDescriptor { label: Some("picture"), size, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST, view_formats: &[] });
        self.queue.write_texture(texture.as_image_copy(), rgba, wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(width * 4), rows_per_image: Some(height) }, size);
        let placement = self.device.create_buffer(&wgpu::BufferDescriptor { label: Some("placement"), size: 48, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let view = texture.create_view(&Default::default());
        let bind = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("picture"),
            layout: &self.image_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: placement.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&view) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Sampler(&self.sampler) },
            ],
        });
        Picture { bind, placement, width, height }
    }

    /// Fits the picture inside `clip` (letterboxed) and records where it goes this frame.
    pub fn place(&self, picture: &Picture, clip: [f32; 4], radius: f32, opacity: f32) {
        let scale = (clip[2] / picture.width as f32).min(clip[3] / picture.height as f32);
        let (w, h) = (picture.width as f32 * scale, picture.height as f32 * scale);
        let dest = [clip[0] + (clip[2] - w) / 2.0, clip[1] + (clip[3] - h) / 2.0, w, h];
        let data: [f32; 12] = [dest[0], dest[1], dest[2], dest[3], clip[0], clip[1], clip[2], clip[3], radius, opacity, 0.0, 0.0];
        self.queue.write_buffer(&picture.placement, 0, bytes(&data));
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        self.config.width = width.max(1);
        self.config.height = height.max(1);
        self.surface.configure(&self.device, &self.config);
    }

    /// Draws the canvas, then `layers` in order. Each layer is a list of
    /// shapes; `between` is called after each shape layer so text and
    /// textures can be drawn in the same pass in z order.
    /// `layers` are ranges of `shapes`; after each layer `overlay(i)` draws that layer's text.
    pub fn frame(&mut self, globals: Globals, shapes: &[Shape], layers: &[std::ops::Range<u32>], pictures: &[Option<&Picture>], capture: bool, overlay: &mut dyn FnMut(usize, &mut wgpu::RenderPass<'_>)) -> Result<(), wgpu::SurfaceError> {
        let output = match self.surface.get_current_texture() {
            Ok(t) => t,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                self.surface.configure(&self.device, &self.config);
                return Ok(());
            }
            Err(e) => return Err(e),
        };
        if shapes.len() > self.capacity {
            self.capacity = shapes.len().next_power_of_two();
            self.instances = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("shapes"), contents: &vec![0u8; self.capacity * std::mem::size_of::<Shape>()], usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST });
        }
        self.queue.write_buffer(&self.globals, 0, bytes(&[globals]));
        if !shapes.is_empty() {
            self.queue.write_buffer(&self.instances, 0, bytes(shapes));
        }
        let view = output.texture.create_view(&Default::default());
        let mut encoder = self.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("wall"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: &view, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::BLACK), store: wgpu::StoreOp::Store } })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_bind_group(0, &self.bind, &[]);
            pass.set_pipeline(&self.background);
            pass.draw(0..3, 0..1);
            for (i, range) in layers.iter().enumerate() {
                if !range.is_empty() {
                    pass.set_pipeline(&self.shapes);
                    pass.set_bind_group(0, &self.bind, &[]);
                    pass.set_vertex_buffer(0, self.instances.slice(..));
                    pass.draw(0..4, range.clone());
                }
                if let Some(Some(picture)) = pictures.get(i) {
                    pass.set_pipeline(&self.images);
                    pass.set_bind_group(0, &self.bind, &[]);
                    pass.set_bind_group(1, &picture.bind, &[]);
                    pass.draw(0..4, 0..1);
                }
                overlay(i, &mut pass);
            }
        }
        // Review evidence only: BORDERLESS_WALL_CAPTURE=<file.png> saves settled frames
        // from the GPU, so screenshots never need access to the rest of the screen.
        // A path containing {n} records a numbered sequence (motion review);
        // otherwise only settled frames overwrite one file.
        let sequence = capture_path().filter(|p| p.to_string_lossy().contains("{n}"));
        let capture = capture || sequence.as_ref().is_some_and(|_| self.last_capture.elapsed().as_millis() >= 100);
        let readback = match (capture, capture_path()) {
            (true, Some(path)) => {
                self.last_capture = std::time::Instant::now();
                self.captured += 1;
                let path = std::path::PathBuf::from(path.to_string_lossy().replace("{n}", &format!("{:04}", self.captured)));
                let (w, h) = (self.config.width, self.config.height);
                let row = (w * 4).div_ceil(256) * 256;
                let buffer = self.device.create_buffer(&wgpu::BufferDescriptor { label: Some("capture"), size: (row * h) as u64, usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ, mapped_at_creation: false });
                encoder.copy_texture_to_buffer(
                    output.texture.as_image_copy(),
                    wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(row), rows_per_image: Some(h) } },
                    wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
                );
                Some((buffer, row, w, h, path))
            }
            _ => None,
        };
        self.queue.submit([encoder.finish()]);
        if let Some((buffer, row, w, h, path)) = readback {
            let slice = buffer.slice(..);
            slice.map_async(wgpu::MapMode::Read, |_| {});
            let _ = self.device.poll(wgpu::PollType::Wait);
            let data = slice.get_mapped_range();
            let bgra = matches!(self.config.format, wgpu::TextureFormat::Bgra8Unorm | wgpu::TextureFormat::Bgra8UnormSrgb);
            let mut rgba = Vec::with_capacity((w * h * 4) as usize);
            for y in 0..h as usize {
                for px in data[y * row as usize..y * row as usize + w as usize * 4].chunks(4) {
                    if bgra { rgba.extend_from_slice(&[px[2], px[1], px[0], 255]) } else { rgba.extend_from_slice(&[px[0], px[1], px[2], 255]) }
                }
            }
            drop(data);
            if let Ok(file) = std::fs::File::create(&path) {
                let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), w, h);
                encoder.set_color(png::ColorType::Rgba);
                encoder.set_depth(png::BitDepth::Eight);
                if let Ok(mut writer) = encoder.write_header() {
                    let _ = writer.write_image_data(&rgba);
                }
            }
        }
        output.present();
        Ok(())
    }
}

pub fn capture_path() -> Option<std::path::PathBuf> {
    std::env::var_os("BORDERLESS_WALL_CAPTURE").map(std::path::PathBuf::from)
}
