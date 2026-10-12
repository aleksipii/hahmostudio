//! Puhe, ajoitus ja huulisynkka.
//!
//! * [`VoiceAgent`] tuottaa repliikkien puheen (Kokoro tai käyttäjän oma ääni).
//! * [`TimingAgent`] rakentaa aikajanan: rivi kestää vähintään puheensa verran,
//!   ja puheleikkeet sijoitetaan rivien alkuun ja miksataan yhdeksi raidaksi.
//! * [`LipSyncAgent`] laskee jokaiselle leikkeelle visemit (Adobe Characterin tapaan).

use crate::production::{LipClip, PlacedClip, VoiceLine};
use crate::{AgentError, AgentReport, Production, Slot, StudioAgent};
use hs_character::CharacterParams;
use hs_lipsync::{Audio, VisemeTrack};
use hs_voice::engine::{synthesize_lines, DialogueLine, SynthesisOptions};
use hs_voice::{LineStatus, Speech, VoiceError};
use std::collections::HashMap;
use std::sync::Arc;

/// Puhujan ääni: säädetty hahmo → esiasetus → ei ääntä.
pub fn voice_for(p: &Production, speaker: &str) -> Option<String> {
    p.cast_params
        .iter()
        .chain(CharacterParams::presets().iter())
        .find(|c| c.name.eq_ignore_ascii_case(speaker))
        .and_then(|c| c.voice.clone())
        .or_else(|| {
            // Nimeämätön puhuja (ei "NIMI:"-etuliitettä) puhuu päähenkilön äänellä.
            speaker.is_empty().then(|| p.cast_params.first().cloned().unwrap_or_else(CharacterParams::pipsa).voice).flatten()
        })
}

/// Tuottaa repliikkien puheen. Ei koskaan korvaa käyttäjän omaa ääntä eikä
/// keksi puuttuvaa ääntä: rivi ilman ääntä jää hiljaiseksi (suu liikkuu silti tekstin mukaan).
#[derive(Default)]
pub struct VoiceAgent {
    /// Edellisen ajon tulos (avain, tila, puheen osoite), jotta muuttumaton tulos ei aja seuraavia vaiheita.
    last: Option<Vec<(usize, String, LineStatus, usize)>>,
}

impl StudioAgent for VoiceAgent {
    fn id(&self) -> &'static str {
        "voice"
    }
    fn name(&self) -> &'static str {
        "Ääni"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Plan, Slot::CastParams, Slot::Voice]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::Audio]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let plan = p.plan.as_ref().ok_or(AgentError::Missing { agent: "voice", slot: Slot::Plan })?;
        let mut lines = Vec::new();
        for (beat, b) in plan.beats.iter().enumerate() {
            if b.text.trim().is_empty() {
                continue;
            }
            let speaker = b.speaker.clone().unwrap_or_default();
            let key = hs_voice::spoken::line_key(&speaker, &b.text);
            lines.push((beat, b.speaker.clone(), DialogueLine { id: key, speaker, text: b.text.clone() }));
        }
        let own: HashMap<String, Arc<Audio>> = p.own_audio.clone();
        let mut out: Vec<VoiceLine> = Vec::new();
        let results = match &p.voice_engine {
            Some(engine) => {
                let voice_for = |s: &str| voice_for(p, s);
                let has_own = |id: &str| own.contains_key(id);
                let dl: Vec<DialogueLine> = lines.iter().map(|l| l.2.clone()).collect();
                let o = SynthesisOptions {
                    engine: engine.as_ref(),
                    voice_for: &voice_for,
                    has_own_audio: &has_own,
                    accepted_notices: &p.accepted_notices,
                    cache: p.speech_cache.clone(),
                    cancel: &p.cancel,
                };
                match synthesize_lines(&dl, &o) {
                    Ok(r) => r.into_iter().map(|r| (r.status, r.notices, r.speech, r.provenance)).collect(),
                    Err(VoiceError::Cancelled) => return Err(AgentError::Cancelled),
                    Err(e) => return Err(AgentError::Failed { agent: "voice", message: e.to_string() }),
                }
            }
            None => lines
                .iter()
                .map(|l| {
                    if own.contains_key(&l.2.id) {
                        (LineStatus::KeptOwnAudio, vec![], None, None)
                    } else {
                        (LineStatus::NoEngine, vec!["Puhemallia ei ole asennettu; suu liikkuu tekstin mukaan.".to_string()], None, None)
                    }
                })
                .collect::<Vec<_>>(),
        };
        for ((beat, speaker, line), (status, notices, speech, provenance)) in lines.into_iter().zip(results) {
            // Oma ääni: huulisynkka käyttää rivin tekstiä äänteinä (suomi lausutaan kuten kirjoitetaan).
            let speech = match own.get(&line.id) {
                Some(a) => Some(Arc::new(Speech { audio: (**a).clone(), phonemes: Some(line.text.to_lowercase()) })),
                None => speech,
            };
            let provenance = if own.contains_key(&line.id) { None } else { provenance };
            out.push(VoiceLine { beat, key: line.id, speaker, text: line.text, status, notices, speech, provenance });
        }
        let spoken = out.iter().filter(|l| l.speech.is_some()).count();
        let summary = match &p.voice_engine {
            Some(e) => format!("{spoken}/{} riviä puheena ({})", out.len(), e.id()),
            None if spoken > 0 => format!("{spoken}/{} riviä omana äänenä, malli puuttuu", out.len()),
            None => format!("{} riviä, puhemalli puuttuu", out.len()),
        };
        let fingerprint: Vec<_> = out
            .iter()
            .map(|l| (l.beat, l.key.clone(), l.status, l.speech.as_ref().map_or(0, |s| Arc::as_ptr(s) as usize)))
            .collect();
        let same = self.last.as_ref() == Some(&fingerprint) && p.timeline.is_some();
        self.last = Some(fingerprint);
        p.voice_lines = out;
        let report = AgentReport::new(summary);
        Ok(if same { report.unchanged() } else { report })
    }
}

/// Mix-raidan näytetaajuus.
pub const MIX_RATE: u32 = 48_000;
/// Hengähdys puheen jälkeen ennen seuraavaa riviä.
const TAIL: f64 = 0.3;

/// Rakentaa aikajanan rivien kestoista ja puheesta, sijoittaa leikkeet ja miksaa ne.
#[derive(Default)]
pub struct TimingAgent;

impl StudioAgent for TimingAgent {
    fn id(&self) -> &'static str {
        "timing"
    }
    fn name(&self) -> &'static str {
        "Ajoitus"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Plan, Slot::Audio]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::Timeline]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let plan = p.plan.as_ref().ok_or(AgentError::Missing { agent: "timing", slot: Slot::Plan })?;
        let mut seconds: Vec<f64> = plan.beats.iter().map(|b| b.seconds).collect();
        let mut extended = 0;
        for l in &p.voice_lines {
            if let Some(s) = &l.speech {
                let need = s.audio.duration() as f64 + TAIL;
                if need > seconds[l.beat] {
                    seconds[l.beat] = need;
                    extended += 1;
                }
            }
        }
        let timeline = hs_script::to_timeline_with(plan, &p.script, p.fps, &seconds);
        let starts: Vec<f32> = seconds.iter().scan(0.0, |acc, d| {
            let s = *acc;
            *acc += d;
            Some(s as f32)
        }).collect();
        p.clips = p
            .voice_lines
            .iter()
            .filter_map(|l| Some(PlacedClip { beat: l.beat, speaker: l.speaker.clone(), start: starts[l.beat], speech: l.speech.clone()? }))
            .collect();
        let total = timeline.duration.seconds() as f32;
        p.mix = (!p.clips.is_empty()).then(|| Arc::new(mix(&p.clips, total)));
        let summary = format!(
            "{:.1} s, {} puheleikettä{}",
            total,
            p.clips.len(),
            if extended > 0 { format!(", {extended} riviä pidennetty puheen mittaisiksi") } else { String::new() }
        );
        p.timeline = Some(timeline);
        Ok(AgentReport::new(summary))
    }
}

/// Miksaa leikkeet yhdeksi 48 kHz monoraidaksi; päällekkäiset leikkeet summataan ja rajoitetaan.
pub fn mix(clips: &[PlacedClip], duration: f32) -> Audio {
    let mut out = vec![0.0f32; (duration * MIX_RATE as f32).ceil() as usize];
    for c in clips {
        let a = c.speech.audio.resampled(MIX_RATE);
        let start = (c.start * MIX_RATE as f32) as usize;
        for (i, s) in a.samples.iter().enumerate() {
            if let Some(o) = out.get_mut(start + i) {
                *o += s;
            }
        }
    }
    for s in &mut out {
        // Pehmeä rajoitin päällekkäisille repliikeille.
        if s.abs() > 0.95 {
            *s = s.signum() * (0.95 + (s.abs() - 0.95).tanh() * 0.05);
        }
    }
    Audio { samples: out, sample_rate: MIX_RATE }
}

/// Laskee visemit jokaiselle puheleikkeelle. Tulokset välimuistissa leikkeen mukaan.
#[derive(Default)]
pub struct LipSyncAgent {
    cache: Vec<(Arc<Speech>, Arc<VisemeTrack>)>,
}

impl StudioAgent for LipSyncAgent {
    fn id(&self) -> &'static str {
        "lipsync"
    }
    fn name(&self) -> &'static str {
        "Huulisynkka"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Timeline]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::LipSync]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let mut cache = Vec::new();
        let mut computed = 0;
        p.lipsync = p
            .clips
            .iter()
            .map(|c| {
                let track = match self.cache.iter().find(|(s, _)| Arc::ptr_eq(s, &c.speech)) {
                    Some((_, t)) => t.clone(),
                    None => {
                        computed += 1;
                        Arc::new(match &c.speech.phonemes {
                            Some(ph) => hs_lipsync::from_text(&c.speech.audio, ph),
                            None => hs_lipsync::from_audio(&c.speech.audio),
                        })
                    }
                };
                cache.push((c.speech.clone(), track.clone()));
                LipClip { speaker: c.speaker.clone(), start: c.start, track }
            })
            .collect();
        self.cache = cache;
        let keys: usize = p.lipsync.iter().map(|c| c.track.keys.len()).sum();
        Ok(AgentReport::new(format!("{} leikettä, {keys} suun muotoa ({computed} laskettu)", p.lipsync.len())))
    }
}
