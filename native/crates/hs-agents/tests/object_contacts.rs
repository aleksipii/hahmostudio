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
fn samples(p: &Production, time: f32) -> Vec<hs_agents::contacts::ObjectFrame> {
    let mut frames = p
        .motion
        .iter()
        .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), time))
        .collect::<Vec<_>>();
    p.contacts
        .as_ref()
        .unwrap()
        .evaluate(p, time, &mut frames)
        .unwrap()
}
#[test]
fn place_releases_on_actual_stand_and_can_pick_up_again() {
    let source="[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nKALLE: [place cup back 2s]\nKALLE: [pick up cup 2s]";
    let p = ready(source);
    assert_eq!(samples(&p, 2.1)[0].owner, Some(0));
    assert_eq!(samples(&p, 3.6)[0].owner, None);
    assert_eq!(samples(&p, 4.0)[0].owner, None);
    assert_eq!(samples(&p, 5.1)[0].owner, Some(0));
    let settled = samples(&p, 4.0);
    let bottom = settled[0].point.y
        + settled[0]
            .mesh
            .vertices
            .iter()
            .map(|v| v.position[1])
            .fold(f32::INFINITY, f32::min);
    let top = settled[0]
        .stand
        .as_ref()
        .unwrap()
        .vertices
        .iter()
        .map(|v| v.position[1])
        .fold(f32::NEG_INFINITY, f32::max);
    assert!((bottom - top).abs() < 0.002);
    for tick in 0..=600 {
        for object in samples(&p, tick as f32 / 100.0) {
            for grip in object.grips {
                if grip.weight >= 0.999 {
                    assert!(grip.actual.distance(grip.expected) < 0.002);
                }
            }
        }
    }
    for boundary in [2.0, 3.5, 4.0] {
        assert!(
            samples(&p, boundary - 0.0001)[0]
                .point
                .distance(samples(&p, boundary + 0.0001)[0].point)
                < 0.001
        );
    }
    let episode =
        hs_agents::project::capture_checked(&p, "place".into(), 1, "Place".into()).unwrap();
    let mut restored = hs_agents::project::restore_checked(&episode).unwrap();
    Pipeline::default().run(&mut restored).unwrap();
    assert_eq!(samples(&restored, 4.0)[0].owner, None);
    assert!(samples(&restored, 4.0)[0].point.distance(settled[0].point) < 0.0001);
}
#[test]
fn drop_has_gravity_releases_and_lands_without_penetration() {
    let p=ready("[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nKALLE: [drop cup 2s]\nKALLE: [pick up cup 2s]");
    let released = samples(&p, 2.4);
    assert_eq!(released[0].owner, None);
    let fallen = samples(&p, 2.5);
    assert!((released[0].point.y - fallen[0].point.y - 4.905 * 0.1f32.powi(2)).abs() < 0.001);
    let landed = samples(&p, 4.0);
    assert_eq!(landed[0].owner, None);
    assert!((landed[0].point.y - 1.22).abs() < 0.002);
    assert_eq!(samples(&p, 5.1)[0].owner, Some(0));
    for tick in 200..=400 {
        let now = samples(&p, tick as f32 / 100.0);
        assert!(now[0].point.y >= 1.22 - 0.002);
    }
    for boundary in [2.4, 4.0] {
        assert!(
            samples(&p, boundary - 0.0001)[0]
                .point
                .distance(samples(&p, boundary + 0.0001)[0].point)
                < 0.001
        );
    }
}
#[test]
fn unsupported_floating_place_wrong_owner_and_stand_edge_fail() {
    for command in [
        "[place cup at -0.25 2.0 0.20 2s]",
        "[place cup at -0.13 1.22 0.20 2s]",
    ] {
        let source=format!("[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nKALLE: {command}");
        let mut p = Production::new(source);
        assert!(Pipeline::default().run(&mut p).is_err(), "{command}");
    }
    for command in ["[place cup back 2s]", "[drop cup 2s]"] {
        let source = format!("[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: {command}");
        let mut p = Production::new(source);
        assert!(Pipeline::default().run(&mut p).is_err());
    }
}
#[test]
fn drop_outside_a_stand_lands_on_the_real_floor() {
    let p =
        ready("[object cup mug at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nKALLE: [drop cup 2s]");
    let landed = samples(&p, 4.0);
    assert_eq!(landed[0].owner, None);
    assert!(landed[0].stand.is_none());
    let bottom = landed[0].point.y
        + landed[0]
            .mesh
            .vertices
            .iter()
            .map(|v| v.position[1])
            .fold(f32::INFINITY, f32::min);
    assert!(bottom.abs() < 0.002);
    for tick in 240..=400 {
        let object = samples(&p, tick as f32 / 100.0).remove(0);
        let min_y = object
            .mesh
            .vertices
            .iter()
            .map(|v| v.position[1])
            .fold(f32::INFINITY, f32::min);
        assert!(object.point.y + min_y >= -0.002);
    }
}
#[test]
fn release_rejects_foreign_owners_and_swept_foreign_stand_collisions() {
    let sources=[
        "[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nMAIJA: [drop cup 2s]",
        "[object cup mug at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\n[object lower mug on stand at -0.25 0.6 0.20]\nMAIJA: [at 0s] [wait 4s]\nKALLE: [at 2s] [drop cup 2s]",
    ];
    for source in sources {
        let mut p = Production::new(source);
        assert!(Pipeline::default().run(&mut p).is_err(), "{source}");
    }
}
