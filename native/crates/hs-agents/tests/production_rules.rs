use hs_agents::{Pipeline, Production, RenderRequest, Slot};
#[test]
fn unknown_actor_does_not_receive_a_fabricated_preset() {
    let mut p = Production::new("JANE: Hello! [wave 2s]");
    let error = Pipeline::default().run(&mut p).unwrap_err().to_string();
    assert!(error.contains("JANE") || error.contains("Jane"));
    assert!(p.cast.is_empty());
    let mut profile = hs_character::CharacterParams::maija();
    profile.name = "Jane".into();
    p.cast_params.push(profile.clone());
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.cast[0].character.params, profile);
    assert!(hs_agents::audit::inspect(&p).allowed());
}
#[test]
fn ambiguous_hand_use_fails_preflight_before_touching_existing_output() {
    let mut p = Production::new("KALLE: [prop coffee cup] [wait 1s]\nKALLE: [texting on phone 2s]");
    let mut pipeline = Pipeline::default();
    pipeline.run(&mut p).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("episode.png");
    std::fs::write(&path, b"previous user image").unwrap();
    p.render_request = RenderRequest::Still {
        frame: 0,
        path: path.clone(),
    };
    pipeline.mark_dirty(Slot::RenderRequest);
    assert!(pipeline.run(&mut p).is_err());
    assert_eq!(std::fs::read(path).unwrap(), b"previous user image");
}
#[test]
fn report_rejects_forged_timeline_even_when_parsed_source_is_current() {
    let mut p = Production::new("KALLE: Hello! [wave 2s]");
    Pipeline::default().run(&mut p).unwrap();
    let report = hs_agents::audit::inspect(&p);
    assert!(report.allowed());
    let timeline = p.timeline.as_mut().unwrap();
    let event = timeline
        .events
        .iter_mut()
        .find(|e| matches!(e.kind, hs_core::EventKind::Motion { .. }))
        .unwrap();
    event.kind = hs_core::EventKind::Motion {
        character: Some("Kalle".into()),
        motion: hs_core::MotionKind::Jump,
    };
    assert!(!hs_agents::audit::inspect(&p).allowed());
}
#[test]
fn visible_phone_is_scoped_to_named_actor_and_hand_conflict_blocks() {
    let mut p = Production::new("KALLE: [wait 1s]\nMAIJA: [phone front] [wait 1s]");
    Pipeline::default().run(&mut p).unwrap();
    let timeline = p.timeline.as_ref().unwrap();
    assert!(p.motion[0].evaluate(timeline, 1.5).props.phone.is_none());
    assert!(p.motion[1].evaluate(timeline, 1.5).props.phone.is_some());
    let report = hs_agents::audit::inspect(&p);
    assert!(report.allowed());
    assert!(report.rows[1].phone_visible);
    let mut gap = Production::new("KALLE: Hello! [wave 2s]");
    Pipeline::default().run(&mut gap).unwrap();
    std::sync::Arc::get_mut(gap.camera.as_mut().unwrap())
        .unwrap()
        .shots[0]
        .start = 0.1;
    assert!(!hs_agents::audit::inspect(&gap).allowed());
    let mut p =
        Production::new("KALLE: [prop coffee cup] [phone front] [wait 1s]\nMAIJA: [wait 1s]");
    Pipeline::default().run(&mut p).unwrap();
    assert!(!hs_agents::audit::inspect(&p).allowed());
    for script in [
        "KALLE: [look at Kalle] [wait 1s]",
        "KALLE: [view front] [walk left 1s]",
    ] {
        let mut p = Production::new(script);
        Pipeline::default().run(&mut p).unwrap();
        assert!(!hs_agents::audit::inspect(&p).allowed());
    }
}
#[test]
fn view_rotation_targets_maija_and_legacy_event_json_remains_readable() {
    let mut p = Production::new("KALLE: [wait 1s]\nMAIJA: [view left] [wait 1s]");
    Pipeline::default().run(&mut p).unwrap();
    let timeline = p.timeline.as_ref().unwrap();
    assert!(p.motion[0].evaluate(timeline, 1.5).yaw.abs() < 0.1);
    assert!(p.motion[1].evaluate(timeline, 1.5).yaw.abs() > 0.5);
    let legacy: hs_core::EventKind = serde_json::from_str(r#"{"Phone":{"view":"Front"}}"#).unwrap();
    assert!(matches!(
        legacy,
        hs_core::EventKind::Phone {
            character: None,
            ..
        }
    ));
}
#[test]
fn long_speech_extends_scene_but_never_authored_motion_and_phone_remains_held() {
    use std::sync::Arc;
    let mut p=Production::new("[shot wide]\nKALLE: Welcome to the longest conversation in our little family home today! [walk left 1s]\nMAIJA: Let me send everyone a message about our wonderful new family episode! [texting on phone 1s]");
    p.voice_engine = Some(Arc::new(hs_voice::TestEngine::default()));
    Pipeline::default().run(&mut p).unwrap();
    let timeline = p.timeline.as_ref().unwrap();
    for event in timeline
        .events
        .iter()
        .filter(|event| matches!(event.kind, hs_core::EventKind::Motion { .. }))
    {
        assert_eq!(event.duration, hs_core::Tick::from_seconds(1.0));
    }
    let proof = hs_agents::audit::inspect(&p);
    assert!(proof.allowed(), "{:?}", proof.diagnostics);
    assert!(proof
        .rows
        .iter()
        .all(|row| row.end_seconds - row.start_seconds > 2.0 && row.motion_seconds == 1.0));
    let scene = &proof.rows[1];
    let time = (scene.start_seconds + 2.0) as f32;
    assert!(p.motion[1].evaluate(timeline, time).props.phone.is_some());
    assert!(p.motion[0].evaluate(timeline, 1.8).velocity.length() < 0.01);
}
#[test]
fn excessive_recorded_speech_stops_before_timeline_and_mix_allocation() {
    let mut p = Production::new("KALLE: Hello! [wait 1s]");
    p.own_audio.insert(
        hs_voice::spoken::line_key("KALLE", "Hello!"),
        std::sync::Arc::new(hs_voice::Audio {
            samples: vec![0.1; 24000 * 60],
            sample_rate: 24000,
        }),
    );
    let error = Pipeline::default().run(&mut p).unwrap_err().to_string();
    assert!(error.contains("60"));
    assert!(p.timeline.is_none());
    assert!(p.mix.is_none());
    assert!(p.camera.is_none());
}
#[test]
fn explicit_front_view_is_not_overridden_by_conversation_staging() {
    let mut p = Production::new("[shot two shot]\nKALLE: [view front] [wait 2s]\nMAIJA: [wait 2s]");
    Pipeline::default().run(&mut p).unwrap();
    let frame = 18;
    let pose = p.motion[0].evaluate(p.timeline.as_ref().unwrap(), 0.6).pose;
    let expected = p.cast[0].character.humanoid.skeleton.skin_matrices(&pose);
    let scene = hs_agents::agents::render::FrameBuilder::default()
        .scene(&p, frame, 320, 568)
        .unwrap();
    let actual = scene
        .items
        .iter()
        .find(|item| std::sync::Arc::ptr_eq(&item.mesh, &p.cast[0].mesh))
        .unwrap();
    assert_eq!(actual.skin[0], expected[0]);
}

#[test]
fn persistent_background_does_not_extend_audit_row_or_its_camera_list() {
    let mut p = hs_agents::Production::new("[background living room]\n[shot wide]\nKALLE: [walk left 1s]\n[shot close up]\nMAIJA: [wait 2s]");
    Pipeline::default().run(&mut p).unwrap();
    let r = hs_agents::audit::inspect(&p);
    assert!(r.allowed(), "{:?}", r.diagnostics);
    assert_eq!(r.rows[0].end_seconds, 1.0);
    assert_eq!(r.rows[0].shots.len(), 1);
    assert_eq!(r.rows[1].end_seconds, 3.0);
}
