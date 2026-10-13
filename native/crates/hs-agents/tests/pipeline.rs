use hs_agents::{Backend, Pipeline, Production, RenderRequest, Slot};

const SCRIPT: &str = "[tausta studio]\nPIPSA: Hei! Tervetuloa mukaan. [vilkuta 2s]\nKävelen oikealle. [juokse oikealle 2s]\nPIPSA: Laitan viestin. [näpyttele puhelinta 3s]\n[tausta kaupunki ilta]\nVILLE: Nähdään! [hyppää]";

#[test]
fn full_pipeline_plans_every_stage() {
    let mut p = Production::new(SCRIPT);
    let mut pipe = Pipeline::default();
    let order: Vec<_> = pipe.agents().map(|a| a.id()).collect();
    assert_eq!(
        order,
        ["script-parser", "voice", "timing", "lipsync", "character-mesh", "procedural-motion", "cinematography", "render"]
    );
    let runs = pipe.run(&mut p).expect("putki");
    for r in &runs {
        eprintln!("{:<18} {:>8.2} ms  {:?}", r.name, r.took.as_secs_f64() * 1000.0, r.outcome);
    }
    assert_eq!(runs.len(), 8);
    // Ilman puhemallia rivit jäävät hiljaisiksi, mutta aikajana syntyy.
    assert!(p.voice_lines.iter().all(|l| l.status == hs_voice::LineStatus::NoEngine));
    assert!(p.mix.is_none());
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
    assert_eq!(ids, ["voice", "character-mesh", "procedural-motion", "cinematography", "render"]);
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

#[test]
fn speech_extends_lines_and_drives_lips_and_audio() {
    use hs_voice::{Audio, LineStatus, SpeechEngine, TestEngine};
    use std::sync::Arc;
    let script = "[kuva lähikuva]\nPIPSA: Hello there, my friend! How are you doing today? [vilkuta 1s]\nVILLE: Moi! [nyökkää 1s]\nPIPSA: Bye bye.";
    let mut p = Production::new(script);
    p.width = 270;
    p.height = 480;
    let engine = Arc::new(TestEngine::default());
    p.voice_engine = Some(engine.clone() as Arc<dyn SpeechEngine>);
    // Villen rivi on käyttäjän oma äänitys: sitä ei syntetisoida.
    let ville_key = hs_voice::spoken::line_key("VILLE", "Moi!");
    p.own_audio.insert(ville_key.clone(), Arc::new(Audio::synthetic_speech("Moi!", 1.0, 140.0)));
    let mut pipe = Pipeline::default();
    pipe.run(&mut p).unwrap();
    let st: Vec<_> = p.voice_lines.iter().map(|l| l.status).collect();
    assert_eq!(st, [LineStatus::Synthesized, LineStatus::KeptOwnAudio, LineStatus::Synthesized]);
    assert_eq!(engine.calls.lock().unwrap().len(), 2);
    // Ensimmäinen rivi pidentyy 1 sekunnista puheen mittaiseksi.
    let first = &p.clips[0];
    let d = first.speech.audio.duration();
    assert!(d > 1.5, "{d}");
    let tl = p.timeline.as_ref().unwrap();
    assert!(p.clips[1].start as f64 >= d as f64 + 0.29, "{:?}", p.clips.iter().map(|c| c.start).collect::<Vec<_>>());
    assert!(tl.duration.seconds() > 1.0 + 1.0 + 0.5);
    // Miksaus kattaa koko jakson.
    let mix = p.mix.as_ref().unwrap();
    assert!((mix.duration() - tl.duration.seconds() as f32).abs() < 0.05);
    // Huulisynkka: Villen leike kuuluu Villelle, ja suu on auki puheen aikana.
    assert_eq!(p.lipsync.len(), 3);
    assert!(p.lipsync[1].speaker.as_deref().is_some_and(|s| s.eq_ignore_ascii_case("ville")));
    let pipsa = |s: &Option<String>| s.as_deref().is_some_and(|s| s.eq_ignore_ascii_case("pipsa"));
    let open: f32 = (0..(d * 100.0) as usize).filter_map(|i| p.mouth_at(&pipsa, i as f32 * 0.01)).map(|m| m.open).fold(0.0, f32::max);
    assert!(open > 0.5, "{open}");
    assert!(p.mouth_at(&pipsa, p.clips[1].start + 0.05).is_none());

    // Uudelleenajo: rivin muokkaus syntetisoi vain muuttuneen rivin.
    p.script = script.replace("Bye bye.", "See you soon.");
    pipe.mark_dirty(Slot::Script);
    pipe.run(&mut p).unwrap();
    assert_eq!(engine.calls.lock().unwrap().len(), 3);
    let st: Vec<_> = p.voice_lines.iter().map(|l| l.status).collect();
    assert_eq!(st, [LineStatus::Cached, LineStatus::KeptOwnAudio, LineStatus::Synthesized]);

    if let Some(ffmpeg) = hs_render::export::find_ffmpeg() {
        let dir = std::path::PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("puhe");
        std::fs::create_dir_all(&dir).unwrap();
        let out = dir.join("puhe.mp4");
        p.render_request = RenderRequest::Mp4(out.clone());
        pipe.mark_dirty(Slot::RenderRequest);
        pipe.run(&mut p).unwrap();
        assert!(!dir.join("puhe.aani.wav").exists(), "väliaikainen ääni jäi");
        let probe = ffmpeg.with_file_name(if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" });
        if let Ok(o) = std::process::Command::new(&probe).args(["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0"]).arg(&out).output() {
            let streams = String::from_utf8_lossy(&o.stdout);
            assert!(streams.contains("video") && streams.contains("audio") && streams.contains("subtitle"), "{streams}");
        }
        // Englanninkielinen tekstitys: SRT videon vieressä ja valittava raita, kieli eng.
        let srt = std::fs::read_to_string(out.with_extension("srt")).expect("srt");
        assert!(srt.contains("See you soon.") && srt.contains("-->"), "{srt}");
        if let Ok(o) = std::process::Command::new(&probe).args(["-v", "error", "-select_streams", "s", "-show_entries", "stream_tags=language", "-of", "csv=p=0"]).arg(&out).output() {
            assert!(String::from_utf8_lossy(&o.stdout).contains("eng"));
        }
    }
}

#[test]
fn series_cast_and_camera_angles() {
    use hs_agents::agents::cinematography::ShotKind;
    let script = "[tausta olohuone]\n[kuva laaja]\nKALLE: Hei kaikki! [vilkuta 2s]\n[kuva kaksikko]\nMAIJA: Moikka! [odota 2s]\n[kuva olan yli]\nKALLE: Mitä syödään? [odota 2s]\n[kuva alakulma]\nEETU: Pizzaa! [hyppää]\n[kuva yläkulma]\nRONJA: Ei taas! [odota 2s]";
    let mut p = Production::new(script);
    p.width = 1280;
    p.height = 720;
    Pipeline::default().run(&mut p).expect("putki");
    let names: Vec<_> = p.cast.iter().map(|c| c.character.params.name.as_str()).collect();
    assert_eq!(names, ["Kalle", "Maija", "Eetu", "Ronja"]);
    assert!(p.cast[2].character.humanoid.proportions.head_ratio > 0.25, "lapsilla iso pää");
    let cam = p.camera.as_ref().unwrap();
    let kinds: Vec<_> = cam.shots.iter().map(|s| s.kind).collect();
    assert_eq!(kinds, [ShotKind::Wide, ShotKind::TwoShot, ShotKind::OverShoulder, ShotKind::LowAngle, ShotKind::HighAngle]);
    let aspect = 1280.0 / 720.0;
    let tl = p.timeline.as_ref().unwrap();
    let on_screen = |t: f32, who: usize| {
        let (c, _, _) = cam.camera_at(t, aspect);
        let f = p.motion[who].evaluate(tl, t);
        let head = f.root + glam::Vec3::Y * p.cast[who].character.humanoid.proportions.height * 0.9;
        let clip = c.view_proj(aspect) * head.extend(1.0);
        let (x, y) = (clip.x / clip.w, clip.y / clip.w);
        clip.w > 0.0 && x.abs() < 1.0 && y.abs() < 1.0
    };
    // Laaja kuva näyttää koko perheen, kaksikko molemmat puhujat.
    for who in 0..4 {
        assert!(on_screen(1.0, who), "laaja: hahmo {who} ei näy");
    }
    assert!(on_screen(3.0, 0) && on_screen(3.0, 1));
    // Ala- ja yläkulma: kamera kohteen alapuolella / yläpuolella.
    let (low, _, _) = cam.camera_at(6.5, aspect);
    assert!(low.eye.y < low.target.y);
    let (high, _, _) = cam.camera_at(8.0, aspect);
    assert!(high.eye.y > high.target.y + 0.3);
}

#[test]
fn props_follow_the_hand_until_put_away() {
    let script = "[tausta keittiö]\n[esine kahvikuppi]\nKALLE: Huomenta. [odota 2s]\n[esine pois]\nKALLE: No niin. [odota 2s]";
    let mut p = Production::new(script);
    p.width = 320;
    p.height = 568;
    Pipeline::default().run(&mut p).expect("putki");
    let mut fb = hs_agents::agents::render::FrameBuilder::default();
    let with = fb.scene(&p, 30, 320, 568).unwrap();
    let without = fb.scene(&p, 90, 320, 568).unwrap();
    assert_eq!(with.items.len(), without.items.len() + 1, "kuppi kädessä vain ensimmäisellä rivillä");
    let cup = with.items.iter().find(|i| i.skin.len() == 1).expect("käteen sidottu esine");
    assert!(cup.outline);
}

#[test]
fn subtitles_follow_speech_timing_and_never_overlap() {
    use hs_agents::subtitles::{cues, to_srt};
    let engine = std::sync::Arc::new(hs_voice::TestEngine::default());
    let mut p = Production::new("PIPSA: Hello there, Ville! (quickly)\nVILLE: Good morning, Pipsa.\nPIPSA: Moi, mitä kuuluu?");
    p.width = 270;
    p.height = 480;
    p.voice_engine = Some(engine);
    Pipeline::default().run(&mut p).expect("putki");
    let c = cues(&p);
    assert_eq!(c.len(), 3);
    // Nopeusohje ei päädy tekstitykseen; teksti on repliikki sellaisenaan.
    assert_eq!(c[0].text, "Hello there, Ville!");
    assert_eq!(c[2].text, "Moi, mitä kuuluu?", "tekstiä ei käännetä eikä keksitä");
    assert_eq!(c[1].speaker.as_deref(), Some("Ville"));
    for w in c.windows(2) {
        assert!(w[0].end <= w[1].start + 1e-4 && w[0].start < w[0].end);
    }
    // Puheellisen rivin vihje loppuu puheen jälkeen, ei rivin tauon lopussa.
    let speech = p.voice_lines[0].speech.as_ref().unwrap().audio.duration();
    assert!((c[0].end - c[0].start - (speech + 0.15)).abs() < 0.02, "{:?}", c[0]);
    assert!(to_srt(&c).starts_with("1\n00:00:00,000 --> "));
}

#[test]
fn burned_subtitles_appear_in_the_picture_only_when_asked() {
    use hs_voice::{SpeechEngine, TestEngine};
    let Some(ffmpeg) = hs_render::export::find_ffmpeg() else { return };
    let dir = std::path::PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("poltettu");
    std::fs::create_dir_all(&dir).unwrap();
    let frame_at_one_second = |name: &str, burn: bool, track: bool| {
        let mut p = Production::new("PIPSA: Good morning, everybody!");
        p.width = 270;
        p.height = 480;
        p.backend = hs_agents::Backend::Cpu;
        p.voice_engine = Some(std::sync::Arc::new(TestEngine::default()) as std::sync::Arc<dyn SpeechEngine>);
        p.subtitle_burn = burn;
        p.subtitle_track = track;
        let out = dir.join(format!("{name}.mp4"));
        let _ = std::fs::remove_file(out.with_extension("srt"));
        p.render_request = RenderRequest::Mp4(out.clone());
        Pipeline::default().run(&mut p).expect("vienti");
        let png = dir.join(format!("{name}.png"));
        let ok = std::process::Command::new(&ffmpeg).args(["-v", "error", "-y", "-ss", "1.0", "-i"]).arg(&out).args(["-frames:v", "1"]).arg(&png).status().unwrap().success();
        assert!(ok);
        (out, png)
    };
    let bright_bottom = |png: &std::path::Path| {
        let img = image_pixels(png);
        let (w, h, px) = img;
        (h * 6 / 10..h).map(|y| (0..w).filter(|&x| px[(y * w + x) as usize * 4..][..3].iter().all(|c| *c > 235)).count()).sum::<usize>()
    };
    let (plain_mp4, plain) = frame_at_one_second("ilman", false, true);
    let (_, burned) = frame_at_one_second("poltettu", true, true);
    assert!(bright_bottom(&burned) > bright_bottom(&plain) + 100, "poltettu {} vs ilman {}", bright_bottom(&burned), bright_bottom(&plain));
    assert!(plain_mp4.with_extension("srt").exists());
    // Raita pois: ei .srt-tiedostoa eikä tekstitysraitaa.
    let (off_mp4, _) = frame_at_one_second("pois", false, false);
    assert!(!off_mp4.with_extension("srt").exists());
}

fn image_pixels(path: &std::path::Path) -> (u32, u32, Vec<u8>) {
    let mut dec = png::Decoder::new(std::fs::File::open(path).unwrap());
    dec.set_transformations(png::Transformations::EXPAND);
    let mut r = dec.read_info().unwrap();
    let mut buf = vec![0; r.output_buffer_size()];
    let info = r.next_frame(&mut buf).unwrap();
    let rgba = match info.color_type {
        png::ColorType::Rgba => buf[..info.buffer_size()].to_vec(),
        png::ColorType::Rgb => buf[..info.buffer_size()].chunks(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect(),
        t => panic!("{t:?}"),
    };
    (info.width, info.height, rgba)
}
