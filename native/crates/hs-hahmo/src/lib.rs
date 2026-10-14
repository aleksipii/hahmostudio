//! Olemassa olevien `.hahmo`-projektien häviötön luku, kirjoitus, historia ja 2D-renderöinti.
//!
//! Natiivisovellus avaa ja säilyttää nykyiset
//! projektit (muodot v1–v5) ja piirtää PSD-tasoihin perustuvan rigin
//! animaation samoin säännöin kuin `lib/animation-transform.ts` ja
//! `lib/psd-render.ts`. Tuotantokokoonpanoja (`presentations`), Cutout3D:tä,
//! taustakuvia ja ei-normaaleja sekoitustiloja ei vielä piirretä; ne on
//! kirjattu pariteettilistaan (`native/PARITEETTI.md`).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
mod archive;
pub use archive::PortableHistory;
use tiny_skia::{Pixmap, PixmapPaint, Transform};

pub const MAX_ARCHIVE_BYTES: u64 = 128 * 1024 * 1024;
pub const MAX_LAYERS: usize = 1000;
pub const MAX_LAYER_PIXELS: u64 = 16_000_000;
pub const MAX_DECODED_PIXELS: u64 = 48_000_000;

#[derive(Debug, thiserror::Error)]
pub enum HahmoError {
    #[error("tiedosto ei ole .hahmo-arkisto: {0}")]
    Archive(String),
    #[error("tuntematon projektimuoto")]
    Format,
    #[error("projekti on liian suuri: {0}")]
    TooLarge(String),
    #[error("virheellinen projekti: {0}")]
    Invalid(String),
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Layer {
    pub key: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub left: f64,
    #[serde(default)]
    pub top: f64,
    #[serde(default)]
    pub width: f64,
    #[serde(default)]
    pub height: f64,
    #[serde(default = "one")]
    pub opacity: f64,
    #[serde(default = "yes")]
    pub visible: bool,
    #[serde(default)]
    pub blend_mode: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub children: Vec<Layer>,
}

fn one() -> f64 {
    1.0
}
fn yes() -> bool {
    true
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Document {
    #[serde(default)]
    pub name: String,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub layers: Vec<Layer>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Part {
    pub key: String,
    pub pivot: Point,
    #[serde(default)]
    pub parent_key: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Rig {
    pub parts: Vec<Part>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Bezier {
    pub cp1: Point,
    pub cp2: Point,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Keyframe {
    pub frame: f64,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub scale: f64,
    pub opacity: f64,
    pub easing: String,
    #[serde(default)]
    pub bezier_curve: Option<Bezier>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Track {
    pub key: String,
    pub frames: Vec<Keyframe>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Animation {
    pub fps: f64,
    pub duration: f64,
    pub rig: Rig,
    #[serde(default)]
    pub tracks: Vec<Track>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Scene {
    pub width: f64,
    pub height: f64,
    #[serde(default = "default_bg")]
    pub background: String,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
}

fn default_bg() -> String {
    "#253341".into()
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct ProjectJson {
    format: String,
    version: u32,
    document: Document,
    animation: Option<Animation>,
    scene: Option<Scene>,
}

/// Avattu projekti: metatiedot ja puretut tasokuvat.
pub struct Project {
    metadata: serde_json::Value,
    resources: std::collections::BTreeMap<String, Vec<u8>>,
    original: Vec<u8>,
    dirty: bool,
    pub version: u32,
    pub document: Document,
    pub animation: Option<Animation>,
    pub scene: Option<Scene>,
    pub images: HashMap<String, Pixmap>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Pose {
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub scale: f64,
    pub opacity: f64,
}

pub const NEUTRAL: Pose = Pose { x: 0.0, y: 0.0, rotation: 0.0, scale: 1.0, opacity: 1.0 };

fn cubic(t: f64, p1: f64, p2: f64) -> f64 {
    let u = 1.0 - t;
    3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t
}

/// Sama kuin `sampleBezierCurve` (30 kierroksen puolitushaku).
pub fn sample_bezier(c: &Bezier, t: f64) -> f64 {
    if t <= 0.0 {
        return 0.0;
    }
    if t >= 1.0 {
        return 1.0;
    }
    let (mut lo, mut hi, mut mid) = (0.0, 1.0, t);
    for _ in 0..30 {
        if cubic(mid, c.cp1.x, c.cp2.x) < t {
            lo = mid;
        } else {
            hi = mid;
        }
        mid = (lo + hi) / 2.0;
    }
    cubic(mid, c.cp1.y, c.cp2.y)
}

/// Sama kuin `sampleTrack` (`lib/animation-model.ts`).
pub fn sample_track(track: Option<&Track>, frame: f64) -> Pose {
    let Some(track) = track.filter(|t| !t.frames.is_empty()) else { return NEUTRAL };
    let f = &track.frames;
    let pose = |k: &Keyframe| Pose { x: k.x, y: k.y, rotation: k.rotation, scale: k.scale, opacity: k.opacity };
    if frame <= f[0].frame {
        return pose(&f[0]);
    }
    let last = f.last().unwrap();
    if frame >= last.frame {
        return pose(last);
    }
    let right = f.partition_point(|k| k.frame <= frame);
    let (a, b) = (&f[right - 1], &f[right]);
    let mut t = (frame - a.frame) / (b.frame - a.frame);
    if a.easing == "hold" {
        t = 0.0;
    } else if let Some(c) = &a.bezier_curve {
        t = sample_bezier(c, t);
    } else if a.easing == "smooth" {
        t = t * t * (3.0 - 2.0 * t);
    }
    let l = |x: f64, y: f64| x + (y - x) * t;
    Pose { x: l(a.x, b.x), y: l(a.y, b.y), rotation: l(a.rotation, b.rotation), scale: l(a.scale, b.scale), opacity: l(a.opacity, b.opacity) }
}

/// Affiinimuunnos (a, b, c, d, e, f) ja peittävyys kuten `animationTransforms`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Affine {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub e: f64,
    pub f: f64,
    pub opacity: f64,
}

impl Affine {
    const IDENTITY: Affine = Affine { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: 0.0, opacity: 1.0 };
    fn combine(p: Affine, q: Affine) -> Affine {
        Affine {
            a: p.a * q.a + p.c * q.b,
            b: p.b * q.a + p.d * q.b,
            c: p.a * q.c + p.c * q.d,
            d: p.b * q.c + p.d * q.d,
            e: p.a * q.e + p.c * q.f + p.e,
            f: p.b * q.e + p.d * q.f + p.f,
            opacity: p.opacity * q.opacity,
        }
    }
}

pub fn animation_transforms(animation: &Animation, frame: f64) -> Result<HashMap<String, Affine>, HahmoError> {
    let parts: HashMap<&str, &Part> = animation.rig.parts.iter().map(|p| (p.key.as_str(), p)).collect();
    let tracks: HashMap<&str, &Track> = animation.tracks.iter().map(|t| (t.key.as_str(), t)).collect();
    let mut out: HashMap<String, Affine> = HashMap::new();
    fn resolve<'a>(key: &'a str, parts: &HashMap<&str, &'a Part>, tracks: &HashMap<&str, &Track>, frame: f64, out: &mut HashMap<String, Affine>, visiting: &mut Vec<&'a str>) -> Result<Affine, HahmoError> {
        if let Some(a) = out.get(key) {
            return Ok(*a);
        }
        if visiting.contains(&key) {
            return Err(HahmoError::Invalid("osien liitoksissa on kehä".into()));
        }
        visiting.push(key);
        let part = parts.get(key).ok_or_else(|| HahmoError::Invalid("liitettyä osaa ei löydy".into()))?;
        let pose = sample_track(tracks.get(key).copied(), frame);
        let ang = pose.rotation.to_radians();
        let (a, b) = (ang.cos() * pose.scale, ang.sin() * pose.scale);
        let (c, d) = (-b, a);
        let local = Affine {
            a,
            b,
            c,
            d,
            e: part.pivot.x + pose.x - a * part.pivot.x - c * part.pivot.y,
            f: part.pivot.y + pose.y - b * part.pivot.x - d * part.pivot.y,
            opacity: pose.opacity,
        };
        let parent = match &part.parent_key {
            Some(p) => resolve(p, parts, tracks, frame, out, visiting)?,
            None => Affine::IDENTITY,
        };
        let value = Affine::combine(parent, local);
        visiting.pop();
        out.insert(key.to_string(), value);
        Ok(value)
    }
    for p in &animation.rig.parts {
        let mut visiting = Vec::new();
        resolve(&p.key, &parts, &tracks, frame, &mut out, &mut visiting)?;
    }
    Ok(out)
}

fn count_layers(layers: &[Layer]) -> usize {
    layers.iter().map(|l| 1 + count_layers(&l.children)).sum()
}

impl Project {
    pub fn open(bytes: &[u8]) -> Result<Project, HahmoError> {
        if bytes.len() as u64 > MAX_ARCHIVE_BYTES {
            return Err(HahmoError::TooLarge("yli 128 MiB".into()));
        }
        let resources = archive::unpack(bytes)?;
        let json = resources.get("project.json").ok_or_else(|| HahmoError::Invalid("project.json puuttuu".into()))?;
        let metadata: serde_json::Value = serde_json::from_slice(json).map_err(|e| HahmoError::Invalid(e.to_string()))?;
        archive::validate_metadata(&metadata, &resources)?;
        let read = |name: &str, _limit: u64| -> Result<Vec<u8>, HahmoError> {
            resources.get(name).cloned().ok_or_else(|| HahmoError::Invalid(format!("{name}: resurssi puuttuu")))
        };
        let data: ProjectJson = serde_json::from_slice(json).map_err(|e| HahmoError::Invalid(e.to_string()))?;
        if data.format != "hahmostudio-project" || !(1..=5).contains(&data.version) {
            return Err(HahmoError::Format);
        }
        if count_layers(&data.document.layers) > MAX_LAYERS {
            return Err(HahmoError::TooLarge("yli 1000 tasoa".into()));
        }
        let mut images = HashMap::new();
        let mut decoded: u64 = 0;
        let mut stack: Vec<&Layer> = data.document.layers.iter().collect();
        while let Some(l) = stack.pop() {
            stack.extend(l.children.iter());
            let Some(path) = &l.image else { continue };
            if images.contains_key(path) {
                continue;
            }
            let png = read(path, MAX_ARCHIVE_BYTES)?;
            // Tarkista mitat otsakkeesta ennen purkua.
            if png.len() < 24 || &png[1..4] != b"PNG" {
                return Err(HahmoError::Invalid(format!("{path}: ei PNG")));
            }
            let (w, h) = (u32::from_be_bytes(png[16..20].try_into().unwrap()), u32::from_be_bytes(png[20..24].try_into().unwrap()));
            let px = w as u64 * h as u64;
            decoded += px;
            if px > MAX_LAYER_PIXELS || decoded > MAX_DECODED_PIXELS {
                return Err(HahmoError::TooLarge(format!("{path}: {w}×{h}")));
            }
            let pixmap = Pixmap::decode_png(&png).map_err(|e| HahmoError::Invalid(format!("{path}: {e}")))?;
            images.insert(path.clone(), pixmap);
        }
        let project = Project { metadata, resources, original: bytes.to_vec(), dirty: false, version: data.version, document: data.document, animation: data.animation, scene: data.scene, images };
        project.history()?;
        Ok(project)
    }

    pub fn frame_count(&self) -> u32 {
        self.animation.as_ref().map_or(1, |a| a.duration.max(1.0) as u32)
    }

    pub fn fps(&self) -> f64 {
        self.animation.as_ref().map_or(24.0, |a| a.fps)
    }

    /// Piirtää ruudun kuten `renderScene` ilman tuotantokokoonpanoja.
    pub fn render(&self, frame: u32) -> Result<Pixmap, HahmoError> {
        let doc = &self.document;
        let (w, h, bg, place) = match &self.scene {
            Some(s) => {
                let x = s.x - doc.width * s.scale / 2.0;
                let y = s.y - doc.height * s.scale / 2.0;
                (s.width, s.height, s.background.clone(), Transform::from_row(s.scale as f32, 0.0, 0.0, s.scale as f32, x as f32, y as f32))
            }
            None => (doc.width, doc.height, "#00000000".into(), Transform::identity()),
        };
        let mut pixmap = Pixmap::new(w.round().max(1.0) as u32, h.round().max(1.0) as u32).ok_or_else(|| HahmoError::Invalid("kuvakoko".into()))?;
        if let Some(c) = parse_hex(&bg) {
            pixmap.fill(c);
        }
        let transforms = match &self.animation {
            Some(a) => animation_transforms(a, frame as f64)?,
            None => HashMap::new(),
        };
        self.paint(&mut pixmap, &doc.layers, place, 1.0, &transforms);
        Ok(pixmap)
    }

    fn paint(&self, target: &mut Pixmap, layers: &[Layer], base: Transform, alpha: f64, transforms: &HashMap<String, Affine>) {
        for l in layers {
            if !l.visible {
                continue;
            }
            let opacity = alpha * l.opacity;
            if l.kind == "group" {
                self.paint(target, &l.children, base, opacity, transforms);
                continue;
            }
            let Some(img) = l.image.as_ref().and_then(|p| self.images.get(p)) else { continue };
            let (mut t, mut o) = (base, opacity);
            if let Some(a) = transforms.get(&l.key) {
                t = t.pre_concat(Transform::from_row(a.a as f32, a.b as f32, a.c as f32, a.d as f32, a.e as f32, a.f as f32));
                o *= a.opacity;
            }
            // Kuva venytetään tason laatikkoon (left, top, width, height).
            let sx = l.width / img.width().max(1) as f64;
            let sy = l.height / img.height().max(1) as f64;
            t = t.pre_concat(Transform::from_row(sx as f32, 0.0, 0.0, sy as f32, l.left as f32, l.top as f32));
            let paint = PixmapPaint { opacity: o.clamp(0.0, 1.0) as f32, quality: tiny_skia::FilterQuality::Bilinear, ..Default::default() };
            target.draw_pixmap(0, 0, img.as_ref(), &paint, t, None);
        }
    }
}

fn parse_hex(s: &str) -> Option<tiny_skia::Color> {
    let h = s.strip_prefix('#')?;
    let v = |i: usize| u8::from_str_radix(h.get(i..i + 2)?, 16).ok();
    match h.len() {
        6 => Some(tiny_skia::Color::from_rgba8(v(0)?, v(2)?, v(4)?, 255)),
        8 => Some(tiny_skia::Color::from_rgba8(v(0)?, v(2)?, v(4)?, v(6)?)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example(name: &str) -> Vec<u8> {
        std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..").join(name)).expect("esimerkkiprojekti")
    }

    #[test]
    fn opens_shipped_examples_and_animates() {
        for name in ["Esimerkki-kavely.hahmo", "Esimerkki-nivelet-ja-aannepuhe.hahmo", "Esimerkki-pystyjakso.hahmo"] {
            let p = Project::open(&example(name)).unwrap_or_else(|e| panic!("{name}: {e}"));
            assert!(!p.images.is_empty(), "{name}");
            let a = p.render(0).unwrap();
            let b = p.render(p.frame_count() / 2).unwrap();
            assert!(a.width() > 0);
            if p.animation.as_ref().is_some_and(|a| !a.tracks.is_empty()) {
                assert_ne!(a.data(), b.data(), "{name}: animaatio ei liikuta mitään");
            }
        }
    }

    #[test]
    fn bezier_matches_endpoints_and_linear() {
        let lin = Bezier { cp1: Point { x: 0.0, y: 0.0 }, cp2: Point { x: 1.0, y: 1.0 } };
        for t in [0.1, 0.5, 0.9] {
            assert!((sample_bezier(&lin, t) - t).abs() < 1e-6);
        }
    }

    #[test]
    fn rejects_non_projects() {
        assert!(Project::open(b"not a zip").is_err());
    }
}
