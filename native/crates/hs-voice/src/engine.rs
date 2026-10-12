//! Puhemoottorin rajapinta ja rivien synteesi (portti: lib/kokoro.ts).
//!
//! Moottori on vaihdettava: oikea Kokoro ([`crate::kokoro`]) tai testien
//! deterministinen [`TestEngine`]. Synteesi tuottaa vain puuttuvat tai
//! muuttuneet rivit eikä koskaan korvaa käyttäjän omaa ääntä.

use crate::spoken::{cache_key, is_english_line, is_voice, parse_spoken_text, MAX_LINE, MAX_SECONDS};
use crate::wav::Audio;
use crate::VoiceError;
use std::collections::{BTreeSet, HashMap};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, PartialEq)]
pub struct SpeechRequest {
    pub text: String,
    pub voice: String,
    pub speed: f32,
}

/// Moottorin tuottama ääni. `phonemes` on IPA-merkkijono, jos moottori sen
/// tuntee; huulisynkka käyttää sitä visemien järjestykseen.
#[derive(Clone, Debug)]
pub struct Speech {
    pub audio: Audio,
    pub phonemes: Option<String>,
}

pub trait SpeechEngine: Send + Sync {
    fn id(&self) -> &str;
    fn model_version(&self) -> &str;
    fn synthesize(&self, request: &SpeechRequest, cancel: &AtomicBool) -> Result<Speech, VoiceError>;
}

/// Deterministinen korvaava moottori: ei mallia, ei verkkoa. Jokainen sana on
/// soinnillinen purske ja välimerkit taukoja, joten huulisynkalla on rakennetta.
pub struct TestEngine {
    pub calls: Mutex<Vec<SpeechRequest>>,
}

impl Default for TestEngine {
    fn default() -> Self {
        TestEngine { calls: Mutex::new(Vec::new()) }
    }
}

impl SpeechEngine for TestEngine {
    fn id(&self) -> &str {
        "test"
    }
    fn model_version(&self) -> &str {
        "test-engine"
    }
    fn synthesize(&self, r: &SpeechRequest, cancel: &AtomicBool) -> Result<Speech, VoiceError> {
        if cancel.load(Ordering::Relaxed) {
            return Err(VoiceError::Cancelled);
        }
        self.calls.lock().unwrap().push(r.clone());
        let pitch = 180.0 + (r.voice.as_bytes()[0] % 7) as f32 * 20.0;
        Ok(Speech { audio: Audio::synthetic_speech(&r.text, r.speed, pitch), phonemes: Some(r.text.to_lowercase()) })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub enum LineStatus {
    Synthesized,
    Cached,
    KeptOwnAudio,
    NeedsReview,
    NoVoice,
    /// Puhemallia ei ole asennettu (rivi saa silti tekstistä johdetun huulisynkan).
    NoEngine,
    UnsupportedLanguage,
    Empty,
}

impl LineStatus {
    pub fn finnish(self) -> &'static str {
        match self {
            LineStatus::Synthesized => "tuotettu",
            LineStatus::Cached => "välimuistista",
            LineStatus::KeptOwnAudio => "oma ääni",
            LineStatus::NeedsReview => "tarkista",
            LineStatus::NoVoice => "ei ääntä",
            LineStatus::NoEngine => "malli puuttuu",
            LineStatus::UnsupportedLanguage => "kieli ei tuettu",
            LineStatus::Empty => "tyhjä",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Provenance {
    pub engine: String,
    pub voice: String,
    pub speed: f32,
    pub model_version: String,
    pub key: String,
}

#[derive(Clone, Debug)]
pub struct LineResult {
    pub id: String,
    pub status: LineStatus,
    pub notices: Vec<String>,
    pub speech: Option<Arc<Speech>>,
    pub provenance: Option<Provenance>,
}

#[derive(Clone, Debug)]
pub struct DialogueLine {
    pub id: String,
    pub speaker: String,
    pub text: String,
}

/// Välimuisti avaimen mukaan; jaettu tuotannon ajojen kesken.
pub type SpeechCache = Arc<Mutex<HashMap<String, Arc<Speech>>>>;

pub struct SynthesisOptions<'a> {
    pub engine: &'a dyn SpeechEngine,
    /// Puhujan Kokoro-ääni; puuttuva ääni estää rivin.
    pub voice_for: &'a dyn Fn(&str) -> Option<String>,
    /// Rivit, joilla on jo käyttäjän ääni. Niitä ei koskaan syntetisoida.
    pub has_own_audio: &'a dyn Fn(&str) -> bool,
    /// Rivit, joiden huomautukset käyttäjä on hyväksynyt.
    pub accepted_notices: &'a BTreeSet<String>,
    pub cache: SpeechCache,
    pub cancel: &'a AtomicBool,
}

pub fn synthesize_lines(lines: &[DialogueLine], o: &SynthesisOptions) -> Result<Vec<LineResult>, VoiceError> {
    lines.iter().map(|l| synthesize_one(l, o)).collect()
}

fn synthesize_one(line: &DialogueLine, o: &SynthesisOptions) -> Result<LineResult, VoiceError> {
    if o.cancel.load(Ordering::Relaxed) {
        return Err(VoiceError::Cancelled);
    }
    let result = |status, notices| LineResult { id: line.id.clone(), status, notices, speech: None, provenance: None };
    if (o.has_own_audio)(&line.id) {
        return Ok(result(LineStatus::KeptOwnAudio, vec![]));
    }
    let spoken = parse_spoken_text(&line.text);
    let mut notices = spoken.notices.clone();
    if spoken.text.is_empty() {
        notices.push("Rivillä ei ole puhuttavaa tekstiä.".into());
        return Ok(result(LineStatus::Empty, notices));
    }
    if spoken.text.chars().count() > MAX_LINE {
        return Ok(result(LineStatus::NeedsReview, notices));
    }
    if !is_english_line(&spoken.text) {
        notices.push("Kokoro tukee tässä vaiheessa vain englanninkielisiä rivejä.".into());
        return Ok(result(LineStatus::UnsupportedLanguage, notices));
    }
    let Some(voice) = (o.voice_for)(&line.speaker).filter(|v| is_voice(v)) else {
        notices.push(format!("Puhujalle {} ei ole valittu Kokoro-ääntä.", line.speaker));
        return Ok(result(LineStatus::NoVoice, notices));
    };
    if !notices.is_empty() && !o.accepted_notices.contains(&line.id) {
        return Ok(result(LineStatus::NeedsReview, notices));
    }
    let key = cache_key(&spoken.text, &voice, spoken.speed, o.engine.model_version());
    let provenance = Provenance {
        engine: o.engine.id().to_string(),
        voice: voice.clone(),
        speed: spoken.speed,
        model_version: o.engine.model_version().to_string(),
        key: key.clone(),
    };
    if let Some(hit) = o.cache.lock().unwrap().get(&key).cloned() {
        return Ok(LineResult { id: line.id.clone(), status: LineStatus::Cached, notices, speech: Some(hit), provenance: Some(provenance) });
    }
    let speech = o.engine.synthesize(&SpeechRequest { text: spoken.text, voice, speed: spoken.speed }, o.cancel)?;
    let d = speech.audio.duration();
    if speech.audio.samples.is_empty() || speech.audio.sample_rate < 8000 || !d.is_finite() || d > MAX_SECONDS {
        return Err(VoiceError::Engine("Puhemoottori palautti virheellisen äänen.".into()));
    }
    let speech = Arc::new(speech);
    o.cache.lock().unwrap().insert(key, speech.clone());
    Ok(LineResult { id: line.id.clone(), status: LineStatus::Synthesized, notices, speech: Some(speech), provenance: Some(provenance) })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines() -> Vec<DialogueLine> {
        [("1", "PIPSA", "Hello there, friend!"), ("2", "VILLE", "Hei, mitä kuuluu"), ("3", "NOBODY", "Hi"), ("4", "PIPSA", "Wait (whispers) here"), ("5", "PIPSA", "Mine")]
            .iter()
            .map(|(i, s, t)| DialogueLine { id: i.to_string(), speaker: s.to_string(), text: t.to_string() })
            .collect()
    }

    #[test]
    fn synthesizes_only_what_it_may_and_caches() {
        let engine = TestEngine::default();
        let cancel = AtomicBool::new(false);
        let cache: SpeechCache = Default::default();
        let accepted = BTreeSet::new();
        let voice_for = |s: &str| (s != "NOBODY").then(|| "af_heart".to_string());
        let own = |id: &str| id == "5";
        let o = SynthesisOptions { engine: &engine, voice_for: &voice_for, has_own_audio: &own, accepted_notices: &accepted, cache: cache.clone(), cancel: &cancel };
        let r = synthesize_lines(&lines(), &o).unwrap();
        let st: Vec<_> = r.iter().map(|r| r.status).collect();
        assert_eq!(st, [LineStatus::Synthesized, LineStatus::UnsupportedLanguage, LineStatus::NoVoice, LineStatus::NeedsReview, LineStatus::KeptOwnAudio]);
        assert!(r[0].speech.as_ref().unwrap().audio.duration() > 0.5);
        let again = synthesize_lines(&lines()[..1], &o).unwrap();
        assert_eq!(again[0].status, LineStatus::Cached);
        assert_eq!(engine.calls.lock().unwrap().len(), 1);
        cancel.store(true, Ordering::Relaxed);
        assert!(matches!(synthesize_lines(&lines(), &o), Err(VoiceError::Cancelled)));
    }
}
