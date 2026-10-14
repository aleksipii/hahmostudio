use hs_agents::{Pipeline, Production};
#[test]
fn different_actors_share_a_clock_without_shortening_actions() {
    let mut p=Production::new("[background living room]\nKALLE: [at 0s] [wave 4s]\nMAIJA: [at 1s] [nod 2s]\nKALLE: [wait 1s]");
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.beat_times, vec![(0.0, 4.0), (1.0, 2.0), (4.0, 1.0)]);
    assert_eq!(p.timeline.as_ref().unwrap().duration.seconds(), 5.0);
    let proof = hs_agents::audit::inspect(&p);
    assert!(proof.allowed(), "{:?}", proof.diagnostics);
}
#[test]
fn conflicting_actor_and_unknown_timing_are_rejected() {
    for source in [
        "KALLE: [at 0s] [wave 4s]\nKALLE: [at 1s] [wave 2s]",
        "KALLE: [at NaNs] [wait 2s]",
        "[at 1s]\nKALLE: [wait 2s]",
    ] {
        let mut p = Production::new(source);
        let outcome = Pipeline::default().run(&mut p);
        assert!(
            outcome.is_err() || !hs_agents::audit::inspect(&p).allowed(),
            "{source}"
        );
    }
}

#[test]
fn simultaneous_dialogue_keeps_audio_and_single_track_subtitles() {
    let mut p = Production::new(
        "KALLE: Hello there. [at 0s] [wait 3s]\nMAIJA: Welcome home. [at 0s] [wait 3s]",
    );
    p.voice_engine = Some(std::sync::Arc::new(hs_voice::TestEngine::default()));
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.clips.len(), 2);
    assert!(p.clips.iter().all(|c| c.start == 0.0));
    assert!(p
        .mix
        .as_ref()
        .unwrap()
        .samples
        .iter()
        .any(|s| s.abs() > 0.01));
    assert_eq!(
        p.camera.as_ref().unwrap().shots[0].kind,
        hs_agents::agents::cinematography::ShotKind::TwoShot
    );
    let source = hs_agents::captions::cues(&p);
    let mux = hs_subtitle::single_track_cues(&source).unwrap();
    assert!(mux
        .iter()
        .any(|c| c.text.contains("Hello there.") && c.text.contains("Welcome home.")));
    assert!(mux.windows(2).all(|w| w[0].end <= w[1].start));
    assert!(hs_agents::audit::inspect(&p).allowed());
}
#[test]
fn written_camera_beats_automatic_parallel_framing() {
    let mut p =
        Production::new("KALLE: [at 0s] [camera close up] [wave 4s]\nMAIJA: [at 1s] [nod 2s]");
    Pipeline::default().run(&mut p).unwrap();
    let shot = p.camera.as_ref().unwrap().shot_at(2.0).unwrap();
    assert!(shot.authored);
    assert_eq!(
        shot.kind,
        hs_agents::agents::cinematography::ShotKind::CloseUp
    );
}

#[test]
fn leading_gap_does_not_apply_a_written_camera_before_its_start() {
    let mut p = Production::new("KALLE: [at 2s] [camera close up] [nod 2s]");
    Pipeline::default().run(&mut p).unwrap();
    let camera = p.camera.as_ref().unwrap();
    assert!(!camera.shot_at(1.0).unwrap().authored);
    assert_eq!(
        camera.shot_at(1.0).unwrap().kind,
        hs_agents::agents::cinematography::ShotKind::Wide
    );
    assert!(camera.shot_at(2.5).unwrap().authored);
    assert!(hs_agents::audit::inspect(&p).allowed());
}

#[test]
fn one_actor_disjoint_body_channels_run_together() {
    let mut p=Production::new("KALLE: [at 0s] [wave 4s]\nKALLE: [at 1s] [nod 2s]");
    Pipeline::default().run(&mut p).unwrap();
    assert!(hs_agents::audit::inspect(&p).allowed());
    assert_eq!(p.timeline.as_ref().unwrap().duration.seconds(),4.0);
    let frame=p.motion[0].evaluate(p.timeline.as_ref().unwrap(),1.5);
    let h=&p.cast[0].character.humanoid;
    assert!(frame.pose.local[h.arm(hs_motion::Side::Left).upper].angle_between(h.rest_pose().local[h.arm(hs_motion::Side::Left).upper])>0.1);
}
