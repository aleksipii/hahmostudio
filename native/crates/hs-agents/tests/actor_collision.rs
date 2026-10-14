use glam::Vec3;
use hs_agents::{
    collision::{capsules_intersect, swept_capsules_intersect, BodyCapsule},
    Pipeline, Production,
};
fn capsule(x: f32, z: f32) -> BodyCapsule {
    BodyCapsule {
        a: Vec3::new(x, 0.5, z),
        b: Vec3::new(x, 1.5, z),
        radius: 0.1,
    }
}
#[test]
fn touching_tolerance_and_degenerate_head_segment_are_correct() {
    assert!(!capsules_intersect(capsule(0., 0.), capsule(0.198, 0.)).unwrap());
    assert!(capsules_intersect(capsule(0., 0.), capsule(0.196, 0.)).unwrap());
    let head = BodyCapsule {
        a: Vec3::new(0., 1., 0.),
        b: Vec3::new(0., 1., 0.),
        radius: 0.1,
    };
    assert!(capsules_intersect(capsule(0., 0.), head).unwrap());
    assert!(capsules_intersect(head, capsule(0., 0.)).unwrap());
}
#[test]
fn synchronized_crossing_is_blocked_without_rejecting_different_times() {
    assert!(!capsules_intersect(capsule(-1., 0.), capsule(1., 0.)).unwrap());
    assert!(!capsules_intersect(capsule(1., 0.), capsule(-1., 0.)).unwrap());
    assert!(swept_capsules_intersect(
        capsule(-1., 0.),
        capsule(1., 0.),
        capsule(1., 0.),
        capsule(-1., 0.)
    )
    .unwrap());
    // Narrow contact away from the interval midpoint cannot tunnel through.
    let small = |x| BodyCapsule {
        radius: 0.004,
        ..capsule(x, 0.)
    };
    assert!(swept_capsules_intersect(small(-1.), small(1.), small(-0.73), small(-0.73)).unwrap());
    // Same path and direction, fixed 1 m spacing: swept volumes overlap but bodies never do.
    assert!(!swept_capsules_intersect(
        capsule(-1., 0.),
        capsule(1., 0.),
        capsule(0., 0.),
        capsule(2., 0.)
    )
    .unwrap());
    assert!(!swept_capsules_intersect(
        capsule(-1., 0.),
        capsule(1., 0.),
        capsule(1., 0.3),
        capsule(-1., 0.3)
    )
    .unwrap());
    assert!(swept_capsules_intersect(
        capsule(-1., 0.),
        capsule(1., 0.),
        capsule(-1., 0.),
        capsule(1., 0.)
    )
    .unwrap());
}
fn ready() -> Production {
    let mut p = Production::new("KALLE: [wait 4s]\nMAIJA: [at 0s] [wait 4s]");
    Pipeline::default().run(&mut p).unwrap();
    p
}
#[test]
fn real_fk_crossing_and_penetration_report_actors_source_and_time() {
    let p = ready();
    let plan = p.collision.as_ref().unwrap();
    let before = p
        .motion
        .iter()
        .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), 0.))
        .collect::<Vec<_>>();
    plan.evaluate(&p, 0., &before).unwrap();
    let mut after = before.clone();
    after[0].pose.root_pos = before[1].pose.root_pos;
    after[1].pose.root_pos = before[0].pose.root_pos;
    plan.evaluate(&p, 1., &after).unwrap();
    let error = plan.sweep(&p, 0., &before, 1., &after).unwrap_err();
    assert!(
        error.contains("Kalle")
            && error.contains("Maija")
            && error.contains("Rivi 2")
            && error.contains("0.000–1.000"),
        "{error}"
    );
    after[1].pose.root_pos = after[0].pose.root_pos;
    let error = plan.evaluate(&p, 1., &after).unwrap_err();
    assert!(
        error.contains("törmäävät") && error.contains("1.000"),
        "{error}"
    );
}
#[test]
fn valid_handoff_contacts_and_portable_project_keep_body_clearance() {
    let mut p = Production::new("[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nMAIJA: [at 0s] [wait 6s]\nKALLE: [at 2s] [give cup to Maija 2s]");
    Pipeline::default().run(&mut p).unwrap();
    for tick in 0..=240 {
        let t = tick as f32 / 60.;
        let mut frames = p
            .motion
            .iter()
            .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), t))
            .collect::<Vec<_>>();
        p.contacts
            .as_ref()
            .unwrap()
            .evaluate(&p, t, &mut frames)
            .unwrap();
        p.collision
            .as_ref()
            .unwrap()
            .evaluate(&p, t, &frames)
            .unwrap();
    }
    let episode =
        hs_agents::project::capture_checked(&p, "actor".into(), 1, "Body clearance".into())
            .unwrap();
    let series = hs_project::Series {
        id: "actor-series".into(),
        name: "Actors".into(),
        episodes: vec![episode],
    };
    let decoded = hs_project::decode(&hs_project::encode(&series).unwrap()).unwrap();
    let mut restored = hs_agents::project::restore_checked(&decoded.episodes[0]).unwrap();
    Pipeline::default().run(&mut restored).unwrap();
    let mut builder = hs_agents::agents::render::FrameBuilder::default();
    assert!(
        builder.scene(&restored, 90, 160, 90).is_some(),
        "{:?}",
        builder.last_error
    );
}
#[test]
fn authored_pose_route_crossing_is_rejected_by_preflight() {
    let mut p = ready();
    use hs_motion::pose_edit::{Interpolation, PoseKey};
    let positions = p
        .motion
        .iter()
        .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), 0.).pose.root_pos)
        .collect::<Vec<_>>();
    for (i, name) in ["Kalle", "Maija"].iter().enumerate() {
        p.pose_tracks
            .upsert(
                name,
                None,
                PoseKey::from_euler_degrees(
                    0.,
                    positions[i].to_array(),
                    [0.; 3],
                    Interpolation::Linear,
                ),
            )
            .unwrap();
        p.pose_tracks
            .upsert(
                name,
                None,
                PoseKey::from_euler_degrees(
                    1.,
                    positions[1 - i].to_array(),
                    [0.; 3],
                    Interpolation::Linear,
                ),
            )
            .unwrap();
    }
    let error = Pipeline::default().run(&mut p).unwrap_err().to_string();
    assert!(
        error.contains("Kalle") && error.contains("Maija") && error.contains("Rivi"),
        "{error}"
    );
}
