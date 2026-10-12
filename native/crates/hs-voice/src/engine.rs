//! Puhemoottorin rajapinta ja rivien synteesi (portti: lib/kokoro.ts).
//!
//! Moottori on vaihdettava: oikea Kokoro ([`crate::kokoro`]) tai testien
//! deterministinen [`TestEngine`]. Synteesi tuottaa vain puuttuvat tai
//! muuttuneet rivit eikä koskaan korvaa käyttäjän omaa ääntä.

use crate::spoken::{cache_key, is_english_line, is_voice, parse_spoken_text, MAX_LINE, MAX_SECONDS, VOICES};
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
        // Jokaisella studion äänellä oma sävelkorkeus, jotta hahmot erottuvat testeissäkin.
        let Some(index) = VOICES.iter().position(|(v, _)| *v == r.voice) else {
            return Err(VoiceError::Model(format!("Tuntematon Kokoro-ääni {}.", r.voice)));
        };
        self.calls.lock().unwrap().push(r.clone());
        let pitch = 140.0 + index as f32 * 20.0;
        Ok(Speech { audio: Audio::synthetic_speech(&r.text, r.speed, pitch), phonemes: Some(r.text.to_lowercase()) })
    }
}

/// Taustasynteesi käyttöliittymälle: `synthesize` ei koskaan odota mallia,
/// vaan jonottaa pyynnön ja palauttaa [`VoiceError::Pending`]. Valmis puhe
/// menee suoraan jaettuun välimuistiin, josta seuraava putken ajo löytää sen.
/// Epäonnistunutta riviä ei jonoteta uudelleen (valmistumisilmoitus ajaa
/// putken uudelleen, joten uusi yritys kiertäisi loputtomasti); sama pyyntö
/// palauttaa tallennetun virheen. Uusi moottori (mallin uusi avaus) yrittää alusta.
pub struct BackgroundEngine {
    inner: Arc<dyn SpeechEngine>,
    cache: SpeechCache,
    queued: Arc<Mutex<BTreeSet<String>>>,
    failed: Arc<Mutex<HashMap<String, String>>>,
    tx: Mutex<std::sync::mpsc::Sender<(String, SpeechRequest)>>,
    /// Virheet taustasynteesistä (rivin avain, viesti).
    pub errors: Arc<Mutex<Vec<(String, String)>>>,
}

impl BackgroundEngine {
    /// `notify` kutsutaan taustasäikeestä jokaisen valmiin rivin jälkeen (esim. ruudun päivitys).
    pub fn new(inner: Arc<dyn SpeechEngine>, cache: SpeechCache, notify: Arc<dyn Fn() + Send + Sync>) -> Self {
        let (tx, rx) = std::sync::mpsc::channel::<(String, SpeechRequest)>();
        let queued: Arc<Mutex<BTreeSet<String>>> = Default::default();
        let errors: Arc<Mutex<Vec<(String, String)>>> = Default::default();
        let failed: Arc<Mutex<HashMap<String, String>>> = Default::default();
        let (engine, c, q, errs, f) = (inner.clone(), cache.clone(), queued.clone(), errors.clone(), failed.clone());
        std::thread::Builder::new()
            .name("puhesynteesi".into())
            .spawn(move || {
                let never = AtomicBool::new(false);
                for (key, req) in rx {
                    match engine.synthesize(&req, &never).and_then(|s| check_speech(&s).map(|_| s)) {
                        Ok(speech) => {
                            c.lock().unwrap().insert(key.clone(), Arc::new(speech));
                        }
                        Err(e) => {
                            f.lock().unwrap().insert(key.clone(), e.to_string());
                            errs.lock().unwrap().push((key.clone(), e.to_string()));
                        }
                    }
                    q.lock().unwrap().remove(&key);
                    notify();
                }
            })
            .expect("puhesäie");
        BackgroundEngine { inner, cache, queued, failed, tx: Mutex::new(tx), errors }
    }

    /// Alla oleva moottori (vienti käyttää sitä suoraan omassa säikeessään).
    pub fn inner(&self) -> Arc<dyn SpeechEngine> {
        self.inner.clone()
    }

    pub fn queue_len(&self) -> usize {
        self.queued.lock().unwrap().len()
    }
}

impl SpeechEngine for BackgroundEngine {
    fn id(&self) -> &str {
        self.inner.id()
    }
    fn model_version(&self) -> &str {
        self.inner.model_version()
    }
    fn synthesize(&self, r: &SpeechRequest, _cancel: &AtomicBool) -> Result<Speech, VoiceError> {
        let key = cache_key(&r.text, &r.voice, r.speed, self.inner.model_version());
        if let Some(s) = self.cache.lock().unwrap().get(&key) {
            return Ok((**s).clone());
        }
        if let Some(e) = self.failed.lock().unwrap().get(&key) {
            return Err(VoiceError::Engine(e.clone()));
        }
        if self.queued.lock().unwrap().insert(key.clone()) {
            let _ = self.tx.lock().unwrap().send((key, r.clone()));
        }
        Err(VoiceError::Pending)
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
    /// Puhe syntetisoidaan taustalla; rivi päivittyy, kun se valmistuu.
    Pending,
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
            LineStatus::Pending => "tulossa",
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
    let speech = match o.engine.synthesize(&SpeechRequest { text: spoken.text, voice, speed: spoken.speed }, o.cancel) {
        Err(VoiceError::Pending) => {
            return Ok(LineResult { id: line.id.clone(), status: LineStatus::Pending, notices, speech: None, provenance: Some(provenance) })
        }
        r => r?,
    };
    check_speech(&speech)?;
    let speech = Arc::new(speech);
    o.cache.lock().unwrap().insert(key, speech.clone());
    Ok(LineResult { id: line.id.clone(), status: LineStatus::Synthesized, notices, speech: Some(speech), provenance: Some(provenance) })
}

/// Hylkää tyhjän, liian pitkän tai rikkinäisen äänen ennen välimuistia.
fn check_speech(speech: &Speech) -> Result<(), VoiceError> {
    let d = speech.audio.duration();
    if speech.audio.samples.is_empty()
        || speech.audio.sample_rate < 8000
        || !d.is_finite()
        || d > MAX_SECONDS
        || speech.audio.samples.iter().any(|x| !x.is_finite())
    {
        return Err(VoiceError::Engine("Puhemoottori palautti virheellisen äänen.".into()));
    }
    Ok(())
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

    #[test]
    fn background_engine_never_blocks_and_fills_the_cache() {
        let cache: SpeechCache = Default::default();
        let (tx, rx) = std::sync::mpsc::channel();
        let tx = Mutex::new(tx);
        let bg = BackgroundEngine::new(Arc::new(TestEngine::default()), cache.clone(), Arc::new(move || tx.lock().unwrap().send(()).unwrap()));
        let cancel = AtomicBool::new(false);
        let accepted = BTreeSet::new();
        let voice_for = |_: &str| Some("af_heart".to_string());
        let own = |_: &str| false;
        let o = SynthesisOptions { engine: &bg, voice_for: &voice_for, has_own_audio: &own, accepted_notices: &accepted, cache: cache.clone(), cancel: &cancel };
        let first = synthesize_lines(&lines()[..1], &o).unwrap();
        assert_eq!(first[0].status, LineStatus::Pending);
        rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
        assert_eq!(bg.queue_len(), 0);
        let again = synthesize_lines(&lines()[..1], &o).unwrap();
        assert_eq!(again[0].status, LineStatus::Cached);
    }

    /// Testimoottori, jonka malliversio ja virheet voi valita; laskee kutsut.
    struct Scripted {
        version: &'static str,
        fail: bool,
        empty: bool,
        calls: Mutex<Vec<SpeechRequest>>,
    }

    impl Scripted {
        fn new(version: &'static str) -> Self {
            Scripted { version, fail: false, empty: false, calls: Mutex::new(Vec::new()) }
        }
        fn calls(&self) -> Vec<SpeechRequest> {
            self.calls.lock().unwrap().clone()
        }
    }

    impl SpeechEngine for Scripted {
        fn id(&self) -> &str {
            "scripted"
        }
        fn model_version(&self) -> &str {
            self.version
        }
        fn synthesize(&self, r: &SpeechRequest, cancel: &AtomicBool) -> Result<Speech, VoiceError> {
            self.calls.lock().unwrap().push(r.clone());
            if self.fail {
                return Err(VoiceError::Engine("rikki".into()));
            }
            if self.empty {
                return Ok(Speech { audio: Audio { samples: vec![], sample_rate: 24000 }, phonemes: None });
            }
            TestEngine::default().synthesize(r, cancel)
        }
    }

    fn dialogue(rows: &[(&str, &str)]) -> Vec<DialogueLine> {
        rows.iter().map(|(s, t)| DialogueLine { id: crate::spoken::line_key(s, t), speaker: s.to_string(), text: t.to_string() }).collect()
    }

    fn run(engine: &dyn SpeechEngine, lines: &[DialogueLine], voices: &[(&str, &str)], own: &[&str], cache: &SpeechCache) -> Vec<LineResult> {
        let cancel = AtomicBool::new(false);
        let accepted = BTreeSet::new();
        let voice_for = |s: &str| voices.iter().find(|(n, _)| n.eq_ignore_ascii_case(s)).map(|(_, v)| v.to_string());
        let has_own = |id: &str| own.contains(&id);
        let o = SynthesisOptions { engine, voice_for: &voice_for, has_own_audio: &has_own, accepted_notices: &accepted, cache: cache.clone(), cancel: &cancel };
        synthesize_lines(lines, &o).unwrap()
    }

    fn statuses(r: &[LineResult]) -> Vec<LineStatus> {
        r.iter().map(|r| r.status).collect()
    }

    const TWO: &[(&str, &str)] = &[("PIPSA", "af_heart"), ("VILLE", "am_adam")];

    #[test]
    fn two_characters_keep_their_own_english_voices() {
        let engine = Scripted::new("v1");
        let cache = SpeechCache::default();
        let lines = dialogue(&[("PIPSA", "Hello there!"), ("VILLE", "Hello there!"), ("Pipsa", "Don't worry, I'm fine.")]);
        let r = run(&engine, &lines, TWO, &[], &cache);
        assert_eq!(statuses(&r), [LineStatus::Synthesized; 3]);
        let voices: Vec<_> = engine.calls().iter().map(|c| c.voice.clone()).collect();
        assert_eq!(voices, ["af_heart", "am_adam", "af_heart"]);
        // Sama teksti eri hahmoilla: eri avain, eri ääni, oma alkuperätieto.
        let (a, b) = (r[0].provenance.as_ref().unwrap(), r[1].provenance.as_ref().unwrap());
        assert_ne!(a.key, b.key);
        assert_eq!((a.voice.as_str(), b.voice.as_str()), ("af_heart", "am_adam"));
        assert_eq!((a.model_version.as_str(), a.engine.as_str(), a.speed), ("v1", "scripted", 1.0));
        assert_ne!(r[0].speech.as_ref().unwrap().audio.samples, r[1].speech.as_ref().unwrap().audio.samples);
        // Uusi ajo samoilla valinnoilla: kaikki välimuistista, ei uutta synteesiä.
        let again = run(&engine, &lines, TWO, &[], &cache);
        assert_eq!(statuses(&again), [LineStatus::Cached; 3]);
        assert_eq!(engine.calls().len(), 3);
        assert!(Arc::ptr_eq(again[1].speech.as_ref().unwrap(), r[1].speech.as_ref().unwrap()));
    }

    #[test]
    fn invalid_or_missing_voices_are_never_synthesized() {
        let engine = Scripted::new("v1");
        let cache = SpeechCache::default();
        let lines = dialogue(&[("PIPSA", "Hello."), ("VILLE", "Hello."), ("TARU", "Hello."), ("UKKO", "Hello.")]);
        let voices = [("PIPSA", "af_sky"), ("VILLE", "../../etc/passwd"), ("TARU", "")];
        let r = run(&engine, &lines, &voices, &[], &cache);
        assert_eq!(statuses(&r), [LineStatus::NoVoice; 4]);
        assert!(engine.calls().is_empty());
        // Suora kutsu tuntemattomalla tai tyhjällä äänellä on virhe, ei paniikki.
        let never = AtomicBool::new(false);
        for voice in ["", "af_sky", "../x"] {
            let req = SpeechRequest { text: "Hi".into(), voice: voice.into(), speed: 1.0 };
            assert!(matches!(TestEngine::default().synthesize(&req, &never), Err(VoiceError::Model(_))));
        }
    }

    #[test]
    fn cache_follows_text_voice_speed_and_model_version() {
        let cache = SpeechCache::default();
        let v1 = Scripted::new("v1");
        let base = [("PIPSA", "Good morning."), ("VILLE", "Where is the bus?"), ("PIPSA", "Over there."), ("VILLE", "Thanks a lot.")];
        run(&v1, &dialogue(&base), TWO, &[], &cache);
        assert_eq!(v1.calls().len(), 4);

        // 1. Yhden repliikin tekstin muutos: vain se syntetisoidaan.
        let mut edited = base;
        edited[2].1 = "Right over there.";
        let r = run(&v1, &dialogue(&edited), TWO, &[], &cache);
        assert_eq!(statuses(&r), [LineStatus::Cached, LineStatus::Cached, LineStatus::Synthesized, LineStatus::Cached]);
        assert_eq!(v1.calls().last().unwrap().text, "Right over there.");
        assert_eq!(v1.calls().len(), 5);

        // 2. Nopeusohje muuttaa vain oman rivinsä.
        edited[1].1 = "Where is the bus? (slowly)";
        let r = run(&v1, &dialogue(&edited), TWO, &[], &cache);
        assert_eq!(statuses(&r), [LineStatus::Cached, LineStatus::Synthesized, LineStatus::Cached, LineStatus::Cached]);
        assert_eq!((v1.calls().last().unwrap().speed, v1.calls().len()), (0.85, 6));

        // 3. Villen äänen vaihto: vain Villen rivit syntetisoidaan, Pipsan pysyvät.
        let swapped = [("PIPSA", "af_heart"), ("VILLE", "bm_george")];
        let r = run(&v1, &dialogue(&edited), &swapped, &[], &cache);
        assert_eq!(statuses(&r), [LineStatus::Cached, LineStatus::Synthesized, LineStatus::Cached, LineStatus::Synthesized]);
        assert!(v1.calls()[6..].iter().all(|c| c.voice == "bm_george"));
        assert_eq!(v1.calls().len(), 8);
        // Paluu aiempaan ääneen löytää vanhan puheen välimuistista.
        let r = run(&v1, &dialogue(&edited), TWO, &[], &cache);
        assert_eq!(statuses(&r), [LineStatus::Cached; 4]);
        assert_eq!(v1.calls().len(), 8);

        // 4. Uusi malliversio: mitään vanhaa ei käytetä.
        let v2 = Scripted::new("v2");
        let r = run(&v2, &dialogue(&edited), TWO, &[], &cache);
        assert_eq!(statuses(&r), [LineStatus::Synthesized; 4]);
        assert_eq!(v2.calls().len(), 4);
    }

    #[test]
    fn own_or_imported_audio_is_never_replaced() {
        let cache = SpeechCache::default();
        let engine = Scripted::new("v1");
        let lines = dialogue(&[("PIPSA", "Hello there!"), ("VILLE", "See you later."), ("VILLE", "Moi kaikki")]);
        // Välimuistissa on jo synteesi Villen riville (esim. ennen omaa äänitystä).
        run(&engine, &lines[..2], TWO, &[], &cache);
        assert_eq!(engine.calls().len(), 2);
        let own = [lines[1].id.as_str(), lines[2].id.as_str()];
        let r = run(&engine, &lines, TWO, &own, &cache);
        assert_eq!(statuses(&r), [LineStatus::Cached, LineStatus::KeptOwnAudio, LineStatus::KeptOwnAudio]);
        assert!(r[1].speech.is_none() && r[1].provenance.is_none() && r[1].notices.is_empty());
        assert_eq!(engine.calls().len(), 2);

        // Taustamoottori ei edes jonota omaa riviä.
        let (tx, _rx) = std::sync::mpsc::channel();
        let tx = Mutex::new(tx);
        let bg = BackgroundEngine::new(Arc::new(Scripted::new("v1")), SpeechCache::default(), Arc::new(move || tx.lock().unwrap().send(()).unwrap()));
        let r = run(&bg, &lines[1..], TWO, &own, &SpeechCache::default());
        assert_eq!(statuses(&r), [LineStatus::KeptOwnAudio; 2]);
        assert_eq!(bg.queue_len(), 0);
    }

    fn background(engine: Scripted) -> (BackgroundEngine, SpeechCache, std::sync::mpsc::Receiver<()>) {
        let cache = SpeechCache::default();
        let (tx, rx) = std::sync::mpsc::channel();
        let tx = Mutex::new(tx);
        let bg = BackgroundEngine::new(Arc::new(engine), cache.clone(), Arc::new(move || tx.lock().unwrap().send(()).unwrap()));
        (bg, cache, rx)
    }

    #[test]
    fn background_failure_is_reported_once_not_retried_forever() {
        let mut failing = Scripted::new("v1");
        failing.fail = true;
        let (bg, cache, rx) = background(failing);
        let lines = dialogue(&[("PIPSA", "Hello there!")]);
        assert_eq!(statuses(&run(&bg, &lines, TWO, &[], &cache)), [LineStatus::Pending]);
        rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
        assert_eq!(bg.errors.lock().unwrap().len(), 1);
        // Valmistumisilmoitus ajaa putken uudelleen: virhe näkyy eikä riviä jonoteta uudestaan.
        let cancel = AtomicBool::new(false);
        let accepted = BTreeSet::new();
        let voice_for = |_: &str| Some("af_heart".to_string());
        let own = |_: &str| false;
        let o = SynthesisOptions { engine: &bg, voice_for: &voice_for, has_own_audio: &own, accepted_notices: &accepted, cache: cache.clone(), cancel: &cancel };
        for _ in 0..3 {
            assert!(matches!(synthesize_lines(&lines, &o), Err(VoiceError::Engine(_))));
        }
        assert!(rx.recv_timeout(std::time::Duration::from_millis(200)).is_err());
        assert_eq!(bg.queue_len(), 0);
        assert_eq!(bg.errors.lock().unwrap().len(), 1);
    }

    #[test]
    fn background_never_caches_invalid_audio() {
        let mut empty = Scripted::new("v1");
        empty.empty = true;
        let (bg, cache, rx) = background(empty);
        let lines = dialogue(&[("PIPSA", "Hello there!")]);
        assert_eq!(statuses(&run(&bg, &lines, TWO, &[], &cache)), [LineStatus::Pending]);
        rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
        assert!(cache.lock().unwrap().is_empty());
        assert!(bg.errors.lock().unwrap()[0].1.contains("virheellisen"));
    }
}
