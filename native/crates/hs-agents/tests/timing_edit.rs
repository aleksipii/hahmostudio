use hs_agents::{Pipeline, Production};
#[test]
fn retiming_preserves_audio_and_roundtrips_project() {
    let source = "KALLE: Hello. [at 0s] [wave 3s]\nMAIJA: Welcome. [at 0s] [nod 3s]";
    let mut p = Production::new(source);
    p.voice_engine = Some(std::sync::Arc::new(hs_voice::TestEngine::default()));
    Pipeline::default().run(&mut p).unwrap();
    let before: Vec<_> = p
        .voice_lines
        .iter()
        .map(|v| {
            (
                v.key.clone(),
                v.speech.as_ref().unwrap().audio.samples.clone(),
            )
        })
        .collect();
    let next = hs_agents::timing_edit::checked_retime(&p, source, 2, 1.0).unwrap();
    assert_eq!(p.script, source);
    p.script = next;
    p.voice_engine = None;
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.beat_times, vec![(0.0, 3.0), (1.0, 3.0)]);
    assert_eq!(
        before,
        p.voice_lines
            .iter()
            .map(|v| (
                v.key.clone(),
                v.speech.as_ref().unwrap().audio.samples.clone()
            ))
            .collect::<Vec<_>>()
    );
    let episode = hs_agents::project::capture(&p, "pilot".into(), 1, "Pilot".into());
    let mut restored = hs_agents::project::restore(&episode);
    Pipeline::default().run(&mut restored).unwrap();
    assert_eq!(p.beat_times, restored.beat_times);
    assert_eq!(restored.clips.len(), 2);
}
#[test]
fn actual_recording_blocks_overlap_without_mutating_source() {
    let source = "KALLE: Long recording. [at 0s] [wait 1s]\nKALLE: Next. [at 5s] [wait 1s]";
    let mut p = Production::new(source);
    Pipeline::default().run(&mut p).unwrap();
    let key = p.voice_lines[0].key.clone();
    p.own_audio.insert(
        key,
        std::sync::Arc::new(hs_lipsync::Audio {
            samples: vec![0.02; 48000 * 4],
            sample_rate: 48000,
        }),
    );
    Pipeline::default().run(&mut p).unwrap();
    assert!(p.beat_times[0].1 >= 4.3);
    let error = hs_agents::timing_edit::checked_retime(&p, source, 2, 2.0).unwrap_err();
    assert!(error.contains("Rivi"), "{error}");
    assert_eq!(p.script, source);
    assert!(hs_agents::timing_edit::checked_retime(&p, "stale", 2, 6.0).is_err());
    assert!(hs_agents::timing_edit::checked_retime(&p, source, 0, 6.0).is_err());
}
#[test]
fn handoff_cannot_move_before_pickup() {
    let source = include_str!("../../../examples/object-handoff.en.txt");
    let mut p = Production::new(source);
    Pipeline::default().run(&mut p).unwrap();
    assert!(hs_agents::timing_edit::checked_retime(&p, source, 6, 0.0).is_err());
    assert!(hs_agents::timing_edit::checked_retime(&p, source, 6, 3.0).is_ok());
    assert_eq!(p.script, source);
}

#[test]
fn resize_retains_speech_and_updates_action_duration() {
    let source = "KALLE: Hello. [at 0s] [wave 3s]";
    let mut p = Production::new(source);
    p.voice_engine = Some(std::sync::Arc::new(hs_voice::TestEngine::default()));
    Pipeline::default().run(&mut p).unwrap();
    let speech = p.voice_lines[0]
        .speech
        .as_ref()
        .unwrap()
        .audio
        .samples
        .clone();
    let key = p.voice_lines[0].key.clone();
    let next = hs_agents::timing_edit::checked_duration(&p, source, 1, 4.0).unwrap();
    assert!(next.contains("[wave 4.000000s]"));
    assert_eq!(p.script, source);
    p.script = next;
    p.voice_engine = None;
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.plan.as_ref().unwrap().beats[0].seconds, 4.0);
    assert_eq!(p.voice_lines[0].key, key);
    assert_eq!(
        p.voice_lines[0].speech.as_ref().unwrap().audio.samples,
        speech
    );
    assert_eq!(p.beat_times[0], (0.0, 4.0));
}

#[test]
fn resize_cannot_truncate_own_recording_or_cross_next_actor_action() {
    let source = "KALLE: Recorded line. [at 0s] [wait 5s]\nKALLE: [at 5s] [nod 2s]";
    let mut p = Production::new(source);
    Pipeline::default().run(&mut p).unwrap();
    p.own_audio.insert(
        p.voice_lines[0].key.clone(),
        std::sync::Arc::new(hs_lipsync::Audio {
            samples: vec![0.05; 48000 * 4],
            sample_rate: 48000,
        }),
    );
    Pipeline::default().run(&mut p).unwrap();
    let error = hs_agents::timing_edit::checked_duration(&p, source, 1, 2.0).unwrap_err();
    assert!(error.contains("4.300"), "{error}");
    assert!(hs_agents::timing_edit::checked_duration(&p, source, 1, 6.0).is_err());
    assert!(hs_agents::timing_edit::checked_duration(&p, source, 1, 4.5).is_ok());
    assert_eq!(p.script, source);
}

#[test]
fn independent_motion_preserves_speech_clock_audio_and_project_reopen() {
    let source = "KALLE: Hello. [at 0s] [wave 3s] [camera close up]";
    let mut p = Production::new(source);
    p.voice_engine = Some(std::sync::Arc::new(hs_voice::TestEngine::default()));
    Pipeline::default().run(&mut p).unwrap();
    let speech = p.voice_lines[0]
        .speech
        .as_ref()
        .unwrap()
        .audio
        .samples
        .clone();
    let key = p.voice_lines[0].key.clone();
    let captions = hs_agents::captions::cues(&p);
    let next = hs_agents::timing_edit::checked_motion_duration(&p, source, 1, 1.0).unwrap();
    p.script = next;
    p.voice_engine = None;
    Pipeline::default().run(&mut p).unwrap();
    let expected = p.script.clone();
    p.script = hs_agents::timing_edit::checked_motion_start(&p, &expected, 1, 4.0).unwrap();
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.clips[0].start, 0.0);
    assert_eq!(p.beat_times[0], (0.0, 3.0));
    assert_eq!(p.timeline.as_ref().unwrap().duration.seconds(), 5.0);
    let event = p
        .timeline
        .as_ref()
        .unwrap()
        .events
        .iter()
        .find(|e| matches!(e.kind, hs_core::EventKind::Motion { .. }))
        .unwrap();
    assert_eq!(event.start.seconds(), 4.0);
    assert_eq!(event.duration.seconds(), 1.0);
    assert_eq!(p.voice_lines[0].key, key);
    assert_eq!(
        p.voice_lines[0].speech.as_ref().unwrap().audio.samples,
        speech
    );
    assert_eq!(hs_agents::captions::cues(&p), captions);
    assert!(p.camera.as_ref().unwrap().shot_at(0.0).unwrap().authored);
    assert!(hs_agents::audit::inspect(&p).allowed());
    let episode = hs_agents::project::capture(&p, "pilot".into(), 1, "Pilot".into());
    let mut restored = hs_agents::project::restore(&episode);
    Pipeline::default().run(&mut restored).unwrap();
    assert_eq!(restored.timeline, p.timeline);
    assert_eq!(restored.clips[0].start, 0.0);
}
#[test]
fn independent_motion_guards_order_overlap_and_real_speech() {
    let source = "KALLE: Long line. [at 0s] [wave 5s]\nKALLE: Next. [at 5s] [nod 2s]";
    let mut p = Production::new(source);
    Pipeline::default().run(&mut p).unwrap();
    p.own_audio.insert(
        p.voice_lines[0].key.clone(),
        std::sync::Arc::new(hs_lipsync::Audio {
            samples: vec![0.02; 48000 * 4],
            sample_rate: 48000,
        }),
    );
    Pipeline::default().run(&mut p).unwrap();
    assert!(hs_agents::timing_edit::checked_motion_duration(&p, source, 1, 0.5).is_ok());
    assert!(hs_agents::timing_edit::checked_motion_start(&p, source, 1, 3.0).is_err());
    assert!(hs_agents::timing_edit::checked_motion_start(&p, source, 2, 4.0).is_err());
    assert!(hs_agents::timing_edit::checked_motion_start(&p, source, 1, 59.0).is_err());
    assert_eq!(p.script, source);
}

#[test]
fn speech_move_leaves_motion_and_shared_context_before_speech() {
    let source="[background living room]\nKALLE: Hello. [at 0s] [wave 3s] [camera close up]";
    let mut p=Production::new(source);p.voice_engine=Some(std::sync::Arc::new(hs_voice::TestEngine::default()));
    Pipeline::default().run(&mut p).unwrap();
    let audio=p.voice_lines[0].speech.as_ref().unwrap().audio.samples.clone();
    p.script=hs_agents::timing_edit::checked_retime(&p,source,2,2.0).unwrap();p.voice_engine=None;
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.clips[0].start,2.0);
    let motion=p.timeline.as_ref().unwrap().events.iter().find(|e|matches!(e.kind,hs_core::EventKind::Motion{..})).unwrap();
    assert_eq!(motion.start.seconds(),0.0);assert_eq!(motion.duration.seconds(),3.0);
    assert_eq!(p.camera.as_ref().unwrap().background_at(0.0),"apartment-v1");
    assert!(p.camera.as_ref().unwrap().shot_at(0.0).unwrap().authored);
    assert_eq!(p.voice_lines[0].speech.as_ref().unwrap().audio.samples,audio);
    assert!(hs_agents::audit::inspect(&p).allowed());
}

#[test]
fn initial_world_stays_ready_when_both_clocks_move_later() {
    let source="[background living room]\nKALLE: Hello. [at 2s] [wave 3s] [motion at 1s] [motion duration 1s]\nMAIJA: Welcome. [at 0s] [nod 3s]";
    let mut p=Production::new(source);Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.camera.as_ref().unwrap().background_at(0.0),"apartment-v1");
    assert!(hs_agents::audit::inspect(&p).allowed());
}

#[test]
fn changing_speech_clock_preserves_cast_positions_profiles_and_meshes() {
    let source="KALLE: Hello. [at 0s] [wave 3s]\nMAIJA: Welcome. [at 0s] [nod 3s]";
    let mut p=Production::new(source);let mut pipeline=Pipeline::default();pipeline.run(&mut p).unwrap();
    let cast=p.cast.clone();
    p.script=hs_agents::timing_edit::checked_retime(&p,source,1,2.0).unwrap();pipeline.run(&mut p).unwrap();
    assert_eq!(p.cast.len(),cast.len());
    for (old,new) in cast.iter().zip(&p.cast) {
        assert_eq!(old.character.params,new.character.params);
        assert_eq!(old.start_x,new.start_x);assert_eq!(old.lead,new.lead);
        assert!(std::sync::Arc::ptr_eq(&old.mesh,&new.mesh));
    }
}

#[test]
fn portable_profile_order_survives_retiming_and_reopen() {
    let source="KALLE: Hello. [at 0s] [wave 3s]\nMAIJA: Welcome. [at 0s] [nod 3s]";
    let mut p=Production::new(source);
    p.cast_params=["Maija","Kalle"].iter().map(|name|hs_character::CharacterParams::presets().into_iter().find(|profile|profile.name.eq_ignore_ascii_case(name)).unwrap()).collect();
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.cast[0].character.params.name,"Maija");
    p.script=hs_agents::timing_edit::checked_retime(&p,source,1,2.0).unwrap();Pipeline::default().run(&mut p).unwrap();
    let episode=hs_agents::project::capture(&p,"legacy".into(),1,"Legacy".into());
    let mut restored=hs_agents::project::restore(&episode);Pipeline::default().run(&mut restored).unwrap();
    for (old,new) in p.cast.iter().zip(&restored.cast) {assert_eq!(old.character.params,new.character.params);assert_eq!(old.start_x,new.start_x);}
}
