//! Vienti taustasäikeessä omalla tuotannolla ja renderöijällä, jotta
//! käyttöliittymä pysyy sujuvana. Peruutus vapauttaa kooderin ja poistaa
//! keskeneräisen tiedoston.

use hs_agents::{Backend, Pipeline, Production, RenderRequest, Slot};
use hs_character::CharacterParams;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::Arc;

/// Puhe vientiin: sama malli, välimuisti ja omat äänitykset kuin studiossa.
#[derive(Clone, Default)]
pub struct ExportVoice {
    pub engine: Option<Arc<dyn hs_voice::SpeechEngine>>,
    pub fps: Option<hs_core::Fps>,
    pub allow_silent: bool,
    pub recorded_lines: hs_agents::recording::RecordedLines,
    pub soundtrack: Vec<hs_edit::Track>,
    pub caption_settings: hs_subtitle::CaptionSettings,
    pub caption_overrides: Vec<hs_subtitle::CaptionCue>,
    pub cache: hs_voice::SpeechCache,
    pub saved_speech: std::collections::HashMap<String, hs_project::AudioBinding>,
    pub own_audio: std::collections::HashMap<String, Arc<hs_voice::Audio>>,
    pub accepted_notices: std::collections::BTreeSet<String>,
    pub pose_tracks: hs_motion::pose_edit::PoseTracks,
}

pub struct ExportJob {
    pub done: Arc<AtomicU32>,
    pub total: Arc<AtomicU32>,
    pub cancel: Arc<AtomicBool>,
    pub label: String,
    rx: mpsc::Receiver<String>,
}

impl ExportJob {
    pub fn start(script: String, cast: Vec<CharacterParams>, voice: ExportVoice, request: RenderRequest, backend: Backend, size: (u32, u32)) -> ExportJob {
        let done = Arc::new(AtomicU32::new(0));
        let total = Arc::new(AtomicU32::new(1));
        let cancel = Arc::new(AtomicBool::new(false));
        let (tx, rx) = mpsc::channel();
        let label = match &request {
            RenderRequest::Mp4(p) | RenderRequest::PngSequence(p) | RenderRequest::Still { path: p, .. } => p.display().to_string(),
            RenderRequest::None => String::new(),
        };
        let (d, t, c) = (done.clone(), total.clone(), cancel.clone());
        std::thread::spawn(move || {
            let mut p = Production::new(script);
            p.cast_params = cast;
            if let Some(fps) = voice.fps { p.fps = fps; }
            p.voice_engine = voice.engine;
            p.speech_cache = voice.cache;
            p.own_audio = voice.own_audio;
            p.saved_speech = voice.saved_speech;
            p.allow_silent_export = voice.allow_silent;
            p.recorded_lines = voice.recorded_lines;
            p.soundtrack = voice.soundtrack;
            p.caption_settings = voice.caption_settings;
            p.caption_overrides = voice.caption_overrides;
            p.accepted_notices = voice.accepted_notices;
            p.pose_tracks = voice.pose_tracks;
            p.width = size.0;
            p.height = size.1;
            p.backend = backend;
            p.render_request = request;
            p.cancel = c;
            p.progress = Some(Arc::new(move |done, total| {
                d.store(done, Ordering::Relaxed);
                t.store(total, Ordering::Relaxed);
            }));
            let mut pipe = Pipeline::default();
            pipe.mark_dirty(Slot::RenderRequest);
            let msg = match pipe.run(&mut p) {
                Ok(_) => format!("Vienti valmis: {}", p.output.unwrap_or_default()),
                Err(e) => format!("Vienti keskeytyi: {e}"),
            };
            let _ = tx.send(msg);
        });
        ExportJob { done, total, cancel, label, rx }
    }

    pub fn poll(&mut self) -> Option<String> {
        self.rx.try_recv().ok()
    }

    pub fn progress(&self) -> f32 {
        self.done.load(Ordering::Relaxed) as f32 / self.total.load(Ordering::Relaxed).max(1) as f32
    }
}

impl ExportJob {
    pub fn start_psd(scene: hs_render::RenderScene, path: std::path::PathBuf) -> Self {
        let done=Arc::new(AtomicU32::new(0));let total=Arc::new(AtomicU32::new(1));let cancel=Arc::new(AtomicBool::new(false));let (tx,rx)=mpsc::channel();
        let label=path.display().to_string();let progress=done.clone();let signal=cancel.clone();
        std::thread::spawn(move || {
            let result=hs_render::raytrace::render_cancelable(&scene,Default::default(),&signal)
                .and_then(|buffers| if signal.load(Ordering::Relaxed) { Err(hs_render::RenderError::Export("PSD-vienti peruttu".into())) } else { hs_render::psd_exporter::save_atomic(&buffers,&path) });
            let message=match result {Ok(())=>{progress.store(1,Ordering::Relaxed);format!("PSD valmis: {}",path.display())},Err(e)=>format!("PSD-vienti keskeytyi: {e}")};let _=tx.send(message);
        });
        Self{done,total,cancel,label,rx}
    }
}
