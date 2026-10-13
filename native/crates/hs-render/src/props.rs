//! Esineet, jotka rakennetaan ruutukohtaisesti: puhelin ja kosketusvarjo.

use glam::{Quat, Vec3};
use hs_character::{CharacterMesh, MeshBuilder};
use hs_motion::hands::PhoneState;

/// Fixed chair using the exact contact dimensions of the motion solver.
pub fn chair(contact: &hs_motion::seating::ChairContact) -> CharacterMesh {
    let mut b = MeshBuilder::new();
    let r = Quat::from_rotation_y(contact.yaw);
    let p = |v: Vec3| contact.position + r * v;
    let wood = [0x85, 0x59, 0x39];
    let thickness = contact.width * 0.06;
    b.cuboid(
        p(Vec3::new(0.0, contact.seat_height - thickness * 0.5, 0.0)),
        Vec3::new(contact.width * 0.5, thickness * 0.5, contact.depth * 0.5),
        r,
        wood,
        1.0,
    );
    let back_height = contact.width * 0.85;
    b.cuboid(
        p(Vec3::new(
            0.0,
            contact.seat_height + back_height * 0.5,
            -contact.depth * 0.5,
        )),
        Vec3::new(contact.width * 0.5, back_height * 0.5, thickness * 0.5),
        r,
        wood,
        1.0,
    );
    for x in [-1.0, 1.0] {
        for z in [-1.0, 1.0] {
            b.cuboid(
                p(Vec3::new(
                    x * (contact.width * 0.5 - thickness),
                    contact.seat_height * 0.5,
                    z * (contact.depth * 0.5 - thickness),
                )),
                Vec3::new(thickness * 0.5, contact.seat_height * 0.5, thickness * 0.5),
                r,
                wood,
                1.0,
            );
        }
    }
    b.finish()
}

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

/// Käteen otettavat esineet (tunnisteet kuten `hs_script::PROP_ALIASES`).
pub const HELD: &[&str] = &["mug", "pizza-box", "book", "gift", "ball", "flowers", "can", "microphone"];

/// Rakentaa käteen otettavan esineen sidonta-asennon koordinaateissa kämmenen
/// kohdalle (`palm`); verkko sidotaan luuhun 0 ja liikutetaan käden ihomatriisilla.
/// `side` = +1/-1 (käden puoli). Tuntematon tunniste: `None`.
pub fn held(id: &str, palm: Vec3, side: f32) -> Option<CharacterMesh> {
    let mut b = MeshBuilder::new();
    let one = hs_character::Bind::one(0);
    // Esine on sormien edessä ja hieman kämmenen alapuolella.
    let c = palm + Vec3::new(-side * 0.01, -0.05, 0.05);
    match id {
        "mug" => {
            b.capsule(c - Vec3::Y * 0.045, c + Vec3::Y * 0.045, 0.042, 0.042, [0xf4, 0xf1, 0xea], one, 16, false);
            b.ellipsoid(c + Vec3::Y * 0.07, Vec3::new(0.034, 0.006, 0.034), Quat::IDENTITY, [0x5a, 0x34, 0x22], one, 4, 16);
            b.capsule(c + Vec3::new(side * 0.05, 0.025, 0.0), c + Vec3::new(side * 0.05, -0.025, 0.0), 0.012, 0.012, [0xd8, 0x4a, 0x3a], one, 8, false);
            b.ellipsoid(c + Vec3::new(0.0, 0.0, 0.041), Vec3::new(0.022, 0.022, 0.004), Quat::IDENTITY, [0xd8, 0x4a, 0x3a], one, 4, 12);
        }
        "pizza-box" => {
            let box_c = c + Vec3::new(0.0, -0.14, 0.02);
            b.cuboid(box_c, Vec3::new(0.02, 0.17, 0.17), Quat::IDENTITY, [0xd9, 0xb8, 0x82], 1.0);
            b.cuboid(box_c + Vec3::new(side * 0.021, 0.02, 0.0), Vec3::new(0.002, 0.06, 0.06), Quat::IDENTITY, [0xc8, 0x37, 0x2d], 0.0);
        }
        "book" => {
            let bc = c + Vec3::new(0.0, -0.08, 0.0);
            b.cuboid(bc, Vec3::new(0.025, 0.11, 0.08), Quat::IDENTITY, [0x2f, 0x6f, 0xb0], 1.0);
            b.cuboid(bc + Vec3::Z * 0.004, Vec3::new(0.02, 0.105, 0.078), Quat::IDENTITY, [0xf6, 0xf2, 0xe4], 1.0);
        }
        "gift" => {
            let gc = c + Vec3::new(0.0, -0.06, 0.06);
            b.cuboid(gc, Vec3::splat(0.09), Quat::IDENTITY, [0xd6, 0x46, 0x7a], 1.0);
            b.cuboid(gc, Vec3::new(0.092, 0.092, 0.018), Quat::IDENTITY, [0xf2, 0xc2, 0x30], 1.0);
            b.cuboid(gc, Vec3::new(0.018, 0.092, 0.092), Quat::IDENTITY, [0xf2, 0xc2, 0x30], 1.0);
            b.ellipsoid(gc + Vec3::Y * 0.1, Vec3::new(0.04, 0.02, 0.03), Quat::IDENTITY, [0xf2, 0xc2, 0x30], one, 6, 10);
        }
        "ball" => {
            let bc = c + Vec3::new(0.0, -0.06, 0.08);
            b.ellipsoid(bc, Vec3::splat(0.11), Quat::IDENTITY, [0xe0, 0x4a, 0x3a], one, 12, 20);
            b.ellipsoid(bc, Vec3::new(0.112, 0.03, 0.112), Quat::IDENTITY, [0xf6, 0xf4, 0xee], one, 6, 20);
        }
        "flowers" => {
            let base = c + Vec3::new(0.0, 0.0, 0.0);
            let colors = [[0xe8, 0x4a, 0x7a], [0xf2, 0xc2, 0x30], [0x8e, 0x5b, 0xc4], [0xf0, 0x7a, 0x36], [0xf6, 0xf4, 0xee]];
            for (k, col) in colors.iter().enumerate() {
                let a = k as f32 / colors.len() as f32 * std::f32::consts::TAU;
                let top = base + Vec3::new(a.cos() * 0.05, -0.2, 0.05 + a.sin() * 0.05);
                b.capsule(base, top, 0.006, 0.006, [0x3f, 0x8a, 0x42], one, 6, false);
                b.ellipsoid(top, Vec3::splat(0.035), Quat::IDENTITY, *col, one, 6, 10);
            }
            b.capsule(base + Vec3::Y * 0.02, base - Vec3::Y * 0.05, 0.03, 0.035, [0xf6, 0xe6, 0xd0], one, 10, false);
        }
        "can" => {
            b.capsule(c - Vec3::Y * 0.05, c + Vec3::Y * 0.05, 0.034, 0.034, [0xc8, 0x2a, 0x2a], one, 14, false);
            b.ellipsoid(c + Vec3::Y * 0.085, Vec3::new(0.03, 0.006, 0.03), Quat::IDENTITY, [0xc8, 0xcc, 0xd2], one, 4, 14);
            b.ellipsoid(c + Vec3::Z * 0.033, Vec3::new(0.02, 0.03, 0.003), Quat::IDENTITY, [0xf6, 0xf4, 0xee], one, 4, 10);
        }
        "microphone" => {
            b.capsule(c - Vec3::Y * 0.06, c + Vec3::Y * 0.05, 0.016, 0.022, [0x22, 0x22, 0x28], one, 10, false);
            b.ellipsoid(c + Vec3::Y * 0.09, Vec3::splat(0.04), Quat::IDENTITY, [0x9a, 0xa0, 0xa8], one, 8, 12);
        }
        _ => return None,
    }
    Some(b.finish())
}

#[cfg(test)]
mod tests {
    #[test]
    fn chair_mesh_matches_fixed_contact_and_reaches_floor() {
        let contact = hs_motion::seating::ChairContact {
            position: glam::Vec3::new(2.0, 0.0, -1.0),
            standing_position: glam::Vec3::new(2.0, 0.0, -0.5),
            yaw: 0.7,
            seat_height: 0.45,
            width: 0.5,
            depth: 0.38,
            seated_weight: 1.0,
        };
        let mesh = super::chair(&contact);
        assert!(mesh.triangle_count() >= 72);
        assert!(mesh
            .vertices
            .iter()
            .all(|v| v.position.iter().all(|x| x.is_finite())));
        let min_y = mesh
            .vertices
            .iter()
            .map(|v| v.position[1])
            .fold(f32::INFINITY, f32::min);
        assert!(min_y.abs() < 1e-5);
        let mut standing = contact;
        standing.seated_weight = 0.0;
        let other = super::chair(&standing);
        assert_eq!(
            mesh.vertices.iter().map(|v| v.position).collect::<Vec<_>>(),
            other
                .vertices
                .iter()
                .map(|v| v.position)
                .collect::<Vec<_>>()
        );
    }


    #[test]
    fn every_held_prop_builds() {
        for id in super::HELD {
            let m = super::held(id, glam::Vec3::new(0.3, 0.7, 0.0), 1.0).unwrap_or_else(|| panic!("{id}"));
            assert!(m.triangle_count() > 20, "{id}");
            assert!(m.vertices.iter().all(|v| v.bones == [0, 0]));
        }
        assert!(super::held("dragon", glam::Vec3::ZERO, 1.0).is_none());
    }
}
