use hs_core::{Direction, EventKind, Fps, MotionKind, SourceSpan, Tick, Timeline};
use hs_motion::{Humanoid, ProceduralMotion, Proportions, Side};
fn timeline(kinds: &[MotionKind]) -> Timeline {
    let mut timeline = Timeline::new(Fps(30));
    for (index, kind) in kinds.iter().enumerate() {
        timeline.push(
            Tick::ZERO,
            Tick::from_seconds(4.0),
            EventKind::Motion {
                character: Some("Kalle".into()),
                motion: *kind,
            },
            SourceSpan {
                line: index + 1,
                text: format!("{kind:?}"),
            },
        );
    }
    timeline
}
fn solver() -> ProceduralMotion {
    let mut motion = ProceduralMotion::new(Humanoid::new(Proportions::default()));
    motion.name = Some("Kalle".into());
    motion
}
#[test]
fn walk_wave_nod_preserve_root_feet_and_authored_gestures() {
    let kinds = [
        MotionKind::Walk(Direction::Front),
        MotionKind::Wave,
        MotionKind::Nod,
    ];
    let all = timeline(&kinds);
    let combined = solver().prepare(&all).with_layers(&all).unwrap();
    let walk_tl = timeline(&kinds[..1]);
    let walk = solver().prepare(&walk_tl);
    let wave_tl = timeline(&kinds[1..2]);
    let wave = solver().prepare(&wave_tl);
    let nod_tl = timeline(&kinds[2..]);
    let nod = solver().prepare(&nod_tl);
    let h = &combined.motion.humanoid;
    for index in 1..120 {
        let time = index as f32 / 30.0;
        let actual = combined.evaluate(&all, time);
        let walking = walk.evaluate(&walk_tl, time);
        let waving = wave.evaluate(&wave_tl, time);
        let nodding = nod.evaluate(&nod_tl, time);
        assert!((actual.pose.root_pos - walking.pose.root_pos).length() < 1e-6);
        assert!(actual
            .pose
            .root_rot
            .abs_diff_eq(walking.pose.root_rot, 1e-6));
        let world = h.skeleton.world(&actual.pose);
        let walk_world = h.skeleton.world(&walking.pose);
        for side in Side::BOTH {
            let foot = h.leg(side).foot;
            assert!((world[foot].pos - walk_world[foot].pos).length() < 1e-5);
        }
        for joint in hs_motion::layers::joint_mask(h, hs_motion::layers::LEFT_ARM) {
            assert!(actual.pose.local[joint].abs_diff_eq(waving.pose.local[joint], 1e-6));
        }
        assert!(actual.pose.local[h.head].abs_diff_eq(nodding.pose.local[h.head], 1e-6));
        assert!(world
            .iter()
            .all(|joint| joint.pos.is_finite() && joint.rot.is_finite()));
    }
    let actual = combined.evaluate(&all, 1.1);
    let walking = walk.evaluate(&walk_tl, 1.1);
    assert!(
        (h.skeleton.world(&actual.pose)[h.arm(Side::Left).hand].pos
            - h.skeleton.world(&walking.pose)[h.arm(Side::Left).hand].pos)
            .length()
            > 0.1
    );
    assert!(!actual.pose.local[h.head].abs_diff_eq(walking.pose.local[h.head], 1e-3));
}
#[test]
fn overlapping_channels_and_reserved_body_fail() {
    for pair in [
        [MotionKind::Wave, MotionKind::Wave],
        [MotionKind::Nod, MotionKind::ShakeHead],
        [MotionKind::Wave, MotionKind::Clap],
        [
            MotionKind::Walk(Direction::Front),
            MotionKind::Run(Direction::Front),
        ],
        [MotionKind::Sit, MotionKind::Nod],
        [MotionKind::PhoneTap, MotionKind::Wave],
    ] {
        let tl = timeline(&pair);
        assert!(solver().prepare(&tl).with_layers(&tl).is_err(), "{pair:?}");
    }
}
#[test]
fn same_channel_boundaries_and_contact_reservation() {
    let mut tl = timeline(&[MotionKind::Wave, MotionKind::Wave]);
    tl.events[1].start = Tick::from_seconds(4.0);
    tl.duration = Tick::from_seconds(8.0);
    assert!(solver().prepare(&tl).with_layers(&tl).is_ok());
    let mut tl = timeline(&[MotionKind::Wave]);
    tl.push(
        Tick::ZERO,
        Tick::from_seconds(2.0),
        EventKind::ObjectContact {
            character: Some("Kalle".into()),
            contact: hs_core::ObjectContact::PickUp {
                object: "cup".into(),
            },
        },
        SourceSpan {
            line: 2,
            text: "pick up cup".into(),
        },
    );
    assert!(solver().prepare(&tl).with_layers(&tl).is_err());
}
