//! Adapter between the portable project domain and the runtime pipeline.
use crate::Production;
use hs_core::Fps;
use hs_project::{AudioBinding, AudioSource, Episode};
use std::sync::Arc;

/// Capture all retained audio, including recordings no longer referenced by the script.
pub fn capture(p: &Production, id: String, number: u32, name: String) -> Episode {
    let mut audio: Vec<_> = p.saved_speech.values().cloned().collect();
    for (key, recording) in &p.own_audio {
        audio.push(AudioBinding {
            line_key: key.clone(),
            speech: hs_voice::Speech {
                audio: (**recording).clone(),
                phonemes: None,
            },
            source: AudioSource::Own,
        });
    }
    audio.sort_by(|a, b| {
        a.line_key.cmp(&b.line_key).then_with(|| {
            matches!(a.source, AudioSource::Own).cmp(&matches!(b.source, AudioSource::Own))
        })
    });
    let mut cast = p.cast_params.clone();
    for member in &p.cast {
        if !cast
            .iter()
            .any(|c| c.name.eq_ignore_ascii_case(&member.character.params.name))
        {
            cast.push(member.character.params.clone());
        }
    }
    Episode {
        id,
        number,
        name,
        script: p.script.clone(),
        cast,
        fps: p.fps.0,
        width: p.width,
        height: p.height,
        captions: p.caption_overrides.clone(),
        caption_settings: p.caption_settings.clone(),
        assets: Vec::new(),
        accepted_notices: p.accepted_notices.clone(),
        audio,
    }
}

/// Restore into a fresh runtime; no device, engine, or cross-project cache is inherited.
pub fn restore(episode: &Episode) -> Production {
    let mut p = Production::new(episode.script.clone());
    p.cast_params = episode.cast.clone();
    p.fps = Fps(episode.fps);
    p.width = episode.width;
    p.height = episode.height;
    p.accepted_notices = episode.accepted_notices.clone();
    p.caption_settings = episode.caption_settings.clone();
    p.caption_overrides = episode.captions.clone();
    for binding in &episode.audio {
        match binding.source {
            AudioSource::Own => {
                p.own_audio.insert(
                    binding.line_key.clone(),
                    Arc::new(binding.speech.audio.clone()),
                );
            }
            AudioSource::Synthesized { .. } => {
                p.saved_speech
                    .insert(binding.line_key.clone(), binding.clone());
            }
        }
    }
    p
}

/// Validated restore for file consumers; rejects malformed editing/image workspaces.
pub fn restore_checked(episode:&Episode)->Result<Production,String> {
    let mut p=restore(episode);
    for asset in &episode.assets {match asset.kind.as_str() {
        "editing"=>p.soundtrack=hs_edit::decode_workspace(&asset.bytes)?,
        "image"=>{hs_image::Document::decode(&asset.bytes)?;},
        "library"=>{validate_library(&asset.bytes)?;},
        "recordings"=>p.recorded_lines=crate::recording::decode(&asset.bytes)?,
        "pose"=>p.pose_tracks=hs_motion::pose_edit::PoseTracks::decode(&asset.bytes)?,
        "review"=>{hs_project::production_review::ReviewState::decode(&asset.bytes)?;},
        "legacy"=>{hs_hahmo::Project::open(&asset.bytes).map_err(|e|e.to_string())?;},
        _=>return Err("Unknown project workspace".into()),
    }}
    Ok(p)
}

pub fn capture_checked(p:&Production,id:String,number:u32,name:String)->Result<Episode,String> {
    let mut episode=capture(p,id,number,name);
    if !p.recorded_lines.is_empty() {episode.assets.push(hs_project::ProjectAsset{id:"recording-identities".into(),kind:"recordings".into(),bytes:crate::recording::encode(&p.recorded_lines)?});}
    if !p.pose_tracks.tracks.is_empty() {episode.assets.push(hs_project::ProjectAsset{id:"native-pose-tracks".into(),kind:"pose".into(),bytes:p.pose_tracks.encode()?});}
    Ok(episode)
}


/// Open either the portable archive or Claude's earlier directory-based format.
/// Import is read-only; save the converted result to a new portable archive.
pub fn load_series(path: &std::path::Path) -> Result<hs_project::Series,String> {
    if !path.is_dir() {return hs_project::load(path).map_err(|e|e.to_string());}
    let source=crate::project_directory::SeriesProject::open(path).map_err(|e|e.to_string())?;
    let mut episodes=Vec::new();
    let mut retained_bytes=0usize;
    for (index,entry) in source.manifest.episodes.iter().enumerate() {
        let loaded=source.load_episode(&entry.id).map_err(|e|e.to_string())?;
        retained_bytes=retained_bytes.saturating_add(loaded.episode.own_audio.values().map(|a|a.samples.len().saturating_mul(4)).sum::<usize>()).saturating_add(loaded.episode.speech.iter().map(|a|a.speech.audio.samples.len().saturating_mul(4)).sum::<usize>());
        if retained_bytes>128*1024*1024 {return Err("Imported series audio exceeds 128 MiB".into());}
        if !loaded.warnings.is_empty() {return Err(format!("Directory project contains invalid audio: {}",loaded.warnings.join("; ")));}
        let mut p=Production::new(loaded.episode.script);
        p.cast_params=source.manifest.cast.clone();p.own_audio=loaded.episode.own_audio;
        p.accepted_notices=loaded.episode.accepted_notices;
        // Reconcile source line keys without synthesizing or inventing dialogue.
        let plan=hs_script::parse(&p.script);
        for speech in loaded.episode.speech {
            for beat in &plan.beats {
                let speaker=beat.speaker.clone().unwrap_or_default();
                if hs_voice::spoken::cache_key(&beat.text,&speech.voice,speech.speed,&speech.model_version)==speech.key {
                    let key=hs_voice::spoken::line_key(&speaker,&beat.text);
                    p.saved_speech.insert(key.clone(),AudioBinding{line_key:key,speech:(*speech.speech).clone(),source:AudioSource::Synthesized{engine:speech.engine.clone(),voice:speech.voice.clone(),speed:speech.speed,model_version:speech.model_version.clone(),cache_key:speech.key.clone()}});
                }
            }
        }
        episodes.push(capture_checked(&p,entry.id.clone(),index as u32+1,loaded.episode.title)?);
    }
    let series=hs_project::Series{id:"imported-directory-series".into(),name:source.manifest.name,episodes};
    // Apply portable bounds before publishing imported data to the application.
    hs_project::encode(&series).map_err(|e|e.to_string())?;
    Ok(series)
}

/// Validate portable presets with the same profiles and grammar as production.
pub fn validate_library(bytes: &[u8]) -> Result<hs_project::library::SeriesLibrary, String> {
    let library = hs_project::library::SeriesLibrary::decode(bytes)?;
    for c in &library.cast { crate::audit::validate_profile(c)?; }
    for w in &library.worlds {
        if !hs_script::parse(&format!("{}\nKALLE: [wait 1s]", w.source)).is_assemblable() {
            return Err("Maailmapohja sisältää tuntemattoman tai virheellisen ohjeen".into());
        }
    }
    Ok(library)
}
