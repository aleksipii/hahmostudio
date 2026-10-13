use glam::{Quat, Vec3};
use hs_core::{EventKind, Fps, MotionKind, SourceSpan, Tick, Timeline};
use hs_motion::{gait, Humanoid, ProceduralMotion, Proportions, Side};
use std::f32::consts::FRAC_PI_2;

fn timeline(events: &[(f64, f64, MotionKind)]) -> Timeline {
    let mut tl = Timeline::new(Fps(30));
    for (start, duration, motion) in events {
        tl.push(
            Tick::from_seconds(*start),
            Tick::from_seconds(*duration),
            EventKind::Motion {
                character: None,
                motion: *motion,
            },
            SourceSpan {
                line: 1,
                text: String::new(),
            },
        );
    }
    tl
}

#[test]
fn relative_turns_finish_on_authored_clock_and_persist_without_translation() {
    let tl = timeline(&[
        (0., 1., MotionKind::TurnRight),
        (1., 2., MotionKind::Wait),
        (3., 1., MotionKind::TurnLeft),
        (4., 2., MotionKind::Shrug),
    ]);
    let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
    assert!((m.root_at(0.5).1 - FRAC_PI_2 * 0.5).abs() < 0.012);
    for t in [1., 1.5, 2.9] {
        assert!((m.root_at(t).1 - FRAC_PI_2).abs() < 1e-4);
    }
    assert!(m.root_at(4.5).1.abs() < 1e-4);
    assert_eq!(m.root_at(5.).0, Vec3::ZERO);
    let saved = m.evaluate(&tl, 3.5).pose;
    let _ = m.evaluate(&tl, 0.1);
    assert_eq!(saved, m.evaluate(&tl, 3.5).pose);
}

#[test]
fn backward_walk_reverses_displacement_and_planted_foot_trajectory() {
    let tl = timeline(&[
        (0., 1., MotionKind::TurnRight),
        (1., 3., MotionKind::WalkBackward),
        (4., 1., MotionKind::Wait),
    ]);
    let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
    let end = m.evaluate(&tl, 4.5);
    assert!(end.root.x < -0.8);
    assert!(end.root.z.abs() < 1e-4);
    assert!((end.yaw - FRAC_PI_2).abs() < 1e-4);
    let h = &m.motion.humanoid;
    let params = gait::GaitParams::walk();
    let mut last: Option<(bool, f32)> = None;
    let mut slip = 0.0f32;
    for k in 0..480 {
        let t = k as f32 / 240.;
        let mut g = gait::sample(h, &params, t * params.frequency);
        let forward = g.ankle_target[0].z;
        gait::reverse(&mut g);
        assert_eq!(g.ankle_target[0].z, -forward);
        let world = -Vec3::Z * params.speed(h.pelvis_height()) * t + g.ankle_target[0];
        if let (Some((true, old)), true) = (last, g.planted[0]) {
            slip = slip.max((world.z - old).abs());
        }
        last = Some((g.planted[0], world.z));
    }
    assert!(slip < 1e-4, "backward stance slip {slip}");
    let mut previous: [Option<(bool, Vec3)>; 2] = [None, None];
    let mut actual_slip = 0.0f32;
    for k in 0..480 {
        let t = 1.4 + k as f32 / 240.;
        let sample = gait::sample(h, &params, (t - 1.) * params.frequency);
        let f = m.evaluate(&tl, t);
        let world = h.skeleton.world(&f.pose);
        for side in Side::BOTH {
            let i = side as usize;
            let ankle = world[h.leg(side).foot].pos;
            if let (Some((true, old)), true) = (previous[i], sample.planted[i]) {
                actual_slip =
                    actual_slip.max(Vec3::new(ankle.x - old.x, 0., ankle.z - old.z).length());
            }
            previous[i] = Some((sample.planted[i], ankle));
        }
    }
    assert!(
        actual_slip < 0.001,
        "actual IK foot stance slip {actual_slip}"
    );
    let actual = m.evaluate(&tl, 2.2);
    let world = h.skeleton.world(&actual.pose);
    for side in Side::BOTH {
        assert!(world[h.leg(side).foot].pos.y >= 0.0);
    }
    assert!(end.velocity.length() < 1e-4);
}

#[test]
fn pointing_extends_actual_right_index_forward() {
    let tl = timeline(&[(0., 2., MotionKind::PointForward)]);
    let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
    let f = m.evaluate(&tl, 1.);
    let h = &m.motion.humanoid;
    let arm = h.arm(Side::Right);
    let w = h.skeleton.world(&f.pose);
    assert!(w[arm.hand].pos.z - w[arm.upper].pos.z > arm.upper_len + arm.fore_len - 0.02);
    let index = &arm.fingers[1];
    let a = w[index.joints[0]].pos;
    let tip = w[index.joints[2]].pos + w[index.joints[2]].rot * index.tip;
    assert!((tip - a).normalize().dot(Vec3::Z) > 0.98);
    assert!(f.pose.local[arm.fingers[2].joints[1]].angle_between(Quat::IDENTITY) > 0.8);
}

#[test]
fn shrug_raises_shoulders_and_turns_actual_palms_up() {
    let tl = timeline(&[(0., 2., MotionKind::Shrug)]);
    let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
    let h = &m.motion.humanoid;
    let mid = m.evaluate(&tl, 1.);
    let rest = h.skeleton.world(&h.rest_pose());
    let w = h.skeleton.world(&mid.pose);
    for side in Side::BOTH {
        let a = h.arm(side);
        assert!(w[a.upper].pos.y - rest[a.upper].pos.y > h.proportions.height * 0.025);
        let normal = w[a.hand].rot * (-Vec3::X * side.sign());
        assert!(normal.dot(Vec3::Y) > 0.99, "palm normal {normal:?}");
    }
}

#[test]
fn shake_head_has_opposite_yaw_without_nod_or_root_motion() {
    let tl = timeline(&[(0., 2., MotionKind::ShakeHead)]);
    let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
    let head = m.motion.humanoid.head;
    let left = m.evaluate(&tl, 0.75).pose.local[head] * Vec3::Z;
    let right = m.evaluate(&tl, 1.25).pose.local[head] * Vec3::Z;
    assert!(left.x < -0.2 && right.x > 0.2);
    assert!(left.y.abs() < 1e-5 && right.y.abs() < 1e-5);
    assert_eq!(m.root_at(1.).0, Vec3::ZERO);
}

#[test]
fn clap_palm_surfaces_meet_and_separate_for_multiple_actual_skeletons() {
    for (height, arm_ratio, hand_scale) in [(0.85, 0.25, 0.6), (1.3, 0.36, 1.), (1.85, 0.5, 1.6)] {
        let proportions = Proportions {
            height,
            arm_ratio,
            hand_scale,
            ..Proportions::default()
        };
        let tl = timeline(&[(0., 2., MotionKind::Clap)]);
        let m = ProceduralMotion::new(Humanoid::new(proportions)).prepare(&tl);
        let h = &m.motion.humanoid;
        let surfaces = |t| {
            let f = m.evaluate(&tl, t);
            let w = h.skeleton.world(&f.pose);
            Side::BOTH.map(|side| {
                let a = h.arm(side);
                let hand = w[a.hand];
                hand.pos
                    + hand.rot * Vec3::new(-side.sign() * a.hand_len * 0.11, -a.hand_len * 0.24, 0.)
            })
        };
        let contact = surfaces(1.);
        assert!(
            contact[0].distance(contact[1]) < 0.002,
            "height {height}, surfaces {contact:?}"
        );
        for t in [0.4, 1.6] {
            let hands = surfaces(t);
            assert!(hands[0].distance(hands[1]) > 0.07 * height);
        }
        let pose = m.evaluate(&tl, 1.).pose;
        let _ = m.evaluate(&tl, 0.2);
        assert_eq!(pose, m.evaluate(&tl, 1.).pose);
    }
}

#[test]
fn new_gestures_finish_and_do_not_replace_other_actor_motion() {
    let mut tl = timeline(&[
        (0., 1., MotionKind::PointForward),
        (1., 1., MotionKind::Wait),
    ]);
    for e in &mut tl.events {
        if let EventKind::Motion { character, .. } = &mut e.kind {
            *character = Some("Kalle".into());
        }
    }
    let mut source = ProceduralMotion::new(Humanoid::new(Proportions::default()));
    source.name = Some("Maija".into());
    source.lead = false;
    let m = source.prepare(&tl);
    assert!(m.evaluate(&tl, 0.5).motion.is_none());
    let mut source = m.motion.clone();
    source.name = Some("Kalle".into());
    let m = source.prepare(&tl);
    assert_eq!(m.evaluate(&tl, 0.5).motion, Some(MotionKind::PointForward));
    assert_eq!(m.evaluate(&tl, 1.5).motion, Some(MotionKind::Wait));
}

#[test]
fn backward_from_authored_view_keeps_orientation_in_idle() {
    let mut tl = timeline(&[
        (1., 2., MotionKind::WalkBackward),
        (3., 1., MotionKind::Wait),
    ]);
    tl.push(
        Tick::ZERO,
        Tick::from_seconds(1.),
        EventKind::CharacterView {
            character: None,
            view: hs_core::View::Left,
        },
        SourceSpan {
            line: 1,
            text: String::new(),
        },
    );
    let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
    let initial_yaw = m.root_at(1.).1;
    assert!((initial_yaw + FRAC_PI_2).abs() < 0.001);
    let (root, yaw) = m.root_at(3.5);
    assert!(root.x > 0.5);
    assert!((yaw - initial_yaw).abs() < 1e-5);
}
