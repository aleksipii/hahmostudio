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
    "kitchen-v1",
    "classroom-v1",
    "park-day-v1",
    "street-day-v1",
];

/// Tyhjän kuvan taustaväri ympäristölle (sRGB).
pub fn clear_color(id: &str) -> [u8; 3] {
    match id {
        "city-evening-v1" => [0x2b, 0x24, 0x4d],
        "studio-premium-v1" => [0xf3, 0xe9, 0xdc],
        "apartment-v1" => [0xe9, 0xdc, 0xc6],
        "kitchen-v1" => [0xf2, 0xe8, 0xd0],
        "classroom-v1" => [0xe6, 0xe2, 0xc8],
        "park-day-v1" | "street-day-v1" => [0x9c, 0xd2, 0xf0],
        id if id.starts_with("car") => [0x9c, 0xc4, 0xe4],
        id if id.starts_with("phone") => [0xd9, 0xe4, 0xf0],
        _ => [0x25, 0x33, 0x41],
    }
}

/// Lattian väri hahmon kohdalla (kosketusvarjo tummennetaan tästä).
pub fn floor_color(id: &str) -> [u8; 3] {
    match id {
        "studio-premium-v1" => [0xe8, 0xdc, 0xcc],
        "apartment-v1" => [0xb8, 0x86, 0x5b],
        "city-evening-v1" => [0x4a, 0x48, 0x58],
        "kitchen-v1" => [0xd8, 0xd4, 0xc8],
        "classroom-v1" => [0xb0, 0x8a, 0x60],
        "park-day-v1" => [0x6c, 0xb8, 0x58],
        "street-day-v1" => [0x8c, 0x8c, 0x90],
        id if id.starts_with("car") => [0x3a, 0x3d, 0x45],
        id if id.starts_with("phone") => [0xc8, 0xd4, 0xe0],
        _ => [0x3c, 0x52, 0x66],
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
                        if (i + row as usize + col).is_multiple_of(3) {
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
        "kitchen-v1" => {
            // Keittiö: laatoitettu lattia, kaapit, työtaso, jääkaappi, ikkuna ja pöytä.
            floor_and_wall(&mut b, [0xd8, 0xd4, 0xc8], [0xc4, 0xbe, 0xb0], [0xf6, 0xec, 0xc8], [0xee, 0xde, 0xb4]);
            for i in 0..6 {
                let x = -3.0 + i as f32 * 0.62;
                b.cuboid(Vec3::new(x, 0.45, -5.6), Vec3::new(0.3, 0.45, 0.35), Quat::IDENTITY, [0x6a, 0x9c, 0xb8], 1.0);
                b.cuboid(Vec3::new(x, 2.05, -5.75), Vec3::new(0.3, 0.35, 0.22), Quat::IDENTITY, [0x6a, 0x9c, 0xb8], 1.0);
                b.cuboid(Vec3::new(x + 0.18, 0.62, -5.24), Vec3::new(0.06, 0.015, 0.01), Quat::IDENTITY, [0xd8, 0xd8, 0xd8], 1.0);
            }
            b.cuboid(Vec3::new(-1.45, 0.93, -5.6), Vec3::new(1.95, 0.04, 0.38), Quat::IDENTITY, [0xf4, 0xf2, 0xee], 1.0);
            b.cuboid(Vec3::new(1.2, 0.95, -5.5), Vec3::new(0.4, 0.95, 0.4), Quat::IDENTITY, [0xf2, 0xf2, 0xf4], 1.0);
            b.cuboid(Vec3::new(0.86, 1.25, -5.09), Vec3::new(0.02, 0.2, 0.01), Quat::IDENTITY, [0x9a, 0x9a, 0xa4], 1.0);
            b.quad(
                [Vec3::new(2.2, 1.1, -5.98), Vec3::new(3.6, 1.1, -5.98), Vec3::new(3.6, 2.3, -5.98), Vec3::new(2.2, 2.3, -5.98)],
                [[0xa8, 0xd8, 0xf4], [0xa8, 0xd8, 0xf4], [0xd8, 0xf0, 0xfc], [0xd8, 0xf0, 0xfc]],
                0.0,
            );
            // Pöytä ja tuolit.
            b.cuboid(Vec3::new(2.4, 0.72, -2.6), Vec3::new(0.7, 0.03, 0.45), Quat::IDENTITY, [0xc0, 0x86, 0x52], 1.0);
            for (dx, dz) in [(-0.6f32, -0.38f32), (0.6, -0.38), (-0.6, 0.38), (0.6, 0.38)] {
                b.cuboid(Vec3::new(2.4 + dx, 0.36, -2.6 + dz), Vec3::new(0.03, 0.36, 0.03), Quat::IDENTITY, [0xa0, 0x6c, 0x40], 1.0);
            }
            b.cuboid(Vec3::new(2.4, 0.8, -2.6), Vec3::new(0.12, 0.05, 0.12), Quat::IDENTITY, [0xe8, 0x5a, 0x3a], 1.0);
        }
        "classroom-v1" => {
            floor_and_wall(&mut b, [0xb0, 0x8a, 0x60], [0x98, 0x74, 0x50], [0xf0, 0xec, 0xd2], [0xd8, 0xe4, 0xc8]);
            // Liitutaulu, opettajan pöytä ja oppilaiden pulpetit.
            b.cuboid(Vec3::new(-0.6, 1.7, -5.95), Vec3::new(1.9, 0.7, 0.03), Quat::IDENTITY, [0x5a, 0x40, 0x2a], 1.0);
            b.quad(
                [Vec3::new(-2.4, 1.07, -5.9), Vec3::new(1.2, 1.07, -5.9), Vec3::new(1.2, 2.33, -5.9), Vec3::new(-2.4, 2.33, -5.9)],
                [[0x2e, 0x5a, 0x46], [0x2e, 0x5a, 0x46], [0x36, 0x66, 0x50], [0x36, 0x66, 0x50]],
                0.0,
            );
            for (x, y, w) in [(-1.8f32, 2.0f32, 0.5f32), (-1.0, 1.8, 0.7), (-1.5, 1.55, 0.4)] {
                b.cuboid(Vec3::new(x, y, -5.88), Vec3::new(w * 0.5, 0.012, 0.004), Quat::IDENTITY, [0xf4, 0xf4, 0xee], 0.0);
            }
            b.cuboid(Vec3::new(2.6, 0.75, -4.4), Vec3::new(0.6, 0.04, 0.35), Quat::IDENTITY, [0x8a, 0x5c, 0x3a], 1.0);
            b.cuboid(Vec3::new(2.6, 0.37, -4.4), Vec3::new(0.56, 0.37, 0.3), Quat::IDENTITY, [0x7a, 0x50, 0x32], 1.0);
            b.sphere(Vec3::new(2.3, 0.86, -4.4), Vec3::new(0.07, 0.08, 0.07), [0xd8, 0x3a, 0x34]);
            for row in 0..2 {
                for col in 0..4 {
                    let p = Vec3::new(-3.6 + col as f32 * 1.6, 0.0, -2.9 + row as f32 * 1.2);
                    if col == 2 || col == 1 && row == 1 {
                        continue; // käytävä hahmoille
                    }
                    b.cuboid(p + Vec3::Y * 0.62, Vec3::new(0.38, 0.03, 0.26), Quat::IDENTITY, [0xd8, 0xb0, 0x7a], 1.0);
                    b.cuboid(p + Vec3::Y * 0.31, Vec3::new(0.03, 0.31, 0.2), Quat::IDENTITY, [0x5a, 0x5a, 0x64], 1.0);
                }
            }
        }
        "park-day-v1" | "street-day-v1" => {
            let street = id == "street-day-v1";
            if street {
                floor_and_wall(&mut b, [0x8c, 0x8c, 0x90], [0x74, 0x74, 0x7a], [0x7e, 0xc0, 0xec], [0xc8, 0xe6, 0xf6]);
                // Jalkakäytävä, talot ja liikennevalo.
                b.cuboid(Vec3::new(0.0, 0.03, -2.4), Vec3::new(14.0, 0.03, 1.1), Quat::IDENTITY, [0xb8, 0xb4, 0xac], 1.0);
                let houses = [([0xe0, 0x8a, 0x5a], 2.6f32), ([0xf0, 0xd0, 0x7a], 3.4), ([0x8a, 0xb8, 0xd8], 2.8), ([0xd8, 0x9a, 0xb8], 3.8), ([0xa8, 0xc8, 0x8a], 3.0)];
                for (i, (col, hgt)) in houses.iter().enumerate() {
                    let x = -5.2 + i as f32 * 2.6;
                    b.cuboid(Vec3::new(x, hgt * 0.5, -4.6), Vec3::new(1.2, hgt * 0.5, 0.8), Quat::IDENTITY, *col, 1.0);
                    b.cuboid(Vec3::new(x, hgt + 0.25, -4.6), Vec3::new(1.3, 0.25, 0.85), Quat::IDENTITY, [0x8a, 0x3a, 0x2e], 1.0);
                    b.cuboid(Vec3::new(x - 0.4, 0.55, -3.79), Vec3::new(0.25, 0.55, 0.01), Quat::IDENTITY, [0x6a, 0x42, 0x2a], 1.0);
                    for wx in [0.15f32, 0.75] {
                        b.cuboid(Vec3::new(x + wx - 0.2, hgt * 0.62, -3.79), Vec3::new(0.22, 0.25, 0.01), Quat::IDENTITY, [0xd8, 0xee, 0xfa], 0.0);
                    }
                }
                b.cuboid(Vec3::new(3.4, 1.3, -1.6), Vec3::new(0.05, 1.3, 0.05), Quat::IDENTITY, [0x3a, 0x3c, 0x44], 1.0);
                b.cuboid(Vec3::new(3.4, 2.75, -1.6), Vec3::new(0.14, 0.32, 0.1), Quat::IDENTITY, [0x2a, 0x2c, 0x34], 1.0);
                for (k, col) in [[0xe8, 0x3a, 0x30], [0xf2, 0xc2, 0x30], [0x4a, 0xc0, 0x5a]].iter().enumerate() {
                    b.sphere(Vec3::new(3.4, 2.97 - k as f32 * 0.21, -1.49), Vec3::new(0.07, 0.07, 0.02), *col);
                }
            } else {
                floor_and_wall(&mut b, [0x6c, 0xb8, 0x58], [0x5a, 0xa4, 0x4a], [0x7e, 0xc0, 0xec], [0xc8, 0xe6, 0xf6]);
                // Aita, puut, penkki ja aurinko.
                for i in 0..28 {
                    let x = -7.0 + i as f32 * 0.5;
                    b.cuboid(Vec3::new(x, 0.55, -4.8), Vec3::new(0.08, 0.55, 0.03), Quat::IDENTITY, [0xf4, 0xf0, 0xe6], 1.0);
                }
                b.cuboid(Vec3::new(0.0, 0.75, -4.78), Vec3::new(7.0, 0.05, 0.02), Quat::IDENTITY, [0xf4, 0xf0, 0xe6], 1.0);
                for (x, z, s) in [(-3.6f32, -3.6f32, 1.0f32), (3.8, -3.9, 1.2), (5.6, -2.6, 0.9)] {
                    b.cuboid(Vec3::new(x, 0.7 * s, z), Vec3::new(0.1 * s, 0.7 * s, 0.1 * s), Quat::IDENTITY, [0x7a, 0x52, 0x34], 1.0);
                    b.sphere(Vec3::new(x, 1.75 * s, z), Vec3::new(0.75, 0.7, 0.75) * s, [0x3e, 0x96, 0x46]);
                }
                b.cuboid(Vec3::new(-2.2, 0.42, -2.2), Vec3::new(0.8, 0.04, 0.22), Quat::IDENTITY, [0xb0, 0x70, 0x40], 1.0);
                b.cuboid(Vec3::new(-2.2, 0.7, -2.4), Vec3::new(0.8, 0.18, 0.03), Quat::IDENTITY, [0xb0, 0x70, 0x40], 1.0);
                for dx in [-0.7f32, 0.7] {
                    b.cuboid(Vec3::new(-2.2 + dx, 0.2, -2.2), Vec3::new(0.04, 0.2, 0.2), Quat::IDENTITY, [0x3a, 0x3c, 0x44], 1.0);
                }
            }
            b.sphere(Vec3::new(-4.5, 5.6, -5.9), Vec3::new(0.6, 0.6, 0.05), [0xff, 0xe8, 0x8a]);
            for (x, y) in [(1.5f32, 5.2f32), (4.6, 5.8)] {
                for k in 0..3 {
                    b.sphere(Vec3::new(x + k as f32 * 0.35, y + (k % 2) as f32 * 0.12, -5.9), Vec3::new(0.32, 0.22, 0.05), [0xfa, 0xfc, 0xff]);
                }
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
