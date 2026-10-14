//! Original character acting cadence, independent of camera, audio and contact clocks.
//!
//! A stepped cadence holds only explicitly allowed upper-body channels. Evaluate
//! root/legs at the real scene time, preserve real-time visemes, then solve contacts
//! at that same real time. This is not full-scene time quantization or a new rig.
use crate::{Humanoid, Pose, Side};
use hs_core::motion_channels::{HEAD, LEFT_ARM, RIGHT_ARM};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActingStyle {
    #[default]
    Smooth,
    Stepped12,
    Stepped15,
}

/// Maximum portable acting-style resource size, including whitespace.
pub const MAX_BYTES: usize = 128;

impl ActingStyle {
    /// Portable bounded project asset; unknown styles are errors, never fallback.
    pub fn encode(self) -> Result<Vec<u8>, String> {
        serde_json::to_vec(&self).map_err(|e| format!("Acting style serialization failed: {e}"))
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() > MAX_BYTES {
            return Err("Acting style resource exceeds 128 bytes".into());
        }
        serde_json::from_slice(bytes).map_err(|e| format!("Invalid acting style resource: {e}"))
    }

    pub fn frames_per_second(self) -> Option<u8> {
        match self {
            Self::Smooth => None,
            Self::Stepped12 => Some(12),
            Self::Stepped15 => Some(15),
        }
    }

    /// Pose sample on an action-local grid, never earlier than its authored start.
    /// `time` and `anchor` remain seconds on the original timeline. This helper
    /// does not change event durations or speech timing, and never samples ahead.
    pub fn sample_time(self, time: f64, anchor: f64) -> Result<f64, String> {
        if !time.is_finite() || !anchor.is_finite() || anchor < 0.0 || time < anchor {
            return Err("Invalid acting pose time or action anchor".into());
        }
        let Some(fps) = self.frames_per_second() else {
            return Ok(time);
        };
        let delta = time - anchor;
        let frame = (delta * f64::from(fps)).floor();
        if !frame.is_finite() {
            return Err("Acting pose time exceeds finite sampling range".into());
        }
        Ok((anchor + frame / f64::from(fps)).clamp(anchor, time))
    }
}

/// Copy selected held acting joints into an actual-time pose.
///
/// Allowed mask is a subset of LEFT_ARM | RIGHT_ARM | HEAD; pass zero while a
/// full-body contact is active, or exclude its reserved hand. Caller must also
/// protect keyed joints. Root, torso, legs and local facial/viseme rig transforms
/// always stay intact. Neck/head movement moves the face in world space but does
/// not replace the jaw/lip shape. Final contact and collision checks still apply.
/// Both inputs must use this humanoid's skeleton. Invalid input is rejected
/// before any mutation, so a bad held pose cannot partially replace a live pose.
pub fn apply_upper_body(
    humanoid: &Humanoid,
    live: &mut Pose,
    held: &Pose,
    allowed_channels: u8,
) -> Result<(), String> {
    if allowed_channels & !(HEAD | LEFT_ARM | RIGHT_ARM) != 0 {
        return Err("Acting cadence can only modify upper-body channels".into());
    }
    let count = humanoid.skeleton.joints.len();
    if [
        live.local.len(),
        live.translate.len(),
        held.local.len(),
        held.translate.len(),
    ]
    .iter()
    .any(|n| *n != count)
    {
        return Err("Acting pose does not match the humanoid skeleton".into());
    }
    // The built-in humanoid has 19 joints per arm and two head joints.
    // Keep this per-frame helper free of heap allocation.
    let mut indices = [0usize; 40];
    let mut length = 0;
    let mut append = |joint| {
        indices[length] = joint;
        length += 1;
    };
    if allowed_channels & HEAD != 0 {
        append(humanoid.neck);
        append(humanoid.head);
    }
    for side in Side::BOTH {
        let channel = match side {
            Side::Left => LEFT_ARM,
            Side::Right => RIGHT_ARM,
        };
        if allowed_channels & channel != 0 {
            let arm = humanoid.arm(side);
            for joint in [arm.clavicle, arm.upper, arm.fore, arm.hand] {
                append(joint);
            }
            for finger in &arm.fingers {
                for joint in finger.joints {
                    append(joint);
                }
            }
        }
    }
    for &joint in &indices[..length] {
        if joint >= count
            || !held.local[joint].is_finite()
            || (held.local[joint].length_squared() - 1.0).abs() > 0.001
            || !held.translate[joint].is_finite()
        {
            return Err("Invalid held acting joint transform".into());
        }
    }
    for &joint in &indices[..length] {
        live.local[joint] = held.local[joint];
        live.translate[joint] = held.translate[joint];
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Proportions;
    use glam::{Quat, Vec3};

    #[test]
    fn cadence_is_local_bounded_and_stateless() {
        for (style, fps) in [
            (ActingStyle::Stepped12, 12.0),
            (ActingStyle::Stepped15, 15.0),
        ] {
            let anchor = 1.137;
            for index in 0..=3000 {
                let time = anchor + index as f64 * 0.001;
                let sample = style.sample_time(time, anchor).unwrap();
                assert!(sample >= anchor && sample <= time);
                assert!(time - sample < 1.0 / fps + 1e-12);
                let frame = (sample - anchor) * fps;
                assert!((frame - frame.round()).abs() < 1e-10);
                assert_eq!(sample, style.sample_time(time, anchor).unwrap());
            }
            assert_eq!(style.sample_time(anchor, anchor).unwrap(), anchor);
            assert_eq!(style.sample_time(anchor + 0.01, anchor).unwrap(), anchor);
        }
        assert_eq!(ActingStyle::default(), ActingStyle::Smooth);
        assert_eq!(
            ActingStyle::Smooth.sample_time(2.713, 1.137).unwrap(),
            2.713
        );
    }

    #[test]
    fn style_serialization_is_bounded_and_invalid_time_rejected() {
        for style in [
            ActingStyle::Smooth,
            ActingStyle::Stepped12,
            ActingStyle::Stepped15,
        ] {
            assert_eq!(
                ActingStyle::decode(&style.encode().unwrap()).unwrap(),
                style
            );
            let json = serde_json::to_string(&style).unwrap();
            assert_eq!(serde_json::from_str::<ActingStyle>(&json).unwrap(), style);
            for (time, anchor) in [
                (f64::NAN, 0.0),
                (f64::INFINITY, 0.0),
                (1.0, -1.0),
                (1.0, 2.0),
                (1.0, f64::NAN),
            ] {
                assert!(style.sample_time(time, anchor).is_err());
            }
        }
        assert!(serde_json::from_str::<ActingStyle>("\"stepped_1200\"").is_err());
        assert!(ActingStyle::decode(&vec![b' '; MAX_BYTES + 1]).is_err());
        assert!(ActingStyle::decode(b"\"smooth\" trailing").is_err());
        assert!(ActingStyle::decode(b"null").is_err());
    }

    #[test]
    fn held_channels_preserve_roots_feet_visemes_and_reserved_arm() {
        let h = Humanoid::new(Proportions::default());
        let mut live = h.rest_pose();
        live.root_pos = Vec3::new(0.3, 0.1, -0.2);
        live.root_rot = Quat::from_rotation_y(0.4);
        live.local[h.jaw] = Quat::from_rotation_x(0.2);
        live.translate[h.mouth.corner_left] = Vec3::new(0.01, 0.02, 0.0);
        let before = live.clone();
        let before_world = h.skeleton.world(&live);
        let mut held = h.rest_pose();
        for q in &mut held.local {
            *q = Quat::from_rotation_z(0.25);
        }
        for v in &mut held.translate {
            *v = Vec3::new(0.003, 0.002, 0.0);
        }
        held.root_pos = Vec3::splat(10.0);
        apply_upper_body(&h, &mut live, &held, LEFT_ARM | HEAD).unwrap();
        assert_eq!(live.root_pos, before.root_pos);
        assert_eq!(live.root_rot, before.root_rot);
        for joint in [
            h.pelvis,
            h.spine,
            h.chest,
            h.jaw,
            h.mouth.corner_left,
            h.arm(Side::Right).upper,
            h.arm(Side::Right).hand,
        ] {
            assert_eq!(live.local[joint], before.local[joint]);
            assert_eq!(live.translate[joint], before.translate[joint]);
        }
        assert_eq!(live.local[h.head], held.local[h.head]);
        assert_eq!(
            live.local[h.arm(Side::Left).hand],
            held.local[h.arm(Side::Left).hand]
        );
        let after_world = h.skeleton.world(&live);
        for side in Side::BOTH {
            for joint in [h.leg(side).foot, h.leg(side).toe] {
                assert_eq!(after_world[joint], before_world[joint]);
            }
        }
    }

    #[test]
    fn invalid_channels_and_joint_data_do_not_partially_apply() {
        let h = Humanoid::new(Proportions::default());
        let mut live = h.rest_pose();
        let before = live.clone();
        let mut held = h.rest_pose();
        held.local[h.head] = Quat::from_rotation_x(0.3);
        held.translate[h.arm(Side::Right).hand].x = f32::NAN;
        assert!(apply_upper_body(&h, &mut live, &held, HEAD | RIGHT_ARM).is_err());
        assert_eq!(live, before);
        assert!(apply_upper_body(&h, &mut live, &held, 1).is_err());
        assert_eq!(live, before);
        apply_upper_body(&h, &mut live, &held, 0).unwrap();
        assert_eq!(live, before);
        held.local.pop();
        assert!(apply_upper_body(&h, &mut live, &held, HEAD).is_err());
        assert_eq!(live, before);
    }
}
