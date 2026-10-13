//! Deterministic, actor-scoped contact with one fixed, proportion-matched chair.
use crate::{
    humanoid::{Humanoid, Side},
    ik,
    procedural::PreparedMotion,
    skeleton::Pose,
};
use glam::{Quat, Vec3};
use hs_core::{EventKind, MotionKind};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ChairContact {
    /// Ground anchor at the actor's first sit, never follows subsequent movement.
    pub position: Vec3,
    /// Original actor root, one thigh length in front of the fixed chair.
    pub standing_position: Vec3,
    pub yaw: f32,
    /// Top of seat above the ground anchor.
    pub seat_height: f32,
    pub width: f32,
    pub depth: f32,
    pub seated_weight: f32,
}

fn smooth(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

impl PreparedMotion {
    /// Chair remains visible after standing; pose weight is reconstructed from history.
    pub fn chair_at(&self, t: f32) -> Option<ChairContact> {
        let h = &self.motion.humanoid;
        let first = self
            .events()
            .iter()
            .filter(|e| {
                matches!(
                    e.kind,
                    EventKind::Motion {
                        motion: MotionKind::Sit,
                        ..
                    }
                )
            })
            .min_by_key(|e| e.start)?;
        let (position, yaw) = self.root_at(first.start.seconds() as f32);
        let l = h.leg(Side::Left);
        let mut chair = ChairContact {
            position: Vec3::new(position.x, 0.0, position.z)
                - Quat::from_rotation_y(yaw) * Vec3::Z * l.thigh_len,
            standing_position: Vec3::new(position.x, 0.0, position.z),
            yaw,
            seat_height: l.shin_len + l.ankle_height
                - h.skeleton.joints[l.thigh].offset.y
                - h.proportions.height * 0.06,
            width: h.proportions.hip_width + h.proportions.height * 0.20,
            depth: l.thigh_len * 0.85,
            seated_weight: 0.0,
        };
        let mut weight = 0.0;
        for e in self.events() {
            let start = e.start.seconds() as f32;
            if start > t {
                continue;
            }
            if let EventKind::Motion { motion, .. } = e.kind {
                if !matches!(motion, MotionKind::Sit | MotionKind::Stand) {
                    continue;
                }
                let p = smooth((t - start) / (e.duration.seconds() as f32).max(1e-3));
                weight = if motion == MotionKind::Sit {
                    weight + (1.0 - weight) * p
                } else {
                    weight * (1.0 - p)
                };
            }
        }
        chair.seated_weight = weight;
        Some(chair)
    }
}

pub(crate) fn apply(h: &Humanoid, pose: &mut Pose, chair: &ChairContact) {
    let w = chair.seated_weight;
    if w <= 0.0 {
        return;
    }
    let sk = &h.skeleton;
    let rot = Quat::from_rotation_y(chair.yaw);
    // The procedural path relaxes authored views toward front after the event.
    // Contact takes ownership of orientation while seated, rather than twisting
    // the torso independently of feet and fixed chair.
    pose.root_rot = pose.root_rot.slerp(rot, w);
    // Character mesh pelvis ellipsoid extends 0.06 * height below its joint.
    let pelvis_y = chair.position.y + chair.seat_height + h.proportions.height * 0.06;
    let stand_y = h.pelvis_height() + pose.translate[h.pelvis].y + pose.root_pos.y;
    let desired_y = stand_y + (pelvis_y - stand_y) * w;
    pose.root_pos.y = desired_y - h.pelvis_height() - pose.translate[h.pelvis].y;
    pose.translate[h.pelvis].x *= 1.0 - w;
    pose.root_pos.x += (chair.position.x - pose.root_pos.x) * w;
    pose.root_pos.z += (chair.position.z - pose.root_pos.z) * w;
    // Lower hips backwards into the chair while feet stay at their standing locations.
    for side in Side::BOTH {
        let l = h.leg(side);
        let target = chair.standing_position
            + rot
                * Vec3::new(
                    side.sign() * h.proportions.hip_width * 0.5,
                    l.ankle_height,
                    0.0,
                );
        let pole = chair.position
            + rot
                * Vec3::new(
                    side.sign() * h.proportions.hip_width * 0.5,
                    chair.seat_height,
                    l.thigh_len * 2.0,
                );
        ik::two_bone(sk, pose, l.thigh, l.shin, l.foot, target, pole);
        sk.set_world_rotation(pose, l.foot, pose.root_rot);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ProceduralMotion, Proportions};
    use hs_core::{Fps, SourceSpan, Tick, Timeline};
    fn fixture() -> Timeline {
        let mut t = Timeline::new(Fps(30));
        for (start, duration, motion) in [
            (0., 1., MotionKind::Sit),
            (1., 2., MotionKind::Wait),
            (3., 1., MotionKind::Stand),
            (4., 1., MotionKind::Wait),
        ] {
            t.push(
                Tick::from_seconds(start),
                Tick::from_seconds(duration),
                EventKind::Motion {
                    character: Some("Kalle".into()),
                    motion,
                },
                SourceSpan {
                    line: 1,
                    text: String::new(),
                },
            );
        }
        t
    }
    #[test]
    fn actual_skeleton_contacts_seat_and_ground_persistently() {
        let t = fixture();
        let mut motion = ProceduralMotion::new(Humanoid::new(Proportions::default()));
        motion.name = Some("Kalle".into());
        let p = motion.prepare(&t);
        let h = &p.motion.humanoid;
        for time in [1., 1.5, 2.99] {
            let chair = p.chair_at(time).unwrap();
            assert_eq!(chair.seated_weight, 1.);
            let world = h.skeleton.world(&p.evaluate(&t, time).pose);
            let drop = h.proportions.height * 0.06;
            assert!((world[h.pelvis].pos.y - chair.seat_height - drop).abs() < 1e-4);
            for side in Side::BOTH {
                let l = h.leg(side);
                assert!((world[l.foot].pos.y - l.ankle_height).abs() < 2e-4);
                assert!((world[l.shin].pos.y - world[l.thigh].pos.y).abs() < 2e-4);
            }
        }
        assert_eq!(p.chair_at(4.5).unwrap().seated_weight, 0.);
        let pose = p.evaluate(&t, 4.5).pose;
        assert!(pose.root_pos.y.abs() < 1e-5);
        for time in [0.0, 0.1, 0.5, 0.9, 1.0, 2.0, 3.1, 3.5, 3.9, 4.0] {
            let frame = p.evaluate(&t, time);
            let chair = p.chair_at(time).unwrap();
            let world = h.skeleton.world(&frame.pose);
            assert!((frame.root.x - frame.pose.root_pos.x).abs() < 1e-6);
            assert!((frame.root.z - frame.pose.root_pos.z).abs() < 1e-6);
            for side in Side::BOTH {
                let leg = h.leg(side);
                let foot = chair.standing_position
                    + Vec3::new(
                        side.sign() * h.proportions.hip_width * 0.5,
                        leg.ankle_height,
                        0.0,
                    );
                assert!(
                    world[leg.foot].pos.distance(foot) < 0.0005,
                    "foot at {time}"
                );
            }
        }
    }
    #[test]
    fn transitions_are_continuous_and_other_actor_is_unchanged() {
        let t = fixture();
        let mut motion = ProceduralMotion::new(Humanoid::new(Proportions::default()));
        motion.name = Some("Kalle".into());
        let p = motion.clone().prepare(&t);
        for boundary in [0., 1., 3., 4.] {
            let a = p.evaluate(&t, (boundary - 0.0001f32).max(0.)).pose;
            let b = p.evaluate(&t, boundary + 0.0001).pose;
            let h = &p.motion.humanoid;
            let wa = h.skeleton.world(&a);
            let wb = h.skeleton.world(&b);
            for j in [h.pelvis, h.leg(Side::Left).foot, h.leg(Side::Right).foot] {
                assert!(
                    wa[j].pos.distance(wb[j].pos) < 0.001,
                    "joint {j} at {boundary}"
                );
            }
        }
        motion.name = Some("Maija".into());
        let other = motion.prepare(&t);
        assert!(other.chair_at(2.).is_none());
        assert!(other.evaluate(&t, 2.).pose.root_pos.y.abs() < 1e-6);
        assert_eq!(
            p.chair_at(4.).unwrap().position,
            p.chair_at(0.).unwrap().position
        );
    }

    #[test]
    fn contact_scales_with_actual_skeleton_and_world_anchor() {
        let t = fixture();
        for (height, leg_ratio) in [
            (0.8, 0.30),
            (1.8, 0.55),
            (3.0, 0.75),
            (0.8, 0.10),
            (3.0, 0.90),
        ] {
            let mut proportions = Proportions::default();
            proportions.height = height;
            proportions.leg_ratio = leg_ratio;
            let mut motion = ProceduralMotion::new(Humanoid::new(proportions));
            motion.name = Some("Kalle".into());
            motion.start = Vec3::new(1.2, 0., -0.7);
            let p = motion.prepare(&t);
            let c = p.chair_at(2.).unwrap();
            assert!(c.standing_position.distance(Vec3::new(1.2, 0., -0.7)) < 1e-5);
            let frame = p.evaluate(&t, 2.);
            assert!(
                Vec3::new(frame.pose.root_pos.x, 0.0, frame.pose.root_pos.z).distance(c.position)
                    < 1e-5
            );
            let h = &p.motion.humanoid;
            let world = h.skeleton.world(&p.evaluate(&t, 2.).pose);
            for side in Side::BOTH {
                let leg = h.leg(side);
                let wanted = c.position
                    + Vec3::new(
                        side.sign() * h.proportions.hip_width * 0.5,
                        leg.ankle_height,
                        leg.thigh_len,
                    );
                assert!(world[leg.foot].pos.distance(wanted) < 0.0005);
            }
        }
    }

    #[test]
    fn future_chair_is_visible_before_actor_sits() {
        let mut t = Timeline::new(Fps(30));
        t.push(
            Tick::from_seconds(2.0),
            Tick::from_seconds(1.0),
            EventKind::Motion {
                character: Some("Kalle".into()),
                motion: MotionKind::Sit,
            },
            SourceSpan {
                line: 1,
                text: String::new(),
            },
        );
        let mut motion = ProceduralMotion::new(Humanoid::new(Proportions::default()));
        motion.name = Some("Kalle".into());
        let p = motion.prepare(&t);
        let before = p.chair_at(0.0).unwrap();
        assert_eq!(before.seated_weight, 0.0);
        assert_eq!(before.position, p.chair_at(2.5).unwrap().position);
    }

    #[test]
    fn preceding_view_seats_body_and_feet_in_fixed_chair_orientation() {
        let mut t = Timeline::new(Fps(30));
        let source = SourceSpan {
            line: 1,
            text: String::new(),
        };
        t.push(
            Tick::ZERO,
            Tick::from_seconds(1.0),
            EventKind::CharacterView {
                character: Some("Kalle".into()),
                view: hs_core::View::Left,
            },
            source.clone(),
        );
        t.push(
            Tick::from_seconds(1.0),
            Tick::from_seconds(1.0),
            EventKind::Motion {
                character: Some("Kalle".into()),
                motion: MotionKind::Sit,
            },
            source.clone(),
        );
        t.push(
            Tick::from_seconds(2.0),
            Tick::from_seconds(2.0),
            EventKind::Motion {
                character: Some("Kalle".into()),
                motion: MotionKind::Wait,
            },
            source.clone(),
        );
        t.push(
            Tick::from_seconds(4.0),
            Tick::from_seconds(1.0),
            EventKind::Motion {
                character: Some("Kalle".into()),
                motion: MotionKind::Stand,
            },
            source.clone(),
        );
        t.push(
            Tick::from_seconds(5.0),
            Tick::from_seconds(1.0),
            EventKind::Motion {
                character: Some("Kalle".into()),
                motion: MotionKind::Wait,
            },
            source,
        );
        let mut motion = ProceduralMotion::new(Humanoid::new(Proportions::default()));
        motion.name = Some("Kalle".into());
        let p = motion.clone().prepare(&t);
        let chair = p.chair_at(3.0).unwrap();
        assert!(chair.yaw.abs() > 0.5, "test must anchor a non-front chair");
        let frame = p.evaluate(&t, 3.0);
        let rotation = Quat::from_rotation_y(chair.yaw);
        assert!((frame.pose.root_rot * Vec3::Z).distance(rotation * Vec3::Z) < 1e-5);
        let h = &p.motion.humanoid;
        let world = h.skeleton.world(&frame.pose);
        for side in Side::BOTH {
            let leg = h.leg(side);
            let target = chair.position
                + rotation
                    * Vec3::new(
                        side.sign() * h.proportions.hip_width * 0.5,
                        leg.ankle_height,
                        leg.thigh_len,
                    );
            assert!(world[leg.foot].pos.distance(target) < 0.0005);
        }
        for boundary in [1.0, 2.0, 4.0, 5.0] {
            let before = p.evaluate(&t, boundary - 0.0001);
            let after = p.evaluate(&t, boundary + 0.0001);
            let wb = h.skeleton.world(&before.pose);
            let wa = h.skeleton.world(&after.pose);
            for joint in [h.pelvis, h.leg(Side::Left).foot, h.leg(Side::Right).foot] {
                assert!(
                    wb[joint].pos.distance(wa[joint].pos) < 0.001,
                    "rotated joint {joint} boundary {boundary}"
                );
                assert!(
                    (wb[joint].rot * Vec3::Z).distance(wa[joint].rot * Vec3::Z) < 0.001,
                    "rotated foot/body orientation at {boundary}"
                );
            }
        }
        motion.name = Some("Maija".into());
        let other = motion.prepare(&t);
        assert!(other.chair_at(3.0).is_none());
        assert!(
            other
                .evaluate(&t, 3.0)
                .pose
                .root_rot
                .angle_between(Quat::IDENTITY)
                < 1e-5
        );
    }
}
