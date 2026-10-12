//! Vienti taustasäikeessä omalla tuotannolla ja renderöijällä, jotta
//! käyttöliittymä pysyy sujuvana. Peruutus vapauttaa kooderin ja poistaa
//! keskeneräisen tiedoston.

use hs_agents::{Backend, Pipeline, Production, RenderRequest, Slot};
use hs_character::CharacterParams;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc;
use std::sync::Arc;

pub struct ExportJob {
    pub done: Arc<AtomicU32>,
    pub total: Arc<AtomicU32>,
    pub cancel: Arc<AtomicBool>,
    pub label: String,
    rx: mpsc::Receiver<String>,
}

impl ExportJob {
    pub fn start(script: String, cast: Vec<CharacterParams>, request: RenderRequest, backend: Backend, size: (u32, u32)) -> ExportJob {
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
