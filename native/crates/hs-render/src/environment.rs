//! Kuvausympäristöt 3D-lavasteina. Tunnisteet ovat samat kuin
//! 2D-taustoilla (`lib/backgrounds.ts`), jotta käsikirjoituksen
//! `[tausta ...]`-tagit toimivat sellaisinaan. Lavasteet ovat suljettuja,
//! ääriviivattomia muotoja kuten `lib/toon-scenery.ts`:n mallit.

use glam::{Quat, Vec3};
use hs_character::{CharacterMesh, MeshBuilder};

pub const KNOWN: &[&str] = &[
    "studio-v1",
    "studio-premium-v1",
    "apartment-v1",
    "city-evening-v1",
    "car-interior-v2",
    "car-driver-v1",
    "car-passenger-v1",
    "car-back-v1",
    "phone-front-v1",
    "phone-angle-v1",
];

/// Tyhjän kuvan taustaväri ympäristölle (sRGB).
pub fn clear_color(id: &str) -> [u8; 3] {
    match id {
        "city-evening-v1" => [0x2b, 0x24, 0x4d],
        "studio-premium-v1" => [0xf3, 0xe9, 0xdc],
        "apartment-v1" => [0xe9, 0xdc, 0xc6],
        id if id.starts_with("car") => [0x9c, 0xc4, 0xe4],
        id if id.starts_with("phone") => [0xd9, 0xe4, 0xf0],
        _ => [0x25, 0x33, 0x41],
    }
}

fn floor_and_wall(b: &mut MeshBuilder, floor: [u8; 3], floor_far: [u8; 3], wall_top: [u8; 3], wall_bottom: [u8; 3]) {
    let (w, d) = (14.0, 6.0);
    b.quad(
        [Vec3::new(-w, 0.0, 4.0), Vec3::new(w, 0.0, 4.0), Vec3::new(w, 0.0, -d), Vec3::new(-w, 0.0, -d)],
        [floor, floor, floor_far, floor_far],
        0.6,
    );
    b.quad(
        [Vec3::new(-w, 0.0, -d), Vec3::new(w, 0.0, -d), Vec3::new(w, 7.0, -d), Vec3::new(-w, 7.0, -d)],
        [wall_bottom, wall_bottom, wall_top, wall_top],
        0.0,
    );
}

pub fn build(id: &str) -> CharacterMesh {
    let mut b = MeshBuilder::new();
    match id {
        "studio-premium-v1" => {
            floor_and_wall(&mut b, [0xe8, 0xdc, 0xcc], [0xd9, 0xca, 0xb6], [0xf6, 0xee, 0xe2], [0xe6, 0xd6, 0xc2]);
            for x in [-2.6f32, 2.6] {
                b.cuboid(Vec3::new(x, 1.1, -3.0), Vec3::new(0.06, 1.1, 0.06), Quat::IDENTITY, [0x5b, 0x4a, 0x3c], 1.0);
                b.sphere(Vec3::new(x, 2.25, -3.0), Vec3::new(0.32, 0.2, 0.32), [0xff, 0xe9, 0xb8]);
            }
        }
        "apartment-v1" => {
            floor_and_wall(&mut b, [0xb8, 0x86, 0x5b], [0x9c, 0x6e, 0x48], [0xf0, 0xe2, 0xc8], [0xe2, 0xcf, 0xae]);
            // Sohva.
            b.cuboid(Vec3::new(-1.6, 0.25, -2.4), Vec3::new(1.1, 0.25, 0.45), Quat::IDENTITY, [0x4f, 0x7a, 0x8c], 1.0);
            b.cuboid(Vec3::new(-1.6, 0.65, -2.8), Vec3::new(1.1, 0.4, 0.15), Quat::IDENTITY, [0x45, 0x6d, 0x7e], 1.0);
            // Ikkuna ja kasvi.
            b.quad(
                [Vec3::new(1.0, 1.0, -5.98), Vec3::new(2.6, 1.0, -5.98), Vec3::new(2.6, 2.4, -5.98), Vec3::new(1.0, 2.4, -5.98)],
                [[0xbf, 0xe3, 0xf5], [0xbf, 0xe3, 0xf5], [0xe8, 0xf6, 0xfd], [0xe8, 0xf6, 0xfd]],
                0.0,
            );
            b.cuboid(Vec3::new(2.4, 0.2, -2.6), Vec3::new(0.18, 0.2, 0.18), Quat::IDENTITY, [0xc0, 0x6a, 0x3c], 1.0);
            b.sphere(Vec3::new(2.4, 0.75, -2.6), Vec3::new(0.35, 0.45, 0.35), [0x4c, 0x9a, 0x52]);
        }
        "city-evening-v1" => {
            floor_and_wall(&mut b, [0x4a, 0x48, 0x58], [0x38, 0x36, 0x46], [0x3b, 0x2f, 0x6b], [0xf0, 0x8a, 0x5d]);
            let heights = [2.2f32, 3.4, 2.6, 4.1, 2.9, 3.6, 2.3];
            for (i, hgt) in heights.iter().enumerate() {
                let x = -6.0 + i as f32 * 2.0;
                b.cuboid(Vec3::new(x, hgt * 0.5, -5.2), Vec3::new(0.85, hgt * 0.5, 0.5), Quat::IDENTITY, [0x2a, 0x26, 0x40], 0.3);
                for row in 0..(*hgt as i32 * 2) {
                    for col in 0..3 {
                        if (i + row as usize + col) % 3 == 0 {
                            continue;
                        }
                        let p = Vec3::new(x - 0.5 + col as f32 * 0.5, 0.45 + row as f32 * 0.48, -4.69);
                        b.cuboid(p, Vec3::new(0.12, 0.1, 0.01), Quat::IDENTITY, [0xff, 0xd5, 0x7a], 0.0);
                    }
                }
            }
            for x in [-3.5f32, 3.5] {
                b.cuboid(Vec3::new(x, 1.3, -1.8), Vec3::new(0.05, 1.3, 0.05), Quat::IDENTITY, [0x22, 0x22, 0x2a], 1.0);
                b.sphere(Vec3::new(x, 2.65, -1.8), Vec3::splat(0.16), [0xff, 0xf0, 0xb0]);
            }
        }
        id if id.starts_with("car") => {
            // Auton sisätila: kojelauta, istuimet, ikkunan kehys.
            floor_and_wall(&mut b, [0x3a, 0x3d, 0x45], [0x2c, 0x2f, 0x36], [0x9c, 0xc4, 0xe4], [0xcf, 0xe3, 0xef]);
            b.cuboid(Vec3::new(0.0, 0.7, 1.6), Vec3::new(1.6, 0.25, 0.4), Quat::from_rotation_x(-0.2), [0x2e, 0x30, 0x36], 1.0);
            let seat_x = if id == "car-passenger-v1" { 0.45 } else { -0.45 };
            b.cuboid(Vec3::new(seat_x, 0.45, -0.35), Vec3::new(0.35, 0.1, 0.35), Quat::IDENTITY, [0x55, 0x5a, 0x66], 1.0);
            b.cuboid(Vec3::new(seat_x, 0.95, -0.7), Vec3::new(0.35, 0.5, 0.1), Quat::from_rotation_x(-0.15), [0x55, 0x5a, 0x66], 1.0);
            for x in [-1.7f32, 1.7] {
                b.cuboid(Vec3::new(x, 1.3, -1.0), Vec3::new(0.08, 1.3, 2.8), Quat::IDENTITY, [0x24, 0x26, 0x2c], 0.6);
            }
            b.cuboid(Vec3::new(0.0, 2.55, -1.0), Vec3::new(1.8, 0.08, 2.8), Quat::IDENTITY, [0x24, 0x26, 0x2c], 0.6);
            if id == "car-driver-v1" {
                b.capsule(Vec3::new(-0.45, 1.0, 1.15), Vec3::new(-0.45, 1.02, 1.2), 0.2, 0.2, [0x1c, 0x1d, 0x22], hs_character::Bind::one(0), 18, false);
            }
        }
        id if id.starts_with("phone") => {
            floor_and_wall(&mut b, [0xc8, 0xd4, 0xe0], [0xb8, 0xc6, 0xd4], [0xe6, 0xee, 0xf6], [0xd2, 0xde, 0xea]);
        }
        _ => {
            // studio-v1 (oletus): sininen studio, kuten 2D-oletustausta #253341.
            floor_and_wall(&mut b, [0x3c, 0x52, 0x66], [0x30, 0x42, 0x54], [0x1f, 0x2b, 0x37], [0x2c, 0x3d, 0x4e]);
        }
    }
    b.finish()
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_known_environment_builds() {
        for id in super::KNOWN {
            let m = super::build(id);
            assert!(m.triangle_count() >= 4, "{id}");
        }
    }
}
