//! Boundary checks include actual FK, rather than only an envelope formula.
use glam::Vec3;
use hs_core::{EventKind, Fps, MotionKind, SourceSpan, Tick, Timeline};
use hs_motion::{Humanoid, ProceduralMotion, Proportions, Side};

fn timeline(actions: &[MotionKind]) -> Timeline {
    let mut timeline = Timeline::new(Fps(30));
    for (index, motion) in actions.iter().enumerate() {
        timeline.push(
            Tick::from_seconds(index as f64 * 2.0),
            Tick::from_seconds(2.0),
            EventKind::Motion {
                character: None,
                motion: *motion,
            },
            SourceSpan {
                line: index + 1,
                text: String::new(),
            },
        );
    }
    timeline
}

#[test]
fn authored_gestures_start_and_recover_to_same_time_idle_pose() {
    for action in [
        MotionKind::Wave,
        MotionKind::PointForward,
        MotionKind::Shrug,
        MotionKind::Clap,
    ] {
        let active = timeline(&[MotionKind::Wait, action, MotionKind::Wait]);
        let idle = timeline(&[MotionKind::Wait, MotionKind::Wait, MotionKind::Wait]);
        let humanoid = Humanoid::new(Proportions::default());
        let movement = ProceduralMotion::new(humanoid.clone()).prepare(&active);
        let resting = ProceduralMotion::new(humanoid.clone()).prepare(&idle);
        for time in [2.0, 2.0001, 3.9999, 4.0] {
            let a = movement.evaluate(&active, time).pose;
            let b = resting.evaluate(&idle, time).pose;
            let world_a = humanoid.skeleton.world(&a);
            let world_b = humanoid.skeleton.world(&b);
            for (joint, (wa, wb)) in world_a.iter().zip(&world_b).enumerate() {
                assert!(
                    wa.pos.distance(wb.pos) < 0.00005,
                    "{action:?}, t={time}, joint={joint} boundary displacement {}",
                    wa.pos.distance(wb.pos)
                );
                // Quaternions very close to identity can accumulate acos rounding:
                // dot compares orientation without amplifying that rounding.
                assert!(
                    a.local[joint].dot(b.local[joint]).abs() > 0.999999,
                    "{action:?}, t={time}, joint={joint} boundary rotation"
                );
            }
        }
        let peak = movement.evaluate(&active, 3.0).pose;
        let rest = resting.evaluate(&idle, 3.0).pose;
        assert!(
            peak.local
                .iter()
                .zip(&rest.local)
                .any(|(a, b)| a.dot(*b).abs() < 0.99),
            "{action:?} must still perform a visible action"
        );
    }
}

#[test]
fn adjacent_gestures_have_continuous_joints_and_planted_ankles() {
    let timeline = timeline(&[
        MotionKind::Wave,
        MotionKind::PointForward,
        MotionKind::Shrug,
        MotionKind::Clap,
        MotionKind::Wait,
    ]);
    let humanoid = Humanoid::new(Proportions::default());
    let movement = ProceduralMotion::new(humanoid.clone()).prepare(&timeline);
    // Sampling order must not introduce hidden state or a previous-frame dependency.
    let reference = movement.evaluate(&timeline, 5.1).pose;
    let _ = movement.evaluate(&timeline, 0.01);
    assert_eq!(reference, movement.evaluate(&timeline, 5.1).pose);
    for boundary in [2.0, 4.0, 6.0, 8.0] {
        let before = movement.evaluate(&timeline, boundary - 0.0001).pose;
        let after = movement.evaluate(&timeline, boundary + 0.0001).pose;
        for (index, (a, b)) in before.local.iter().zip(&after.local).enumerate() {
            assert!(
                a.dot(*b).abs() > 0.999999,
                "boundary={boundary}, joint={index}"
            );
        }
    }
    for index in 0..=1000 {
        let time = index as f32 * 0.01;
        let frame = movement.evaluate(&timeline, time);
        assert_eq!(frame.root, Vec3::ZERO);
        assert_eq!(frame.pose.root_pos, Vec3::ZERO);
        let world = humanoid.skeleton.world(&frame.pose);
        for side in Side::BOTH {
            let leg = humanoid.leg(side);
            let target = Vec3::new(
                side.sign() * humanoid.proportions.hip_width * 0.5,
                leg.ankle_height,
                0.0,
            );
            assert!(
                world[leg.foot].pos.distance(target) < 0.002,
                "planted foot moved at {time}"
            );
        }
    }
}
