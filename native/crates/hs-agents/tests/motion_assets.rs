use hs_agents::{motion_assets, motion_library};
use serde_json::Value;
fn floats(doc: &Value, bin: &[u8], id: usize) -> Vec<f32> {
    let a = &doc["accessors"][id];
    let view = &doc["bufferViews"][a["bufferView"].as_u64().unwrap() as usize];
    assert_eq!(a["componentType"], 5126);
    let offset = view["byteOffset"].as_u64().unwrap() as usize;
    let len = view["byteLength"].as_u64().unwrap() as usize;
    bin[offset..offset + len]
        .chunks_exact(4)
        .map(|v| f32::from_le_bytes(v.try_into().unwrap()))
        .collect()
}
#[test]
fn real_skin_and_root_tracks_match_native_samples() {
    let preset = motion_library::catalog()
        .into_iter()
        .find(|p| p.family == "walk-right" && p.profile == "Kalle" && p.seconds == 1.1)
        .unwrap();
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("pack");
    let summary = motion_assets::export(&path, std::slice::from_ref(&preset)).unwrap();
    assert_eq!(summary.clips, 1);
    let doc: Value =
        serde_json::from_slice(&std::fs::read(path.join("kalle.gltf")).unwrap()).unwrap();
    let bin = std::fs::read(path.join("kalle.bin")).unwrap();
    assert_eq!(summary.binary_bytes, bin.len());
    let character = hs_character::Character::build(
        hs_character::CharacterParams::presets()
            .into_iter()
            .find(|p| p.name == "Kalle")
            .unwrap(),
    );
    assert_eq!(
        doc["skins"][0]["joints"].as_array().unwrap().len(),
        character.humanoid.skeleton.len()
    );
    for (i, j) in character.humanoid.skeleton.joints.iter().enumerate() {
        let parent = j.parent.map_or(0, |p| p + 1);
        assert!(doc["nodes"][parent]["children"]
            .as_array()
            .unwrap()
            .contains(&serde_json::json!(i + 1)));
    }
    let attrs = &doc["meshes"][0]["primitives"][0]["attributes"];
    let weights = floats(&doc, &bin, attrs["WEIGHTS_0"].as_u64().unwrap() as usize);
    assert!(weights
        .chunks_exact(4)
        .all(|w| (w.iter().sum::<f32>() - 1.0).abs() < 1e-6));
    let joint_accessor = &doc["accessors"][attrs["JOINTS_0"].as_u64().unwrap() as usize];
    let joint_view = &doc["bufferViews"][joint_accessor["bufferView"].as_u64().unwrap() as usize];
    assert_eq!(joint_view["target"], 34962);
    let offset = joint_view["byteOffset"].as_u64().unwrap() as usize;
    let length = joint_view["byteLength"].as_u64().unwrap() as usize;
    let joints: Vec<u16> = bin[offset..offset + length]
        .chunks_exact(2)
        .map(|bytes| u16::from_le_bytes(bytes.try_into().unwrap()))
        .collect();
    let native_bind = character.humanoid.skeleton.bind_positions();
    for ((vertex, js), ws) in character
        .mesh
        .vertices
        .iter()
        .zip(joints.chunks_exact(4))
        .zip(weights.chunks_exact(4))
    {
        for k in 0..4 {
            if ws[k] == 0.0 {
                assert_eq!(js[k], 0);
            }
        }
        let expected = native_bind[vertex.bones[0] as usize] * vertex.weight
            + native_bind[vertex.bones[1] as usize] * (1.0 - vertex.weight);
        let exported = (0..4).fold(glam::Vec3::ZERO, |p, k| {
            p + native_bind[js[k] as usize] * ws[k]
        });
        assert!((expected - exported).length() < 1e-6);
    }
    let plan = hs_script::parse(&preset.script);
    let timeline = hs_script::to_timeline(&plan, &preset.script, hs_core::Fps(30));
    let motion = character.motion().prepare(&timeline);
    let animation = &doc["animations"][0];
    assert_eq!(animation["name"], preset.id);
    let mut found_root = false;
    for channel in animation["channels"].as_array().unwrap() {
        let sampler = &animation["samplers"][channel["sampler"].as_u64().unwrap() as usize];
        let times = floats(&doc, &bin, sampler["input"].as_u64().unwrap() as usize);
        let values = floats(&doc, &bin, sampler["output"].as_u64().unwrap() as usize);
        assert_eq!(*times.last().unwrap(), timeline.duration.seconds() as f32);
        assert!(times.windows(2).all(|t| t[1] > t[0]));
        let node = channel["target"]["node"].as_u64().unwrap() as usize;
        if channel["target"]["path"] == "rotation" {
            for q in values.chunks_exact(4) {
                assert!((q.iter().map(|v| v * v).sum::<f32>() - 1.0).abs() < 1e-5);
            }
        }
        let width = if channel["target"]["path"] == "rotation" {
            4
        } else {
            3
        };
        for (time, v) in times.iter().zip(values.chunks_exact(width)) {
            let pose = motion.evaluate(&timeline, *time).pose;
            if width == 4 {
                let expected = if node == 0 {
                    pose.root_rot
                } else {
                    pose.local[node - 1]
                };
                let actual = glam::Quat::from_xyzw(v[0], v[1], v[2], v[3]);
                assert!(actual.dot(expected.normalize()).abs() > 1.0 - 1e-6);
            } else {
                let expected = if node == 0 {
                    pose.root_pos
                } else {
                    character.humanoid.skeleton.joints[node - 1].offset + pose.translate[node - 1]
                };
                assert!((glam::Vec3::from_slice(v) - expected).length() < 1e-6);
            }
        }
        if node == 0 && channel["target"]["path"] == "translation" {
            found_root = true;
            for (time, v) in times.iter().zip(values.chunks_exact(3)) {
                assert!(
                    (glam::Vec3::from_slice(v) - motion.evaluate(&timeline, *time).pose.root_pos)
                        .length()
                        < 1e-6
                );
            }
            assert!(values.chunks_exact(3).any(|v| v[0] > 0.1));
        }
    }
    assert!(found_root);
    assert!(motion_assets::export(&path, &[preset]).is_err());
    assert_eq!(std::fs::read(path.join("kalle.bin")).unwrap(), bin);
}
#[test]
fn reject_unknown_duplicates_and_preserve_empty_directory() {
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("existing");
    std::fs::create_dir(&path).unwrap();
    let p = motion_library::catalog().remove(0);
    assert!(motion_assets::export(&path, std::slice::from_ref(&p)).is_err());
    assert!(path.is_dir());
    let fresh = tmp.path().join("fresh");
    assert!(motion_assets::export(&fresh, &[p.clone(), p.clone()]).is_err());
    assert!(!fresh.exists());
    let mut forged = p;
    forged.script = "KALLE: [sit 1s]".into();
    assert!(motion_assets::export(&fresh, &[forged]).is_err());
    assert!(!fresh.exists());
}
