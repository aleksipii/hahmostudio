use hs_character::{Character, CharacterParams, CharacterMesh};
use hs_core::{Diagnostic, Fps, Timeline};
use hs_motion::procedural::PreparedMotion;
use hs_script::ScriptPlan;
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

    pub plan: Option<ScriptPlan>,
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
            plan: None,
            timeline: None,
            cast: Vec::new(),
            motion: Vec::new(),
            camera: None,
            diagnostics: Vec::new(),
            output: None,
        }
    }

    pub fn frame_count(&self) -> u32 {
        self.timeline.as_ref().map_or(0, |t| t.frame_count())
    }
}
