use hs_agents::{Backend, Pipeline, Production, RenderRequest, Slot};
use hs_project::{ProjectAsset, Series};
use std::sync::Arc;
#[test]
fn saved_english_episode_restores_music_images_captions_and_exports() {
    let mut original=Production::new("[background living room]\n[shot two shot]\nKALLE: Welcome to our show! [wave 1s] [expression happy] [look at camera]\nMAIJA: Let's get started! [wait 1s] [look at Kalle]");
    original.cast_params=vec![hs_character::CharacterParams::kalle(),hs_character::CharacterParams::maija()];
    original.voice_engine=Some(Arc::new(hs_voice::TestEngine::default()));
    original.width=320;original.height=568;
    let music=hs_edit::Track::new("music".into(),"Test background".into(),hs_voice::Audio{sample_rate:24000,samples:vec![0.05;24000]});
    original.soundtrack=vec![music];
    Pipeline::default().run(&mut original).unwrap();
    let cues=hs_agents::captions::cues(&original);
    assert_eq!(cues.len(),2);
    assert!(cues[1].start>=cues[0].end);
    let mut edited=cues[0].clone();edited.text="Welcome to Koeta!".into();
    original.caption_overrides.push(edited);
    let mut episode=hs_agents::project::capture(&original,"pilot".into(),1,"Pilot".into());
    let image=hs_image::Document::new(16,16).unwrap();
    episode.assets=vec![ProjectAsset{id:"image".into(),kind:"image".into(),bytes:image.encode().unwrap()},ProjectAsset{id:"editing".into(),kind:"editing".into(),bytes:hs_edit::encode_workspace(&original.soundtrack).unwrap()}];
    let dir=tempfile::tempdir().unwrap();let path=dir.path().join("pilot.koeta");
    hs_project::save_atomic(&path,&Series{id:"show".into(),name:"English show".into(),episodes:vec![episode]}).unwrap();
    let moved=dir.path().join("relocated.koeta");std::fs::rename(path,&moved).unwrap();
    let opened=hs_project::load(&moved).unwrap();
    let mut restored=hs_agents::project::restore_checked(&opened.episodes[0]).unwrap();
    assert!(restored.voice_engine.is_none());
    let mut pipe=Pipeline::default();pipe.run(&mut restored).unwrap();
    assert_eq!(restored.mix.as_ref().unwrap().samples,original.mix.as_ref().unwrap().samples);
    assert_eq!(hs_agents::captions::cues(&restored)[0].text,"Welcome to Koeta!");
    assert_eq!(restored.soundtrack.len(),1);
    let img_asset=opened.episodes[0].assets.iter().find(|a|a.kind=="image").unwrap();
    assert_eq!(hs_image::Document::decode(&img_asset.bytes).unwrap().width,16);
    let mut renderer=hs_agents::agents::render::make_renderer(Backend::Cpu).unwrap();
    let mut render=hs_agents::RustRenderAgent::default();
    let captioned=render.render_frame(&restored,renderer.as_mut(),15).unwrap();
    restored.caption_settings.enabled=false;
    let plain=render.render_frame(&restored,renderer.as_mut(),15).unwrap();
    assert_ne!(captioned.rgba,plain.rgba,"captions must be burned into real output pixels");
    restored.caption_settings.enabled=true;
    if hs_render::export::find_ffmpeg().is_some() {
        restored.backend=Backend::Cpu;
        restored.render_request=RenderRequest::Mp4(dir.path().join("episode.mp4"));
        pipe.mark_dirty(Slot::RenderRequest);pipe.run(&mut restored).unwrap();
        assert!(std::fs::metadata(dir.path().join("episode.mp4")).unwrap().len()>1000);
    }
}
#[test]
fn unknown_look_target_and_corrupt_workspace_fail_without_guessing() {
    let mut p=Production::new("KALLE: Hello! [look at Nobody]");
    assert!(Pipeline::default().run(&mut p).is_err());
    let mut episode=hs_agents::project::capture(&Production::new("KALLE: Hello!"),"episode".into(),1,"Episode".into());
    episode.assets.push(ProjectAsset{id:"image".into(),kind:"image".into(),bytes:b"not an image document".to_vec()});
    assert!(hs_agents::project::restore_checked(&episode).is_err());
}
