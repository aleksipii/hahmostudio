use hs_agents::{Pipeline, Production};
const SCENE:&str="[background living room]\n[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nMAIJA: [at 0s] [wait 6s]\nKALLE: [at 2s] [give cup to Maija 2s]";
fn ready(source: &str) -> Production {
    let mut p = Production::new(source);
    Pipeline::default().run(&mut p).unwrap();
    p
}
#[test]
fn pickup_and_handoff_keep_anchors_and_ownership_continuous() {
    let p = ready(SCENE);
    let plan = p.contacts.as_ref().unwrap();
    let proof = hs_agents::audit::inspect(&p);
    assert!(proof.allowed(), "{:?}", proof.diagnostics);
    let sample = |time: f32| {
        let mut frames = p
            .motion
            .iter()
            .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), time))
            .collect::<Vec<_>>();
        plan.evaluate(&p, time, &mut frames).unwrap()
    };
    let early = sample(0.0);
    assert_eq!(early[0].owner, None);
    let object_bottom = early[0].point.y
        + early[0]
            .mesh
            .vertices
            .iter()
            .map(|v| v.position[1])
            .fold(f32::INFINITY, f32::min);
    let support_top = early[0]
        .stand
        .as_ref()
        .unwrap()
        .vertices
        .iter()
        .map(|v| v.position[1])
        .fold(f32::NEG_INFINITY, f32::max);
    assert!((object_bottom - support_top).abs() < 0.001);
    let lifted = sample(1.99);
    assert_eq!(lifted[0].owner, Some(0));
    assert!(lifted[0].point.y > early[0].point.y + 0.1);
    assert_eq!(sample(2.9)[0].owner, Some(0));
    assert_eq!(sample(3.1)[0].owner, Some(1));
    for boundary in [0.9, 2.0, 3.0, 4.0] {
        let before = sample(boundary - 0.001);
        let after = sample(boundary + 0.001);
        assert!(before[0].point.distance(after[0].point) < 0.001);
    }
    for tick in 0..=180 {
        for object in sample(tick as f32 / 30.0) {
            for grip in object.grips {
                if grip.weight >= 0.999 {
                    assert!(
                        grip.expected.distance(grip.actual) < 0.002,
                        "{tick}: {:?}",
                        grip
                    );
                }
            }
        }
    }
    assert_eq!(sample(6.0)[0].owner, Some(1));
    let mut render = hs_agents::agents::render::FrameBuilder::default();
    assert!(render.scene(&p, 100, 160, 90).is_some());
}
#[test]
fn missing_unreachable_or_wrongly_owned_objects_fail() {
    for source in [
        "KALLE: [pick up missing 2s]",
        "[object cup mug at 4 1 4]\nKALLE: [pick up cup 2s]",
        "[object cup mug at 0 1 0]\nKALLE: [give cup to Maija 2s]\nMAIJA: [wait 2s]",
    ] {
        let mut p = Production::new(source);
        assert!(Pipeline::default().run(&mut p).is_err(), "{source}");
    }
}

#[test]
fn resources_survive_project_reopen_and_stale_contact_plans_fail() {
    let p = ready(SCENE);
    let episode =
        hs_agents::project::capture_checked(&p, "contacts".into(), 1, "Contact demo".into())
            .unwrap();
    let series = hs_project::Series {
        id: "series".into(),
        name: "Contacts".into(),
        episodes: vec![episode],
    };
    let decoded = hs_project::decode(&hs_project::encode(&series).unwrap()).unwrap();
    let mut restored = hs_agents::project::restore_checked(&decoded.episodes[0]).unwrap();
    Pipeline::default().run(&mut restored).unwrap();
    assert!(hs_agents::audit::inspect(&restored).allowed());
    let old = p.contacts.as_ref().unwrap();
    let mut frames = restored
        .motion
        .iter()
        .map(|m| m.evaluate(restored.timeline.as_ref().unwrap(), 3.5))
        .collect::<Vec<_>>();
    assert!(old.evaluate(&restored, 3.5, &mut frames).is_err());
    frames[0].pose.local.clear();
    assert!(restored
        .contacts
        .as_ref()
        .unwrap()
        .evaluate(&restored, 3.5, &mut frames)
        .is_err());
}
#[test]
fn later_legacy_prop_cannot_occupy_the_same_hand() {
    let source = format!(
        "{}\nMAIJA: [at 4s] [prop coffee cup] [wait 1s]",
        SCENE.replace("[wait 6s]", "[wait 2s]")
    );
    let mut p = Production::new(source);
    assert!(Pipeline::default().run(&mut p).is_err());
}

#[test]
fn held_hand_gestures_are_rejected_instead_of_erasing_the_action() {
    let source = format!("{}\nMAIJA: [at 6s] [wave 2s]", SCENE);
    let mut p = Production::new(source);
    assert!(Pipeline::default().run(&mut p).is_err());
}

#[test]
fn audio_mix_edits_reuse_the_checked_contact_resources() {
    let mut p = Production::new(SCENE);
    let mut pipeline = Pipeline::default();
    pipeline.run(&mut p).unwrap();
    let old = p.contacts.clone().unwrap();
    p.soundtrack.push(hs_edit::Track::new(
        "music".into(),
        "Music".into(),
        hs_voice::Audio {
            sample_rate: 24000,
            samples: vec![0.05; 24000],
        },
    ));
    pipeline.mark_dirty(hs_agents::Slot::Audio);
    pipeline.run(&mut p).unwrap();
    assert!(std::sync::Arc::ptr_eq(&old, p.contacts.as_ref().unwrap()));
    assert!(p
        .mix
        .as_ref()
        .unwrap()
        .samples
        .iter()
        .any(|s| s.abs() > 0.001));
}
