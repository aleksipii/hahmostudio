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
