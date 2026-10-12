//! Ääni studiossa: Kokoro-malli (lataus luvalla, tuonti, poisto), taustasynteesi,
//! toisto kuvan tahdissa, rivikohtaiset omat äänitykset ja esitystila
//! (mikrofonista reaaliaikainen suu valitulle hahmolle).

use crate::app::StudioApp;
use eframe::egui::{self, Color32, RichText};
use hs_agents::{LiveOverride, Slot};
use hs_audio::{LiveMouth, Player, Recorder};
use hs_voice::store::{ModelStore, StoreStatus};
use hs_voice::{Audio, BackgroundEngine, LineStatus, SpeechEngine};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};

pub struct Download {
    pub progress: Arc<Mutex<(String, u64, Option<u64>)>>,
    pub cancel: Arc<AtomicBool>,
    rx: Receiver<Result<StoreStatus, String>>,
}

/// Mihin mikrofonin äänitys menee.
#[derive(Clone, Debug, PartialEq)]
pub enum RecordTarget {
    /// Rivin oma ääni (rivin avain).
    Line(String),
    /// Esitystila: vain reaaliaikainen suu, ei tallennusta.
    Live,
}

pub struct VoiceState {
    pub store: Option<ModelStore>,
    pub status: StoreStatus,
    pub engine: Option<Arc<BackgroundEngine>>,
    loading: Option<Receiver<Result<Arc<dyn SpeechEngine>, String>>>,
    pub load_error: Option<String>,
    pub download: Option<Download>,
    pub confirm_download: bool,
    pub player: Option<Player>,
    pub player_error: Option<String>,
    pub recorder: Option<(Recorder, RecordTarget)>,
    pub recorder_error: Option<String>,
    pub live: LiveMouth,
    pub live_character: String,
    /// Taustasynteesi valmisti rivin: putki ajetaan uudelleen.
    ready: Arc<AtomicBool>,
    mix_ptr: usize,
    pub recordings_dir: Option<PathBuf>,
}

impl VoiceState {
    pub fn new(ctx: &egui::Context, screenshot: bool) -> Self {
        let store = ModelStore::default_data_dir().map(ModelStore::new);
        let status = store.as_ref().map(|s| s.status(false)).unwrap_or(StoreStatus { installed: false, bytes: 0, error: None });
        let recordings_dir = ModelStore::default_data_dir().map(|d| d.join("aanitykset"));
        // Kuvakaappaustilassa (testit) ei avata äänilaitteita.
        let (player, player_error) = if screenshot {
            (None, None)
        } else {
            match Player::new() {
                Ok(p) => (Some(p), None),
                Err(e) => (None, Some(e)),
            }
        };
        let mut v = VoiceState {
            store,
            status,
            engine: None,
            loading: None,
            load_error: None,
            download: None,
            confirm_download: false,
            player,
            player_error,
            recorder: None,
            recorder_error: None,
            live: LiveMouth::default(),
            live_character: String::new(),
            ready: Arc::new(AtomicBool::new(false)),
            mix_ptr: 0,
            recordings_dir,
        };
        if v.status.installed && !screenshot {
            v.start_loading(ctx);
        }
        v
    }

    /// Rebind the installed engine to a fresh project's cache, without opening new devices.
    pub fn attach_project(&mut self, p: &mut hs_agents::Production, ctx: &egui::Context) {
        if let Some(player) = &self.player { player.pause(); player.set_audio(None); }
        self.mix_ptr = 0;
        // Project-owned recordings must never overwrite/delete legacy global recordings.
        self.recordings_dir = None;
        if let Some(old) = &self.engine {
            let ready = self.ready.clone();
            let ctx = ctx.clone();
            let bg = Arc::new(BackgroundEngine::new(old.inner(), p.speech_cache.clone(), Arc::new(move || {
                ready.store(true, Ordering::Relaxed); ctx.request_repaint();
            })));
            p.voice_engine = Some(bg.clone());
            self.engine = Some(bg);
        }
    }

    /// Avaa mallin taustasäikeessä (painot ~330 MiB).
    pub fn start_loading(&mut self, ctx: &egui::Context) {
        let Some(store) = &self.store else { return };
        let dir = store.model_dir();
        let verify = ModelStore { dir: store.dir.clone() };
        let (tx, rx) = std::sync::mpsc::channel();
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let result = if !verify.status(true).installed {
                Err("Mallitiedostot eivät vastaa manifestia; lataa malli uudelleen.".to_string())
            } else {
                hs_voice::kokoro::KokoroEngine::load(&dir).map(|e| Arc::new(e) as Arc<dyn SpeechEngine>).map_err(|e| e.to_string())
            };
            let _ = tx.send(result);
            ctx.request_repaint();
        });
        self.loading = Some(rx);
        self.load_error = None;
    }

    pub fn is_loading(&self) -> bool {
        self.loading.is_some()
    }

    /// Omat äänitykset levyltä (`<tietokansio>/aanitykset/<avain>.wav`).
    pub fn load_recordings(&self) -> Vec<(String, Arc<Audio>)> {
        let Some(dir) = &self.recordings_dir else { return Vec::new() };
        let Ok(entries) = std::fs::read_dir(dir) else { return Vec::new() };
        entries
            .flatten()
            .filter_map(|e| {
                let path = e.path();
                let key = path.file_stem()?.to_str()?.to_string();
                (path.extension()?.to_str()? == "wav").then_some(())?;
                let audio = hs_voice::wav::decode(&std::fs::read(&path).ok()?).ok()?;
                Some((key, Arc::new(audio)))
            })
            .collect()
    }
}

/// Kutsutaan joka ruudulla ennen paneeleja.
pub fn update(app: &mut StudioApp, ctx: &egui::Context) {
    // Mallin avaus valmistui.
    if let Some(rx) = &app.voice.loading {
        if let Ok(result) = rx.try_recv() {
            app.voice.loading = None;
            match result {
                Ok(inner) => {
                    let ready = app.voice.ready.clone();
                    let c = ctx.clone();
                    let bg = Arc::new(BackgroundEngine::new(
                        inner,
                        app.production.speech_cache.clone(),
                        Arc::new(move || {
                            ready.store(true, Ordering::Relaxed);
                            c.request_repaint();
                        }),
                    ));
                    app.production.voice_engine = Some(bg.clone() as Arc<dyn SpeechEngine>);
                    app.voice.engine = Some(bg);
                    app.pipeline.mark_dirty(Slot::Voice);
                    app.run_pipeline();
                    app.status = "Kokoro-puhe käytössä (offline)".into();
                }
                Err(e) => app.voice.load_error = Some(e),
            }
        }
    }
    if app.voice.ready.swap(false, Ordering::Relaxed) {
        app.pipeline.mark_dirty(Slot::Voice);
        app.run_pipeline();
    }
    // Lataus valmistui.
    if let Some(d) = &app.voice.download {
        if let Ok(result) = d.rx.try_recv() {
            app.voice.download = None;
            match result {
                Ok(st) => {
                    app.voice.status = st;
                    app.voice.start_loading(ctx);
                }
                Err(e) => app.voice.load_error = Some(e),
            }
        } else {
            ctx.request_repaint_after(std::time::Duration::from_millis(200));
        }
    }
    // Toisto: ääni määrää ajan, jotta kuva ja ääni pysyvät tahdissa.
    if let Some(player) = &app.voice.player {
        let ptr = app.production.mix.as_ref().map_or(0, |m| Arc::as_ptr(m) as usize);
        if ptr != app.voice.mix_ptr {
            app.voice.mix_ptr = ptr;
            player.set_audio(app.production.mix.clone());
        }
        if app.playing {
            if !player.is_playing() {
                player.play_from(app.time);
            }
            let d = app.duration();
            let t = player.position();
            if t >= d {
                if app.looping {
                    player.play_from(0.0);
                    app.time = 0.0;
                } else {
                    player.pause();
                    app.playing = false;
                    app.time = d;
                }
            } else {
                app.time = t;
            }
            ctx.request_repaint();
        } else if player.is_playing() {
            player.pause();
        }
    }
    // Esitystila: mikrofonista suu valitulle hahmolle.
    let live_mouth = match &app.voice.recorder {
        Some((rec, _)) if !app.voice.live_character.is_empty() => {
            let dt = ctx.input(|i| i.stable_dt).min(0.1);
            ctx.request_repaint();
            Some(app.voice.live.update(&rec.tail(0.4), dt))
        }
        _ => None,
    };
    let live = live_mouth.map(|m| LiveOverride { speaker: app.voice.live_character.clone(), mouth: Some(m), head: app.camera_head() });
    let live = live.or_else(|| {
        app.camera_head().map(|h| LiveOverride { speaker: app.voice.live_character.clone(), mouth: None, head: Some(h) })
    });
    app.production.live = live;
}

pub fn has_player(app: &StudioApp) -> bool {
    app.voice.player.is_some()
}

fn start_download(app: &mut StudioApp, ctx: &egui::Context) {
    let Some(store) = &app.voice.store else { return };
    let store = ModelStore { dir: store.dir.clone() };
    let progress = Arc::new(Mutex::new((String::new(), 0u64, None)));
    let cancel = Arc::new(AtomicBool::new(false));
    let (tx, rx) = std::sync::mpsc::channel();
    let (p, c, ctx) = (progress.clone(), cancel.clone(), ctx.clone());
    std::thread::spawn(move || {
        let r = store.download(&c, &|file, got, total| *p.lock().unwrap() = (file.to_string(), got, total)).map_err(|e| e.to_string());
        let _ = tx.send(r);
        ctx.request_repaint();
    });
    app.voice.download = Some(Download { progress, cancel, rx });
    app.voice.load_error = None;
}

fn save_recording(app: &mut StudioApp, key: &str, audio: Audio) {
    if let Some(dir) = &app.voice.recordings_dir {
        let _ = std::fs::create_dir_all(dir);
        if let Err(e) = std::fs::write(dir.join(format!("{key}.wav")), hs_voice::wav::encode(&audio)) {
            app.status = format!("Äänityksen tallennus epäonnistui: {e}");
        }
    }
    app.production.own_audio.insert(key.to_string(), Arc::new(audio));
    app.pipeline.mark_dirty(Slot::Voice);
    app.run_pipeline();
}

fn remove_recording(app: &mut StudioApp, key: &str) {
    if let Some(dir) = &app.voice.recordings_dir {
        let _ = std::fs::remove_file(dir.join(format!("{key}.wav")));
    }
    app.production.own_audio.remove(key);
    app.pipeline.mark_dirty(Slot::Voice);
    app.run_pipeline();
}

fn status_color(s: LineStatus) -> Color32 {
    match s {
        LineStatus::Synthesized | LineStatus::Cached | LineStatus::KeptOwnAudio => Color32::from_rgb(0x5d, 0xa8, 0x6c),
        LineStatus::Pending => Color32::from_rgb(0x4e, 0x8c, 0xc2),
        LineStatus::NeedsReview => Color32::from_rgb(0xd8, 0xa8, 0x3a),
        _ => Color32::GRAY,
    }
}

/// Ääni-välilehti: malli ja rivit.
pub fn voice_tab(app: &mut StudioApp, ui: &mut egui::Ui) {
    ui.heading("Puhe (Kokoro, offline)");
    let ctx = ui.ctx().clone();
    if let Some(d) = &app.voice.download {
        let (file, got, total) = d.progress.lock().unwrap().clone();
        let frac = total.map_or(0.0, |t| got as f32 / t.max(1) as f32);
        ui.add(egui::ProgressBar::new(frac).text(format!("{file}: {:.0} MiB", got as f64 / 1048576.0)));
        if ui.button("Peruuta lataus").clicked() {
            d.cancel.store(true, Ordering::Relaxed);
        }
    } else if app.voice.is_loading() {
        ui.horizontal(|ui| {
            ui.spinner();
            ui.label("Avataan Kokoro-mallia…");
        });
    } else if let Some(engine) = &app.voice.engine {
        let q = engine.queue_len();
        ui.label(RichText::new(format!("Kokoro-82M käytössä ({} MiB, Apache-2.0)", app.voice.status.bytes >> 20)).color(Color32::from_rgb(0x5d, 0xa8, 0x6c)));
        if q > 0 {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(format!("Tuotetaan puhetta: {q} riviä jonossa"));
            });
        }
        for (_, e) in engine.errors.lock().unwrap().iter().rev().take(3) {
            ui.label(RichText::new(e).color(Color32::from_rgb(0xe0, 0x6c, 0x5a)).small());
        }
    } else {
        if app.production.voice_lines.iter().any(|l| l.speech.is_some()) {
            ui.label("Puhemallia ei ole asennettu. Projektin tallennetut puheet ja omat äänet ovat käytössä; uusi synteesi tarvitsee Kokoron.");
        } else {
            ui.label("Puhemallia ei ole asennettu. Suut liikkuvat silti tekstin mukaan, ja voit äänittää rivit itse.");
        }
        ui.horizontal(|ui| {
            if ui.add_enabled(app.voice.store.is_some(), egui::Button::new("Lataa Kokoro…")).clicked() {
                app.voice.confirm_download = true;
            }
            if ui.button("Tuo kansiosta…").clicked() {
                if let (Some(dir), Some(store)) = (rfd::FileDialog::new().pick_folder(), &app.voice.store) {
                    match store.import_from(&dir) {
                        Ok(st) => {
                            app.voice.status = st;
                            app.voice.start_loading(&ctx);
                        }
                        Err(e) => app.voice.load_error = Some(e.to_string()),
                    }
                }
            }
        });
    }
    if let Some(e) = &app.voice.load_error {
        ui.label(RichText::new(e).color(Color32::from_rgb(0xe0, 0x6c, 0x5a)));
    }
    if let Some(e) = &app.voice.player_error {
        ui.label(RichText::new(format!("Toisto ei käytössä: {e}")).weak().small());
    }
    if let Some(e) = &app.voice.recorder_error {
        ui.label(RichText::new(e).color(Color32::from_rgb(0xe0, 0x6c, 0x5a)).small());
    }
    ui.separator();
    ui.label(RichText::new("Repliikit").strong());
    ui.label(RichText::new("Kokoro puhuu englantia. Suomenkieliset rivit voit äänittää itse: huulisynkka lukee rivin tekstin äänteinä.").weak().small());
    let lines = app.production.voice_lines.clone();
    let recording_key = app.voice.recorder.as_ref().and_then(|(_, t)| match t {
        RecordTarget::Line(k) => Some(k.clone()),
        RecordTarget::Live => None,
    });
    egui::ScrollArea::vertical().id_salt("repliikit").show(ui, |ui| {
        for l in &lines {
            ui.group(|ui| {
                ui.set_width(ui.available_width());
                ui.horizontal_wrapped(|ui| {
                    if let Some(s) = &l.speaker {
                        ui.label(RichText::new(s).strong());
                    }
                    ui.label(&l.text);
                });
                ui.horizontal(|ui| {
                    ui.label(RichText::new(l.status.finnish()).color(status_color(l.status)).small());
                    if let Some(sp) = &l.speech {
                        ui.label(RichText::new(format!("{:.1} s", sp.audio.duration())).weak().small());
                        if let Some(clip) = app.production.clips.iter().find(|c| c.beat == l.beat) {
                            if ui.small_button("▶").on_hover_text("Toista rivi").clicked() {
                                app.time = clip.start;
                                app.playing = true;
                                if let Some(p) = &app.voice.player {
                                    p.play_from(clip.start);
                                }
                            }
                        }
                    }
                    let is_rec = recording_key.as_deref() == Some(l.key.as_str());
                    if is_rec {
                        let (rec, _) = app.voice.recorder.as_ref().unwrap();
                        ui.add(egui::ProgressBar::new((rec.level() * 8.0).min(1.0)).desired_width(50.0));
                        ui.label(format!("{:.1} s", rec.seconds()));
                        if ui.small_button("Lopeta").clicked() {
                            let (rec, _) = app.voice.recorder.take().unwrap();
                            let audio = rec.finish();
                            save_recording(app, &l.key, audio);
                        }
                        ui.ctx().request_repaint();
                    } else if app.voice.recorder.is_none() && ui.small_button("Äänitä").clicked() {
                        match Recorder::start() {
                            Ok(r) => {
                                app.voice.recorder = Some((r, RecordTarget::Line(l.key.clone())));
                                app.voice.recorder_error = None;
                            }
                            Err(e) => app.voice.recorder_error = Some(e),
                        }
                    }
                    if ui.small_button("Tuo WAV…").clicked() {
                        if let Some(path) = rfd::FileDialog::new().add_filter("WAV", &["wav"]).pick_file() {
                            match std::fs::read(&path).map_err(|e| e.to_string()).and_then(|b| hs_voice::wav::decode(&b).map_err(|e| e.to_string())) {
                                Ok(a) => save_recording(app, &l.key, a.resampled(hs_audio::RATE)),
                                Err(e) => app.status = format!("WAV: {e}"),
                            }
                        }
                    }
                    if app.production.own_audio.contains_key(&l.key) && ui.small_button("Poista oma ääni").clicked() {
                        remove_recording(app, &l.key);
                    }
                });
                if l.status == LineStatus::NeedsReview {
                    for n in &l.notices {
                        ui.label(RichText::new(n).small().color(Color32::from_rgb(0xd8, 0xa8, 0x3a)));
                    }
                    if ui.small_button("Hyväksy ja tuota ilman ohjetta").clicked() {
                        app.production.accepted_notices.insert(l.key.clone());
                        app.pipeline.mark_dirty(Slot::Voice);
                        app.run_pipeline();
                    }
                } else if matches!(l.status, LineStatus::NoVoice | LineStatus::UnsupportedLanguage) {
                    for n in &l.notices {
                        ui.label(RichText::new(n).weak().small());
                    }
                }
            });
        }
    });
    if app.voice.confirm_download {
        let mut open = true;
        egui::Window::new("Lataa puhemalli").collapsible(false).resizable(false).open(&mut open).show(&ctx, |ui| {
            ui.label("Kokoro-82M ladataan Hugging Facesta (hexgrad/Kokoro-82M ja onnx-community/Kokoro-82M-v1.0-ONNX).");
            ui.label("Koko noin 330 MiB · lisenssi Apache-2.0 · tallennetaan vain tälle koneelle.");
            ui.label("Lataus tehdään kerran. Sen jälkeen puhe toimii ilman verkkoyhteyttä.");
            if let Some(s) = &app.voice.store {
                ui.label(RichText::new(s.dir.display().to_string()).weak().small());
            }
            ui.horizontal(|ui| {
                if ui.button("Lataa").clicked() {
                    app.voice.confirm_download = false;
                    start_download(app, &ctx);
                }
                if ui.button("Peruuta").clicked() {
                    app.voice.confirm_download = false;
                }
            });
        });
        if !open {
            app.voice.confirm_download = false;
        }
    }
}

/// Esitys-välilehti: reaaliaikainen suu (ja kameran pää) valitulle hahmolle.
pub fn performance_tab(app: &mut StudioApp, ui: &mut egui::Ui) {
    ui.heading("Esitys");
    ui.label(RichText::new("Puhu mikrofoniin: valitun hahmon suu seuraa ääntäsi reaaliajassa. Kamera seuraa pään liikettä, kun se on päällä.").weak().small());
    let names: Vec<String> = app.production.cast.iter().map(|c| c.character.params.name.clone()).collect();
    if app.voice.live_character.is_empty() || !names.contains(&app.voice.live_character) {
        app.voice.live_character = names.first().cloned().unwrap_or_default();
    }
    egui::ComboBox::from_label("hahmo").selected_text(app.voice.live_character.clone()).show_ui(ui, |ui| {
        for n in &names {
            ui.selectable_value(&mut app.voice.live_character, n.clone(), n);
        }
    });
    let live = matches!(app.voice.recorder, Some((_, RecordTarget::Live)));
    ui.horizontal(|ui| {
        if live {
            let (rec, _) = app.voice.recorder.as_ref().unwrap();
            ui.add(egui::ProgressBar::new((rec.level() * 8.0).min(1.0)).desired_width(120.0).text("taso"));
            if ui.button("Mikrofoni pois").clicked() {
                app.voice.recorder = None;
            }
        } else if app.voice.recorder.is_none() && ui.button("Mikrofoni päälle").clicked() {
            match Recorder::start() {
                Ok(r) => {
                    app.voice.recorder = Some((r, RecordTarget::Live));
                    app.voice.recorder_error = None;
                }
                Err(e) => app.voice.recorder_error = Some(e),
            }
        }
    });
    ui.add(egui::Slider::new(&mut app.voice.live.gate, 0.002..=0.08).logarithmic(true).text("hiljaisuusraja"));
    if let Some(e) = &app.voice.recorder_error {
        ui.label(RichText::new(e).color(Color32::from_rgb(0xe0, 0x6c, 0x5a)).small());
    }
    if let Some(m) = app.production.live.as_ref().and_then(|l| l.mouth) {
        ui.label(RichText::new(format!("suu auki {:.0} % · leveys {:+.1} · pyöreys {:.1}", m.open * 100.0, m.wide, m.round)).monospace().small());
    }
    ui.separator();
    crate::camera_ui::camera_section(app, ui);
}
