use hs_agents::{Pipeline, Production};
use hs_project::{Series, ProjectAsset};
use std::sync::Arc;

#[test]
fn pilot_and_portable_library_reopen_without_synthesis() {
    let script = include_str!("../../../examples/pilot-episode.en.txt");
    let mut p = Production::new(script);
    p.cast_params = vec![hs_character::CharacterParams::kalle(), hs_character::CharacterParams::maija()];
    p.voice_engine = Some(Arc::new(hs_voice::TestEngine::default())); // Explicit simulated speech.
    Pipeline::default().run(&mut p).unwrap();
    assert!(hs_agents::audit::inspect(&p).allowed());
    assert!((20.0..=30.0).contains(&p.timeline.as_ref().unwrap().duration.seconds()));
    let library = hs_project::library::SeriesLibrary { cast: p.cast_params.clone(), worlds: vec![hs_project::library::WorldPreset {
        name: "Home".into(), source: "[background living room]\n[camera two shot]".into()
    }] };
    let bytes = library.encode().unwrap();
    hs_agents::project::validate_library(&bytes).unwrap();
    let mut episode = hs_agents::project::capture_checked(&p, "pilot".into(), 1, "The Missing Mug".into()).unwrap();
    episode.assets.push(ProjectAsset { id: "series-library".into(), kind: "library".into(), bytes });
    let series = Series { id: "series".into(), name: "Koeta Pilot".into(), episodes: vec![episode] };
    let reopened = hs_project::decode(&hs_project::encode(&series).unwrap()).unwrap();
    let mut restored = hs_agents::project::restore_checked(&reopened.episodes[0]).unwrap();
    assert!(restored.voice_engine.is_none());
    Pipeline::default().run(&mut restored).unwrap();
    assert_eq!(p.mix, restored.mix);
    assert_eq!(hs_agents::captions::cues(&p), hs_agents::captions::cues(&restored));
    assert_eq!(restored.voice_lines.len(), 4);
    assert!(restored.voice_lines.iter().all(|l| l.speech.is_some()));
    let asset = &reopened.episodes[0].assets.iter().find(|a| a.kind == "library").unwrap();
    assert!(hs_agents::project::validate_library(&asset.bytes).unwrap() == library);
    let mut invalid = library;
    invalid.worlds[0].source = "[invent a flying castle]".into();
    assert!(hs_agents::project::validate_library(&invalid.encode().unwrap()).is_err());
}

#[test]
fn visual_scene_reorder_keeps_authored_camera_with_dialogue() {
    let source = include_str!("../../../examples/pilot-episode.en.txt");
    let expected = hs_edit::script::line_texts(source)[8];
    let moved = hs_edit::script::rewrite(source, 8, expected, hs_edit::script::LineEdit::MoveSceneTo(2)).unwrap();
    let mut p = Production::new(moved);
    Pipeline::default().run(&mut p).unwrap();
    let report = hs_agents::audit::inspect(&p);
    assert!(report.allowed(), "{:?}", report.diagnostics);
    assert!(report.rows[0].actor.as_deref().unwrap().eq_ignore_ascii_case("Maija"));
    assert!(report.rows[0].authored_camera);
    assert!(report.rows[0].source.contains("Maybe try drinking"));
}
