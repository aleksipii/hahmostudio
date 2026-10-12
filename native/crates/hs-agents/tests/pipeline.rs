use hs_agents::{Backend, Pipeline, Production, RenderRequest, Slot};

const SCRIPT: &str = "[tausta studio]\nPIPSA: Hei! Tervetuloa mukaan. [vilkuta 2s]\nKävelen oikealle. [juokse oikealle 2s]\nPIPSA: Laitan viestin. [näpyttele puhelinta 3s]\n[tausta kaupunki ilta]\nVILLE: Nähdään! [hyppää]";

#[test]
fn full_pipeline_plans_every_stage() {
    let mut p = Production::new(SCRIPT);
    let mut pipe = Pipeline::default();
    let order: Vec<_> = pipe.agents().map(|a| a.id()).collect();
    assert_eq!(order, ["script-parser", "character-mesh", "procedural-motion", "cinematography", "render"]);
    let runs = pipe.run(&mut p).expect("putki");
    for r in &runs {
        eprintln!("{:<18} {:>8.2} ms  {:?}", r.name, r.took.as_secs_f64() * 1000.0, r.outcome);
    }
    assert_eq!(runs.len(), 5);
    assert_eq!(p.cast.len(), 2);
    assert_eq!(p.cast[0].character.params.name, "Pipsa");
    assert_eq!(p.cast[1].character.params.name, "Ville");
    let cam = p.camera.as_ref().unwrap();
    let kinds: Vec<_> = cam.shots.iter().map(|s| s.kind).collect();
    assert!(kinds.contains(&hs_agents::agents::cinematography::ShotKind::Insert), "{kinds:?}");
    assert!(kinds.contains(&hs_agents::agents::cinematography::ShotKind::Wide), "{kinds:?}");
    // 180 asteen sääntö: kamera aina +Z-puolella.
    for f in 0..p.frame_count() {
        let (c, _, kind) = cam.camera_at(f as f32 / 30.0, 9.0 / 16.0);
        if kind != hs_agents::agents::cinematography::ShotKind::Insert {
            assert!(c.eye.z > c.target.z, "ruutu {f}");
        }
    }

    // Uudelleenajo ilman muutoksia ei aja mitään; hahmon muutos ei aja jäsennintä.
    assert!(pipe.run(&mut p).unwrap().is_empty());
    let mut taller = hs_character::CharacterParams::pipsa();
    taller.height = 1.5;
    p.cast_params = vec![taller];
    pipe.mark_dirty(Slot::CastParams);
    let ids: Vec<_> = pipe.run(&mut p).unwrap().iter().map(|r| r.id).collect();
    assert_eq!(ids, ["character-mesh", "procedural-motion", "cinematography", "render"]);
}

#[test]
fn headless_still_and_mp4_export() {
    let dir = std::path::PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("pipeline");
    std::fs::create_dir_all(&dir).unwrap();
    let mut p = Production::new(SCRIPT);
    p.width = 270;
    p.height = 480;
    p.backend = Backend::Auto;
    let mut pipe = Pipeline::default();
    pipe.run(&mut p).unwrap();
    for (frame, name) in [(20u32, "vilkutus"), (75, "juoksu"), (150, "puhelin"), (250, "hyppy")] {
        p.render_request = RenderRequest::Still { frame, path: dir.join(format!("{name}.png")) };
        pipe.mark_dirty(Slot::RenderRequest);
        pipe.run(&mut p).unwrap();
        assert!(dir.join(format!("{name}.png")).is_file());
    }
    if hs_render::export::find_ffmpeg().is_some() {
        p.render_request = RenderRequest::Mp4(dir.join("jakso.mp4"));
        pipe.mark_dirty(Slot::RenderRequest);
        pipe.run(&mut p).unwrap();
        eprintln!("{}", p.output.as_deref().unwrap());
        assert!(std::fs::metadata(dir.join("jakso.mp4")).unwrap().len() > 10_000);
    } else {
        eprintln!("MP4-osa ohitettu: FFmpegiä ei löytynyt");
    }
}

#[test]
fn script_errors_block_export() {
    let mut p = Production::new("Hei [lennä kuuhun]");
    p.render_request = RenderRequest::Still { frame: 0, path: std::env::temp_dir().join("ei-saa-syntya.png") };
    let mut pipe = Pipeline::default();
    assert!(pipe.run(&mut p).is_err());
    assert!(!p.diagnostics.is_empty());
}
