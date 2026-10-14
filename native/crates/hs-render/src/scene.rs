use glam::{Mat4, Vec3};
use hs_character::CharacterMesh;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Camera {
    pub eye: Vec3,
    pub target: Vec3,
    /// Pystysuuntainen näkökenttä asteina.
    pub fov_y: f32,
}

impl Camera {
    pub fn view_proj(&self, aspect: f32) -> Mat4 {
        let view = Mat4::look_at_rh(self.eye, self.target, Vec3::Y);
        let proj = Mat4::perspective_rh(self.fov_y.to_radians().clamp(0.05, 3.0), aspect.max(1e-3), 0.05, 100.0);
        proj * view
    }
}

/// Suuntavalo. `dir` on suunta, johon valo kulkee; `color` sisältää voimakkuuden (lineaarinen).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Light {
    pub dir: Vec3,
    pub color: Vec3,
}

/// Kolmipistevalaistus: avain-, täyte- ja takavalo sekä ympäristövalo.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Lights {
    pub key: Light,
    pub fill: Light,
    pub rim: Light,
    pub ambient: Vec3,
}

impl Default for Lights {
    fn default() -> Self {
        Lights {
            key: Light { dir: Vec3::new(-0.5, -0.6, -0.6).normalize(), color: Vec3::splat(0.75) },
            fill: Light { dir: Vec3::new(0.7, -0.2, -0.5).normalize(), color: Vec3::splat(0.25) },
            rim: Light { dir: Vec3::new(0.0, -0.3, 1.0).normalize(), color: Vec3::splat(0.5) },
            ambient: Vec3::splat(0.32),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShadingStyle {
    /// Perusvärit ja hyvin kevyt valo (vastaa `renderStyle: flat`).
    Flat = 0,
    /// Porrastettu sarjakuvavarjostus (vastaa `renderStyle: cel`).
    Cel = 1,
}

/// Piirrettävä verkko ja sen ihomatriisit (tyhjä = jäykkä, identiteetti).
#[derive(Clone, Debug)]
pub struct DrawItem {
    pub mesh: Arc<CharacterMesh>,
    pub skin: Vec<Mat4>,
    /// Piirretäänkö sarjakuvamainen ääriviiva (hahmot ja esineet, ei lavasteet).
    pub outline: bool,
    /// False for raster-only decorations, such as painted contact shadows.
    pub ray_visible: bool,
}

impl DrawItem {
    pub fn rigid(mesh: Arc<CharacterMesh>) -> Self {
        DrawItem { mesh, skin: Vec::new(), outline: false, ray_visible: true }
    }
    /// Luilla liikkuva hahmo ääriviivoineen.
    pub fn skinned(mesh: Arc<CharacterMesh>, skin: Vec<Mat4>) -> Self {
        DrawItem { mesh, skin, outline: true, ray_visible: true }
    }
    pub fn with_outline(mut self, outline: bool) -> Self {
        self.outline = outline;
        self
    }
    pub fn raster_only(mut self) -> Self { self.ray_visible = false; self }
    pub fn skin_matrix(&self, bone: u32) -> Mat4 {
        self.skin.get(bone as usize).copied().unwrap_or(Mat4::IDENTITY)
    }
}

#[derive(Clone, Debug)]
pub struct RenderScene {
    pub width: u32,
    pub height: u32,
    pub camera: Camera,
    pub lights: Lights,
    pub style: ShadingStyle,
    /// Taustaväri (sRGB) niille kohdille, joihin mikään ei piirry.
    pub clear: [u8; 3],
    /// Ääriviivan leveys pikseleinä (0 = ei ääriviivoja).
    pub outline: f32,
    pub items: Vec<DrawItem>,
}

impl RenderScene {
    /// Ääriviivan leveys maailman yksikköinä yhtä leikekoordinaatin w-yksikköä kohden:
    /// siirtymä `normaali · k · w` näkyy kuvassa `outline` pikselin levyisenä etäisyydestä riippumatta.
    pub fn outline_factor(&self) -> f32 {
        if self.outline <= 0.0 {
            return 0.0;
        }
        self.outline * 2.0 * (self.camera.fov_y.to_radians() * 0.5).tan() / self.height.max(1) as f32
    }
}

/// RGBA8-kuva (sRGB), rivit ylhäältä alas.
#[derive(Clone, Debug, PartialEq)]
pub struct Image {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

impl Image {
    pub fn new(width: u32, height: u32) -> Image {
        Image { width, height, rgba: vec![0; (width * height * 4) as usize] }
    }
    pub fn pixel(&self, x: u32, y: u32) -> [u8; 4] {
        let i = ((y * self.width + x) * 4) as usize;
        [self.rgba[i], self.rgba[i + 1], self.rgba[i + 2], self.rgba[i + 3]]
    }
    /// Keskimääräinen kanavakohtainen ero toiseen kuvaan (0..255).
    pub fn mean_abs_diff(&self, other: &Image) -> f32 {
        assert_eq!((self.width, self.height), (other.width, other.height));
        let sum: u64 = self.rgba.iter().zip(&other.rgba).map(|(a, b)| (*a as i32 - *b as i32).unsigned_abs() as u64).sum();
        sum as f32 / self.rgba.len() as f32
    }
    /// Osuus pikseleistä, jotka eroavat yli `threshold` jollain kanavalla.
    pub fn differing_fraction(&self, other: &Image, threshold: u8) -> f32 {
        let n = self.rgba.chunks(4).zip(other.rgba.chunks(4)).filter(|(a, b)| a.iter().zip(b.iter()).any(|(x, y)| x.abs_diff(*y) > threshold)).count();
        n as f32 / (self.width * self.height) as f32
    }
}
