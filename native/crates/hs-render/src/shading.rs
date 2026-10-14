//! Yhteinen varjostusmalli. Sama kaava on WGSL:nä tiedostossa `shaders/toon.wgsl`;
//! muutokset tehdään molempiin, ja testi `gpu_matches_cpu` valvoo yhtäpitävyyttä.

use crate::scene::{Lights, ShadingStyle};
use glam::Vec3;

pub fn shade(base: Vec3, normal: Vec3, to_eye: Vec3, shade_flag: f32, style: ShadingStyle, l: &Lights) -> Vec3 {
    let n = normal.normalize_or_zero();
    let v = to_eye.normalize_or_zero();
    // Direction magnitude is not brightness; intensity lives in light.color.
    let key = -l.key.dir.normalize_or_zero();
    let fill = -l.fill.dir.normalize_or_zero();
    let back = -l.rim.dir.normalize_or_zero();
    let key_facing = n.dot(key).max(0.0);
    let mut k = key_facing;
    let mut f = n.dot(fill).max(0.0);
    let facing = n.dot(v).max(0.0);
    let mut rim = (1.0 - facing).powi(3) * (n.dot(back) * 0.5 + 0.5);
    if style == ShadingStyle::Cel {
        k = if k > 0.5 { 1.0 } else if k > 0.18 { 0.6 } else { 0.3 };
        f = if f > 0.3 { 0.8 } else { 0.35 };
        rim = if rim > 0.35 { 1.0 } else { 0.0 };
    }
    // Takavalon reunakorostus vain hahmoille ja esineille (ei lattialle/seinälle).
    if shade_flag < 0.9 {
        rim = 0.0;
    }
    let lit = l.ambient + l.key.color * k + l.fill.color * f;
    let lit = match style {
        ShadingStyle::Flat => Vec3::ONE.lerp(lit, 0.3),
        ShadingStyle::Cel => lit,
    };
    let rim_amount = if style == ShadingStyle::Flat { 0.15 } else { 0.35 };
    // A small key-light highlight gives character/prop surfaces readable form
    // as the camera moves. It is intentionally a stylized approximation, not
    // a per-material BRDF. Backgrounds and unlit facial features keep their
    // original response. Turning off the key light also turns this off.
    let half = (key + v).normalize_or_zero();
    let mut specular = n.dot(half).max(0.0).powi(32) * key_facing;
    if style == ShadingStyle::Cel {
        specular = if specular > 0.65 { 1.0 } else { 0.0 };
    }
    if shade_flag < 0.9 { specular = 0.0; }
    let strength = if style == ShadingStyle::Flat { 0.08 } else { 0.05 };
    let lit_color = base * lit + l.rim.color * rim * rim_amount + l.key.color * (specular * strength);
    // Silmät ja suu: lähes valaisematon perusväri.
    let unlit = base * (0.92 + 0.08 * k);
    unlit.lerp(lit_color, shade_flag.clamp(0.0, 1.0))
}

/// Ääriviivojen muste (lineaarinen RGB). Sama vakio on varjostimessa `INK`.
pub const INK: Vec3 = Vec3::new(0.012, 0.009, 0.011);

pub fn linear_to_srgb(x: f32) -> u8 {
    let x = x.clamp(0.0, 1.0);
    let s = if x <= 0.003_130_8 { x * 12.92 } else { 1.055 * x.powf(1.0 / 2.4) - 0.055 };
    (s * 255.0 + 0.5) as u8
}
