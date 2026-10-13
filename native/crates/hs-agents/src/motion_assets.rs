//! Real glTF 2.0 baked, skinned motion assets. No external model or audio.
use crate::motion_library::Preset;
use glam::{Mat4, Quat};
use hs_character::{Character, CharacterParams};
use hs_core::Fps;
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};
const LIMIT: usize = 128 * 1024 * 1024;
const HZ: f32 = 30.0;
#[derive(Debug, Serialize)]
pub struct Summary {
    pub clips: usize,
    pub rigs: usize,
    pub binary_bytes: usize,
    pub sample_rate: u32,
}
#[derive(Default)]
struct Buffer {
    bytes: Vec<u8>,
    views: Vec<Value>,
    accessors: Vec<Value>,
}
impl Buffer {
    fn add(
        &mut self,
        bytes: Vec<u8>,
        count: usize,
        component: u32,
        kind: &str,
        bounds: Option<(Vec<f32>, Vec<f32>)>,
    ) -> Result<usize, String> {
        while self.bytes.len() % 4 != 0 {
            self.bytes.push(0);
        }
        if self
            .bytes
            .len()
            .checked_add(bytes.len())
            .is_none_or(|n| n > LIMIT)
        {
            return Err("Motion binary exceeds 128 MiB".into());
        }
        let view = self.views.len();
        self.views
            .push(json!({"buffer":0,"byteOffset":self.bytes.len(),"byteLength":bytes.len()}));
        self.bytes.extend(bytes);
        let mut a = json!({"bufferView":view,"componentType":component,"count":count,"type":kind});
        if let Some((lo, hi)) = bounds {
            a["min"] = json!(lo);
            a["max"] = json!(hi);
        }
        let id = self.accessors.len();
        self.accessors.push(a);
        Ok(id)
    }
    fn floats(
        &mut self,
        values: &[f32],
        width: usize,
        kind: &str,
        bounded: bool,
    ) -> Result<usize, String> {
        if values.is_empty() || values.len() % width != 0 || values.iter().any(|v| !v.is_finite()) {
            return Err("Invalid float accessor".into());
        }
        let bounds = bounded.then(|| {
            let mut lo = vec![f32::INFINITY; width];
            let mut hi = vec![f32::NEG_INFINITY; width];
            for row in values.chunks_exact(width) {
                for k in 0..width {
                    lo[k] = lo[k].min(row[k]);
                    hi[k] = hi[k].max(row[k]);
                }
            }
            (lo, hi)
        });
        self.add(
            values.iter().flat_map(|v| v.to_le_bytes()).collect(),
            values.len() / width,
            5126,
            kind,
            bounds,
        )
    }
}
fn rotation(q: Quat, previous: Option<Quat>) -> Result<Quat, String> {
    if !q.is_finite() || q.length_squared() < 1e-8 {
        return Err("Invalid motion quaternion".into());
    }
    let q = q.normalize();
    Ok(if previous.is_some_and(|p| p.dot(q) < 0.0) {
        -q
    } else {
        q
    })
}
fn track(
    buffer: &mut Buffer,
    samplers: &mut Vec<Value>,
    channels: &mut Vec<Value>,
    node: usize,
    path: &str,
    times: &[f32],
    values: &[f32],
    base: &[f32],
) -> Result<(), String> {
    let width = base.len();
    // Never approximate varying tracks: only bitwise-equal constants are compressed.
    if values.chunks_exact(width).all(|v| v == base) {
        return Ok(());
    }
    let constant = values.chunks_exact(width).all(|v| v == &values[..width]);
    let (t, v) = if constant {
        (
            vec![times[0], *times.last().unwrap()],
            values[..width].repeat(2),
        )
    } else {
        (times.to_vec(), values.to_vec())
    };
    let input = buffer.floats(&t, 1, "SCALAR", true)?;
    let output = buffer.floats(&v, width, if width == 4 { "VEC4" } else { "VEC3" }, false)?;
    let sampler = samplers.len();
    samplers.push(json!({"input":input,"output":output,"interpolation":"LINEAR"}));
    channels.push(json!({"sampler":sampler,"target":{"node":node,"path":path}}));
    Ok(())
}
fn rig(folder: &Path, profile: &str, presets: &[&Preset]) -> Result<usize, String> {
    let params = CharacterParams::presets()
        .into_iter()
        .find(|p| p.name == profile)
        .ok_or("Unknown rig profile")?;
    let character = Character::build(params);
    let sk = &character.humanoid.skeleton;
    let mut b = Buffer::default();
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut colors = Vec::new();
    let mut joints = Vec::new();
    let mut weights = Vec::new();
    for v in &character.mesh.vertices {
        if v.bones.iter().any(|j| *j as usize >= sk.len()) || !(0.0..=1.0).contains(&v.weight) {
            return Err("Invalid skin vertex".into());
        }
        positions.extend(v.position);
        normals.extend(v.normal);
        // Native alpha encodes outline suppression, not visual transparency.
        colors.extend([v.color[0], v.color[1], v.color[2], 1.0]);
        let (bones, skin_weights) = if v.bones[0] == v.bones[1] {
            ([v.bones[0], 0, 0, 0], [1.0, 0.0, 0.0, 0.0])
        } else {
            (
                [
                    if v.weight > 0.0 { v.bones[0] } else { 0 },
                    if v.weight < 1.0 { v.bones[1] } else { 0 },
                    0,
                    0,
                ],
                [v.weight, 1.0 - v.weight, 0.0, 0.0],
            )
        };
        for j in bones {
            joints.extend((j as u16).to_le_bytes());
        }
        weights.extend(skin_weights);
    }
    let pos = b.floats(&positions, 3, "VEC3", true)?;
    let normal = b.floats(&normals, 3, "VEC3", false)?;
    let color = b.floats(&colors, 4, "VEC4", false)?;
    let joint = b.add(joints, character.mesh.vertices.len(), 5123, "VEC4", None)?;
    let weight = b.floats(&weights, 4, "VEC4", false)?;
    if character
        .mesh
        .indices
        .iter()
        .any(|i| *i as usize >= character.mesh.vertices.len())
    {
        return Err("Invalid mesh index".into());
    }
    let index = b.add(
        character
            .mesh
            .indices
            .iter()
            .flat_map(|i| i.to_le_bytes())
            .collect(),
        character.mesh.indices.len(),
        5125,
        "SCALAR",
        None,
    )?;
    for accessor in [pos, normal, color, joint, weight] {
        let view = b.accessors[accessor]["bufferView"].as_u64().unwrap() as usize;
        b.views[view]["target"] = json!(34962);
    }
    let index_view = b.accessors[index]["bufferView"].as_u64().unwrap() as usize;
    b.views[index_view]["target"] = json!(34963);
    let inverse: Vec<f32> = sk
        .bind_positions()
        .iter()
        .flat_map(|p| Mat4::from_translation(-*p).to_cols_array())
        .collect();
    let ibm = b.floats(&inverse, 16, "MAT4", false)?;
    let mut nodes = vec![json!({"name":format!("{profile}-root"),"children":[]})];
    for (i, j) in sk.joints.iter().enumerate() {
        if j.parent.is_some_and(|p| p >= i) || !j.offset.is_finite() {
            return Err("Invalid skeleton hierarchy".into());
        }
        nodes.push(json!({"name":j.name,"translation":j.offset.to_array(),"children":[]}));
    }
    for (i, j) in sk.joints.iter().enumerate() {
        let parent = j.parent.map_or(0, |p| p + 1);
        nodes[parent]["children"]
            .as_array_mut()
            .unwrap()
            .push(json!(i + 1));
    }
    for node in &mut nodes {
        if node["children"].as_array().is_some_and(Vec::is_empty) {
            node.as_object_mut().unwrap().remove("children");
        }
    }
    let mesh_node = nodes.len();
    nodes.push(json!({"name":format!("{profile}-mesh"),"mesh":0,"skin":0}));
    let mut animations = Vec::new();
    for preset in presets {
        let plan = hs_script::parse(&preset.script);
        if !plan.is_assemblable() {
            return Err(format!("Invalid recipe {}", preset.id));
        }
        let timeline = hs_script::to_timeline(&plan, &preset.script, Fps(30));
        let duration = timeline.duration.seconds() as f32;
        if !duration.is_finite() || duration <= 0.0 || duration > 60.0 {
            return Err("Invalid clip duration".into());
        }
        let mut times: Vec<f32> = (0..=(duration * HZ).floor() as usize)
            .map(|i| i as f32 / HZ)
            .filter(|t| *t < duration)
            .collect();
        times.push(duration);
        let motion = character.motion().prepare(&timeline);
        let poses: Vec<_> = times
            .iter()
            .map(|t| motion.evaluate(&timeline, *t).pose)
            .collect();
        let mut samplers = Vec::new();
        let mut channels = Vec::new();
        for node in 0..=sk.len() {
            let mut rs = Vec::new();
            let mut ts = Vec::new();
            let mut previous = None;
            for pose in &poses {
                let q = rotation(
                    if node == 0 {
                        pose.root_rot
                    } else {
                        pose.local[node - 1]
                    },
                    previous,
                )?;
                previous = Some(q);
                rs.extend(q.to_array());
                ts.extend(
                    if node == 0 {
                        pose.root_pos
                    } else {
                        sk.joints[node - 1].offset + pose.translate[node - 1]
                    }
                    .to_array(),
                );
            }
            track(
                &mut b,
                &mut samplers,
                &mut channels,
                node,
                "rotation",
                &times,
                &rs,
                &[0., 0., 0., 1.],
            )?;
            let base = if node == 0 {
                [0., 0., 0.]
            } else {
                sk.joints[node - 1].offset.to_array()
            };
            track(
                &mut b,
                &mut samplers,
                &mut channels,
                node,
                "translation",
                &times,
                &ts,
                &base,
            )?;
        }
        if channels.is_empty() {
            return Err("Clip has no animation tracks".into());
        }
        animations.push(json!({"name":preset.id,"samplers":samplers,"channels":channels,"extras":{"family":preset.family,"durationSeconds":duration,"sourceScript":preset.script}}));
    }
    let stem = profile.to_lowercase();
    let doc = json!({"asset":{"version":"2.0","generator":"Koeta native procedural motion baker"},"scene":0,"scenes":[{"nodes":[0,mesh_node]}],"nodes":nodes,
        "meshes":[{"name":profile,"primitives":[{"attributes":{"POSITION":pos,"NORMAL":normal,"COLOR_0":color,"JOINTS_0":joint,"WEIGHTS_0":weight},"indices":index,"material":0}]}],
        "materials":[{"name":"Native vertex colors","pbrMetallicRoughness":{"baseColorFactor":[1,1,1,1],"metallicFactor":0,"roughnessFactor":1},"doubleSided":false}],
        "skins":[{"name":profile,"inverseBindMatrices":ibm,"skeleton":0,"joints":(1..=sk.len()).collect::<Vec<_>>()}],"animations":animations,
        "buffers":[{"uri":format!("{stem}.bin"),"byteLength":b.bytes.len()}],"bufferViews":b.views,"accessors":b.accessors});
    fs::write(folder.join(format!("{stem}.bin")), &b.bytes).map_err(|e| e.to_string())?;
    fs::write(
        folder.join(format!("{stem}.gltf")),
        serde_json::to_vec_pretty(&doc).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(b.bytes.len())
}
/// Publish a fresh pack directory; existing user assets are never replaced.
pub fn export(path: &Path, presets: &[Preset]) -> Result<Summary, String> {
    if presets.is_empty() || presets.len() > 2000 {
        return Err("Expected 1..2000 motion presets".into());
    }
    if path.try_exists().map_err(|e| e.to_string())? {
        return Err("Destination already exists".into());
    }
    let catalog = crate::motion_library::catalog();
    let mut ids = BTreeSet::new();
    let mut groups: BTreeMap<&str, Vec<&Preset>> = BTreeMap::new();
    for p in presets {
        if !ids.insert(&p.id) || !catalog.iter().any(|known| known == p) {
            return Err("Unknown or duplicate motion preset".into());
        }
        groups.entry(&p.profile).or_default().push(p);
    }
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let staging = tempfile::Builder::new()
        .prefix(".koeta-motion-")
        .tempdir_in(parent)
        .map_err(|e| e.to_string())?;
    let mut bytes = 0;
    for (profile, items) in &groups {
        bytes += rig(staging.path(), profile, items)?;
    }
    let summary = Summary {
        clips: presets.len(),
        rigs: groups.len(),
        binary_bytes: bytes,
        sample_rate: 30,
    };
    let metadata = json!({"format":"koeta-motion-pack","version":1,"summary":summary,"basis":"20 authored procedural recipes, rig and duration variants; not motion capture","clips":presets.iter().map(|p|json!({"preset":p,"rig":format!("{}.gltf",p.profile.to_lowercase()),"animation":p.id,"sampleRate":30})).collect::<Vec<_>>()});
    fs::write(
        staging.path().join("catalog.json"),
        serde_json::to_vec_pretty(&metadata).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    // Empty destination races fail on files and nonempty directories. Reserve atomically
    // so even an existing empty directory is preserved rather than renamed over.
    fs::create_dir(path).map_err(|e| e.to_string())?;
    if let Err(e) = fs::rename(staging.path(), path) {
        let _ = fs::remove_dir(path);
        return Err(e.to_string());
    }
    Ok(summary)
}
