// Borderless native Wall. Colours arrive as sRGB values and are blended in
// sRGB space on a non-sRGB surface, matching how the design system looks in
// the Console and Portal.

struct Globals {
  size: vec2<f32>,
  scale: f32,
  time: f32,
  wall: vec4<f32>,
  wash_a: vec4<f32>,
  wash_b: vec4<f32>,
  grid: vec4<f32>,
};
@group(0) @binding(0) var<uniform> g: Globals;

struct BgOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex fn bg_vs(@builtin(vertex_index) i: u32) -> BgOut {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u));
  var o: BgOut;
  o.pos = vec4<f32>(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2<f32>(p.x, 1.0 - p.y);
  return o;
}

fn wash(uv: vec2<f32>, centre: vec2<f32>, radius: vec2<f32>) -> f32 {
  let d = length((uv - centre) / radius);
  return 1.0 - smoothstep(0.0, 0.6, d);
}

@fragment fn bg_fs(in: BgOut) -> @location(0) vec4<f32> {
  var c = g.wall.rgb;
  c = mix(c, g.wash_a.rgb, wash(in.uv, vec2<f32>(0.12, 0.08), vec2<f32>(0.7, 0.6)) * g.wash_a.a);
  c = mix(c, g.wash_b.rgb, wash(in.uv, vec2<f32>(0.92, 0.92), vec2<f32>(0.6, 0.6)) * g.wash_b.a);
  // 1 px dots on a 32 px pitch at 1080p, scaled with the display.
  let pitch = 32.0 * g.scale;
  let px = in.uv * g.size;
  let cell = (px + pitch * 0.5) % vec2<f32>(pitch) - pitch * 0.5;
  let dot = 1.0 - smoothstep(1.0 * g.scale, 1.3 * g.scale + 0.5, length(cell));
  c = mix(c, g.grid.rgb, dot * g.grid.a);
  return vec4<f32>(c, 1.0);
}

// One instance per rounded shape: windows, ornaments, sparks, particles.
struct Shape {
  @location(0) rect: vec4<f32>,      // x, y, w, h in pixels
  @location(1) fill: vec4<f32>,
  @location(2) ring: vec4<f32>,
  @location(3) params: vec4<f32>,    // radius, ring width, shadow strength, blur
};
struct ShapeOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) extent: vec2<f32>,
  @location(2) fill: vec4<f32>,
  @location(3) ring: vec4<f32>,
  @location(4) params: vec4<f32>,
};

@vertex fn shape_vs(@builtin(vertex_index) i: u32, s: Shape) -> ShapeOut {
  // Grow the quad to fit the soft shadow below the shape.
  let pad = s.params.w * 2.0 + s.params.w * 0.75 * step(0.001, s.params.z);
  let corner = vec2<f32>(f32(i & 1u), f32((i >> 1u) & 1u));
  let extent = s.rect.zw * 0.5;
  let centre = s.rect.xy + extent;
  let local = (corner * 2.0 - 1.0) * (extent + vec2<f32>(pad));
  let px = centre + local;
  var o: ShapeOut;
  o.pos = vec4<f32>(px.x / g.size.x * 2.0 - 1.0, 1.0 - px.y / g.size.y * 2.0, 0.0, 1.0);
  o.local = local; o.extent = extent; o.fill = s.fill; o.ring = s.ring; o.params = s.params;
  return o;
}

fn rounded(p: vec2<f32>, extent: vec2<f32>, r: f32) -> f32 {
  let q = abs(p) - extent + vec2<f32>(r);
  return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment fn shape_fs(in: ShapeOut) -> @location(0) vec4<f32> {
  let r = min(in.params.x, min(in.extent.x, in.extent.y));
  let d = rounded(in.local, in.extent, r);
  var out = vec4<f32>(0.0);
  // Ambient shadow: soft, offset downwards (design-system elevation, rest).
  if (in.params.z > 0.0) {
    let ds = rounded(in.local - vec2<f32>(0.0, in.params.w * 0.4), in.extent, r);
    let a = (1.0 - smoothstep(-in.params.w * 0.4, in.params.w * 1.6, ds)) * in.params.z;
    out = vec4<f32>(0.12, 0.16, 0.31, a);
  }
  let inside = 1.0 - smoothstep(-0.75, 0.75, d);
  out = mix(out, vec4<f32>(in.fill.rgb, 1.0), inside * in.fill.a);
  out.a = max(out.a, inside * in.fill.a);
  if (in.params.y > 0.0) {
    let ring = (1.0 - smoothstep(-0.75, 0.75, abs(d + in.params.y * 0.5) - in.params.y * 0.5)) * in.ring.a;
    out = vec4<f32>(mix(out.rgb, in.ring.rgb, ring), max(out.a, ring));
  }
  return vec4<f32>(out.rgb * out.a, out.a);
}

// Room images: drawn into the window's content area, letterboxed
// ("contain") and clipped to the window's rounded corners.
struct Placement {
  dest: vec4<f32>,   // image rectangle in pixels
  clip: vec4<f32>,   // window content rectangle in pixels
  params: vec4<f32>, // corner radius, opacity
};
@group(1) @binding(0) var<uniform> place: Placement;
@group(1) @binding(1) var picture: texture_2d<f32>;
@group(1) @binding(2) var picture_sampler: sampler;

struct ImageOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) px: vec2<f32> };

@vertex fn image_vs(@builtin(vertex_index) i: u32) -> ImageOut {
  let corner = vec2<f32>(f32(i & 1u), f32((i >> 1u) & 1u));
  let px = place.dest.xy + corner * place.dest.zw;
  var o: ImageOut;
  o.pos = vec4<f32>(px.x / g.size.x * 2.0 - 1.0, 1.0 - px.y / g.size.y * 2.0, 0.0, 1.0);
  o.uv = corner;
  o.px = px;
  return o;
}

@fragment fn image_fs(in: ImageOut) -> @location(0) vec4<f32> {
  let extent = place.clip.zw * 0.5;
  let d = rounded(in.px - (place.clip.xy + extent), extent, min(place.params.x, min(extent.x, extent.y)));
  let a = (1.0 - smoothstep(-0.75, 0.75, d)) * place.params.y;
  let c = textureSample(picture, picture_sampler, in.uv);
  return vec4<f32>(c.rgb * c.a * a, c.a * a);
}

// Live windows: I420 planes from the decoder, converted to colour here
// (BT.709, limited range), letterboxed and clipped like room images.
@group(1) @binding(1) var plane_y: texture_2d<f32>;
@group(1) @binding(2) var plane_u: texture_2d<f32>;
@group(1) @binding(3) var plane_v: texture_2d<f32>;
@group(1) @binding(4) var plane_sampler: sampler;

@fragment fn video_fs(in: ImageOut) -> @location(0) vec4<f32> {
  let extent = place.clip.zw * 0.5;
  let d = rounded(in.px - (place.clip.xy + extent), extent, min(place.params.x, min(extent.x, extent.y)));
  let a = (1.0 - smoothstep(-0.75, 0.75, d)) * place.params.y;
  let y = (textureSample(plane_y, plane_sampler, in.uv).r - 16.0 / 255.0) * (255.0 / 219.0);
  let u = (textureSample(plane_u, plane_sampler, in.uv).r - 128.0 / 255.0) * (255.0 / 224.0);
  let v = (textureSample(plane_v, plane_sampler, in.uv).r - 128.0 / 255.0) * (255.0 / 224.0);
  let rgb = clamp(vec3<f32>(y + 1.5748 * v, y - 0.1873 * u - 0.4681 * v, y + 1.8556 * u), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(rgb * a, a);
}
