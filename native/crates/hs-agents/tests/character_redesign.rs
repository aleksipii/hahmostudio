//! Actual family meshes, skinning and CPU closeups. These tests guard the
//! redesign's rendering/rig contracts; aesthetic approval remains visual.
use glam::{Mat4, Quat, Vec3};
use hs_character::{Character, CharacterParams, Vertex};
use hs_lipsync::Viseme;
use hs_motion::{face::apply_mouth, skeleton::Pose, Side};
use hs_render::{cpu::CpuRenderer, Camera, DrawItem, Lights, RenderScene, Renderer, ShadingStyle};
use std::sync::Arc;

fn family() -> [CharacterParams; 4] {
    [
        CharacterParams::kalle(),
        CharacterParams::maija(),
        CharacterParams::eetu(),
        CharacterParams::ronja(),
    ]
}

fn skinned_position(vertex: &Vertex, skin: &[Mat4]) -> Vec3 {
    let position = Vec3::from_array(vertex.position);
    skin[vertex.bones[0] as usize].transform_point3(position) * vertex.weight
        + skin[vertex.bones[1] as usize].transform_point3(position) * (1.0 - vertex.weight)
}

fn closeup(character: &Character, pose: &Pose, angle: f32) -> RenderScene {
    let h = &character.humanoid;
    let target = h.skeleton.bind_positions()[h.head] + Vec3::Y * h.head_height * 0.48;
    let eye = target + Vec3::new(angle.sin(), 0.08, angle.cos()) * h.head_height * 3.0;
    RenderScene {
        width: 128,
        height: 128,
        camera: Camera {
            eye,
            target,
            fov_y: 38.0,
        },
        lights: Lights::default(),
        style: ShadingStyle::Flat,
        clear: [17, 31, 47],
        outline: 0.7,
        items: vec![DrawItem::skinned(
            Arc::new(character.mesh.clone()),
            h.skeleton.skin_matrices(pose),
        )],
    }
}

#[test]
fn family_geometry_remains_finite_indexed_and_skinnable_during_motion() {
    for params in family() {
        let character = Character::build(params);
        let h = &character.humanoid;
        let mesh = &character.mesh;
        assert!(!mesh.vertices.is_empty());
        assert_eq!(mesh.indices.len() % 3, 0);
        assert!(mesh
            .indices
            .iter()
            .all(|index| (*index as usize) < mesh.vertices.len()));
        for vertex in &mesh.vertices {
            assert!(vertex
                .position
                .iter()
                .chain(&vertex.normal)
                .chain(&vertex.color)
                .all(|x| x.is_finite()));
            assert!((0.0..=1.0).contains(&vertex.weight));
            assert!(vertex
                .bones
                .iter()
                .all(|bone| (*bone as usize) < h.skeleton.len()));
        }
        let (min, max) = mesh.bounds();
        assert!(min.is_finite() && max.is_finite());
        assert!(max.x > min.x && max.y > min.y && max.z > min.z);
        assert!((max.y - min.y - character.params.height).abs() < character.params.height * 0.1);
        let mut pose = h.rest_pose();
        for sample in 0..=20 {
            let phase = sample as f32 / 20.0;
            pose.local[h.head] = Quat::from_rotation_y((phase - 0.5) * 1.0);
            pose.local[h.arm(Side::Left).upper] = Quat::from_rotation_z(phase * 1.2);
            apply_mouth(
                h,
                &mut pose,
                &Viseme::ALL[sample % Viseme::ALL.len()].shape(),
            );
            let skin = h.skeleton.skin_matrices(&pose);
            assert!(skin.iter().all(|matrix| matrix.is_finite()));
            for vertex in &mesh.vertices {
                let position = skinned_position(vertex, &skin);
                assert!(position.is_finite());
                assert!(
                    position.length() < character.params.height * 3.0,
                    "{}: escaping deformed vertex {position:?}",
                    character.params.name
                );
            }
        }
    }
}

#[test]
fn family_front_three_quarter_and_profile_closeups_are_visible_and_repeatable() {
    let mut renderer = CpuRenderer {
        supersample: 1,
        threads: 1,
    };
    for params in family() {
        let character = Character::build(params);
        let pose = character.humanoid.rest_pose();
        let mut views = Vec::new();
        for angle in [
            0.0,
            std::f32::consts::FRAC_PI_4,
            std::f32::consts::FRAC_PI_2,
        ] {
            let scene = closeup(&character, &pose, angle);
            let image = renderer.render(&scene).unwrap();
            let occupied = image
                .rgba
                .chunks_exact(4)
                .filter(|pixel| pixel[..3] != scene.clear)
                .count();
            // A character-only scene excludes scenery falsely satisfying visibility.
            assert!(
                occupied > (image.width * image.height / 20) as usize,
                "{} at {angle}: empty or tiny face ({occupied} pixels)",
                character.params.name
            );
            assert!(image.rgba.chunks_exact(4).all(|pixel| pixel[3] == 255));
            assert_eq!(renderer.render(&scene).unwrap(), image);
            views.push(image);
        }
        assert!(
            views[0].mean_abs_diff(&views[2]) > 1.0,
            "{}: profile should change the actual rendered silhouette",
            character.params.name
        );
    }
}

#[test]
fn redesigned_family_mouth_bindings_preserve_visible_visemes() {
    let mut renderer = CpuRenderer {
        supersample: 1,
        threads: 1,
    };
    for params in family() {
        let character = Character::build(params);
        let h = &character.humanoid;
        let rest = h.rest_pose();
        let rest_skin = h.skeleton.skin_matrices(&rest);
        let mut mouth = rest.clone();
        for viseme in Viseme::ALL {
            apply_mouth(h, &mut mouth, &viseme.shape());
            assert!(h
                .skeleton
                .skin_matrices(&mouth)
                .iter()
                .all(|matrix| matrix.is_finite()));
        }
        apply_mouth(h, &mut mouth, &Viseme::Ah.shape());
        let ah_skin = h.skeleton.skin_matrices(&mouth);
        let displaced = character
            .mesh
            .vertices
            .iter()
            .filter(|vertex| {
                skinned_position(vertex, &rest_skin).distance(skinned_position(vertex, &ah_skin))
                    > h.head_height * 0.005
            })
            .count();
        assert!(
            displaced > 10,
            "{}: mouth bones lost their mesh bindings",
            character.params.name
        );
        let rest_image = renderer.render(&closeup(&character, &rest, 0.0)).unwrap();
        let ah_image = renderer.render(&closeup(&character, &mouth, 0.0)).unwrap();
        assert!(
            rest_image.differing_fraction(&ah_image, 8) > 0.0005,
            "{}: open viseme does not reach rendered pixels",
            character.params.name
        );
    }
}
