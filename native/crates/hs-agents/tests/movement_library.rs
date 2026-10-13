use hs_agents::{Pipeline, Production};
fn ready(script: &str) -> Production {
    let mut p = Production::new(script);
    Pipeline::default().run(&mut p).unwrap();
    p
}
#[test]
fn seven_moves_compile_to_real_actor_scoped_timeline_and_camera() {
    let p = ready(include_str!("../../../examples/english-movements.txt"));
    let report = hs_agents::audit::inspect(&p);
    assert!(report.allowed(), "{:?}", report.diagnostics);
    assert_eq!(report.rows.len(), 8);
    assert_eq!(
        p.plan.as_ref().unwrap().beats[0].motion,
        hs_core::MotionKind::TurnLeft
    );
    for r in report.rows {
        assert!(r.end_seconds > r.start_seconds);
        assert_eq!(r.actor.as_deref(), Some("Kalle"));
    }
}
#[test]
fn gestures_require_free_hands_and_standing_and_turn_has_one_orientation() {
    for source in [
        "KALLE: [prop coffee cup] [clap hands 2s]",
        "KALLE: [prop book] [point forward 2s]",
        "KALLE: [phone front] [shrug shoulders 2s]",
        "KALLE: [sit on chair 2s]\nKALLE: [clap hands 2s]",
        "KALLE: [turn left 2s] [view right]",
        "KALLE: [walk backward 2s] [view back]",
    ] {
        let p = ready(source);
        let report = hs_agents::audit::inspect(&p);
        assert!(!report.allowed(), "{source}");
        assert!(report
            .diagnostics
            .iter()
            .any(|d| d.line > 0 && d.severity == hs_core::Severity::Error));
    }
    let p =
        ready("KALLE: [prop book] [wait 1s]\nKALLE: [prop none] [phone hidden] [clap hands 2s]");
    assert!(hs_agents::audit::inspect(&p).allowed());
}
#[test]
fn portable_episode_reconstructs_turn_orientation_and_gesture_pose() {
    let p = ready("KALLE: [turn left 2s]\nKALLE: [point forward 2s]\nKALLE: [wait 1s]");
    let episode = hs_agents::project::capture(&p, "episode-1".into(), 1, "Gestures".into());
    let bytes = hs_project::encode(&hs_project::Series {
        id: "series-1".into(),
        name: "Moves".into(),
        episodes: vec![episode],
    })
    .unwrap();
    let s = hs_project::decode(&bytes).unwrap();
    let mut reopened = hs_agents::project::restore(&s.episodes[0]);
    Pipeline::default().run(&mut reopened).unwrap();
    assert!(hs_agents::audit::inspect(&reopened).allowed());
    for t in [0.0, 1.0, 2.0, 3.0, 4.9] {
        assert_eq!(p.motion[0].root_at(t), reopened.motion[0].root_at(t));
        let sk = &p.cast[0].character.humanoid.skeleton;
        assert_eq!(
            sk.skin_matrices(&p.motion[0].evaluate(p.timeline.as_ref().unwrap(), t).pose),
            sk.skin_matrices(
                &reopened.motion[0]
                    .evaluate(reopened.timeline.as_ref().unwrap(), t)
                    .pose
            )
        );
    }
}

#[test]
fn actual_clap_contact_is_validated_for_all_shipped_profiles() {
    for profile in hs_character::CharacterParams::presets() {
        let mut p=Production::new(format!("{}: [clap hands 2s]",profile.name));
        p.cast_params.push(profile);
        Pipeline::default().run(&mut p).unwrap();
        let report=hs_agents::audit::inspect(&p);
        assert!(report.allowed(), "{}: {:?}",p.script,report.diagnostics);
    }
    let mut p=ready("KALLE: [clap hands 2s]");
    let mut impossible=hs_motion::ProceduralMotion::new(hs_motion::Humanoid::new(hs_motion::Proportions {shoulder_width:4.0,..Default::default()}));
    impossible.name=Some("Kalle".into());
    p.motion[0]=std::sync::Arc::new(impossible.prepare(p.timeline.as_ref().unwrap()));
    assert!(!hs_agents::audit::inspect(&p).allowed());
}
