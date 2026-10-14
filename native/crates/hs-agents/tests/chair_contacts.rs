use hs_agents::{Pipeline, Production};
fn ready(script: &str) -> Production {
    let mut p = Production::new(script);
    Pipeline::default().run(&mut p).unwrap();
    p
}
#[test]
fn valid_chair_lifecycle_is_actor_scoped_and_rendered() {
    let p=ready("[background living room]\nKALLE: [sit on chair 2s]\nMAIJA: Hello. [wait 1s]\nKALLE: Yes. [nod 1s]\nKALLE: [stand up 2s]");
    let report = hs_agents::audit::inspect(&p);
    assert!(report.allowed(), "{:?}", report.diagnostics);
    assert!(report.rows[0].chair_contact.is_some());
    assert!(report.rows[1].chair_contact.is_none());
    assert!(report.rows[2].chair_contact.is_some());
    assert_eq!(p.motion[0].chair_at(3.5).unwrap().seated_weight, 1.0);
    assert!(p.motion[1].chair_at(3.5).is_none());
    let mut builder = hs_agents::agents::render::FrameBuilder::default();
    let scene = builder.scene(&p, 90, 192, 320).unwrap();
    // Lavaste + two shadows, two characters and the explicit chair.
    assert!(scene.items.len() >= 6);
}
#[test]
fn missing_contact_and_incompatible_actions_are_line_errors() {
    for script in [
        "KALLE: [stand up 2s]",
        "KALLE: [sit on chair 2s]\nKALLE: [sit on chair 2s]",
        "KALLE: [sit on chair 2s]\nKALLE: [walk left 2s]",
        "KALLE: [sit on chair 2s]\nKALLE: [jump 1s]",
        "KALLE: [sit on chair 2s]\nKALLE: [view right] [wait 1s]",
        "[background car driver]\nKALLE: [sit on chair 2s]",
        "KALLE: [sit on chair 2s]\nKALLE: [stand up 2s]\nKALLE: [walk left 2s]\nKALLE: [sit on chair 2s]",
        "[background living room]\nKALLE: [sit on chair 2s]\n[background kitchen]\nKALLE: [wait 1s]",
    ] {
        let mut p=Production::new(script);
        if let Err(error)=Pipeline::default().run(&mut p) { assert!(error.to_string().contains("Rivi "),"{script}: {error}"); continue; }
        let report=hs_agents::audit::inspect(&p);
        assert!(!report.allowed(), "{script}");
        assert!(report.diagnostics.iter().any(|d| d.line>0 && d.severity==hs_core::Severity::Error), "{script}");
    }
}
#[test]
fn seated_closeup_tracks_real_lowered_head_height() {
    let p=ready("KALLE: [sit on chair 2s]\n[camera close up]\nKALLE: [wait 2s]\nKALLE: [stand up 2s]\n[camera close up]\nKALLE: [wait 1s]");
    let camera = p.camera.as_ref().unwrap();
    let seated = camera.camera_at(3.0, 0.6).0;
    let standing = camera.camera_at(6.5, 0.6).0;
    assert!(standing.target.y - seated.target.y > 0.15);
}

#[test]
fn chair_contacts_survive_portable_series_roundtrip() {
    let p=ready("KALLE: [sit on chair 2s]\nKALLE: [wait 2s]\nKALLE: [stand up 2s]");
    let episode=hs_agents::project::capture(&p,"episode-1".into(),1,"Chair".into());
    let bytes=hs_project::encode(&hs_project::Series{id:"series-1".into(),name:"Contacts".into(),episodes:vec![episode]}).unwrap();
    let opened=hs_project::decode(&bytes).unwrap();
    let mut restored=hs_agents::project::restore(&opened.episodes[0]);
    Pipeline::default().run(&mut restored).unwrap();
    assert!(hs_agents::audit::inspect(&restored).allowed());
    for t in [0.0,1.0,2.0,3.0,5.0,6.0] {
        assert_eq!(p.motion[0].chair_at(t),restored.motion[0].chair_at(t));
        let h=&p.cast[0].character.humanoid;
        let original=h.skeleton.skin_matrices(&p.motion[0].evaluate(p.timeline.as_ref().unwrap(),t).pose);
        let reopened=h.skeleton.skin_matrices(&restored.motion[0].evaluate(restored.timeline.as_ref().unwrap(),t).pose);
        assert_eq!(original,reopened);
    }
}
