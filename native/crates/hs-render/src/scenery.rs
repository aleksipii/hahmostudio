//! CPU/GPU shared geometry, matching the motion solver's support surfaces.
use glam::{Quat, Vec3};
use hs_character::{CharacterMesh, MeshBuilder};
use hs_core::scenery::ScenerySpec;
pub fn mesh(spec: &ScenerySpec, door_angle: f32) -> CharacterMesh {
    let mut b = MeshBuilder::new();
    match spec {
        ScenerySpec::Door {
            hinge,
            width,
            height,
            yaw_degrees,
            handle_height,
            ..
        } => {
            let base = Quat::from_rotation_y(yaw_degrees.to_radians());
            let rot = base * Quat::from_rotation_y(door_angle.to_radians());
            let p = Vec3::from_array(*hinge);
            b.cuboid(
                p + rot * Vec3::new(width * 0.5, height * 0.5, 0.),
                Vec3::new(width * 0.5, height * 0.5, 0.025),
                rot,
                [139, 94, 60],
                1.,
            );
            b.cuboid(
                p + rot * Vec3::new(width * 0.85, *handle_height, 0.04),
                Vec3::new(0.05, 0.025, 0.035),
                rot,
                [195, 180, 110],
                1.,
            );
            for x in [0., *width] {
                b.cuboid(
                    p + base * Vec3::new(x, height * 0.5, 0.),
                    Vec3::new(0.035, height * 0.5, 0.05),
                    base,
                    [80, 65, 50],
                    1.,
                );
            }
            b.cuboid(
                p + base * Vec3::new(width * 0.5, *height, 0.),
                Vec3::new(width * 0.5, 0.035, 0.05),
                base,
                [80, 65, 50],
                1.,
            );
        }
        ScenerySpec::Stairs {
            origin,
            width,
            rise,
            run,
            steps,
            yaw_degrees,
            ..
        } => {
            let rot = Quat::from_rotation_y(yaw_degrees.to_radians());
            let p = Vec3::from_array(*origin);
            for n in 0..*steps {
                let h = *rise * (n + 1) as f32;
                b.cuboid(
                    p + rot * Vec3::new(0., h * 0.5, *run * (n as f32 + 0.5)),
                    Vec3::new(width * 0.5, h * 0.5, run * 0.5),
                    rot,
                    [130, 139, 151],
                    1.,
                );
            }
            // Explicit top landing: one tread deep; essential for the final support phase.
            let h = *rise * *steps as f32;
            b.cuboid(
                p + rot * Vec3::new(0., h * 0.5, *run * (*steps as f32 + 0.5)),
                Vec3::new(width * 0.5, h * 0.5, run * 0.5),
                rot,
                [130, 139, 151],
                1.,
            );
        }
    };
    b.finish()
}
/// Cached panel in hinge-local coordinates and fixed frame in world coordinates.
pub fn door_parts(spec: &ScenerySpec) -> Option<(CharacterMesh, CharacterMesh)> {
    let ScenerySpec::Door {
        hinge,
        width,
        height,
        yaw_degrees,
        handle_height,
        ..
    } = spec
    else {
        return None;
    };
    let mut panel = MeshBuilder::new();
    panel.cuboid(
        Vec3::new(width * 0.5, height * 0.5, 0.),
        Vec3::new(width * 0.5, height * 0.5, 0.025),
        Quat::IDENTITY,
        [139, 94, 60],
        1.,
    );
    panel.cuboid(
        Vec3::new(width * 0.85, *handle_height, 0.04),
        Vec3::new(0.05, 0.025, 0.035),
        Quat::IDENTITY,
        [195, 180, 110],
        1.,
    );
    let mut frame = MeshBuilder::new();
    let r = Quat::from_rotation_y(yaw_degrees.to_radians());
    let p = Vec3::from_array(*hinge);
    for x in [0., *width] {
        frame.cuboid(
            p + r * Vec3::new(x, height * 0.5, 0.),
            Vec3::new(0.035, height * 0.5, 0.05),
            r,
            [80, 65, 50],
            1.,
        );
    }
    frame.cuboid(
        p + r * Vec3::new(width * 0.5, *height, 0.),
        Vec3::new(width * 0.5, 0.035, 0.05),
        r,
        [80, 65, 50],
        1.,
    );
    Some((panel.finish(), frame.finish()))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stair_geometry_has_exact_support_height() {
        let s = ScenerySpec::Stairs {
            id: "s".into(),
            origin: [0., 0., 0.],
            width: 0.7,
            rise: 0.08,
            run: 0.24,
            steps: 3,
            yaw_degrees: 0.,
        };
        let m = mesh(&s, 0.);
        assert!(!m.vertices.is_empty());
        assert!(!m.indices.is_empty());
        let max = m
            .vertices
            .iter()
            .map(|v| v.position[1])
            .fold(f32::NEG_INFINITY, f32::max);
        assert!((max - 0.24).abs() < 1e-6);
        assert!(m
            .vertices
            .iter()
            .all(|v| v.position.into_iter().all(f32::is_finite)));
    }
}
