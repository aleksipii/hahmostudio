//! Authored hand gestures with deterministic two-bone arm contact.
use crate::{
    humanoid::{Humanoid, Side},
    ik,
    skeleton::Pose,
};
use glam::{Quat, Vec3};
use std::f32::consts::{FRAC_PI_2, PI};

/// One clap: lift, close the palms at the middle, open and return to rest.
/// Palm centres are separated by the two half-thicknesses, avoiding interpenetration.
pub fn clap(h: &Humanoid, pose: &mut Pose, progress: f32) {
    let p = progress.clamp(0.0, 1.0);
    let weight = (PI * p).sin().powi(2);
    let root = pose.root_pos;
    let rot = pose.root_rot;
    let world = h.skeleton.world(pose);
    let chest = rot.inverse() * (world[h.chest].pos - root);
    let shoulder_y = (rot.inverse()
        * ((world[h.arm(Side::Left).upper].pos + world[h.arm(Side::Right).upper].pos) * 0.5
            - root))
        .y;
    let closure = (PI * p).sin().powi(8);
    for side in Side::BOTH {
        let arm = h.arm(side);
        let half_thickness = arm.hand_len * 0.11;
        let x =
            side.sign() * (half_thickness + (1.0 - closure) * h.proportions.shoulder_width * 0.38);
        let palm = root
            + rot
                * Vec3::new(
                    x,
                    shoulder_y - (arm.upper_len + arm.fore_len) * 0.25,
                    (arm.upper_len + arm.fore_len) * 0.55,
                );
        let hand_rot = rot * Quat::from_rotation_x(-FRAC_PI_2);
        let wrist = palm - hand_rot * Vec3::new(0.0, -arm.hand_len * 0.24, 0.0);
        let pole = root
            + rot
                * Vec3::new(
                    side.sign() * h.proportions.height * 0.35,
                    chest.y - h.proportions.height * 0.25,
                    0.03,
                );
        let original = pose.clone();
        ik::two_bone(
            &h.skeleton,
            pose,
            arm.upper,
            arm.fore,
            arm.hand,
            wrist,
            pole,
        );
        h.skeleton.set_world_rotation(pose, arm.hand, hand_rot);
        for joint in [arm.upper, arm.fore, arm.hand] {
            pose.local[joint] = original.local[joint].slerp(pose.local[joint], weight);
        }
        crate::hands::curl_fingers(h, pose, side, 0.04 * weight);
    }
}
