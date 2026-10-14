use hs_agents::agents::cinematography::ShotKind;
use hs_agents::{Pipeline, Production};

#[test]
fn authored_subsecond_and_repeated_shots_remain_distinct() {
    let source = "[shot wide]\nKALLE: First. [wait 1s]\n[shot closeup]\nMAIJA: Second. [wait 0.5s]\n[shot closeup]\nKALLE: Third. [wait 0.6s]";
    let mut production = Production::new(source);
    Pipeline::default().run(&mut production).unwrap();
    let shots = &production.camera.as_ref().unwrap().shots;
    assert_eq!(shots.len(), 3, "{shots:?}");
    assert_eq!(
        shots.iter().map(|s| s.kind).collect::<Vec<_>>(),
        vec![ShotKind::Wide, ShotKind::CloseUp, ShotKind::CloseUp]
    );
    assert_eq!(
        production.cast[shots[1].subject].character.params.name,
        "Maija"
    );
    assert_eq!(
        production.cast[shots[2].subject].character.params.name,
        "Kalle"
    );
    assert!(shots[1].end - shots[1].start < 1.0);
    assert!(shots[2].end - shots[2].start < 1.0);
    assert_eq!(shots[1].end, shots[2].start);
}

#[test]
fn two_shot_and_over_shoulder_reject_missing_partner() {
    for shot in ["two shot", "over shoulder"] {
        let mut production = Production::new(format!("[shot {shot}]\nKALLE: Alone. [wait 1s]"));
        let error = Pipeline::default()
            .run(&mut production)
            .unwrap_err()
            .to_string();
        assert!(error.contains("partner"), "{error}");
        assert!(production.camera.is_none());
    }
}

#[test]
fn insert_requires_a_real_supported_phone_prop() {
    let mut production = Production::new("[shot insert]\nKALLE: No phone. [wait 1s]");
    let error = Pipeline::default()
        .run(&mut production)
        .unwrap_err()
        .to_string();
    assert!(error.contains("phone prop"), "{error}");
    assert!(production.camera.is_none());
    let mut production = Production::new("[shot insert]\nKALLE: Sending it. [tap phone 1s]");
    Pipeline::default().run(&mut production).unwrap();
    assert_eq!(
        production.camera.as_ref().unwrap().shots[0].kind,
        ShotKind::Insert
    );
}

#[test]
fn authored_partner_shots_keep_subject_and_distinct_partner() {
    let mut production = Production::new(
        "[shot two shot]\nKALLE: Hello. [wait 1s]\n[shot over shoulder]\nMAIJA: Hi. [wait 0.5s]",
    );
    Pipeline::default().run(&mut production).unwrap();
    let shots = &production.camera.as_ref().unwrap().shots;
    assert_eq!(shots.len(), 2);
    assert_eq!(shots[0].kind, ShotKind::TwoShot);
    assert_eq!(shots[1].kind, ShotKind::OverShoulder);
    assert_ne!(shots[0].subject, shots[0].partner.unwrap());
    assert_ne!(shots[1].subject, shots[1].partner.unwrap());
    assert_eq!(
        production.cast[shots[1].subject].character.params.name,
        "Maija"
    );
    let (camera, _, kind) = production
        .camera
        .as_ref()
        .unwrap()
        .camera_at(shots[1].start + 0.1, 16.0 / 9.0);
    assert_eq!(kind, ShotKind::OverShoulder);
    assert!(camera.eye.is_finite() && camera.target.is_finite());
}

#[test]
fn repeated_authored_same_subject_same_kind_keeps_cut_boundary() {
    let mut production = Production::new(
        "[shot closeup]\nKALLE: First. [wait 1s]\n[shot closeup]\nKALLE: Second. [wait 1s]",
    );
    Pipeline::default().run(&mut production).unwrap();
    let shots = &production.camera.as_ref().unwrap().shots;
    assert_eq!(shots.len(), 2, "{shots:?}");
    assert_eq!(shots[0].subject, shots[1].subject);
    assert_eq!(shots[0].kind, shots[1].kind);
    assert_eq!(shots[0].end, shots[1].start);
}

#[test]
fn tracking_wide_centers_the_cast_instead_of_only_the_moving_subject() {
    let mut production =
        Production::new("[shot wide]\nKALLE: Moving. [walk left 4s]\nMAIJA: Watching. [wait 1s]");
    Pipeline::default().run(&mut production).unwrap();
    let track = production.camera.as_ref().unwrap();
    assert!(track.shots[0].tracking);
    let t = 2.0;
    let (camera, _, kind) = track.camera_at(t, 16.0 / 9.0);
    assert_eq!(kind, ShotKind::Wide);
    let xs: Vec<f32> = production
        .motion
        .iter()
        .map(|motion| motion.root_at(t).0.x)
        .collect();
    let center = (xs.iter().copied().fold(f32::INFINITY, f32::min)
        + xs.iter().copied().fold(f32::NEG_INFINITY, f32::max))
        * 0.5;
    assert!(
        (camera.target.x - center).abs() < 0.1,
        "camera {:?}, cast {xs:?}",
        camera.target
    );
}
