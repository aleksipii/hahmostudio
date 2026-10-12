use crate::params::{CharacterParams, ClothingStyle, HairStyle};
use bytemuck::{Pod, Zeroable};
use glam::{Quat, Vec3};
use hs_motion::{Humanoid, Side};
use std::f32::consts::{PI, TAU};

/// GPU:lle sellaisenaan kelpaava kärkipiste.
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Pod, Zeroable)]
pub struct Vertex {
    /// Sidonta-asennon paikka (metreinä).
    pub position: [f32; 3],
    pub normal: [f32; 3],
    /// Lineaarinen RGB + alfa.
    pub color: [f32; 4],
    /// Kaksi luuta; paino koskee ensimmäistä.
    pub bones: [u32; 2],
    pub weight: f32,
    /// 1 = ihoa/kangasta (varjostetaan), 0 = silmänvalkuainen ym. (ei porrastusta).
    pub shade: f32,
}

#[derive(Clone, Debug, Default)]
pub struct CharacterMesh {
    pub vertices: Vec<Vertex>,
    pub indices: Vec<u32>,
}

impl CharacterMesh {
    pub fn triangle_count(&self) -> usize {
        self.indices.len() / 3
    }
    pub fn bounds(&self) -> (Vec3, Vec3) {
        self.vertices.iter().fold((Vec3::splat(f32::MAX), Vec3::splat(f32::MIN)), |(lo, hi), v| {
            let p = Vec3::from(v.position);
            (lo.min(p), hi.max(p))
        })
    }
}

pub fn srgb_to_linear(c: [u8; 3]) -> [f32; 4] {
    let f = |u: u8| {
        let x = u as f32 / 255.0;
        if x <= 0.04045 {
            x / 12.92
        } else {
            ((x + 0.055) / 1.055).powf(2.4)
        }
    };
    [f(c[0]), f(c[1]), f(c[2]), 1.0]
}

fn mix(a: [u8; 3], b: [u8; 3], t: f32) -> [u8; 3] {
    [0, 1, 2].map(|i| (a[i] as f32 + (b[i] as f32 - a[i] as f32) * t).round() as u8)
}

/// Luusidonta: yksi luu tai kahden luun sekoitus.
#[derive(Clone, Copy, Debug)]
pub struct Bind {
    pub a: usize,
    pub b: usize,
}

impl Bind {
    pub fn one(a: usize) -> Bind {
        Bind { a, b: a }
    }
}

/// Verkon rakentaja hahmoille, lavasteille ja esineille (sidonta luuhun 0 = jäykkä).
#[derive(Default)]
pub struct MeshBuilder {
    pub mesh: CharacterMesh,
}

type Builder = MeshBuilder;

impl MeshBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Suorakulmainen särmiö (normaalit tahkoittain, terävät reunat).
    pub fn cuboid(&mut self, center: Vec3, half: Vec3, rot: Quat, color: [u8; 3], shade: f32) {
        let c = srgb_to_linear(color);
        let faces = [
            (Vec3::X, Vec3::Y, Vec3::Z),
            (Vec3::NEG_X, Vec3::Y, Vec3::NEG_Z),
            (Vec3::Y, Vec3::Z, Vec3::X),
            (Vec3::NEG_Y, Vec3::Z, Vec3::NEG_X),
            (Vec3::Z, Vec3::Y, Vec3::NEG_X),
            (Vec3::NEG_Z, Vec3::Y, Vec3::X),
        ];
        for (n, u, v) in faces {
            let base = self.mesh.vertices.len() as u32;
            for (su, sv) in [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)] {
                let local = (n + u * su + v * sv) * half;
                self.push(center + rot * local, rot * n, c, [0, 0], 1.0, shade);
            }
            // Järjestys niin, että etupuoli osoittaa normaalin suuntaan.
            let (a, b2, c2, d) = (base, base + 1, base + 2, base + 3);
            if u.cross(v).dot(n) > 0.0 {
                self.mesh.indices.extend_from_slice(&[a, b2, c2, a, c2, d]);
            } else {
                self.mesh.indices.extend_from_slice(&[a, c2, b2, a, d, c2]);
            }
        }
    }

    /// Nelikulmio kärkikohtaisilla väreillä (liukuvärit taustoihin).
    pub fn quad(&mut self, corners: [Vec3; 4], colors: [[u8; 3]; 4], shade: f32) {
        let n = (corners[1] - corners[0]).cross(corners[3] - corners[0]).normalize_or_zero();
        let base = self.mesh.vertices.len() as u32;
        for (p, c) in corners.iter().zip(colors) {
            self.push(*p, n, srgb_to_linear(c), [0, 0], 1.0, shade);
        }
        self.mesh.indices.extend_from_slice(&[base, base + 1, base + 2, base, base + 2, base + 3]);
    }

    pub fn sphere(&mut self, center: Vec3, radii: Vec3, color: [u8; 3]) {
        self.ellipsoid(center, radii, Quat::IDENTITY, color, Bind::one(0), 10, 16);
    }

    pub fn finish(self) -> CharacterMesh {
        self.mesh
    }

    pub fn push(&mut self, p: Vec3, n: Vec3, color: [f32; 4], bones: [u32; 2], weight: f32, shade: f32) -> u32 {
        self.mesh.vertices.push(Vertex {
            position: p.to_array(),
            normal: n.normalize_or_zero().to_array(),
            color,
            bones,
            weight,
            shade,
        });
        (self.mesh.vertices.len() - 1) as u32
    }

    /// Ellipsoidi: `radii` paikallisessa koordinaatistossa, `rot` kääntää sen.
    #[allow(clippy::too_many_arguments)]
    pub fn ellipsoid(&mut self, center: Vec3, radii: Vec3, rot: Quat, color: [u8; 3], bind: Bind, rings: u32, segments: u32) {
        let c = srgb_to_linear(color);
        let base = self.mesh.vertices.len() as u32;
        for r in 0..=rings {
            let v = r as f32 / rings as f32;
            let theta = v * PI;
            for s in 0..=segments {
                let u = s as f32 / segments as f32;
                let phi = u * TAU;
                let unit = Vec3::new(theta.sin() * phi.cos(), theta.cos(), theta.sin() * phi.sin());
                let p = center + rot * (unit * radii);
                let n = rot * (unit / radii);
                self.push(p, n, c, [bind.a as u32, bind.b as u32], 1.0, 1.0);
            }
        }
        let row = segments + 1;
        for r in 0..rings {
            for s in 0..segments {
                let i0 = base + r * row + s;
                let i1 = i0 + row;
                self.mesh.indices.extend_from_slice(&[i0, i0 + 1, i1, i1, i0 + 1, i1 + 1]);
            }
        }
    }

    /// Kartiomainen kapseli pisteestä `a` pisteeseen `b`. Paino siirtyy
    /// `bind.b`:stä (vanhempi) `bind.a`:han ensimmäisen neljänneksen aikana,
    /// jolloin nivel taipuu pehmeästi.
    #[allow(clippy::too_many_arguments)]
    pub fn capsule(&mut self, a: Vec3, b: Vec3, ra: f32, rb: f32, color: [u8; 3], bind: Bind, segments: u32, blend_start: bool) {
        let c = srgb_to_linear(color);
        let axis = b - a;
        let len = axis.length().max(1e-5);
        let dir = axis / len;
        let side = dir.any_orthonormal_vector();
        let up = dir.cross(side);
        let base = self.mesh.vertices.len() as u32;
        // Rengasprofiili: puolipallo a:ssa, runko, puolipallo b:ssä.
        let hemi = 4;
        let mut rings: Vec<(f32, f32, f32)> = Vec::new(); // (paikka akselilla, säde, normaalin akselikomponentti)
        for k in 0..=hemi {
            let ang = -PI / 2.0 + (k as f32 / hemi as f32) * PI / 2.0;
            rings.push((ra * ang.sin(), ra * ang.cos(), ang.sin()));
        }
        let body = 6;
        for k in 1..body {
            let s = k as f32 / body as f32;
            rings.push((s * len, ra + (rb - ra) * s, 0.0));
        }
        for k in 0..=hemi {
            let ang = (k as f32 / hemi as f32) * PI / 2.0;
            rings.push((len + rb * ang.sin(), rb * ang.cos(), ang.sin()));
        }
        for (z, r, nz) in &rings {
            let s = (z / len).clamp(0.0, 1.0);
            let w = if blend_start { 0.5 + 0.5 * (s / 0.3).clamp(0.0, 1.0) } else { 1.0 };
            for k in 0..=segments {
                let phi = k as f32 / segments as f32 * TAU;
                let radial = side * phi.cos() + up * phi.sin();
                let p = a + dir * *z + radial * r.max(0.0);
                let n = radial * (1.0 - nz * nz).max(0.0).sqrt() + dir * *nz;
                self.push(p, n, c, [bind.a as u32, bind.b as u32], w, 1.0);
            }
        }
        let row = segments + 1;
        for r in 0..(rings.len() as u32 - 1) {
            for s in 0..segments {
                let i0 = base + r * row + s;
                let i1 = i0 + row;
                self.mesh.indices.extend_from_slice(&[i0, i1, i0 + 1, i1, i1 + 1, i0 + 1]);
            }
        }
    }

    fn unshaded_ellipsoid(&mut self, center: Vec3, radii: Vec3, rot: Quat, color: [u8; 3], bind: Bind) {
        let start = self.mesh.vertices.len();
        self.ellipsoid(center, radii, rot, color, bind, 8, 12);
        for v in &mut self.mesh.vertices[start..] {
            v.shade = 0.0;
        }
    }
}

/// Rigattu suu: tumma suuontelo, jonka reunat seuraavat ylähuulta, leukaa ja
/// suupieliä, sekä hampaat ja kieli. Levossa ontelo on ohut viiva ja
/// hampaiden ja kielen korkeus on nolla, joten ne eivät näy.
fn mouth(b: &mut MeshBuilder, h: &Humanoid, head_c: Vec3, head_r: Vec3, y: f32, mw: f32) {
    let hh = h.head_height;
    let r = h.mouth;
    let lift = hh * 0.012;
    let surface = |x: f32, y: f32| {
        let u = (x / head_r.x).powi(2) + ((y - head_c.y) / head_r.y).powi(2);
        head_c.z + head_r.z * (1.0 - u).max(0.0).sqrt() + lift
    };
    let n = Vec3::new(0.0, -0.25, 1.0).normalize();
    let cavity = srgb_to_linear([0x4a, 0x14, 0x1a]);
    let mh = hh * 0.011;
    // Ontelo: keskipiste + reunakehä. Ylä-/alapuolisko seuraa ylähuulta/leukaa,
    // sivut suupieliä (paino cos²).
    let center = b.push(Vec3::new(0.0, y, surface(0.0, y)), n, cavity, [r.lip_upper as u32, h.jaw as u32], 0.5, 0.0);
    let segments = 24;
    let ring: Vec<u32> = (0..segments)
        .map(|k| {
            let a = k as f32 / segments as f32 * TAU;
            let (x, yy) = (a.cos() * mw, y + a.sin() * mh);
            let corner = if a.cos() >= 0.0 { r.corner_left } else { r.corner_right };
            let lip = if a.sin() >= 0.0 { r.lip_upper } else { h.jaw };
            b.push(Vec3::new(x, yy, surface(x, yy)), n, cavity, [corner as u32, lip as u32], a.cos().powi(2), 0.0)
        })
        .collect();
    for k in 0..segments {
        b.mesh.indices.extend_from_slice(&[center, ring[k], ring[(k + 1) % segments]]);
    }
    // Hampaat (yläreuna ylähuulessa, alareuna hammasluussa) ja kieli (leuka → kielen kärki).
    let strip = |b: &mut MeshBuilder, half_w: f32, z_off: f32, top: usize, bottom: usize, color: [u8; 3]| {
        let c = srgb_to_linear(color);
        let base = b.mesh.vertices.len() as u32;
        let cols = 6;
        for k in 0..=cols {
            let x = -half_w + 2.0 * half_w * k as f32 / cols as f32;
            let z = surface(x, y) + z_off;
            b.push(Vec3::new(x, y, z), n, c, [top as u32, top as u32], 1.0, 0.0);
            b.push(Vec3::new(x, y, z), n, c, [bottom as u32, bottom as u32], 1.0, 0.0);
        }
        for k in 0..cols as u32 {
            let (t0, b0, t1, b1) = (base + 2 * k, base + 2 * k + 1, base + 2 * k + 2, base + 2 * k + 3);
            b.mesh.indices.extend_from_slice(&[t0, b0, t1, t1, b0, b1]);
        }
    };
    strip(b, mw * 0.62, hh * 0.002, r.lip_upper, r.teeth, [0xf6, 0xf4, 0xee]);
    strip(b, mw * 0.5, hh * 0.001, h.jaw, r.tongue, [0xd8, 0x5a, 0x66]);
}

/// Rakentaa verkon luurangon ympärille. Kaikki muodot ovat suljettuja ja
/// ääriviivattomia; vain kasvojen yksityiskohdat ovat tummia.
pub fn build(p: &CharacterParams, h: &Humanoid) -> CharacterMesh {
    let mut b = Builder { mesh: CharacterMesh::default() };
    let bind = h.skeleton.bind_positions();
    let j = |i: usize| bind[i];
    let height = h.proportions.height;
    let wide = p.build.clamp(0.6, 1.6);
    let hh = h.head_height;
    let skin = p.skin;
    let dress = p.clothing == ClothingStyle::Dress;
    let hoodie = p.clothing == ClothingStyle::Hoodie;
    let dark = [0x24, 0x1d, 0x1c];

    // Vartalo.
    let pelvis = j(h.pelvis);
    let chest = j(h.chest);
    let neck = j(h.neck);
    let torso_r = height * 0.085 * wide * if hoodie { 1.1 } else { 1.0 };
    b.ellipsoid(pelvis + Vec3::Y * height * 0.01, Vec3::new(h.proportions.hip_width * 0.62, height * 0.07, height * 0.065 * wide), Quat::IDENTITY, if dress { p.top } else { p.bottom }, Bind::one(h.pelvis), 12, 18);
    b.capsule(pelvis + Vec3::Y * height * 0.03, chest, torso_r * 0.92, torso_r, p.top, Bind { a: h.spine, b: h.pelvis }, 18, true);
    b.ellipsoid(chest + Vec3::Y * height * 0.03, Vec3::new(h.proportions.shoulder_width * 0.52, (neck.y - chest.y) * 0.75, torso_r * 0.95), Quat::IDENTITY, p.top, Bind { a: h.chest, b: h.spine }, 12, 18);
    if hoodie {
        b.ellipsoid(neck + Vec3::new(0.0, -height * 0.005, -torso_r * 0.55), Vec3::new(torso_r * 0.7, height * 0.03, torso_r * 0.4), Quat::IDENTITY, mix(p.top, [0, 0, 0], 0.15), Bind::one(h.chest), 8, 14);
    }
    b.capsule(neck - Vec3::Y * height * 0.01, j(h.head) + Vec3::Y * hh * 0.1, height * 0.028, height * 0.026, skin, Bind { a: h.neck, b: h.chest }, 12, true);

    // Helma: vartalon alareuna tai mekko, sidottu helmaniveliin, jotta se heiluu.
    let hem_len = if dress { height * 0.16 } else { height * 0.035 };
    let hem_top = pelvis.y + height * 0.05;
    let hem_r = if dress { h.proportions.hip_width * 0.75 } else { torso_r * 1.02 };
    for (joint, z) in [(h.hem_front, 1.0f32), (h.hem_back, -1.0)] {
        let center = Vec3::new(0.0, hem_top - hem_len * 0.5, z * hem_r * 0.35);
        let radii = Vec3::new(hem_r * 1.05, hem_len * 0.5 + height * 0.01, hem_r * 0.7);
        b.ellipsoid(center, radii, Quat::IDENTITY, p.top, Bind { a: joint, b: h.pelvis }, 8, 16);
    }

    // Kädet.
    for side in Side::BOTH {
        let arm = h.arm(side);
        let s = side.sign();
        let shoulder = j(arm.upper);
        let elbow = j(arm.fore);
        let wrist = j(arm.hand);
        let r_up = height * 0.032 * wide;
        let r_fore = height * 0.026 * wide;
        b.ellipsoid(shoulder, Vec3::splat(r_up * 1.08), Quat::IDENTITY, p.top, Bind { a: arm.upper, b: h.chest }, 8, 12);
        let sleeve = p.sleeve.clamp(0.0, 1.0);
        if sleeve > 0.15 && sleeve < 0.5 {
            // Lyhythiha päättyy olkavarteen; loppuosa on ihoa (ei päällekkäisiä pintoja).
            let cut = shoulder.lerp(elbow, (sleeve * 1.8).min(0.95));
            b.capsule(shoulder, cut, r_up * 1.06, r_up * 1.04, p.top, Bind { a: arm.upper, b: h.chest }, 12, true);
            b.capsule(cut, elbow, r_up * 0.94, r_fore * 1.05, skin, Bind::one(arm.upper), 12, false);
        } else {
            let upper_color = if sleeve > 0.15 { p.top } else { skin };
            b.capsule(shoulder, elbow, r_up, r_fore * 1.05, upper_color, Bind { a: arm.upper, b: h.chest }, 12, true);
        }
        let fore_color = if sleeve > 0.75 { p.top } else { skin };
        b.capsule(elbow, wrist, r_fore, r_fore * 0.8, fore_color, Bind { a: arm.fore, b: arm.upper }, 12, true);
        if hoodie || sleeve > 0.75 {
            b.capsule(wrist + Vec3::Y * height * 0.03, wrist + Vec3::Y * height * 0.012, r_fore * 0.95, r_fore * 0.92, mix(p.top, [0, 0, 0], 0.12), Bind::one(arm.fore), 12, false);
        }
        // Kämmen: litteä ellipsoidi, kämmenpuoli kohti kehoa.
        let palm_len = arm.hand_len * 0.48;
        let palm_center = wrist + Vec3::new(-s * arm.hand_len * 0.02, -palm_len * 0.55, 0.0);
        b.ellipsoid(palm_center, Vec3::new(arm.hand_len * 0.14, palm_len * 0.6, arm.hand_len * 0.24), Quat::IDENTITY, skin, Bind { a: arm.hand, b: arm.fore }, 8, 12);
        // Viisi sormea, kolme falanksia kussakin.
        for (k, f) in arm.fingers.iter().enumerate() {
            let radius = arm.hand_len * if k == 0 { 0.075 } else { 0.058 } * if k == 4 { 0.85 } else { 1.0 };
            let parent_of_first = arm.hand;
            for seg in 0..3 {
                let a = j(f.joints[seg]);
                let end = if seg < 2 { j(f.joints[seg + 1]) } else { j(f.joints[2]) + f.tip };
                let parent = if seg == 0 { parent_of_first } else { f.joints[seg - 1] };
                let r = radius * (1.0 - seg as f32 * 0.1);
                b.capsule(a, end, r, r * 0.92, skin, Bind { a: f.joints[seg], b: parent }, 8, true);
            }
        }
    }

    // Jalat.
    for side in Side::BOTH {
        let leg = h.leg(side);
        let hip = j(leg.thigh);
        let knee = j(leg.shin);
        let ankle = j(leg.foot);
        let r_thigh = height * 0.045 * wide;
        let r_shin = height * 0.034 * wide;
        let lower_color = if dress { skin } else { p.bottom };
        b.capsule(hip, knee, r_thigh, r_shin * 1.08, if dress { skin } else { p.bottom }, Bind { a: leg.thigh, b: h.pelvis }, 14, true);
        let trouser = p.trouser.clamp(0.0, 1.0);
        let shin_color = if dress || trouser < 0.6 { skin } else { lower_color };
        b.capsule(knee, ankle, r_shin, r_shin * 0.8, shin_color, Bind { a: leg.shin, b: leg.thigh }, 14, true);
        if !dress && trouser < 0.6 {
            b.capsule(knee + Vec3::Y * height * 0.02, knee - Vec3::Y * height * 0.03, r_shin * 1.12, r_shin * 1.05, p.bottom, Bind::one(leg.thigh), 14, false);
        }
        // Kenkä: pitkänomainen ellipsoidi eteenpäin, pohja maassa.
        let shoe_center = Vec3::new(ankle.x, leg.ankle_height * 0.75, ankle.z + leg.foot_len * 0.25);
        b.ellipsoid(shoe_center, Vec3::new(r_shin * 1.15, leg.ankle_height * 0.8, leg.foot_len * 0.55), Quat::IDENTITY, p.shoes, Bind::one(leg.foot), 10, 16);
        b.ellipsoid(Vec3::new(ankle.x, leg.ankle_height * 0.22, ankle.z + leg.foot_len * 0.25), Vec3::new(r_shin * 1.22, leg.ankle_height * 0.25, leg.foot_len * 0.6), Quat::IDENTITY, mix(p.shoes, [255, 255, 255], 0.55), Bind::one(leg.foot), 6, 16);
    }

    // Pää ja kasvot (kasvot katsovat +Z:aan).
    let head_base = j(h.head);
    let head_c = head_base + Vec3::Y * hh * 0.55;
    let head_r = Vec3::new(hh * 0.46, hh * 0.52, hh * 0.46);
    b.ellipsoid(head_c, head_r, Quat::IDENTITY, skin, Bind::one(h.head), 18, 28);
    for s in [-1.0f32, 1.0] {
        b.ellipsoid(head_c + Vec3::new(s * head_r.x * 0.98, -hh * 0.02, 0.0), Vec3::new(hh * 0.06, hh * 0.1, hh * 0.07), Quat::IDENTITY, mix(skin, [0, 0, 0], 0.06), Bind::one(h.head), 6, 10);
    }
    let f = &p.face;
    let eye_y = head_c.y + hh * 0.02;
    let eye_dx = hh * 0.17 * f.eye_spacing.clamp(0.6, 1.5);
    let eye_r = hh * 0.085 * f.eye_size.clamp(0.5, 1.8);
    for s in [-1.0f32, 1.0] {
        // Pinnalle sovitettu syvyys: ellipsoidin z annetulla x/y:llä.
        let surface = |x: f32, y: f32| {
            let u = (x / head_r.x).powi(2) + ((y - head_c.y) / head_r.y).powi(2);
            head_c.z + head_r.z * (1.0 - u).max(0.0).sqrt()
        };
        let x = s * eye_dx;
        let z = surface(x, eye_y);
        let normal = Vec3::new(x / head_r.x.powi(2), (eye_y - head_c.y) / head_r.y.powi(2), (z - head_c.z) / head_r.z.powi(2)).normalize();
        let face_rot = Quat::from_rotation_arc(Vec3::Z, normal);
        b.unshaded_ellipsoid(Vec3::new(x, eye_y, z - eye_r * 0.25), Vec3::new(eye_r * 0.82, eye_r, eye_r * 0.45), face_rot, [0xfb, 0xfb, 0xf8], Bind::one(h.head));
        b.unshaded_ellipsoid(Vec3::new(x, eye_y - eye_r * 0.12, z - eye_r * 0.02), Vec3::new(eye_r * 0.5, eye_r * 0.62, eye_r * 0.3), face_rot, f.eye_color, Bind::one(h.head));
        b.unshaded_ellipsoid(Vec3::new(x + eye_r * 0.15, eye_y + eye_r * 0.18, z + eye_r * 0.06), Vec3::splat(eye_r * 0.14), face_rot, [255, 255, 255], Bind::one(h.head));
        // Kulmakarvat hiusten värillä.
        let brow_y = eye_y + eye_r * 1.45;
        let brow_z = surface(x, brow_y);
        b.unshaded_ellipsoid(Vec3::new(x, brow_y, brow_z - hh * 0.005), Vec3::new(eye_r * 0.85, eye_r * 0.14 * f.brow_thickness.clamp(0.3, 2.5), eye_r * 0.2), face_rot * Quat::from_rotation_z(s * 0.08), mix(p.hair, dark, 0.35), Bind::one(h.head));
        if f.cheeks {
            let cy = eye_y - eye_r * 1.6;
            let cx = s * eye_dx * 1.25;
            b.unshaded_ellipsoid(Vec3::new(cx, cy, surface(cx, cy) - hh * 0.012), Vec3::new(eye_r * 0.6, eye_r * 0.32, eye_r * 0.2), face_rot, mix(skin, [0xe8, 0x6a, 0x6a], 0.35), Bind::one(h.head));
        }
    }
    // Nenä ja suu.
    let nose_y = eye_y - hh * 0.1;
    let nose_z = head_c.z + head_r.z * (1.0 - ((nose_y - head_c.y) / head_r.y).powi(2)).sqrt();
    b.ellipsoid(Vec3::new(0.0, nose_y, nose_z), Vec3::new(hh * 0.035, hh * 0.04, hh * 0.04) * f.nose_size.clamp(0.4, 2.0), Quat::IDENTITY, mix(skin, [0xb0, 0x60, 0x50], 0.12), Bind::one(h.head), 6, 10);
    mouth(&mut b, h, head_c, head_r, j(h.jaw).y, hh * 0.11 * f.mouth_width.clamp(0.4, 2.0));

    // Hiukset.
    match p.hair_style {
        HairStyle::Bald => {}
        HairStyle::Short | HairStyle::Bob | HairStyle::Ponytail => {
            let cap = Vec3::new(head_r.x * 1.07, head_r.y * 0.78, head_r.z * 1.07);
            b.ellipsoid(head_c + Vec3::new(0.0, hh * 0.13, -hh * 0.04), cap, Quat::from_rotation_x(-0.18), p.hair, Bind::one(h.head), 14, 24);
            // Otsatukka.
            b.ellipsoid(head_c + Vec3::new(0.0, hh * 0.3, head_r.z * 0.62), Vec3::new(head_r.x * 0.86, hh * 0.13, hh * 0.16), Quat::from_rotation_x(0.35), p.hair, Bind::one(h.head), 8, 16);
            if p.hair_style == HairStyle::Bob {
                let back = h.hair[0];
                for s in [-1.0f32, 1.0] {
                    b.ellipsoid(head_c + Vec3::new(s * head_r.x * 0.88, -hh * 0.08, -hh * 0.06), Vec3::new(hh * 0.13, hh * 0.32, hh * 0.32), Quat::IDENTITY, p.hair, Bind { a: back, b: h.head }, 10, 14);
                }
                b.ellipsoid(head_c + Vec3::new(0.0, -hh * 0.06, -head_r.z * 0.72), Vec3::new(head_r.x * 0.98, hh * 0.34, hh * 0.2), Quat::IDENTITY, p.hair, Bind { a: back, b: h.head }, 10, 18);
            }
            if p.hair_style == HairStyle::Ponytail {
                if let [h0, h1] = h.hair[..] {
                    let a = j(h0);
                    let m = j(h1);
                    let end = m + (m - a).normalize() * h.proportions.hair_length * 0.5;
                    b.ellipsoid(a, Vec3::splat(hh * 0.09), Quat::IDENTITY, mix(p.hair, [0xff, 0x40, 0x60], 0.6), Bind::one(h.head), 8, 12);
                    b.capsule(a, m, hh * 0.1, hh * 0.09, p.hair, Bind { a: h0, b: h.head }, 12, true);
                    b.capsule(m, end, hh * 0.09, hh * 0.03, p.hair, Bind { a: h1, b: h0 }, 12, true);
                }
            }
        }
    }
    b.mesh
}
