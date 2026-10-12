//! Yhteinen varjostusmalli. Sama kaava on WGSL:nä tiedostossa `shaders/toon.wgsl`;
//! muutokset tehdään molempiin, ja testi `gpu_matches_cpu` valvoo yhtäpitävyyttä.

use crate::scene::{Lights, ShadingStyle};
use glam::Vec3;

pub fn shade(base: Vec3, normal: Vec3, to_eye: Vec3, shade_flag: f32, style: ShadingStyle, l: &Lights) -> Vec3 {
    let n = normal.normalize_or_zero();
    let v = to_eye.normalize_or_zero();
    let mut k = n.dot(-l.key.dir).max(0.0);
    let mut f = n.dot(-l.fill.dir).max(0.0);
    let facing = n.dot(v).max(0.0);
    let mut rim = (1.0 - facing).powi(3) * (n.dot(-l.rim.dir) * 0.5 + 0.5);
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
    let lit_color = base * lit + l.rim.color * rim * rim_amount;
    // Silmät ja suu: lähes valaisematon perusväri.
    let unlit = base * (0.92 + 0.08 * k);
    unlit.lerp(lit_color, shade_flag.clamp(0.0, 1.0))
}

pub fn linear_to_srgb(x: f32) -> u8 {
    let x = x.clamp(0.0, 1.0);
    let s = if x <= 0.003_130_8 { x * 12.92 } else { 1.055 * x.powf(1.0 / 2.4) - 0.055 };
    (s * 255.0 + 0.5) as u8
}
