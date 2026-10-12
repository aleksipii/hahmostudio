//! Esineet, jotka rakennetaan ruutukohtaisesti: puhelin ja kosketusvarjo.

use glam::{Quat, Vec3};
use hs_character::{CharacterMesh, MeshBuilder};
use hs_motion::hands::PhoneState;

/// Puhelin: runko, ruutu ja näppäimet; painettu näppäin hehkuu.
pub fn phone(state: &PhoneState) -> CharacterMesh {
    let mut b = MeshBuilder::new();
    let t = state.transform;
    let s = state.spec;
    b.cuboid(t.pos, Vec3::new(s.width * 0.5, s.height * 0.5, s.depth * 0.5), t.rot, [0x23, 0x25, 0x2b], 1.0);
    let screen = t.pos + t.rot * Vec3::new(0.0, 0.0, s.depth * 0.5 + 0.0006);
    b.cuboid(screen, Vec3::new(s.width * 0.45, s.height * 0.46, 0.0004), t.rot, [0x7f, 0xc4, 0xf2], 0.0);
    // Viestikuplat ruudun yläosassa.
    for k in 0..3 {
        let p = t.pos + t.rot * Vec3::new(if k % 2 == 0 { -0.012 } else { 0.012 }, s.height * (0.36 - k as f32 * 0.08), s.depth * 0.5 + 0.0012);
        b.cuboid(p, Vec3::new(s.width * 0.25, s.height * 0.025, 0.0003), t.rot, [0xf4, 0xf8, 0xfc], 0.0);
    }
    for col in 0..3u8 {
        for row in 0..4u8 {
            let x = (col as f32 - 1.0) * s.width * 0.24;
            let y = s.height * (0.03 - row as f32 * 0.07);
            let pressed = state.pressed == Some((col, row));
            let color = if pressed { [0xff, 0xf2, 0x9a] } else { [0xdc, 0xec, 0xf8] };
            let p = t.pos + t.rot * Vec3::new(x, y, s.depth * 0.5 + 0.0012);
            b.cuboid(p, Vec3::new(s.width * 0.1, s.height * 0.028, 0.0003), t.rot, color, 0.0);
        }
    }
    b.finish()
}

/// Pehmeä kosketusvarjo lattialle hahmon alle (läpinäkymätön, lattiaa tummempi).
pub fn contact_shadow(center: Vec3, radius: f32, floor: [u8; 3]) -> CharacterMesh {
    let mut b = MeshBuilder::new();
    let dark = [0, 1, 2].map(|i| (floor[i] as f32 * 0.72) as u8);
    b.ellipsoid(Vec3::new(center.x, 0.0, center.z), Vec3::new(radius, 0.004, radius * 0.6), Quat::IDENTITY, dark, hs_character::Bind::one(0), 4, 24);
    let m = b.finish();
    let mut m = m;
    for v in &mut m.vertices {
        v.shade = 0.0;
        v.normal = [0.0, 1.0, 0.0];
    }
    m
}
