//! Ohjelmistorasteroija: ihotus, leikkaus lähitasoon, perspektiivikorjattu
//! interpolointi, syvyyspuskuri ja pikselikohtainen varjostus. Kuva jaetaan
//! vaakakaistoihin, jotka rasteroidaan rinnakkain.

use crate::scene::{Image, RenderScene};
use crate::shading::{linear_to_srgb, shade, INK};
use crate::{RenderError, Renderer};
use glam::{Vec3, Vec4};
use hs_character::srgb_to_linear;

pub struct CpuRenderer {
    /// Ylinäytteistys reunojen pehmentämiseen (1 = pois, 2 = 4 näytettä/pikseli).
    pub supersample: u32,
    pub threads: usize,
}

impl Default for CpuRenderer {
    fn default() -> Self {
        CpuRenderer {
            supersample: 2,
            threads: std::thread::available_parallelism().map_or(4, |n| n.get()),
        }
    }
}

#[derive(Clone, Copy)]
struct ClipVertex {
    clip: Vec4,
    world: Vec3,
    normal: Vec3,
    color: Vec3,
    shade: f32,
}

impl ClipVertex {
    fn lerp(&self, o: &ClipVertex, t: f32) -> ClipVertex {
        ClipVertex {
            clip: self.clip.lerp(o.clip, t),
            world: self.world.lerp(o.world, t),
            normal: self.normal.lerp(o.normal, t),
            color: self.color.lerp(o.color, t),
            shade: self.shade + (o.shade - self.shade) * t,
        }
    }
}

/// Valmiiksi projisoitu kolmio rasterointia varten.
struct Tri {
    sx: [f32; 3],
    sy: [f32; 3],
    z: [f32; 3],
    inv_w: [f32; 3],
    /// Attribuutit jaettuna w:llä (perspektiivikorjaus).
    world: [Vec3; 3],
    normal: [Vec3; 3],
    color: [Vec3; 3],
    /// Ääriviivakolmiossa tämä on kärkipisteen ääriviivapaino (värin alfa).
    shade: [f32; 3],
    min_y: f32,
    max_y: f32,
    /// Ääriviivan kuoren kolmio: vain kamerasta poispäin osoittava puoli piirretään musteella.
    ink: bool,
}

/// Leikkaa monikulmion tasoon z >= 0 (wgpu:n syvyysalue 0..1 = lähitaso).
fn clip_near(poly: &[ClipVertex]) -> Vec<ClipVertex> {
    let mut out = Vec::with_capacity(poly.len() + 2);
    for i in 0..poly.len() {
        let a = &poly[i];
        let b = &poly[(i + 1) % poly.len()];
        let (da, db) = (a.clip.z, b.clip.z);
        if da >= 0.0 {
            out.push(*a);
        }
        if (da >= 0.0) != (db >= 0.0) {
            out.push(a.lerp(b, da / (da - db)));
        }
    }
    out
}

impl CpuRenderer {
    fn setup(&self, scene: &RenderScene, w: u32, h: u32) -> Vec<Tri> {
        let vp = scene.camera.view_proj(scene.width as f32 / scene.height as f32);
        let k = scene.outline_factor();
        let mut tris = Vec::new();
        for item in &scene.items {
            let skinned: Vec<(Vec3, Vec3)> = item
                .mesh
                .vertices
                .iter()
                .map(|v| {
                    let ma = item.skin_matrix(v.bones[0]);
                    let mb = item.skin_matrix(v.bones[1]);
                    let p = Vec3::from(v.position);
                    let n = Vec3::from(v.normal);
                    let world = ma.transform_point3(p) * v.weight + mb.transform_point3(p) * (1.0 - v.weight);
                    let normal = ma.transform_vector3(n) * v.weight + mb.transform_vector3(n) * (1.0 - v.weight);
                    (world, normal)
                })
                .collect();
            let verts: Vec<ClipVertex> = item
                .mesh
                .vertices
                .iter()
                .zip(&skinned)
                .map(|(v, &(world, normal))| ClipVertex {
                    clip: vp * world.extend(1.0),
                    world,
                    normal,
                    color: Vec3::new(v.color[0], v.color[1], v.color[2]),
                    shade: v.shade,
                })
                .collect();
            emit(&verts, &item.mesh.indices, false, w, h, &mut tris);
            if item.outline && k > 0.0 {
                // Sama kaava kuin varjostimen vs_outline.
                let hull: Vec<ClipVertex> = item
                    .mesh
                    .vertices
                    .iter()
                    .zip(&skinned)
                    .map(|(v, &(world, normal))| {
                        let n = normal.normalize_or_zero();
                        let w0 = (vp * world.extend(1.0)).w;
                        let grown = world + n * (k * w0);
                        ClipVertex { clip: vp * grown.extend(1.0), world: grown, normal: n, color: INK, shade: v.color[3] }
                    })
                    .collect();
                emit(&hull, &item.mesh.indices, true, w, h, &mut tris);
            }
        }
        tris
    }
}

/// Leikkaa ja projisoi kolmiot rasterointia varten.
fn emit(verts: &[ClipVertex], indices: &[u32], ink: bool, w: u32, h: u32, tris: &mut Vec<Tri>) {
    for idx in indices.chunks_exact(3) {
        let poly = [verts[idx[0] as usize], verts[idx[1] as usize], verts[idx[2] as usize]];
        let clipped = if poly.iter().all(|v| v.clip.z >= 0.0) { poly.to_vec() } else { clip_near(&poly) };
        if clipped.len() < 3 {
            continue;
        }
        // Hylkää kokonaan näkymän ulkopuolella olevat.
        let outside = |f: &dyn Fn(&Vec4) -> bool| clipped.iter().all(|v| f(&v.clip));
        if outside(&|c| c.x > c.w) || outside(&|c| c.x < -c.w) || outside(&|c| c.y > c.w) || outside(&|c| c.y < -c.w) || outside(&|c| c.z > c.w) {
            continue;
        }
        for k in 1..clipped.len() - 1 {
            let tri = [clipped[0], clipped[k], clipped[k + 1]];
            let mut t = Tri {
                sx: [0.0; 3],
                sy: [0.0; 3],
                z: [0.0; 3],
                inv_w: [0.0; 3],
                world: [Vec3::ZERO; 3],
                normal: [Vec3::ZERO; 3],
                color: [Vec3::ZERO; 3],
                shade: [0.0; 3],
                min_y: 0.0,
                max_y: 0.0,
                ink,
            };
            for (i, v) in tri.iter().enumerate() {
                let iw = 1.0 / v.clip.w.max(1e-6);
                t.sx[i] = (v.clip.x * iw * 0.5 + 0.5) * w as f32;
                t.sy[i] = (0.5 - v.clip.y * iw * 0.5) * h as f32;
                t.z[i] = v.clip.z * iw;
                t.inv_w[i] = iw;
                t.world[i] = v.world * iw;
                t.normal[i] = v.normal * iw;
                t.color[i] = v.color * iw;
                t.shade[i] = v.shade * iw;
            }
            t.min_y = t.sy.iter().cloned().fold(f32::MAX, f32::min);
            t.max_y = t.sy.iter().cloned().fold(f32::MIN, f32::max);
            tris.push(t);
        }
    }
}

fn edge(ax: f32, ay: f32, bx: f32, by: f32, px: f32, py: f32) -> f32 {
    (bx - ax) * (py - ay) - (by - ay) * (px - ax)
}

impl Renderer for CpuRenderer {
    fn name(&self) -> &'static str {
        "CPU"
    }

    fn render(&mut self, scene: &RenderScene) -> Result<Image, RenderError> {
        if scene.width == 0 || scene.height == 0 || scene.width > 8192 || scene.height > 8192 {
            return Err(RenderError::Size(scene.width, scene.height));
        }
        let ss = self.supersample.clamp(1, 4);
        let (w, h) = (scene.width * ss, scene.height * ss);
        let tris = self.setup(scene, w, h);
        let clear = srgb_to_linear(scene.clear);
        let clear = Vec3::new(clear[0], clear[1], clear[2]);
        let mut color = vec![clear; (w * h) as usize];
        let mut depth = vec![f32::INFINITY; (w * h) as usize];
        let threads = self.threads.max(1).min(h as usize);
        let band = (h as usize).div_ceil(threads);
        let eye = scene.camera.eye;
        let lights = scene.lights;
        let style = scene.style;
        std::thread::scope(|s| {
            for (k, (cband, dband)) in color.chunks_mut(band * w as usize).zip(depth.chunks_mut(band * w as usize)).enumerate() {
                let tris = &tris;
                s.spawn(move || {
                    let y0 = k * band;
                    let y1 = y0 + cband.len() / w as usize;
                    for t in tris {
                        if t.max_y < y0 as f32 || t.min_y >= y1 as f32 {
                            continue;
                        }
                        let area = edge(t.sx[0], t.sy[0], t.sx[1], t.sy[1], t.sx[2], t.sy[2]);
                        if area.abs() < 1e-9 {
                            continue;
                        }
                        let minx = t.sx.iter().cloned().fold(f32::MAX, f32::min).floor().max(0.0) as i32;
                        let maxx = (t.sx.iter().cloned().fold(f32::MIN, f32::max).ceil() as i32).min(w as i32 - 1);
                        let miny = (t.min_y.floor() as i32).max(y0 as i32);
                        let maxy = (t.max_y.ceil() as i32).min(y1 as i32 - 1);
                        for py in miny..=maxy {
                            let fy = py as f32 + 0.5;
                            for px in minx..=maxx {
                                let fx = px as f32 + 0.5;
                                let mut b0 = edge(t.sx[1], t.sy[1], t.sx[2], t.sy[2], fx, fy) / area;
                                let mut b1 = edge(t.sx[2], t.sy[2], t.sx[0], t.sy[0], fx, fy) / area;
                                let mut b2 = 1.0 - b0 - b1;
                                if b0 < 0.0 || b1 < 0.0 || b2 < 0.0 {
                                    continue;
                                }
                                let z = b0 * t.z[0] + b1 * t.z[1] + b2 * t.z[2];
                                let i = (py as usize - y0) * w as usize + px as usize;
                                if !(0.0..=1.0).contains(&z) || z >= dband[i] {
                                    continue;
                                }
                                let iw = b0 * t.inv_w[0] + b1 * t.inv_w[1] + b2 * t.inv_w[2];
                                b0 /= iw;
                                b1 /= iw;
                                b2 /= iw;
                                let world = t.world[0] * b0 + t.world[1] * b1 + t.world[2] * b2;
                                let normal = t.normal[0] * b0 + t.normal[1] * b1 + t.normal[2] * b2;
                                let flag = t.shade[0] * b0 + t.shade[1] * b1 + t.shade[2] * b2;
                                if t.ink {
                                    if normal.dot(eye - world) > 0.0 || flag < 0.5 {
                                        continue;
                                    }
                                    dband[i] = z;
                                    cband[i] = INK;
                                    continue;
                                }
                                dband[i] = z;
                                let base = t.color[0] * b0 + t.color[1] * b1 + t.color[2] * b2;
                                cband[i] = shade(base, normal, eye - world, flag, style, &lights);
                            }
                        }
                    }
                });
            }
        });
        let mut img = Image::new(scene.width, scene.height);
        let norm = 1.0 / (ss * ss) as f32;
        for y in 0..scene.height {
            for x in 0..scene.width {
                let mut acc = Vec3::ZERO;
                for sy in 0..ss {
                    for sx in 0..ss {
                        acc += color[((y * ss + sy) * w + x * ss + sx) as usize];
                    }
                }
                let c = acc * norm;
                let i = ((y * scene.width + x) * 4) as usize;
                img.rgba[i] = linear_to_srgb(c.x);
                img.rgba[i + 1] = linear_to_srgb(c.y);
                img.rgba[i + 2] = linear_to_srgb(c.z);
                img.rgba[i + 3] = 255;
            }
        }
        Ok(img)
    }
}
