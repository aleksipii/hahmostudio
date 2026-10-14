//! Deterministic stair foot targets and checked scenery IK.
use crate::{Humanoid, Pose, Side};
use glam::{Quat, Vec3};
use hs_core::scenery::ScenerySpec;
#[derive(Clone, Copy, Debug)]
pub struct StairSample {
    pub root: Vec3,
    pub yaw: Quat,
    pub feet: [Vec3; 2],
    pub planted: [bool; 2],
}
fn smooth(p: f32) -> f32 {
    let p = p.clamp(0., 1.);
    p * p * (3. - 2. * p)
}
pub fn stair_sample(
    spec: &ScenerySpec,
    descending: bool,
    progress: f32,
    hip_width: f32,
    ankle: f32,
) -> Result<StairSample, String> {
    spec.validate()?;
    if !progress.is_finite()
        || !hip_width.is_finite()
        || hip_width <= 0.
        || !ankle.is_finite()
        || ankle < 0.
    {
        return Err("Invalid stair sample parameters".into());
    }
    let ScenerySpec::Stairs {
        origin,
        rise,
        run,
        steps,
        yaw_degrees,
        ..
    } = spec
    else {
        return Err("Expected stairs".into());
    };
    let phases = *steps as usize * 2;
    let x = progress.clamp(0., 1.) * phases as f32;
    let done = (x.floor() as usize).min(phases);
    let fraction = x - done as f32;
    let mut feet = [Vec3::ZERO; 2];
    let mut planted = [true; 2];
    let point = |level: usize, side: usize| {
        let level = if descending {
            *steps as usize - level
        } else {
            level
        };
        let z = if level == 0 {
            -run * 0.5
        } else {
            *run * (level as f32 - 0.5)
        };
        Vec3::new(
            if side == 0 {
                hip_width * 0.5 * if descending { -1. } else { 1. }
            } else {
                -hip_width * 0.5 * if descending { -1. } else { 1. }
            },
            *rise * level as f32 + ankle,
            z,
        )
    };
    for side in 0..2 {
        let advances = (done + 1 - side) / 2;
        feet[side] = point(advances, side);
        if done < phases && done % 2 == side {
            let to = point(advances + 1, side);
            let p = smooth(fraction);
            feet[side] = feet[side].lerp(to, p);
            feet[side].y +=
                fraction.mul_add(std::f32::consts::PI, 0.).sin().max(0.) * (*rise + 0.06);
            planted[side] = fraction <= 0.0001 || fraction >= 0.9999;
        }
    }
    let base = Quat::from_rotation_y(yaw_degrees.to_radians());
    let origin = Vec3::from_array(*origin);
    let root = Vec3::new(
        0.,
        feet[0].y.min(feet[1].y)
            - ankle
            - 0.035 * smooth(progress / 0.05) * smooth((1. - progress) / 0.05),
        (feet[0].z + feet[1].z) * 0.5,
    );
    Ok(StairSample {
        root: origin + base * root,
        yaw: base * Quat::from_rotation_y(if descending { std::f32::consts::PI } else { 0. }),
        feet: feet.map(|v| origin + base * v),
        planted,
    })
}
pub fn apply_stair_feet(
    h: &Humanoid,
    pose: &mut Pose,
    sample: &StairSample,
) -> Result<[f32; 2], String> {
    if pose.local.len() != h.skeleton.joints.len()
        || pose.translate.len() != h.skeleton.joints.len()
        || !pose.root_pos.is_finite()
        || !pose.root_rot.is_finite()
        || pose.local.iter().any(|v| !v.is_finite())
        || pose.translate.iter().any(|v| !v.is_finite())
    {
        return Err("Malformed stair pose".into());
    }
    let mut errors = [0.; 2];
    for (i, side) in Side::BOTH.into_iter().enumerate() {
        let l = h.leg(side);
        let pole = sample.root + sample.yaw * Vec3::new(side.sign() * 0.1, 0.5, 1.);
        let solved = crate::ik::two_bone(
            &h.skeleton,
            pose,
            l.thigh,
            l.shin,
            l.foot,
            sample.feet[i],
            pole,
        );
        h.skeleton.set_world_rotation(pose, l.foot, sample.yaw);
        errors[i] = solved.error;
        if solved.error > 0.002 {
            return Err(format!(
                "Stair foot target unreachable ({:0.4} m)",
                solved.error
            ));
        }
    }
    Ok(errors)
}
pub fn door_handle(spec: &ScenerySpec, angle: f32) -> Result<Vec3, String> {
    spec.validate()?;
    if !angle.is_finite() {
        return Err("Invalid door angle".into());
    }
    let ScenerySpec::Door {
        hinge,
        width,
        yaw_degrees,
        handle_height,
        ..
    } = spec
    else {
        return Err("Expected door".into());
    };
    Ok(Vec3::from_array(*hinge)
        + Quat::from_rotation_y((yaw_degrees + angle).to_radians())
            * Vec3::new(width * 0.85, *handle_height, 0.04))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stairs_are_supported_and_reachable() {
        let h = Humanoid::new(crate::Proportions::default());
        let s = ScenerySpec::Stairs {
            id: "steps".into(),
            origin: [0., 0., 0.],
            width: 0.7,
            rise: 0.08,
            run: 0.24,
            steps: 3,
            yaw_degrees: 0.,
        };
        for descending in [false, true] {
            for n in 0..=240 {
                let sample = stair_sample(
                    &s,
                    descending,
                    n as f32 / 240.,
                    h.proportions.hip_width,
                    h.leg(Side::Left).ankle_height,
                )
                .unwrap();
                let mut pose = h.rest_pose();
                pose.root_pos = sample.root;
                pose.root_rot = sample.yaw;
                let errors = apply_stair_feet(&h, &mut pose, &sample).unwrap();
                assert!(errors.into_iter().all(|e| e < 0.002));
                for (i, planted) in sample.planted.into_iter().enumerate() {
                    if planted {
                        let y = sample.feet[i].y - h.leg(Side::Left).ankle_height;
                        let level = (y / 0.08).round();
                        assert!((y - level * 0.08).abs() < 0.0001);
                    }
                }
            }
        }
    }
    #[test]
    fn handle_follows_hinge_arc() {
        let s = ScenerySpec::Door {
            id: "door".into(),
            hinge: [1., 0., 2.],
            width: 0.8,
            height: 2.,
            yaw_degrees: 0.,
            handle_height: 1.,
        };
        let a = door_handle(&s, 0.).unwrap();
        let b = door_handle(&s, 90.).unwrap();
        assert!((a.y - b.y).abs() < 1e-5);
        assert!(
            ((a - Vec3::new(1., 1., 2.)).length() - (b - Vec3::new(1., 1., 2.)).length()).abs()
                < 1e-5
        );
        assert!((a - b).length() > 0.9);
    }
}
