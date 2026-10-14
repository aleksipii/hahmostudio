use hs_agents::{scene_timing_edit, Pipeline, Production};
use hs_core::EventKind;
use std::sync::Arc;

fn produced(source: &str) -> Production {
    let mut production = Production::new(source);
    production.voice_engine = Some(Arc::new(hs_voice::TestEngine::default()));
    Pipeline::default().run(&mut production).unwrap();
    production
}
fn audio(production: &Production) -> Vec<(String, Vec<f32>)> {
    production
        .voice_lines
        .iter()
        .map(|voice| {
            (
                voice.key.clone(),
                voice.speech.as_ref().unwrap().audio.samples.clone(),
            )
        })
        .collect()
}
#[test]
fn standalone_camera_background_move_preserves_actor_clocks_audio_and_reopen() {
    let source = "[at 0s] [background living room]\nKALLE: Hello. [at 0s] [wave 4s]\n[at 2s] [camera close up]\n[at 3s] [background kitchen]";
    let mut p = produced(source);
    let original_audio = audio(&p);
    let times = p.beat_times.clone();
    let next = scene_timing_edit::checked_scene_retime(&p, source, 3, 1.0).unwrap();
    assert_eq!(p.script, source);
    p.script = next;
    p.voice_engine = None;
    Pipeline::default().run(&mut p).unwrap();
    let expected = p.script.clone();
    p.script = scene_timing_edit::checked_scene_retime(&p, &expected, 4, 2.0).unwrap();
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.beat_times, times);
    assert_eq!(audio(&p), original_audio);
    assert!(p
        .timeline
        .as_ref()
        .unwrap()
        .events
        .iter()
        .any(|event| event.source.line == 3
            && matches!(event.kind, EventKind::Camera { .. })
            && event.start.seconds() == 1.0));
    assert!(p
        .timeline
        .as_ref()
        .unwrap()
        .events
        .iter()
        .any(|event| event.source.line == 4
            && matches!(event.kind, EventKind::Background { .. })
            && event.start.seconds() == 2.0));
    let episode = hs_agents::project::capture(&p, "scene".into(), 1, "Scene".into());
    let mut restored = hs_agents::project::restore(&episode);
    Pipeline::default().run(&mut restored).unwrap();
    assert_eq!(restored.timeline, p.timeline);
    assert_eq!(audio(&restored), original_audio);
}
#[test]
fn group_shift_rejects_whole_transaction_when_one_selected_actor_conflicts() {
    let source = "[at 0s] [background living room]\nKALLE: Hello. [at 0s] [wave 2s] [motion at 1s] [motion duration 1s]\nMAIJA: Welcome. [at 0s] [nod 2s]\nKALLE: Later. [wait 2s]\n[at 1s] [camera wide]";
    let p = produced(source);
    let original_audio = audio(&p);
    assert!(scene_timing_edit::checked_shift_lines(&p, source, &[2, 3, 5], 2.0).is_err());
    assert_eq!(p.script, source);
    assert_eq!(audio(&p), original_audio);
}
#[test]
fn group_shift_preserves_implicit_unselected_row_and_independent_motion() {
    let source = "[at 0s] [background living room]\nKALLE: Hello. [at 0s] [wave 2s] [motion at 1s] [motion duration 1s]\nMAIJA: Welcome. [at 0s] [nod 2s]\nEETU: Later. [wait 2s]\n[at 1s] [camera wide]";
    let mut p = produced(source);
    let original_audio = audio(&p);
    let untouched_start = p.beat_times[2].0;
    let next = scene_timing_edit::checked_shift_lines(&p, source, &[2, 3, 5], 2.0).unwrap();
    p.script = next;
    p.voice_engine = None;
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.beat_times[0].0, 2.0);
    assert_eq!(p.beat_times[1].0, 2.0);
    assert_eq!(p.beat_times[2].0, untouched_start);
    assert_eq!(p.plan.as_ref().unwrap().beats[0].motion_at, Some(3.0));
    assert_eq!(p.plan.as_ref().unwrap().beats[0].motion_seconds, Some(1.0));
    assert_eq!(
        p.plan
            .as_ref()
            .unwrap()
            .scene_events
            .iter()
            .find(|cue| cue.line == 5)
            .unwrap()
            .at,
        3.0
    );
    assert_eq!(audio(&p), original_audio);
    assert!(hs_agents::audit::inspect(&p).allowed());
}
#[test]
fn group_conflicts_invalid_rows_stale_source_and_negative_time_reject_atomically() {
    let source = "KALLE: First. [at 0s] [wait 2s]\nKALLE: Later. [at 3s] [wait 2s]";
    let p = produced(source);
    let original_audio = audio(&p);
    assert!(scene_timing_edit::checked_shift_lines(&p, source, &[1], 2.0).is_err());
    assert!(scene_timing_edit::checked_shift_lines(&p, source, &[1], -1.0).is_err());
    assert!(scene_timing_edit::checked_shift_lines(&p, source, &[2], 59.0).is_err());
    assert!(scene_timing_edit::checked_shift_lines(&p, source, &[0], 1.0).is_err());
    assert!(scene_timing_edit::checked_shift_lines(&p, source, &[], 1.0).is_err());
    assert!(scene_timing_edit::checked_shift_lines(&p, source, &[1], f64::NAN).is_err());
    assert!(scene_timing_edit::checked_shift_lines(&p, "stale", &[1], 1.0).is_err());
    assert!(scene_timing_edit::checked_scene_retime(&p, source, 1, 1.0).is_err());
    assert_eq!(p.script, source);
    assert_eq!(audio(&p), original_audio);
}

#[test]
fn group_shift_preserves_real_recording_override_and_clip_duration() {
    let source = "KALLE: Recorded line. [at 0s] [wait 5s]\nMAIJA: Welcome. [at 0s] [nod 2s]\nEETU: Next. [wait 1s]";
    let mut p = produced(source);
    let key = p.voice_lines[0].key.clone();
    let samples = vec![0.075; 48_000 * 3];
    p.own_audio.insert(
        key.clone(),
        Arc::new(hs_lipsync::Audio {
            samples: samples.clone(),
            sample_rate: 48_000,
        }),
    );
    p.voice_engine = None;
    Pipeline::default().run(&mut p).unwrap();
    let before = audio(&p);
    let untouched_start = p.beat_times[2].0;
    p.script = scene_timing_edit::checked_shift_lines(&p, source, &[1], 1.0).unwrap();
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(p.clips[0].start, 1.0);
    assert_eq!(p.clips[0].speech.audio.duration(), 3.0);
    assert_eq!(p.beat_times[2].0, untouched_start);
    assert_eq!(p.voice_lines[0].key, key);
    assert_eq!(
        p.voice_lines[0].speech.as_ref().unwrap().audio.samples,
        samples
    );
    assert_eq!(audio(&p), before);
}

#[test]
fn global_cue_collision_invalid_clock_and_stale_source_do_not_mutate_project() {
    let source = "[at 0s] [background living room]\nKALLE: Hello. [at 0s] [wait 4s]\n[at 1s] [camera wide]\n[at 2s] [camera close up]";
    let p = produced(source);
    let original_audio = audio(&p);
    assert!(scene_timing_edit::checked_scene_retime(&p, source, 3, 2.0).is_err());
    assert!(scene_timing_edit::checked_scene_retime(&p, source, 3, f64::NAN).is_err());
    assert!(scene_timing_edit::checked_scene_retime(&p, source, 3, -1.0).is_err());
    assert!(scene_timing_edit::checked_scene_retime(&p, source, 3, 60.0).is_err());
    assert!(scene_timing_edit::checked_scene_retime(&p, "stale", 3, 1.5).is_err());
    assert_eq!(p.script, source);
    assert_eq!(audio(&p), original_audio);
}
