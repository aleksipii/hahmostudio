//! Deterministic software AOV renderer. World-space normals, radial camera depth,
//! cosine-weighted finite-radius AO; opaque triangles and directional specular.
//! No GPU, C ABI, textures, refraction or stochastic global illumination.
use crate::{RenderError, RenderScene};
use glam::Vec3;

pub const MAX_PIXELS: usize = 4_000_000;
#[derive(Clone, Debug)]
pub struct RenderBuffers {
    pub width: u32,
    pub height: u32,
    pub background: Vec<u8>,
    pub diffuse: Vec<u8>,
    pub ambient_occlusion: Vec<u8>,
    pub specular: Vec<u8>,
    pub depth: Vec<u8>,
    pub normal: Vec<u8>,
}
impl RenderBuffers {
    pub fn validate(&self) -> Result<(), RenderError> {
        let n = (self.width as usize)
            .checked_mul(self.height as usize)
            .filter(|n| *n > 0 && *n <= MAX_PIXELS && self.width <= 30_000 && self.height <= 30_000)
            .ok_or(RenderError::Size(self.width, self.height))?;
        if self.layers().iter().any(|b| b.len() != n * 4) {
            return Err(RenderError::Export("AOV buffer dimensions disagree".into()));
        }
        Ok(())
    }
    pub(crate) fn layers(&self) -> [&[u8]; 6] {
        [
            &self.background,
            &self.diffuse,
            &self.ambient_occlusion,
            &self.specular,
            &self.depth,
            &self.normal,
        ]
    }
}
#[derive(Clone, Copy)]
pub struct RayTraceOptions {
    pub ao_samples: u32,
    pub ao_radius: f32,
    pub ao_strength: f32,
    pub depth_near: f32,
    pub depth_far: f32,
    pub threads: usize,
}
impl Default for RayTraceOptions {
    fn default() -> Self {
        Self {
            ao_samples: 8,
            ao_radius: 0.3,
            ao_strength: 1.0,
            depth_near: 0.05,
            depth_far: 100.0,
            threads: std::thread::available_parallelism()
                .map_or(1, usize::from)
                .min(8),
        }
    }
}
#[derive(Clone)]
struct Triangle {
    p: [Vec3; 3],
    n: [Vec3; 3],
    c: [Vec3; 3],
    lo: Vec3,
    hi: Vec3,
}
struct Node {
    lo: Vec3,
    hi: Vec3,
    range: std::ops::Range<usize>,
    children: Option<(usize, usize)>,
}
struct Bvh {
    tri: Vec<Triangle>,
    nodes: Vec<Node>,
}
impl Bvh {
    fn build(&mut self, start: usize, end: usize) -> usize {
        let mut lo = Vec3::splat(f32::INFINITY);
        let mut hi = Vec3::splat(f32::NEG_INFINITY);
        for t in &self.tri[start..end] {
            lo = lo.min(t.lo);
            hi = hi.max(t.hi);
        }
        let id = self.nodes.len();
        self.nodes.push(Node {
            lo,
            hi,
            range: start..end,
            children: None,
        });
        if end - start > 8 {
            let extent = hi - lo;
            let axis = if extent.x >= extent.y && extent.x >= extent.z {
                0
            } else if extent.y >= extent.z {
                1
            } else {
                2
            };
            self.tri[start..end].sort_unstable_by(|a, b| {
                (a.lo[axis] + a.hi[axis]).total_cmp(&(b.lo[axis] + b.hi[axis]))
            });
            let mid = (start + end) / 2;
            let a = self.build(start, mid);
            let b = self.build(mid, end);
            self.nodes[id].children = Some((a, b));
        }
        id
    }
    fn bounds(node: &Node, o: Vec3, d: Vec3, max: f32) -> bool {
        let mut near = 0.00001f32;
        let mut far = max;
        for axis in 0..3 {
            if d[axis].abs() < 1e-12 {
                if o[axis] < node.lo[axis] || o[axis] > node.hi[axis] {
                    return false;
                }
            } else {
                let a = (node.lo[axis] - o[axis]) / d[axis];
                let b = (node.hi[axis] - o[axis]) / d[axis];
                near = near.max(a.min(b));
                far = far.min(a.max(b));
                if near > far {
                    return false;
                }
            }
        }
        true
    }
    fn hit(&self, o: Vec3, d: Vec3, max: f32) -> Option<(usize, f32, f32, f32)> {
        if self.nodes.is_empty() {
            return None;
        }
        let mut stack = [0usize; 64];
        let mut len = 1;
        let mut distance = max;
        let mut found = None;
        while len > 0 {
            len -= 1;
            let node = &self.nodes[stack[len]];
            if !Self::bounds(node, o, d, distance) {
                continue;
            }
            if let Some((a, b)) = node.children {
                stack[len] = a;
                stack[len + 1] = b;
                len += 2;
            } else {
                for i in node.range.clone() {
                    let t = &self.tri[i];
                    let e1 = t.p[1] - t.p[0];
                    let e2 = t.p[2] - t.p[0];
                    let h = d.cross(e2);
                    let det = e1.dot(h);
                    if det.abs() < 1e-8 {
                        continue;
                    }
                    let s = o - t.p[0];
                    let u = s.dot(h) / det;
                    if !(0.0..=1.0).contains(&u) {
                        continue;
                    }
                    let q = s.cross(e1);
                    let v = d.dot(q) / det;
                    if v < 0.0 || u + v > 1.0 {
                        continue;
                    }
                    let depth = e2.dot(q) / det;
                    if depth > 1e-5 && depth < distance {
                        distance = depth;
                        found = Some((i, depth, u, v));
                    }
                }
            }
        }
        found
    }
}
#[derive(Clone, Copy, Default)]
struct Pixel {
    diffuse: [u8; 4],
    ao: [u8; 4],
    spec: [u8; 4],
    depth: [u8; 4],
    normal: [u8; 4],
}
fn byte(v: f32) -> u8 {
    (v.clamp(0.0, 1.0) * 255.0).round() as u8
}
fn rgb(v: Vec3) -> [u8; 4] {
    [byte(v.x), byte(v.y), byte(v.z), 255]
}
fn srgb(v: Vec3) -> [u8; 4] {
    [
        crate::shading::linear_to_srgb(v.x),
        crate::shading::linear_to_srgb(v.y),
        crate::shading::linear_to_srgb(v.z),
        255,
    ]
}
fn error(s: &str) -> RenderError {
    RenderError::Export(s.into())
}

pub fn render(scene: &RenderScene, options: RayTraceOptions) -> Result<RenderBuffers, RenderError> {
    render_cancelable(scene, options, &std::sync::atomic::AtomicBool::new(false))
}
pub fn render_cancelable(
    scene: &RenderScene,
    options: RayTraceOptions,
    cancel: &std::sync::atomic::AtomicBool,
) -> Result<RenderBuffers, RenderError> {
    if cancel.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(error("Ray trace cancelled"));
    }
    let count = (scene.width as usize)
        .checked_mul(scene.height as usize)
        .filter(|n| *n > 0 && *n <= MAX_PIXELS && scene.width <= 30_000 && scene.height <= 30_000)
        .ok_or(RenderError::Size(scene.width, scene.height))?;
    let camera = scene.camera;
    if !camera.eye.is_finite()
        || !camera.target.is_finite()
        || !camera.fov_y.is_finite()
        || !(1.0..179.0).contains(&camera.fov_y)
        || camera.eye.distance(camera.target) < 1e-5
        || options.ao_samples > 64
        || !options.ao_strength.is_finite() || !(0.0..=1.0).contains(&options.ao_strength)
        || options.threads == 0
        || options.threads > 64
        || !options.ao_radius.is_finite()
        || options.ao_radius <= 0.0
        || !options.depth_near.is_finite()
        || !options.depth_far.is_finite()
        || options.depth_near < 0.0
        || options.depth_far <= options.depth_near
    {
        return Err(error("Invalid camera or ray tracing options"));
    }
    for light in [scene.lights.key, scene.lights.fill, scene.lights.rim] {
        if !light.dir.is_finite()
            || !light.color.is_finite()
            || light.dir.length_squared() < 1e-10
            || light.color.min_element() < 0.0
        {
            return Err(error("Invalid directional light"));
        }
    }
    let forward = (camera.target - camera.eye).normalize();
    let right = forward.cross(Vec3::Y).normalize_or_zero();
    if right.length_squared() < 0.5 {
        return Err(error("Camera up direction is singular"));
    }
    let up = right.cross(forward);
    let mut bvh = Bvh {
        tri: Vec::new(),
        nodes: Vec::new(),
    };
    for item in scene.items.iter().filter(|item|item.ray_visible) {
        if item.mesh.indices.len() % 3 != 0 || item.skin.iter().any(|m| !m.is_finite()) {
            return Err(error("Invalid mesh or skin matrices"));
        }
        if bvh.tri.len() + item.mesh.indices.len() / 3 > 200_000 {
            return Err(error("Ray tracer triangle limit is 200000"));
        }
        for indices in item.mesh.indices.chunks_exact(3) {
            let mut p = [Vec3::ZERO; 3];
            let mut n = p;
            let mut c = p;
            for k in 0..3 {
                let v = item
                    .mesh
                    .vertices
                    .get(indices[k] as usize)
                    .ok_or_else(|| error("Mesh index out of bounds"))?;
                if !v.weight.is_finite()
                    || !(0.0..=1.0).contains(&v.weight)
                    || v.color
                        .iter()
                        .any(|x| !x.is_finite() || !(0.0..=1.0).contains(x))
                {
                    return Err(error("AOV renderer requires finite vertices"));
                }
                let a = item.skin_matrix(v.bones[0]);
                let b = item.skin_matrix(v.bones[1]);
                p[k] = a.transform_point3(v.position.into()) * v.weight
                    + b.transform_point3(v.position.into()) * (1.0 - v.weight);
                // Inverse transpose handles non-uniform authored transforms.
                if a.determinant().abs() < 1e-12 || b.determinant().abs() < 1e-12 {
                    return Err(error("Singular skin matrix"));
                }
                n[k] = a.inverse().transpose().transform_vector3(v.normal.into()) * v.weight
                    + b.inverse().transpose().transform_vector3(v.normal.into()) * (1.0 - v.weight);
                c[k] = Vec3::new(v.color[0], v.color[1], v.color[2]);
                if !p[k].is_finite() || !n[k].is_finite() {
                    return Err(error("Nonfinite mesh geometry"));
                }
            }
            if (p[1] - p[0]).cross(p[2] - p[0]).length_squared() > 1e-16 {
                bvh.tri.push(Triangle {
                    lo: p[0].min(p[1]).min(p[2]),
                    hi: p[0].max(p[1]).max(p[2]),
                    p,
                    n,
                    c,
                });
            }
        }
    }
    if !bvh.tri.is_empty() {
        bvh.build(0, bvh.tri.len());
    }
    let tan = (camera.fov_y.to_radians() * 0.5).tan();
    let aspect = scene.width as f32 / scene.height as f32;
    let mut pixels = vec![Pixel::default(); count];
    let chunk = count.div_ceil(options.threads);
    std::thread::scope(|scope| {
        for (part, output) in pixels.chunks_mut(chunk).enumerate() {
            let bvh = &bvh;
            scope.spawn(move || {
                for (offset, pixel) in output.iter_mut().enumerate() {
                    if cancel.load(std::sync::atomic::Ordering::Relaxed) {
                        break;
                    }
                    let index = part * chunk + offset;
                    let x = index % scene.width as usize;
                    let y = index / scene.width as usize;
                    let d = (forward
                        + right
                            * ((2.0 * (x as f32 + 0.5) / scene.width as f32 - 1.0) * tan * aspect)
                        + up * ((1.0 - 2.0 * (y as f32 + 0.5) / scene.height as f32) * tan))
                        .normalize();
                    if let Some((id, distance, u, v)) = bvh.hit(
                        camera.eye + d * (0.05/d.dot(forward)),
                        d,
                        (100.0-0.05)/d.dot(forward),
                    ) {
                        let distance = distance + 0.05/d.dot(forward);
                        let tri = &bvh.tri[id];
                        let w = 1.0 - u - v;
                        let mut normal =
                            (tri.n[0] * w + tri.n[1] * u + tri.n[2] * v).normalize_or_zero();
                        if normal.length_squared() < 0.5 {
                            normal = (tri.p[1] - tri.p[0]).cross(tri.p[2] - tri.p[0]).normalize();
                        }
                        if normal.dot(d) > 0.0 {
                            normal = -normal;
                        }
                        pixel.diffuse = srgb(tri.c[0] * w + tri.c[1] * u + tri.c[2] * v);
                        let point = camera.eye + d * distance;
                        let origin = point + normal * 0.0001;
                        let tangent = normal
                            .cross(if normal.y.abs() < 0.9 {
                                Vec3::Y
                            } else {
                                Vec3::X
                            })
                            .normalize();
                        let bitangent = normal.cross(tangent);
                        let mut occluded = 0u32;
                        for sample in 0..options.ao_samples {
                            let r = ((sample as f32 + 0.5) / options.ao_samples as f32).sqrt();
                            let angle = sample as f32 * 2.3999631;
                            let direction = tangent * (r * angle.cos())
                                + bitangent * (r * angle.sin())
                                + normal * (1.0 - r * r).sqrt();
                            if bvh.hit(origin, direction, options.ao_radius).is_some() {
                                occluded += 1;
                            }
                        }
                        let ao = if options.ao_samples == 0 {
                            1.0
                        } else {
                            1.0 - options.ao_strength * occluded as f32 / options.ao_samples as f32
                        };
                        pixel.ao = rgb(Vec3::splat(ao));
                        let mut spec = Vec3::ZERO;
                        for light in [scene.lights.key, scene.lights.fill, scene.lights.rim] {
                            let l = -light.dir.normalize();
                            if normal.dot(l) > 0.0
                                && bvh.hit(origin, l, 100.0).is_none()
                            {
                                let half = (l - d).normalize_or_zero();
                                spec += light.color * normal.dot(half).max(0.0).powi(48) * 0.25;
                            }
                        }
                        pixel.spec = srgb(spec);
                        pixel.depth = rgb(Vec3::splat(
                            1.0 - (distance - options.depth_near)
                                / (options.depth_far - options.depth_near),
                        ));
                        pixel.normal = rgb(normal * 0.5 + Vec3::splat(0.5));
                    }
                }
            });
        }
    });
    if cancel.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(error("Ray trace cancelled"));
    }
    let mut out = RenderBuffers {
        width: scene.width,
        height: scene.height,
        background: Vec::with_capacity(count * 4),
        diffuse: Vec::with_capacity(count * 4),
        ambient_occlusion: Vec::with_capacity(count * 4),
        specular: Vec::with_capacity(count * 4),
        depth: Vec::with_capacity(count * 4),
        normal: Vec::with_capacity(count * 4),
    };
    for pixel in pixels {
        out.background
            .extend_from_slice(&[scene.clear[0], scene.clear[1], scene.clear[2], 255]);
        out.diffuse.extend_from_slice(&pixel.diffuse);
        out.ambient_occlusion.extend_from_slice(&pixel.ao);
        out.specular.extend_from_slice(&pixel.spec);
        out.depth.extend_from_slice(&pixel.depth);
        out.normal.extend_from_slice(&pixel.normal);
    }
    Ok(out)
}
