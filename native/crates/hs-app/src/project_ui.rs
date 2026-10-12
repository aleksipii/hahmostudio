//! Sarjaprojekti käyttöliittymässä: uusi sarja, avaus, jakson tallennus ja vaihto.

use crate::app::{StudioApp, EXAMPLE};
use eframe::egui;
use hs_agents::Slot;
use hs_project::{Episode, SeriesProject};
use std::path::PathBuf;

/// Avattu sarja ja sen valittu jakso.
pub struct OpenSeries {
    pub project: SeriesProject,
    pub episode: String,
    pub title: String,
}

impl OpenSeries {
    pub fn label(&self) -> String {
        format!("{} – {}", self.project.name(), self.title)
    }
}

/// Nykyinen tuotanto jaksoksi tallennusta varten.
fn current_episode(app: &StudioApp, title: &str) -> Episode {
    Episode {
        title: title.to_string(),
        script: app.script.clone(),
        accepted_notices: app.production.accepted_notices.clone(),
        own_audio: app.production.own_audio.clone(),
        speech: hs_project::speech_in_use(&app.production.voice_lines),
    }
}

/// Luo sarjan kansioon: nykyinen käsikirjoitus ja hahmot tulevat ensimmäiseksi jaksoksi.
pub fn create_series(app: &mut StudioApp, root: PathBuf) {
    app.ensure_cast_params();
    let name = root.file_stem().and_then(|s| s.to_str()).unwrap_or("Sarja").to_string();
    let result = SeriesProject::create(&root, &name, app.production.cast_params.clone()).and_then(|mut project| {
        let episode = current_episode(app, "Jakso 1");
        let id = project.add_episode(&episode)?;
        Ok(OpenSeries { project, episode: id, title: episode.title })
    });
    match result {
        Ok(open) => {
            app.status = format!("Sarja luotu: {}", root.display());
            app.series = Some(open);
            app.series_dirty = false;
        }
        Err(e) => app.status = format!("Sarjan luonti epäonnistui: {e}"),
    }
}

/// Avaa sarjan ja sen ensimmäisen jakson.
pub fn open_series(app: &mut StudioApp, root: PathBuf) {
    match SeriesProject::open(&root) {
        Ok(project) => {
            let first = project.manifest.episodes.first().cloned();
            app.production.cast_params = project.manifest.cast.clone();
            app.series = Some(OpenSeries { project, episode: String::new(), title: String::new() });
            app.pipeline.mark_dirty(Slot::CastParams);
            match first {
                Some(e) => load_episode(app, &e.id),
                None => {
                    app.status = format!("Avattu sarja {} (ei jaksoja)", root.display());
                    app.run_pipeline();
                }
            }
        }
        Err(e) => app.status = format!("Sarjan avaus epäonnistui: {e}"),
    }
}

fn load_episode(app: &mut StudioApp, id: &str) {
    let Some(series) = &mut app.series else { return };
    match series.project.load_episode(id) {
        Ok(loaded) => {
            series.episode = id.to_string();
            series.title = loaded.episode.title.clone();
            // Taustasynteesi jakaa saman välimuistin, joten se täydennetään eikä korvata.
            app.production.speech_cache.lock().unwrap().extend(loaded.speech_cache);
            app.production.own_audio = loaded.episode.own_audio;
            app.production.accepted_notices = loaded.episode.accepted_notices;
            app.script = loaded.episode.script;
            app.script_path = None;
            app.legacy = None;
            app.time = 0.0;
            app.pipeline.mark_dirty(Slot::Script);
            app.pipeline.mark_dirty(Slot::Voice);
            app.run_pipeline();
            app.series_dirty = false;
            app.status = if loaded.warnings.is_empty() {
                format!("Avattu {}", series_label(app))
            } else {
                format!("Avattu {} – {} varoitusta: {}", series_label(app), loaded.warnings.len(), loaded.warnings.join(" "))
            };
        }
        Err(e) => app.status = format!("Jakson avaus epäonnistui: {e}"),
    }
}

fn series_label(app: &StudioApp) -> String {
    app.series.as_ref().map(|s| s.label()).unwrap_or_default()
}

/// Tallentaa hahmot ja nykyisen jakson. Palauttaa onnistumisen.
pub fn save_current(app: &mut StudioApp) -> bool {
    app.ensure_cast_params();
    let Some(series) = &app.series else { return false };
    let episode = current_episode(app, &series.title);
    let id = series.episode.clone();
    let cast = app.production.cast_params.clone();
    let series = app.series.as_mut().unwrap();
    let result = series.project.save_cast(&cast).and_then(|_| series.project.save_episode(&id, &episode));
    match result {
        Ok(()) => {
            app.series_dirty = false;
            app.status = format!("Tallennettu {}", series_label(app));
            true
        }
        Err(e) => {
            app.status = format!("Tallennus epäonnistui: {e}");
            false
        }
    }
}

/// Uusi jakso nykyiseen sarjaan esimerkkikäsikirjoituksella. Nykyinen jakso tallennetaan ensin.
pub fn new_episode(app: &mut StudioApp) {
    if app.series.is_none() || !save_current(app) {
        return;
    }
    let series = app.series.as_mut().unwrap();
    let title = format!("Jakso {}", series.project.manifest.episodes.len() + 1);
    let episode = Episode { title: title.clone(), script: EXAMPLE.into(), ..Default::default() };
    match series.project.add_episode(&episode) {
        Ok(id) => load_episode(app, &id),
        Err(e) => app.status = format!("Jakson luonti epäonnistui: {e}"),
    }
}

/// Vaihtaa jaksoa; nykyinen tallennetaan ensin.
pub fn switch_episode(app: &mut StudioApp, id: &str) {
    if app.series.as_ref().is_some_and(|s| s.episode == id) || !save_current(app) {
        return;
    }
    load_episode(app, id);
}

/// Sarja-valikko.
pub fn series_menu(app: &mut StudioApp, ui: &mut egui::Ui) {
    ui.menu_button("Sarja", |ui| {
        if ui.button("Uusi sarja…").on_hover_text("Nykyinen käsikirjoitus ja hahmot tulevat sarjan ensimmäiseksi jaksoksi.").clicked() {
            ui.close_menu();
            if let Some(p) = rfd::FileDialog::new().set_file_name(format!("Sarja.{}", hs_project::EXTENSION)).save_file() {
                create_series(app, p);
            }
        }
        if ui.button("Avaa sarja…").clicked() {
            ui.close_menu();
            if let Some(p) = rfd::FileDialog::new().pick_folder() {
                open_series(app, p);
            }
        }
        let open = app.series.is_some();
        if ui.add_enabled(open, egui::Button::new("Tallenna jakso").shortcut_text("Ctrl+S")).clicked() {
            ui.close_menu();
            save_current(app);
        }
        if ui.add_enabled(open, egui::Button::new("Uusi jakso")).clicked() {
            ui.close_menu();
            new_episode(app);
        }
        if let Some(series) = &app.series {
            ui.separator();
            let current = series.episode.clone();
            let episodes = series.project.manifest.episodes.clone();
            for e in episodes {
                if ui.radio(e.id == current, &e.title).clicked() {
                    ui.close_menu();
                    switch_episode(app, &e.id);
                }
            }
            ui.separator();
            if let Some(s) = &mut app.series {
                ui.horizontal(|ui| {
                    ui.label("Jakson nimi");
                    if ui.text_edit_singleline(&mut s.title).changed() {
                        app.series_dirty = true;
                    }
                });
            }
        }
    });
    if app.series.is_some() && ui.input_mut(|i| i.consume_key(egui::Modifiers::COMMAND, egui::Key::S)) {
        save_current(app);
    }
}
