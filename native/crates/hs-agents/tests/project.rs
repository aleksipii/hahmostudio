use hs_agents::{Pipeline, Production};
use hs_project::Series;
use hs_voice::{Audio, LineStatus, TestEngine};
use std::sync::Arc;
fn reopen(p: &Production) -> Production {
    let episode = hs_agents::project::capture_checked(p, "pilot".into(), 1, "Pilot".into()).unwrap();
    let bytes = hs_project::encode(&Series {
        id: "show".into(),
        name: "Our show".into(),
        episodes: vec![episode],
    })
    .unwrap();
    let series = hs_project::decode(&bytes).unwrap();
    hs_agents::project::restore_checked(&series.episodes[0]).unwrap()
}
fn generated() -> Production {
    let mut p =
        Production::new("KALLE: Hello there! [odota 1s]\nMAIJA: Welcome to our show! [odota 1s]");
    p.cast_params = hs_character::CharacterParams::presets();
    p.voice_engine = Some(Arc::new(TestEngine::default()));
    Pipeline::default().run(&mut p).unwrap();
    p
}
#[test]
fn voice_and_text_changes_regenerate_only_affected_line() {
    let original = generated();
    let mut p = reopen(&original);
    let engine = Arc::new(TestEngine::default());
    p.voice_engine = Some(engine.clone());
    p.cast_params
        .iter_mut()
        .find(|c| c.name == "Kalle")
        .unwrap()
        .voice = Some("af_heart".into());
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(engine.calls.lock().unwrap().len(), 1);
    assert_eq!(p.voice_lines[0].status, LineStatus::Synthesized);
    assert_eq!(p.voice_lines[1].status, LineStatus::Cached);
    let old_key = p.voice_lines[1].key.clone();
    p.script = p
        .script
        .replace("Welcome to our show!", "Welcome back, friends!");
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(engine.calls.lock().unwrap().len(), 2);
    assert_eq!(p.voice_lines[0].status, LineStatus::Cached);
    assert_eq!(p.voice_lines[1].status, LineStatus::Synthesized);
    assert!(p.saved_speech.contains_key(&old_key));
}
#[test]
fn own_override_keeps_original_generated_speech_after_save() {
    let mut p = generated();
    let key = p.voice_lines[0].key.clone();
    let own = Audio {
        samples: vec![0.25; 24000],
        sample_rate: 24000,
    };
    p.own_audio.insert(key.clone(), Arc::new(own.clone()));
    Pipeline::default().run(&mut p).unwrap();
    let mut loaded = reopen(&p);
    Pipeline::default().run(&mut loaded).unwrap();
    assert_eq!(loaded.voice_lines[0].status, LineStatus::KeptOwnAudio);
    assert_eq!(
        loaded.voice_lines[0].speech.as_ref().unwrap().audio.samples,
        own.samples
    );
    loaded.own_audio.remove(&key);
    Pipeline::default().run(&mut loaded).unwrap();
    assert_eq!(loaded.voice_lines[0].status, LineStatus::Cached);
    assert_ne!(
        loaded.voice_lines[0].speech.as_ref().unwrap().audio.samples,
        own.samples
    );
}
#[test]
fn separate_episodes_do_not_share_same_line_recordings() {
    let mut one = generated();
    let mut two = generated();
    let key = one.voice_lines[0].key.clone();
    one.own_audio.insert(
        key.clone(),
        Arc::new(Audio {
            sample_rate: 24000,
            samples: vec![0.1; 24000],
        }),
    );
    two.own_audio.insert(
        key.clone(),
        Arc::new(Audio {
            sample_rate: 24000,
            samples: vec![0.9; 24000],
        }),
    );
    let series = Series {
        id: "show".into(),
        name: "Our show".into(),
        episodes: vec![
            hs_agents::project::capture(&one, "one".into(), 1, "One".into()),
            hs_agents::project::capture(&two, "two".into(), 2, "Two".into()),
        ],
    };
    let opened = hs_project::decode(&hs_project::encode(&series).unwrap()).unwrap();
    let a = hs_agents::project::restore(&opened.episodes[0]);
    let b = hs_agents::project::restore(&opened.episodes[1]);
    assert_eq!(a.own_audio[&key].samples[0], 0.1);
    assert_eq!(b.own_audio[&key].samples[0], 0.9);
    assert!(!Arc::ptr_eq(&a.speech_cache, &b.speech_cache));
}

#[test]
fn changed_model_version_invalidates_saved_synthesis() {
    struct UpdatedModel(TestEngine);
    impl hs_voice::SpeechEngine for UpdatedModel {
        fn id(&self) -> &str {
            "test"
        }
        fn model_version(&self) -> &str {
            "updated-test-model"
        }
        fn synthesize(
            &self,
            request: &hs_voice::SpeechRequest,
            cancel: &std::sync::atomic::AtomicBool,
        ) -> Result<hs_voice::Speech, hs_voice::VoiceError> {
            self.0.synthesize(request, cancel)
        }
    }
    let mut p = reopen(&generated());
    let engine = Arc::new(UpdatedModel(TestEngine::default()));
    p.voice_engine = Some(engine.clone());
    Pipeline::default().run(&mut p).unwrap();
    assert_eq!(engine.0.calls.lock().unwrap().len(), 2);
    assert!(p
        .voice_lines
        .iter()
        .all(|l| l.status == LineStatus::Synthesized));
    assert!(p.saved_speech.values().all(|binding| matches!(&binding.source,
        hs_project::AudioSource::Synthesized { model_version, .. } if model_version == "updated-test-model")));
}

#[test]
fn edited_own_recording_requires_review_after_portable_reopen() {
    let mut p = generated();
    let original_key = p.voice_lines[0].key.clone();
    p.own_audio.insert(original_key.clone(), Arc::new(Audio {sample_rate:24000,samples:vec![0.125;24000]}));
    Pipeline::default().run(&mut p).unwrap();
    assert!(p.recorded_lines.contains_key(&original_key));
    p.script = p.script.replace("Hello there!", "Hello again, everyone!");
    let mut loaded = reopen(&p);
    let engine = Arc::new(TestEngine::default());
    loaded.voice_engine = Some(engine.clone());
    Pipeline::default().run(&mut loaded).unwrap();
    assert_eq!(loaded.voice_lines[0].status, LineStatus::NeedsReview);
    assert!(loaded.voice_lines[0].speech.is_none());
    assert!(engine.calls.lock().unwrap().is_empty());
    assert_eq!(loaded.own_audio[&original_key].samples[0],0.125);
    let edited_key = loaded.voice_lines[0].key.clone();
    loaded.accepted_notices.insert(edited_key);
    Pipeline::default().run(&mut loaded).unwrap();
    assert_eq!(loaded.voice_lines[0].status,LineStatus::Synthesized);
    assert_eq!(engine.calls.lock().unwrap().len(),1);
    assert_eq!(loaded.own_audio[&original_key].samples[0],0.125);
}

#[test]
fn claude_directory_project_imports_without_resynthesis_or_source_changes() {
    use hs_agents::project_directory::{SeriesProject,Episode};
    let p=generated();
    let dir=tempfile::tempdir().unwrap();
    let root=dir.path().join("earlier.koeta");
    let mut source=SeriesProject::create(&root,"Earlier show",p.cast_params.clone()).unwrap();
    let mut draft=Episode {title:"Pilot".into(),script:p.script.clone(),speech:hs_agents::project_directory::speech_in_use(&p.voice_lines),..Default::default()};
    let key=p.voice_lines[0].key.clone();
    draft.own_audio.insert(key.clone(),Arc::new(Audio{sample_rate:24000,samples:vec![0.2;24000]}));
    source.add_episode(&draft).unwrap();
    let manifest=std::fs::read(root.join("sarja.json")).unwrap();
    let imported=hs_agents::project::load_series(&root).unwrap();
    assert_eq!(imported.name,"Earlier show");
    let portable=dir.path().join("converted.koeta");
    hs_project::save_atomic(&portable,&imported).unwrap();
    let mut restored=hs_agents::project::restore_checked(&hs_project::load(&portable).unwrap().episodes[0]).unwrap();
    let engine=Arc::new(TestEngine::default());restored.voice_engine=Some(engine.clone());
    Pipeline::default().run(&mut restored).unwrap();
    assert!(engine.calls.lock().unwrap().is_empty());
    assert_eq!(restored.voice_lines[0].status,LineStatus::KeptOwnAudio);
    assert_eq!(restored.voice_lines[1].status,LineStatus::Cached);
    assert_eq!(std::fs::read(root.join("sarja.json")).unwrap(),manifest);
}
