//! Captions follow actual placed speech, never estimated text reading speed.
use crate::Production;
use hs_core::Tick;
use hs_subtitle::CaptionCue;
use std::collections::HashMap;
pub fn cues(p: &Production) -> Vec<CaptionCue> {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    p.clips.iter().filter_map(|clip| {
        let line = p.voice_lines.iter().find(|l| l.beat == clip.beat)?;
        let occurrence = counts.entry(&line.key).or_default();
        let id = format!("{}-{}", line.key, occurrence);
        *occurrence += 1;
        if let Some(cue) = p.caption_overrides.iter().find(|c| c.id == id) { return Some(cue.clone()); }
        let text = hs_voice::spoken::parse_spoken_text(&line.text).text;
        if text.trim().is_empty() { return None; }
        let start = p.plan.as_ref().and_then(|plan|plan.beats.get(clip.beat)).and_then(|beat|p.timeline.as_ref()?.events.iter().find(|event| event.source.line==beat.line && matches!(event.kind,hs_core::EventKind::Dialogue{..}))).map_or(Tick::from_seconds(clip.start as f64),|event|event.start);
        let duration=Tick(((clip.speech.audio.samples.len() as i128*hs_core::TICKS_PER_SECOND as i128)/clip.speech.audio.sample_rate as i128) as i64);
        Some(CaptionCue {id,start,end:start+duration,text,speaker:clip.speaker.clone()})
    }).collect()
}
