//! Production-level cadence checks. No model, audio device or GPU is required;
//! saved samples below are fixture recordings, never Kokoro acceptance.
use hs_agents::{acting, ActingStyle, Pipeline, Production, Slot};
use hs_motion::Side;
use hs_render::{cpu::CpuRenderer, Renderer};
use std::sync::Arc;

fn ready(source: &str, style: ActingStyle) -> Production {
    let mut p = Production::new(source);
    p.acting_style = style;
    Pipeline::default().run(&mut p).unwrap();
    p
}

#[test]
fn free_upper_body_holds_within_bin_but_root_and_feet_keep_real_time() {
    let source = "[background studio]\nKALLE: [at 0s] [walk forward 4s]\nKALLE: [at 0s] [wave 4s]\nKALLE: [at 0s] [nod 4s]";
    for style in [ActingStyle::Stepped12, ActingStyle::Stepped15] {
        let p = ready(source, style);
        assert!(p.contacts.is_none() && p.scenery.is_none());
        let a = acting::frames(&p, 1.02).unwrap().remove(0);
        let b = acting::frames(&p, 1.04).unwrap().remove(0);
        let h = &p.cast[0].character.humanoid;
        for joint in hs_motion::layers::joint_mask(h, hs_motion::layers::HEAD | hs_motion::layers::LEFT_ARM | hs_motion::layers::RIGHT_ARM) {
            assert_eq!(a.pose.local[joint], b.pose.local[joint]);
            assert_eq!(a.pose.translate[joint], b.pose.translate[joint]);
        }
        assert!(a.root.distance(b.root) > 0.0001, "walking root must not hold at acting cadence");
        for (time, held) in [(1.02, a), (1.04, b)] {
            let smooth = p.motion[0].evaluate(p.timeline.as_ref().unwrap(), time);
            assert_eq!(held.root, smooth.root);
            assert_eq!(held.pose.root_pos, smooth.pose.root_pos);
            assert_eq!(held.pose.root_rot, smooth.pose.root_rot);
            assert_eq!(held.mouth, smooth.mouth);
            let actual_world = h.skeleton.world(&held.pose);
            let smooth_world = h.skeleton.world(&smooth.pose);
            for side in Side::BOTH {
                for joint in [h.leg(side).foot, h.leg(side).toe] {
                    assert!(actual_world[joint].pos.distance(smooth_world[joint].pos) < 0.000001);
                }
            }
        }
    }
}

#[test]
fn frame_builder_renders_visible_cadence_and_absolute_seek_is_repeatable() {
    let source = "[background studio]\n[shot medium]\nKALLE: [wave 4s]";
    let smooth = ready(source, ActingStyle::Smooth);
    let stepped = ready(source, ActingStyle::Stepped12);
    let mut a = hs_agents::agents::render::FrameBuilder::default();
    let mut b = hs_agents::agents::render::FrameBuilder::default();
    let mut renderer = CpuRenderer { supersample: 1, threads: 1 };
    let mut biggest_difference = 0.0_f32;
    let mut first = None;
    for frame in [17, 22, 31, 43, 58] {
        let sa = a.scene(&smooth, frame, 160, 240).expect("smooth scene");
        let sb = b.scene(&stepped, frame, 160, 240).expect("stepped scene");
        let image_a = renderer.render(&sa).unwrap();
        let image_b = renderer.render(&sb).unwrap();
        biggest_difference = biggest_difference.max(image_a.mean_abs_diff(&image_b));
        if frame == 17 { first = Some(image_b); }
    }
    assert!(biggest_difference > 0.02, "cadence did not visibly reach FrameBuilder: {biggest_difference}");
    let rewound = renderer.render(&b.scene(&stepped, 17, 160, 240).unwrap()).unwrap();
    assert_eq!(rewound, first.unwrap(), "seek must not depend on previously rendered frames");
}

#[test]
fn floor_pickup_and_handoff_keep_solved_grips_under_both_cadences() {
    let floor = include_str!("../../../examples/floor-pickup.en.txt");
    let handoff = "[background living room]\n[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]\nMAIJA: [at 0s] [wait 6s]\nKALLE: [at 2s] [give cup to Maija 2s]";
    for style in [ActingStyle::Stepped12, ActingStyle::Stepped15] {
        for source in [floor, handoff] {
            let p = ready(source, style);
            let plan = p.contacts.as_ref().unwrap();
            let duration = p.timeline.as_ref().unwrap().duration.seconds() as f32;
            for index in 0..=180 {
                let time = duration * index as f32 / 180.0;
                let mut frames = acting::frames(&p, time).unwrap();
                // Contact-protected arms must enter IK at the true sample time.
                for (actor, frame) in frames.iter().enumerate() {
                    let smooth = p.motion[actor].evaluate(p.timeline.as_ref().unwrap(), time);
                    let h = &p.cast[actor].character.humanoid;
                    for joint in hs_motion::layers::joint_mask(h, hs_motion::layers::LEFT_ARM | hs_motion::layers::RIGHT_ARM) {
                        assert_eq!(frame.pose.local[joint], smooth.pose.local[joint]);
                    }
                }
                let objects = plan.evaluate(&p, time, &mut frames).unwrap();
                p.collision.as_ref().unwrap().evaluate(&p, time, &frames).unwrap();
                for object in &objects {
                    for grip in &object.grips {
                        if grip.weight >= 0.999 {
                            assert!(grip.actual.distance(grip.expected) < 0.002, "{style:?} at {time}: {grip:?}");
                        }
                    }
                }
                if index == 180 {
                    assert_eq!(objects[0].owner, Some(if source == floor { 0 } else { 1 }));
                }
            }
            let mut render = hs_agents::agents::render::FrameBuilder::default();
            assert!(render.scene(&p, 40, 128, 192).is_some(), "{:?}", render.last_error);
        }
    }
}

#[test]
fn style_change_rejects_stale_collision_then_camera_rebuild_restores_preview() {
    let mut p = Production::new("[background studio]\nKALLE: [wave 3s]");
    let mut pipeline = Pipeline::default();
    pipeline.run(&mut p).unwrap();
    let old = p.collision.clone().unwrap();
    p.acting_style = ActingStyle::Stepped15;
    let frames = acting::frames(&p, 0.5).unwrap();
    assert!(!old.matches(&p));
    assert!(old.evaluate(&p, 0.5, &frames).is_err());
    let mut builder = hs_agents::agents::render::FrameBuilder::default();
    assert!(builder.scene(&p, 15, 128, 192).is_none());
    pipeline.mark_dirty(Slot::Motion);
    let runs = pipeline.run(&mut p).unwrap();
    assert_eq!(runs.iter().map(|run|run.id).collect::<Vec<_>>(), vec!["cinematography", "render"]);
    assert!(p.collision.as_ref().unwrap().matches(&p));
    assert!(builder.scene(&p, 15, 128, 192).is_some(), "{:?}", builder.last_error);
}

#[test]
fn own_audio_and_timeline_survive_style_change_portable_save_and_reopen() {
    let mut p = ready("KALLE: Hello there. [wave 3s]", ActingStyle::Smooth);
    let key = p.voice_lines[0].key.clone();
    let samples: Vec<_> = (0..24000).map(|i| ((i % 200) as f32 - 100.0) / 500.0).collect();
    let audio = Arc::new(hs_voice::Audio { sample_rate: 24000, samples });
    p.own_audio.insert(key.clone(), audio.clone());
    let mut pipeline = Pipeline::default();
    pipeline.run(&mut p).unwrap();
    let timeline = p.timeline.clone().unwrap();
    let mixed = p.mix.clone().unwrap();
    p.acting_style = ActingStyle::Stepped12;
    pipeline.mark_dirty(Slot::Motion);
    pipeline.run(&mut p).unwrap();
    assert_eq!(p.timeline.as_ref().unwrap(), &timeline);
    assert!(Arc::ptr_eq(&p.own_audio[&key], &audio));
    assert_eq!(p.mix.as_ref().unwrap().samples, mixed.samples);
    let episode = hs_agents::project::capture_checked(&p, "acting".into(), 1, "Own audio".into()).unwrap();
    let series = hs_project::Series { id: "show".into(), name: "Show".into(), episodes: vec![episode] };
    let decoded = hs_project::decode(&hs_project::encode(&series).unwrap()).unwrap();
    let mut restored = hs_agents::project::restore_checked(&decoded.episodes[0]).unwrap();
    Pipeline::default().run(&mut restored).unwrap();
    assert_eq!(restored.acting_style, ActingStyle::Stepped12);
    assert_eq!(restored.own_audio[&key].samples, audio.samples);
    assert_eq!(restored.mix.as_ref().unwrap().samples, mixed.samples);
    assert_eq!(restored.voice_lines[0].status, hs_voice::LineStatus::KeptOwnAudio);
}

#[test]
fn expression_transitions_follow_absolute_cues_even_after_out_of_order_seeks() {
    use hs_core::{EventKind, Expression, Fps, SourceSpan, Tick, Timeline};
    let mut timeline = Timeline::new(Fps(30));
    timeline.push(Tick::from_seconds(1.137), Tick::from_seconds(1.0),
        EventKind::Expression { character: Some("Kalle".into()), expression: Expression::Happy },
        SourceSpan { line: 1, text: "authored happy cue".into() });
    for style in [ActingStyle::Smooth, ActingStyle::Stepped12, ActingStyle::Stepped15] {
        let sample = |time| acting::expression(&timeline, "Kalle", true, time, style);
        assert_eq!(sample(0.5), (Expression::Neutral, Expression::Neutral, 1.0));
        let at_start = sample(1.137001);
        assert_eq!(at_start.0, Expression::Neutral);
        assert_eq!(at_start.1, Expression::Happy);
        assert!(at_start.2 < 0.00001);
        let mid = sample(1.24);
        assert!(mid.2 > 0.0 && mid.2 < 1.0, "{style:?}: {mid:?}");
        assert_eq!(sample(1.5), (Expression::Neutral, Expression::Happy, 1.0));
        let ending = sample(2.25);
        assert_eq!((ending.0, ending.1), (Expression::Happy, Expression::Neutral));
        assert!(ending.2 > 0.0 && ending.2 < 1.0);
        assert_eq!(sample(3.0), (Expression::Happy, Expression::Neutral, 1.0));
        assert_eq!(sample(1.24), mid);
        assert_eq!(acting::expression(&timeline, "Maija", false, 1.5, style), (Expression::Neutral, Expression::Neutral, 1.0));
        if style != ActingStyle::Smooth { assert_eq!(sample(1.24), sample(1.25)); }
    }
}
