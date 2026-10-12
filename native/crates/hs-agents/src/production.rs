use hs_character::{Character, CharacterParams, CharacterMesh};
use hs_core::{Diagnostic, Fps, Timeline};
use hs_motion::procedural::PreparedMotion;
use hs_script::ScriptPlan;
use hs_lipsync::VisemeTrack;
use hs_voice::{Audio, LineStatus, Speech, SpeechCache, SpeechEngine};
use std::collections::{BTreeSet, HashMap};
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::agents::cinematography::CameraTrack;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Backend {
    /// GPU, jos saatavilla; muuten CPU.
    Auto,
    Gpu,
    Cpu,
}

/// Mitä renderöintiagentin pitää tuottaa tällä ajolla.
#[derive(Clone, Debug, PartialEq)]
pub enum RenderRequest {
    /// Ei vientiä (esikatselu piirretään käyttöliittymässä suoraan).
    None,
    PngSequence(PathBuf),
    Mp4(PathBuf),
    /// Yksittäinen ruutu PNG:ksi.
    Still { frame: u32, path: PathBuf },
}

/// Hahmo tuotannossa: valmis verkko (jaettu GPU-välimuistille) ja aloituspaikka.
#[derive(Clone, Debug)]
pub struct CastMember {
    pub character: Arc<Character>,
    pub mesh: Arc<CharacterMesh>,
    pub start_x: f32,
    pub lead: bool,
}

/// Yhden käsikirjoitusrivin puhe.
#[derive(Clone, Debug)]
pub struct VoiceLine {
    /// Indeksi `plan.beats`-listaan.
    pub beat: usize,
    /// Pysyvä tunniste ([`hs_voice::spoken::line_key`]); omat äänitykset tallennetaan tällä.
    pub key: String,
    pub speaker: Option<String>,
    pub text: String,
    pub status: LineStatus,
    pub notices: Vec<String>,
    pub speech: Option<Arc<Speech>>,
}

/// Aikajanalle sijoitettu puheleike.
#[derive(Clone, Debug)]
pub struct PlacedClip {
    pub beat: usize,
    pub speaker: Option<String>,
    /// Alku sekunteina.
    pub start: f32,
    pub speech: Arc<Speech>,
}

/// Puhujan huulisynkka yhdelle leikkeelle.
#[derive(Clone, Debug)]
pub struct LipClip {
    pub speaker: Option<String>,
    pub start: f32,
    pub track: Arc<VisemeTrack>,
}

/// Reaaliaikainen esitys (mikrofoni ja kamera) yhdelle hahmolle esikatselussa.
#[derive(Clone, Debug, PartialEq)]
pub struct LiveOverride {
    pub speaker: String,
    pub mouth: Option<hs_lipsync::MouthShape>,
    /// Pään kierto (kääntö, nyökkäys, kallistus) radiaaneina.
    pub head: Option<[f32; 3]>,
}

/// Koko tuotannon tila, jota agentit lukevat ja kirjoittavat.
pub struct Production {
    pub script: String,
    pub fps: Fps,
    pub width: u32,
    pub height: u32,
    /// Käyttäjän säätämät hahmot; puuttuvat puhujat haetaan esiasetuksista.
    pub cast_params: Vec<CharacterParams>,
    pub backend: Backend,
    pub render_request: RenderRequest,
    pub cancel: Arc<AtomicBool>,
    pub progress: Option<Arc<dyn Fn(u32, u32) + Send + Sync>>,

    /// Puhemoottori (Kokoro, kun malli on asennettu). Ilman sitä käytetään vain omia äänityksiä.
    pub voice_engine: Option<Arc<dyn SpeechEngine>>,
    pub speech_cache: SpeechCache,
    /// Käyttäjän äänitykset tai tuodut äänet rivin avaimen mukaan. Niitä ei koskaan korvata synteesillä.
    pub own_audio: HashMap<String, Arc<Audio>>,
    /// Portable synthesized speech, including provenance; orphan lines are retained.
    pub saved_speech: HashMap<String, hs_project::AudioBinding>,
    /// Rivit, joiden huomautukset (esim. tukematon sulkeohje) käyttäjä on hyväksynyt.
    pub accepted_notices: BTreeSet<String>,
    pub soundtrack: Vec<hs_edit::Track>,
    pub caption_settings: hs_subtitle::CaptionSettings,
    pub caption_overrides: Vec<hs_subtitle::CaptionCue>,

    pub plan: Option<ScriptPlan>,
    pub voice_lines: Vec<VoiceLine>,
    pub clips: Vec<PlacedClip>,
    /// Koko jakson ääni 48 kHz mono (esikatselu ja vienti).
    pub mix: Option<Arc<Audio>>,
    pub lipsync: Vec<LipClip>,
    /// Esitystila: ohittaa valitun hahmon suun ja pään esikatselussa.
    pub live: Option<LiveOverride>,
    pub timeline: Option<Timeline>,
    pub cast: Vec<CastMember>,
    pub motion: Vec<Arc<PreparedMotion>>,
    pub camera: Option<Arc<CameraTrack>>,
    pub diagnostics: Vec<Diagnostic>,
    pub output: Option<String>,
}

impl Production {
    pub fn new(script: impl Into<String>) -> Self {
        Production {
            script: script.into(),
            fps: Fps::EXPORT,
            // Pystyvideo kuten nykyinen oletus (1080×1920); esikatselu voi käyttää pienempää.
            width: 1080,
            height: 1920,
            cast_params: Vec::new(),
            backend: Backend::Auto,
            render_request: RenderRequest::None,
            cancel: Arc::new(AtomicBool::new(false)),
            progress: None,
            voice_engine: None,
            speech_cache: SpeechCache::default(),
            own_audio: HashMap::new(),
            saved_speech: HashMap::new(),
            accepted_notices: BTreeSet::new(),
            soundtrack: Vec::new(),
            caption_settings: Default::default(),
            caption_overrides: Vec::new(),
            plan: None,
            voice_lines: Vec::new(),
            clips: Vec::new(),
            mix: None,
            lipsync: Vec::new(),
            live: None,
            timeline: None,
            cast: Vec::new(),
            motion: Vec::new(),
            camera: None,
            diagnostics: Vec::new(),
            output: None,
        }
    }

    /// Puhujan suun muoto äänellisestä huulisynkasta, jos jokin leike kattaa hetken `t`.
    pub fn mouth_at(&self, speaker: &dyn Fn(&Option<String>) -> bool, t: f32) -> Option<hs_lipsync::MouthShape> {
        self.lipsync
            .iter()
            .filter(|c| speaker(&c.speaker) && t >= c.start && t <= c.start + c.track.duration + 0.1)
            .map(|c| c.track.shape_at(t - c.start))
            .next()
    }

    pub fn frame_count(&self) -> u32 {
        self.timeline.as_ref().map_or(0, |t| t.frame_count())
    }
}
