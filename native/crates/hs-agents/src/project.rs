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
        _=>return Err("Unknown project workspace".into()),
    }}
    Ok(p)
}
