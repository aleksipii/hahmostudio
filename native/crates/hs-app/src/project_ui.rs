//! Portable series workflow. Files are read/written off the UI thread.
use crate::app::StudioApp;
use eframe::egui;
use hs_project::{Episode, Series};
use std::{
    path::PathBuf,
    sync::mpsc::{self, Receiver},
};

pub struct ProjectState {
    pub series: Series,
    pub selected: usize,
    pub path: Option<PathBuf>,
    job: Option<Receiver<Result<JobResult, String>>>,
    confirm_replace: bool,
    new_series: bool,
    confirm_close: bool,
    close_after_save: bool,
    allow_close: bool,
}
enum JobResult {
    Open(Series, PathBuf),
    Saved(PathBuf),
}
fn fresh_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    format!(
        "koeta-{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    )
}
impl ProjectState {
    pub fn new(p: &hs_agents::Production) -> Self {
        Self {
            series: Series {
                id: fresh_id(),
                name: "Uusi sarja".into(),
                episodes: vec![hs_agents::project::capture(
                    p,
                    fresh_id(),
                    1,
                    "Jakso 1".into(),
                )],
            },
            selected: 0,
            path: None,
            job: None,
            confirm_replace: false,
            new_series: false,
            confirm_close: false,
            close_after_save: false,
            allow_close: false,
        }
    }
}
impl StudioApp {
    pub fn open_series(&mut self, path: PathBuf, ctx: &egui::Context) {
        let (tx, rx) = mpsc::channel();
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let result = hs_project::load(&path)
                .map(|s| JobResult::Open(s, path))
                .map_err(|e| e.to_string());
            let _ = tx.send(result);
            ctx.request_repaint();
        });
        self.project.job = Some(rx);
        self.status = "Avataan sarjaprojektia…".into();
    }

    fn capture_episode(&mut self) {
        // Include the current text even while the debounced pipeline is pending.
        self.production.script = self.script.clone();
        let old = &self.project.series.episodes[self.project.selected];
        let snapshot = hs_agents::project::capture(
            &self.production,
            old.id.clone(),
            old.number,
            old.name.clone(),
        );
        self.project.series.episodes[self.project.selected] = snapshot;
    }
    fn activate_episode(&mut self, index: usize, ctx: &egui::Context) {
        self.playing = false;
        let mut production = hs_agents::project::restore(&self.project.series.episodes[index]);
        self.voice.attach_project(&mut production, ctx);
        self.production = production;
        self.script = self.production.script.clone();
        self.script_path = None;
        self.dirty_since = None;
        self.legacy = None;
        self.time = 0.0;
        self.selected_cast = 0;
        self.project.selected = index;
        self.pipeline = hs_agents::Pipeline::default();
        self.run_pipeline();
    }
    fn save_series(&mut self, path: PathBuf, ctx: &egui::Context) {
        self.capture_episode();
        let snapshot = self.project.series.clone();
        let (tx, rx) = mpsc::channel();
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let result = hs_project::save_atomic(&path, &snapshot)
                .map(|_| JobResult::Saved(path))
                .map_err(|e| e.to_string());
            let _ = tx.send(result);
            ctx.request_repaint();
        });
        self.project.job = Some(rx);
        self.status = "Tallennetaan sarjaprojektia…".into();
    }
}
pub fn menu(app: &mut StudioApp, ui: &mut egui::Ui) {
    let ctx = ui.ctx().clone();
    let can_change =
        app.project.job.is_none() && app.voice.recorder.is_none() && app.export.is_none();
    ui.add_enabled_ui(can_change, |ui| {
        if ui.button("Uusi sarjaprojekti").clicked() {
            app.project.new_series = true;
            app.project.confirm_replace = true;
            ui.close_menu();
        }
        if ui.button("Avaa sarjaprojekti (.koeta)…").clicked() {
            app.project.new_series = false;
            app.project.confirm_replace = true;
            ui.close_menu();
        }
        if ui.button("Tallenna sarjaprojekti").clicked() {
            let path = app.project.path.clone().or_else(|| {
                rfd::FileDialog::new()
                    .add_filter("Koeta", &["koeta"])
                    .set_file_name("sarja.koeta")
                    .save_file()
            });
            if let Some(path) = path {
                app.save_series(path, &ctx);
            }
            ui.close_menu();
        }
        if ui.button("Tallenna sarjaprojekti nimellä…").clicked() {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("Koeta", &["koeta"])
                .set_file_name("sarja.koeta")
                .save_file()
            {
                app.save_series(path, &ctx);
            }
            ui.close_menu();
        }
        ui.separator();
        ui.label("Sarjan nimi");
        ui.text_edit_singleline(&mut app.project.series.name);
        let selected = app.project.selected;
        ui.label("Jakson nimi ja numero");
        ui.text_edit_singleline(&mut app.project.series.episodes[selected].name);
        ui.add(
            egui::DragValue::new(&mut app.project.series.episodes[selected].number)
                .range(1..=u32::MAX),
        );
        let mut selected_after = selected;
        egui::ComboBox::from_id_salt("sarjan-jaksot")
            .selected_text(&app.project.series.episodes[selected].name)
            .show_ui(ui, |ui| {
                for (i, episode) in app.project.series.episodes.iter().enumerate() {
                    ui.selectable_value(
                        &mut selected_after,
                        i,
                        format!("{}: {}", episode.number, episode.name),
                    );
                }
            });
        if selected_after != selected {
            app.capture_episode();
            app.activate_episode(selected_after, &ctx);
        }
        if ui.button("Lisää uusi jakso").clicked() {
            app.capture_episode();
            let number = app
                .project
                .series
                .episodes
                .iter()
                .map(|e| e.number)
                .max()
                .unwrap_or(0)
                .saturating_add(1);
            let mut p = hs_agents::Production::new("");
            // Cast/voice choices are shared by copying the previous episode's settings.
            p.cast_params = app.production.cast_params.clone();
            p.width = app.production.width;
            p.height = app.production.height;
            p.fps = app.production.fps;
            let episode: Episode =
                hs_agents::project::capture(&p, fresh_id(), number, format!("Jakso {number}"));
            app.project.series.episodes.push(episode);
            app.activate_episode(app.project.series.episodes.len() - 1, &ctx);
            ui.close_menu();
        }
    });
    if !can_change {
        ui.label("Odota tiedostotyön/viennin valmistumista ja lopeta äänitys.");
    }
}
pub fn busy(app: &StudioApp) -> bool {
    app.project.job.is_some()
}

pub fn update(app: &mut StudioApp, ctx: &egui::Context) {
    let result = app.project.job.as_ref().and_then(|rx| match rx.try_recv() {
        Ok(r) => Some(r),
        Err(mpsc::TryRecvError::Disconnected) => {
            Some(Err("Projektin tiedostotyö keskeytyi.".into()))
        }
        Err(mpsc::TryRecvError::Empty) => None,
    });
    if let Some(result) = result {
        app.project.job = None;
        match result {
            Ok(JobResult::Open(series, path)) => {
                app.project.series = series;
                app.project.path = Some(path);
                app.activate_episode(0, ctx);
                app.status = "Sarjaprojekti avattu; äänet palautettu projektista.".into();
            }
            Ok(JobResult::Saved(path)) => {
                app.status = format!(
                    "Sarjaprojekti tallennettu: {} (tallennuksen aloitushetken tila)",
                    path.display()
                );
                app.project.path = Some(path);
                if app.project.close_after_save {
                    app.project.allow_close = true;
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
            Err(e) => {
                app.status = format!("Projektitoiminto epäonnistui: {e}");
                app.project.close_after_save = false;
            }
        }
    }
    if ctx.input(|i| i.viewport().close_requested())
        && !app.project.allow_close
        && !app.screenshot_mode()
    {
        ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        app.project.confirm_close = true;
        app.project.confirm_replace = false;
    }
    if app.project.confirm_close && app.project.job.is_none() {
        egui::Modal::new(egui::Id::new("koeta-close")).show(ctx, |ui| {
            ui.set_max_width(480.0);
            ui.heading("Sulje Koeta?");
            ui.label("Säilytä koko sarja tallentamalla .koeta-projekti. Sovelluksen asetukset eivät korvaa sarjaprojektia.");
            if ui.button("Peruuta").clicked() { app.project.confirm_close = false; }
            if ui.button("Tallenna sarja ja sulje").clicked() && app.voice.recorder.is_none() && app.export.is_none() {
                let path = app.project.path.clone().or_else(|| rfd::FileDialog::new().add_filter("Koeta", &["koeta"]).set_file_name("sarja.koeta").save_file());
                if let Some(path) = path { app.project.close_after_save = true; app.save_series(path, ctx); }
            }
            if ui.button("Sulje tallentamatta").clicked() {
                app.project.allow_close = true;
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            }
        });
    }
    if app.project.job.is_some() {
        ctx.request_repaint_after(std::time::Duration::from_millis(100));
    }
    if app.project.confirm_replace {
        egui::Modal::new(egui::Id::new("koeta-replace")).show(ctx, |ui| {
            ui.set_max_width(480.0);
            ui.heading("Vaihda sarjaprojektia?");
            ui.label("Nykyisen sarjan tallentamattomat muutokset jäävät pois. Tallenna sarja ensin, jos haluat säilyttää ne.");
            if ui.button("Peruuta").clicked() { app.project.confirm_replace = false; }
            if ui.add_enabled(app.project.job.is_none() && app.voice.recorder.is_none() && app.export.is_none(), egui::Button::new(if app.project.new_series { "Luo uusi sarja" } else { "Jatka avaamiseen…" })).clicked() {
                app.project.confirm_replace = false;
                if app.project.new_series {
                    let p = hs_agents::Production::new("");
                    app.project = ProjectState::new(&p);
                    app.activate_episode(0, ctx);
                    app.status = "Uusi sarjaprojekti luotu.".into();
                } else if let Some(path) = rfd::FileDialog::new().add_filter("Koeta", &["koeta"]).pick_file() {
                    app.open_series(path, ctx);
                }
            }
        });
    }
}
