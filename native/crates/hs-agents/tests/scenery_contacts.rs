use hs_agents::{scenery::SceneryPlan, Pipeline, Production};
use hs_core::{
    scenery::{SceneryAction, ScenerySpec},
    EventKind,
};
use hs_motion::Side;
fn fixture() -> Production {
    let mut p = Production::new("KALLE: [wait 4s]");
    Pipeline::default().run(&mut p).unwrap();
    p
}
fn authored(mut p: Production, spec: ScenerySpec, action: SceneryAction) -> Production {
    let mut metadata = p.timeline.as_ref().unwrap().events[0].clone();
    metadata.kind = EventKind::SceneryObject { object: spec };
    metadata.duration = hs_core::Tick::ZERO;
    let mut event = p
        .timeline
        .as_ref()
        .unwrap()
        .events
        .iter()
        .find(|e| matches!(e.kind, EventKind::Motion { .. }))
        .unwrap()
        .clone();
    event.kind = EventKind::Scenery {
        character: Some("Kalle".into()),
        action,
    };
    p.timeline
        .as_mut()
        .unwrap()
        .events
        .extend([metadata, event]);
    p
}
#[test]
fn staircase_has_real_foot_contacts_and_persistent_elevation() {
    let p = fixture();
    let base = p.motion[0]
        .evaluate(p.timeline.as_ref().unwrap(), 0.)
        .pose
        .root_pos;
    let p = authored(
        p,
        ScenerySpec::Stairs {
            id: "stairs".into(),
            origin: [base.x, 0., base.z + 0.12],
            width: 0.7,
            rise: 0.08,
            run: 0.24,
            steps: 3,
            yaw_degrees: 0.,
        },
        SceneryAction::ClimbStairs {
            id: "stairs".into(),
            descending: false,
        },
    );
    let plan = SceneryPlan::build(&p).unwrap().unwrap();
    assert!(plan.matches(&p));
    for n in 0..=120 {
        let time = n as f32 / 30.;
        let mut frames = p
            .motion
            .iter()
            .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), time))
            .collect::<Vec<_>>();
        plan.apply_roots(&p, &mut frames, time).unwrap();
        plan.apply_contacts(&p, &mut frames, time).unwrap();
        let h = &p.cast[0].character.humanoid;
        let sample = hs_motion::scenery::stair_sample(
            &match &p
                .timeline
                .as_ref()
                .unwrap()
                .events
                .iter()
                .find(|e| matches!(e.kind, EventKind::SceneryObject { .. }))
                .unwrap()
                .kind
            {
                EventKind::SceneryObject { object } => object.clone(),
                _ => unreachable!(),
            },
            false,
            time / 4.,
            h.proportions.hip_width,
            h.leg(Side::Left).ankle_height,
        )
        .unwrap();
        let world = h.skeleton.world(&frames[0].pose);
        for (i, side) in Side::BOTH.into_iter().enumerate() {
            assert!(world[h.leg(side).foot].pos.distance(sample.feet[i]) < 0.002);
        }
    }
    let mut frames = p
        .motion
        .iter()
        .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), 4.1))
        .collect::<Vec<_>>();
    plan.apply_roots(&p, &mut frames, 4.1).unwrap();
    assert!((frames[0].pose.root_pos.y - 0.24).abs() < 0.01);
    assert!(!plan.meshes(2.).is_empty());
    let other = fixture();
    let mut frames = other
        .motion
        .iter()
        .map(|m| m.evaluate(other.timeline.as_ref().unwrap(), 1.))
        .collect::<Vec<_>>();
    assert!(plan.apply_roots(&other, &mut frames, 1.).is_err());
}
#[test]
fn door_panel_rotates_with_a_reachable_hand_and_cached_mesh() {
    let p = fixture();
    let h = &p.cast[0].character.humanoid;
    let frame = p.motion[0].evaluate(p.timeline.as_ref().unwrap(), 0.);
    let shoulder = h.skeleton.world(&frame.pose)[h.arm(Side::Right).upper].pos;
    let p = authored(
        p,
        ScenerySpec::Door {
            id: "door".into(),
            hinge: [frame.pose.root_pos.x - 0.5, 0., frame.pose.root_pos.z - 0.3],
            width: 0.4,
            height: 2.,
            yaw_degrees: 0.,
            handle_height: shoulder.y - 0.1,
        },
        SceneryAction::OpenDoor {
            id: "door".into(),
            angle_degrees: 30.,
        },
    );
    let plan = SceneryPlan::build(&p).unwrap().unwrap();
    let before = plan.meshes(0.);
    let after = plan.meshes(4.);
    assert!(std::sync::Arc::ptr_eq(&before[0].0, &after[0].0));
    assert_ne!(before[0].1, after[0].1);
    for n in 0..=120 {
        let t = n as f32 / 30.;
        let mut frames = p
            .motion
            .iter()
            .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), t))
            .collect::<Vec<_>>();
        plan.apply_contacts(&p, &mut frames, t).unwrap();
    }
}
#[test]
fn unreachable_entrance_and_unknown_object_fail() {
    let p = authored(
        fixture(),
        ScenerySpec::Stairs {
            id: "stairs".into(),
            origin: [4., 0., 4.],
            width: 0.7,
            rise: 0.08,
            run: 0.24,
            steps: 3,
            yaw_degrees: 0.,
        },
        SceneryAction::ClimbStairs {
            id: "stairs".into(),
            descending: false,
        },
    );
    assert!(SceneryPlan::build(&p).is_err());
}
#[test]
fn source_pipeline_builds_scenery_and_standalone_camera_background_cuts() {
    let mut p=Production::new("[stairs steps at 0 0 0.12 width 0.7 rise 0.08 run 0.24 steps 3 yaw 0]\nKALLE: [climb stairs steps 4s]\n[at 1s] [background park]\n[at 2s] [shot closeup]");
    Pipeline::default().run(&mut p).unwrap();
    assert!(p.scenery.as_ref().unwrap().matches(&p));
    let report = hs_agents::audit::inspect(&p);
    assert!(report.allowed(), "{:?}", report.diagnostics);
    let shots = &p.camera.as_ref().unwrap().shots;
    assert!(shots.iter().any(|s| s.authored
        && (s.start - 2.).abs() < 1e-5
        && s.kind == hs_agents::agents::cinematography::ShotKind::CloseUp));
    assert_eq!(p.camera.as_ref().unwrap().background_at(1.5), "park-day-v1");
    assert_eq!(p.plan.as_ref().unwrap().beats.len(), 1);
}
