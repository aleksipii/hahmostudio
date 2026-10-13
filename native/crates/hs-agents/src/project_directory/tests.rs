use super::*;
use crate::{Pipeline, Production};
use hs_voice::{LineStatus, SpeechEngine, TestEngine};

const SCRIPT: &str = "[tausta olohuone]\nPIPSA: Hello there, Ville!\nVILLE: Good morning, Pipsa.\nPIPSA: Let us make a show.";

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("koeta-test-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn cast() -> Vec<CharacterParams> {
    let mut pipsa = CharacterParams::pipsa();
    pipsa.voice = Some("af_bella".into());
    vec![pipsa, CharacterParams::ville()]
}

fn produce(engine: Arc<TestEngine>, episode: &Episode, cast: &[CharacterParams], cache: HashMap<String, Arc<Speech>>) -> Production {
    let mut p = Production::new(episode.script.clone());
    p.width = 270;
    p.height = 480;
    p.cast_params = cast.to_vec();
    p.voice_engine = Some(engine as Arc<dyn SpeechEngine>);
    p.own_audio = episode.own_audio.clone();
    p.accepted_notices = episode.accepted_notices.clone();
    p.speech_cache.lock().unwrap().extend(cache);
    Pipeline::default().run(&mut p).expect("putki");
    p
}

fn episode_from(p: &Production, title: &str) -> Episode {
    Episode {
        title: title.into(),
        script: p.script.clone(),
        accepted_notices: p.accepted_notices.clone(),
        own_audio: p.own_audio.clone(),
        speech: speech_in_use(&p.voice_lines),
    }
}

#[test]
fn episode_survives_save_and_reopen_without_resynthesis() {
    let dir = temp_dir("reopen");
    let mut series = SeriesProject::create(&dir, "Pipsa ja Ville", cast()).unwrap();
    let first = Arc::new(TestEngine::default());
    let draft = Episode { title: "Pilot".into(), script: SCRIPT.into(), ..Default::default() };
    let p = produce(first.clone(), &draft, &series.manifest.cast, HashMap::new());
    assert_eq!(first.calls.lock().unwrap().len(), 3);
    assert!(p.voice_lines.iter().all(|l| l.status == LineStatus::Synthesized));
    let duration = p.timeline.as_ref().unwrap().duration;
    let id = series.add_episode(&episode_from(&p, "Pilot")).unwrap();

    // Sovellus suljetaan ja avataan uudelleen: uusi moottori, tyhjä välimuisti.
    let series = SeriesProject::open(&dir).unwrap();
    assert_eq!(series.name(), "Pipsa ja Ville");
    assert_eq!(series.manifest.cast[0].voice.as_deref(), Some("af_bella"));
    assert_eq!(series.manifest.episodes, vec![EpisodeEntry { id: id.clone(), title: "Pilot".into() }]);
    let loaded = series.load_episode(&id).unwrap();
    assert!(loaded.warnings.is_empty(), "{:?}", loaded.warnings);
    assert_eq!(loaded.episode.script, SCRIPT);
    assert_eq!(loaded.speech_cache.len(), 3);
    assert!(loaded.episode.speech.iter().all(|s| s.engine == "test" && s.model_version == "test-engine"));
    let second = Arc::new(TestEngine::default());
    let q = produce(second.clone(), &loaded.episode, &series.manifest.cast, loaded.speech_cache);
    assert!(second.calls.lock().unwrap().is_empty(), "tallennettua puhetta ei syntetisoida uudelleen");
    assert!(q.voice_lines.iter().all(|l| l.status == LineStatus::Cached));
    assert_eq!(q.timeline.as_ref().unwrap().duration, duration);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn changed_line_and_voice_resynthesize_only_what_changed() {
    let dir = temp_dir("partial");
    let mut series = SeriesProject::create(&dir, "S", cast()).unwrap();
    let p = produce(Arc::new(TestEngine::default()), &Episode { script: SCRIPT.into(), ..Default::default() }, &series.manifest.cast, HashMap::new());
    let id = series.add_episode(&episode_from(&p, "1")).unwrap();
    let mut loaded = series.load_episode(&id).unwrap();
    loaded.episode.script = SCRIPT.replace("Let us make a show.", "Let us make a film.");
    let mut new_cast = series.manifest.cast.clone();
    new_cast[1].voice = Some("bm_george".into());
    series.save_cast(&new_cast).unwrap();
    let series = SeriesProject::open(&dir).unwrap();
    let engine = Arc::new(TestEngine::default());
    produce(engine.clone(), &loaded.episode, &series.manifest.cast, loaded.speech_cache);
    let calls = engine.calls.lock().unwrap();
    let texts: Vec<_> = calls.iter().map(|c| (c.text.as_str(), c.voice.as_str())).collect();
    assert_eq!(texts, vec![("Good morning, Pipsa.", "bm_george"), ("Let us make a film.", "af_bella")]);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn own_recording_is_kept_and_wins_after_reopen() {
    let dir = temp_dir("own");
    let mut series = SeriesProject::create(&dir, "S", cast()).unwrap();
    let key = hs_voice::spoken::line_key("VILLE", "Good morning, Pipsa.");
    let mine = Audio { samples: (0..48_000).map(|i| (i as f32 * 0.05).sin() * 0.3).collect(), sample_rate: 48_000 };
    let mut ep = Episode { script: SCRIPT.into(), ..Default::default() };
    ep.own_audio.insert(key.clone(), Arc::new(mine.clone()));
    let p = produce(Arc::new(TestEngine::default()), &ep, &series.manifest.cast, HashMap::new());
    let id = series.add_episode(&episode_from(&p, "1")).unwrap();
    // Oma ääni ei päädy synteettiseksi puheeksi.
    assert_eq!(series.load_episode(&id).unwrap().episode.speech.len(), 2);

    let loaded = SeriesProject::open(&dir).unwrap().load_episode(&id).unwrap();
    let back = &loaded.episode.own_audio[&key];
    assert_eq!(back.sample_rate, 48_000);
    assert_eq!(back.samples.len(), mine.samples.len());
    assert!(back.samples.iter().zip(&mine.samples).all(|(a, b)| (a - b).abs() < 1e-4));
    let engine = Arc::new(TestEngine::default());
    let q = produce(engine.clone(), &loaded.episode, &cast(), loaded.speech_cache);
    let ville = q.voice_lines.iter().find(|l| l.key == key).unwrap();
    assert_eq!(ville.status, LineStatus::KeptOwnAudio);
    assert!(engine.calls.lock().unwrap().is_empty());

    // Tallennus uudelleen ei kirjoita olemassa olevan äänen päälle eikä poista vanhaa.
    let mut series = SeriesProject::open(&dir).unwrap();
    let mut changed = loaded.episode.clone();
    changed.own_audio.insert(key.clone(), Arc::new(Audio { samples: vec![0.1; 4800], sample_rate: 48_000 }));
    series.save_episode(&id, &changed).unwrap();
    let files = std::fs::read_dir(dir.join("jaksot").join(&id).join("aanet")).unwrap().count();
    assert_eq!(files, 2, "vanha äänitys säilyy levyllä");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn tampered_or_escaping_audio_is_skipped_with_warning() {
    let dir = temp_dir("tamper");
    let mut series = SeriesProject::create(&dir, "S", cast()).unwrap();
    let p = produce(Arc::new(TestEngine::default()), &Episode { script: SCRIPT.into(), ..Default::default() }, &series.manifest.cast, HashMap::new());
    let id = series.add_episode(&episode_from(&p, "1")).unwrap();
    let ep_dir = dir.join("jaksot").join(&id);
    let manifest_path = ep_dir.join("jakso.json");
    let mut m: EpisodeManifest = serde_json::from_slice(&std::fs::read(&manifest_path).unwrap()).unwrap();
    // Yksi tiedosto muuttuu, toinen yrittää karata kansiosta.
    let mut bytes = std::fs::read(ep_dir.join(&m.speech[0].file)).unwrap();
    let last = bytes.len() - 1;
    bytes[last] ^= 0x55;
    std::fs::write(ep_dir.join(&m.speech[0].file), bytes).unwrap();
    m.speech[1].file = "../../sarja.json".into();
    std::fs::write(&manifest_path, serde_json::to_vec(&m).unwrap()).unwrap();
    let loaded = series.load_episode(&id).unwrap();
    assert_eq!(loaded.speech_cache.len(), 1);
    assert_eq!(loaded.warnings.len(), 2, "{:?}", loaded.warnings);
    assert!(loaded.warnings[0].contains("tarkistussumma"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_unknown_format_newer_version_and_bad_ids() {
    let dir = temp_dir("reject");
    SeriesProject::create(&dir, "S", vec![]).unwrap();
    assert!(SeriesProject::create(&dir, "S", vec![]).is_err(), "olemassa olevaa sarjaa ei korvata");
    let path = dir.join("sarja.json");
    let good = std::fs::read_to_string(&path).unwrap();
    std::fs::write(&path, good.replace("\"version\": 1", "\"version\": 99")).unwrap();
    assert!(matches!(SeriesProject::open(&dir), Err(ProjectError::TooNew(99))));
    std::fs::write(&path, good.replace("\"episodes\": []", "\"episodes\": [{\"id\": \"../x\", \"title\": \"t\"}]")).unwrap();
    assert!(SeriesProject::open(&dir).is_err());
    std::fs::write(&path, good.replace(SERIES_FORMAT, "muu")).unwrap();
    assert!(SeriesProject::open(&dir).is_err());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn folder_can_be_moved() {
    let dir = temp_dir("move-a");
    let moved = temp_dir("move-b");
    let mut series = SeriesProject::create(&dir, "S", cast()).unwrap();
    let p = produce(Arc::new(TestEngine::default()), &Episode { script: SCRIPT.into(), ..Default::default() }, &series.manifest.cast, HashMap::new());
    let id = series.add_episode(&episode_from(&p, "1")).unwrap();
    std::fs::rename(&dir, &moved).unwrap();
    let loaded = SeriesProject::open(&moved).unwrap().load_episode(&id).unwrap();
    assert!(loaded.warnings.is_empty());
    assert_eq!(loaded.speech_cache.len(), 3);
    let _ = std::fs::remove_dir_all(&moved);
}
