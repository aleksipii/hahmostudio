//! Explicit native rig keyframes, independent of procedural motion generation.
//! Stable joint names bind only to the selected actor's existing skeleton.
use crate::{CharacterFrame, Pose, Skeleton};
use glam::{Quat, Vec3};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const MAX_KEYS: usize = 10_000;
pub const MAX_BYTES: usize = 4 * 1024 * 1024;
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Interpolation {
    #[default]
    Linear,
    Smooth,
    Hold,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PoseKey {
    pub time: f64,
    pub rotation: [f32; 4],
    pub translation: [f32; 3],
    pub interpolation: Interpolation,
}
impl PoseKey {
    pub fn from_euler_degrees(
        time: f64,
        angles: [f32; 3],
        translation: [f32; 3],
        interpolation: Interpolation,
    ) -> Self {
        Self {
            time,
            rotation: Quat::from_euler(
                glam::EulerRot::XYZ,
                angles[0].to_radians(),
                angles[1].to_radians(),
                angles[2].to_radians(),
            )
            .normalize()
            .to_array(),
            translation,
            interpolation,
        }
    }
}
pub fn sample_euler_degrees(track: &PoseTrack, time: f64) -> Option<([f32; 3], [f32; 3])> {
    let (rotation, translation) = sample(track, time)?;
    let (x, y, z) = rotation.to_euler(glam::EulerRot::XYZ);
    Some((
        [x.to_degrees(), y.to_degrees(), z.to_degrees()],
        translation.to_array(),
    ))
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PoseTrack {
    pub actor: String,
    /// None targets the root transform in world coordinates.
    pub joint: Option<String>,
    pub keys: Vec<PoseKey>,
}
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PoseTracks {
    pub tracks: Vec<PoseTrack>,
}
impl PoseTracks {
    fn structure(&self) -> Result<(), String> {
        if self.tracks.len() > 1024
            || self.tracks.iter().map(|t| t.keys.len()).sum::<usize>() > MAX_KEYS
        {
            return Err("Liikaa 3D-avainruutuja".into());
        }
        let mut targets = HashSet::new();
        for track in &self.tracks {
            if track.actor.trim().is_empty()
                || track.actor.len() > 200
                || track
                    .joint
                    .as_ref()
                    .is_some_and(|j| j.is_empty() || j.len() > 200)
                || !targets.insert((track.actor.to_lowercase(), track.joint.clone()))
            {
                return Err("Virheellinen tai toistuva 3D-raita".into());
            }
            let mut previous = -1.0;
            for key in &track.keys {
                let rotation = Quat::from_array(key.rotation);
                if !key.time.is_finite()
                    || !(0.0..=60.0).contains(&key.time)
                    || key.time <= previous
                    || !rotation.is_finite()
                    || (rotation.length_squared() - 1.0).abs() > 0.001
                    || key
                        .translation
                        .iter()
                        .any(|n| !n.is_finite() || n.abs() > 5.0)
                {
                    return Err(format!("Virheellinen avainruutu: {}", track.actor));
                }
                previous = key.time;
            }
        }
        Ok(())
    }
    pub fn encode(&self) -> Result<Vec<u8>, String> {
        self.structure()?;
        let bytes = serde_json::to_vec(self).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_BYTES {
            return Err("3D-avainruutuaineisto on liian suuri".into());
        }
        Ok(bytes)
    }
    pub fn decode(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() > MAX_BYTES {
            return Err("3D-avainruutuaineisto on liian suuri".into());
        }
        let data: Self = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        data.structure()?;
        Ok(data)
    }
    pub fn validate_duration(&self, duration: f64) -> Result<(), String> {
        self.structure()?;
        if !duration.is_finite()
            || !(0.0..=60.0).contains(&duration)
            || self
                .tracks
                .iter()
                .flat_map(|track| &track.keys)
                .any(|key| key.time > duration)
        {
            return Err("3D-avainruutu ylittää jakson keston".into());
        }
        Ok(())
    }
    pub fn validate(&self, actors: &[(&str, &Skeleton)]) -> Result<(), String> {
        self.structure()?;
        let mut names = HashSet::new();
        for (actor, skeleton) in actors {
            if actor.trim().is_empty() || !names.insert(actor.to_lowercase()) {
                return Err("Toistuva tai tyhjä hahmotunniste".into());
            }
            validate_skeleton(skeleton)?;
        }
        for track in &self.tracks {
            let skeleton = actors
                .iter()
                .find(|(name, _)| name.eq_ignore_ascii_case(&track.actor))
                .map(|(_, s)| *s)
                .ok_or_else(|| format!("Avainruudun hahmo puuttuu: {}", track.actor))?;
            if let Some(joint) = &track.joint {
                if skeleton.find(joint).is_none() {
                    return Err(format!("Nivel puuttuu: {} / {joint}", track.actor));
                }
            }
        }
        Ok(())
    }
    /// Apply only keyed joints; unkeyed procedural joints retain their motion.
    /// Before the first key the original procedural pose remains unchanged.
    pub fn apply(
        &self,
        actor: &str,
        skeleton: &Skeleton,
        pose: &mut Pose,
        time: f64,
    ) -> Result<(), String> {
        self.structure()?;
        validate_skeleton(skeleton)?;
        if !time.is_finite()
            || !(0.0..=60.0).contains(&time)
            || pose.local.len() != skeleton.len()
            || pose.translate.len() != skeleton.len()
        {
            return Err("Virheellinen 3D-asento tai aika".into());
        }
        let mut next = pose.clone();
        for track in self
            .tracks
            .iter()
            .filter(|t| t.actor.eq_ignore_ascii_case(actor))
        {
            let target = match &track.joint {
                Some(name) => Some(
                    skeleton
                        .find(name)
                        .ok_or_else(|| format!("Nivel puuttuu: {name}"))?,
                ),
                None => None,
            };
            let Some((rotation, translation)) = sample(track, time) else {
                continue;
            };
            match target {
                Some(index) => {
                    next.local[index] = rotation;
                    next.translate[index] = translation;
                }
                None => {
                    next.root_rot = rotation;
                    next.root_pos = translation;
                }
            }
        }
        if !next.root_pos.is_finite()
            || !next.root_rot.is_finite()
            || (next.root_rot.length_squared() - 1.0).abs() > 0.001
            || next
                .local
                .iter()
                .any(|q| !q.is_finite() || (q.length_squared() - 1.0).abs() > 0.001)
            || next.translate.iter().any(|p| !p.is_finite())
        {
            return Err("Ei-äärellinen 3D-asento".into());
        }
        *pose = next;
        Ok(())
    }
    pub fn apply_frame(
        &self,
        actor: &str,
        skeleton: &Skeleton,
        frame: &mut CharacterFrame,
        time: f64,
    ) -> Result<(), String> {
        if self.has_actor(actor)
            && (frame.props.phone.is_some() || frame.motion == Some(hs_core::MotionKind::PhoneTap))
        {
            return Err(format!(
                "3D-avainruudut ja puhelinkontakti eivät voi ohjata samaa hahmoa: {actor}"
            ));
        }
        self.apply(actor, skeleton, &mut frame.pose, time)?;
        if self.tracks.iter().any(|track| {
            track.actor.eq_ignore_ascii_case(actor)
                && track.joint.is_none()
                && track.keys.first().is_some_and(|key| key.time <= time)
        }) {
            frame.root = frame.pose.root_pos;
            frame.yaw = frame.pose.root_rot.to_euler(glam::EulerRot::YXZ).0;
        }
        Ok(())
    }
    pub fn has_actor(&self, actor: &str) -> bool {
        self.tracks
            .iter()
            .any(|t| t.actor.eq_ignore_ascii_case(actor) && !t.keys.is_empty())
    }
    pub fn upsert(&mut self, actor: &str, joint: Option<&str>, key: PoseKey) -> Result<(), String> {
        let mut next = self.clone();
        let index = next
            .tracks
            .iter()
            .position(|t| t.actor.eq_ignore_ascii_case(actor) && t.joint.as_deref() == joint)
            .unwrap_or_else(|| {
                next.tracks.push(PoseTrack {
                    actor: actor.into(),
                    joint: joint.map(str::to_owned),
                    keys: vec![],
                });
                next.tracks.len() - 1
            });
        let keys = &mut next.tracks[index].keys;
        keys.retain(|k| k.time != key.time);
        keys.push(key);
        keys.sort_by(|a, b| a.time.total_cmp(&b.time));
        next.structure()?;
        *self = next;
        Ok(())
    }
    pub fn remove(&mut self, actor: &str, joint: Option<&str>, time: f64) -> bool {
        let mut changed = false;
        for track in self
            .tracks
            .iter_mut()
            .filter(|t| t.actor.eq_ignore_ascii_case(actor) && t.joint.as_deref() == joint)
        {
            let before = track.keys.len();
            track.keys.retain(|k| k.time != time);
            changed |= before != track.keys.len();
        }
        self.tracks.retain(|t| !t.keys.is_empty());
        changed
    }
}
fn validate_skeleton(skeleton: &Skeleton) -> Result<(), String> {
    if skeleton.len() > 512 || skeleton.is_empty() {
        return Err("Virheellinen luuranko".into());
    }
    let mut names = HashSet::new();
    for (index, joint) in skeleton.joints.iter().enumerate() {
        if joint.name.is_empty()
            || !names.insert(&joint.name)
            || !joint.offset.is_finite()
            || joint.parent.is_some_and(|p| p >= index)
        {
            return Err("Luurangon tunnisteet tai hierarkia ovat virheellisiä".into());
        }
    }
    Ok(())
}
pub fn sample(track: &PoseTrack, time: f64) -> Option<(Quat, Vec3)> {
    let first = track.keys.first()?;
    if time < first.time {
        return None;
    }
    let right = track.keys.partition_point(|k| k.time <= time);
    let a = &track.keys[right.saturating_sub(1)];
    let Some(b) = track.keys.get(right) else {
        return Some((
            Quat::from_array(a.rotation).normalize(),
            Vec3::from_array(a.translation),
        ));
    };
    let mut weight = ((time - a.time) / (b.time - a.time)) as f32;
    weight = match a.interpolation {
        Interpolation::Linear => weight,
        Interpolation::Smooth => weight * weight * (3.0 - 2.0 * weight),
        Interpolation::Hold => 0.0,
    };
    Some((
        Quat::from_array(a.rotation)
            .normalize()
            .slerp(Quat::from_array(b.rotation).normalize(), weight)
            .normalize(),
        Vec3::from_array(a.translation).lerp(Vec3::from_array(b.translation), weight),
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn rig() -> Skeleton {
        let mut s = Skeleton::default();
        let root = s.add("shoulder", None, Vec3::ZERO);
        s.add("hand", Some(root), Vec3::X);
        s
    }
    fn key(time: f64, angle: f32) -> PoseKey {
        PoseKey {
            time,
            rotation: Quat::from_rotation_z(angle).to_array(),
            translation: [0.0; 3],
            interpolation: Interpolation::Linear,
        }
    }
    #[test]
    fn actual_fk_skinning_and_portable_roundtrip() {
        let s = rig();
        let mut tracks = PoseTracks::default();
        tracks
            .upsert("Kalle", Some("shoulder"), key(0.0, 0.0))
            .unwrap();
        tracks
            .upsert("Kalle", Some("shoulder"), key(2.0, std::f32::consts::PI))
            .unwrap();
        tracks.validate(&[("Kalle", &s)]).unwrap();
        let mut pose = Pose::rest(&s);
        tracks.apply("Kalle", &s, &mut pose, 1.0).unwrap();
        let hand = s.world(&pose)[1].pos;
        assert!(hand.x.abs() < 1e-5);
        assert!((hand.y.abs() - 1.0).abs() < 1e-5);
        assert!((s.skin_matrices(&pose)[1].transform_point3(Vec3::X) - hand).length() < 1e-5);
        let restored = PoseTracks::decode(&tracks.encode().unwrap()).unwrap();
        assert_eq!(restored, tracks);
        assert_eq!(pose.local.len(), s.len());
        assert!(pose.local.iter().all(|q| q.is_normalized()));
    }
    #[test]
    fn root_hold_smooth_and_unkeyed_joint() {
        let s = rig();
        let mut t = PoseTracks::default();
        let mut a = key(1.0, 0.0);
        a.interpolation = Interpolation::Hold;
        t.upsert("Kalle", None, a).unwrap();
        let mut b = key(3.0, 0.0);
        b.translation = [2.0, 0.0, 0.0];
        t.upsert("Kalle", None, b).unwrap();
        let mut pose = Pose::rest(&s);
        pose.local[1] = Quat::from_rotation_y(0.3);
        let saved = pose.local[1];
        t.apply("Kalle", &s, &mut pose, 2.0).unwrap();
        assert_eq!(pose.root_pos, Vec3::ZERO);
        assert_eq!(pose.local[1], saved);
        t.tracks[0].keys[0].interpolation = Interpolation::Smooth;
        t.apply("Kalle", &s, &mut pose, 2.0).unwrap();
        assert_eq!(pose.root_pos, Vec3::X);
        t.apply("Kalle", &s, &mut pose, 3.0).unwrap();
        assert_eq!(pose.root_pos.x, 2.0);
    }
    #[test]
    fn invalid_keys_binding_and_duplicates_reject_transactionally() {
        let s = rig();
        let mut t = PoseTracks::default();
        let mut bad = key(0.0, 0.0);
        bad.rotation = [0.0; 4];
        assert!(t.upsert("Kalle", None, bad).is_err());
        assert!(t.tracks.is_empty());
        t.upsert("Kalle", Some("missing"), key(0.0, 0.0)).unwrap();
        assert!(t.validate(&[("Kalle", &s)]).is_err());
        assert!(t.validate(&[("Maija", &s)]).is_err());
        let mut pose = Pose::rest(&s);
        let old = pose.clone();
        assert!(t.apply("Kalle", &s, &mut pose, 0.0).is_err());
        assert_eq!(pose, old);
        t.tracks.push(t.tracks[0].clone());
        assert!(t.encode().is_err());
        assert!(PoseTracks::decode(&vec![b' '; MAX_BYTES + 1]).is_err());
    }
    #[test]
    fn episode_boundary_and_phone_contact_are_explicit_errors() {
        let s = rig();
        let mut tracks = PoseTracks::default();
        tracks.upsert("Kalle", None, key(2.0, 0.0)).unwrap();
        assert!(tracks.validate_duration(1.0).is_err());
        assert!(tracks.validate_duration(2.0).is_ok());
        let mut beyond = key(0.0, 0.0);
        beyond.translation = [5.01, 0.0, 0.0];
        assert!(tracks.upsert("Kalle", None, beyond).is_err());
        let mut frame = CharacterFrame {
            pose: Pose::rest(&s),
            props: crate::PropFrame { phone: None },
            mouth_open: 0.0,
            mouth: Default::default(),
            motion: Some(hs_core::MotionKind::PhoneTap),
            speaking: false,
            root: Vec3::ZERO,
            yaw: 0.0,
            velocity: Vec3::ZERO,
        };
        let original = frame.pose.clone();
        assert!(tracks.apply_frame("Kalle", &s, &mut frame, 2.0).is_err());
        assert_eq!(frame.pose, original);
    }
    #[test]
    fn limits_and_same_time_replace() {
        let mut t = PoseTracks::default();
        t.upsert("Kalle", None, key(0.0, 0.0)).unwrap();
        t.upsert("Kalle", None, key(0.0, 0.4)).unwrap();
        assert_eq!(t.tracks[0].keys.len(), 1);
        let mut bad = key(61.0, 0.0);
        assert!(t.upsert("Kalle", None, bad.clone()).is_err());
        bad.time = f64::NAN;
        assert!(t.upsert("Kalle", None, bad).is_err());
        t.tracks[0].keys = (0..MAX_KEYS + 1)
            .map(|i| key(i as f64 / 1000.0, 0.0))
            .collect();
        assert!(t.encode().is_err());
    }
}
