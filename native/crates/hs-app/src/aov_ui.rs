//! Render into canonical editable layers; stale jobs never replace another episode/image.
use crate::app::{LeftTab, StudioApp};
use eframe::egui;
use hs_project::render_settings::RenderSettings;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc,
};
struct Job {
    rx: mpsc::Receiver<Result<hs_image::Document, String>>,
    cancel: Arc<AtomicBool>,
    episode: String,
    image_revision: u64,
}
#[derive(Default)]
pub struct AovState {
    pub settings: RenderSettings,
    job: Option<Job>,
}
impl Drop for AovState {
    fn drop(&mut self) {
        if let Some(job) = &self.job {
            job.cancel.store(true, Ordering::Relaxed);
        }
    }
}
pub fn options(settings: &RenderSettings) -> Result<hs_render::raytrace::RayTraceOptions, String> {
    settings.validate()?;
    Ok(hs_render::raytrace::RayTraceOptions {
        ao_samples: settings.ao_samples,
        ao_radius: settings.ao_radius,
        ao_strength: settings.ao_strength,
        depth_near: settings.depth_near,
        depth_far: settings.depth_far,
        ..Default::default()
    })
}
pub fn document(buffers: hs_render::raytrace::RenderBuffers) -> Result<hs_image::Document, String> {
    buffers.validate().map_err(|e| e.to_string())?;
    let mut d = hs_image::Document::new(buffers.width, buffers.height)?;
    d.layers.clear();
    for (index, (name, rgba)) in [
        ("Background", buffers.background),
        ("Diffuse / Base Color", buffers.diffuse),
        ("Ambient Occlusion", buffers.ambient_occlusion),
        ("Specular", buffers.specular),
        ("Depth Map", buffers.depth),
        ("Normal Map", buffers.normal),
    ]
    .into_iter()
    .enumerate()
    {
        let id = d.add_layer(name.into())?;
        let l = d
            .layers
            .iter_mut()
            .find(|l| l.id == id)
            .ok_or("Taso puuttuu")?;
        l.rgba = rgba;
        l.visible = index < 4;
        l.blend_mode = match index {
            2 => hs_image::BlendMode::Multiply,
            3 => hs_image::BlendMode::Screen,
            _ => hs_image::BlendMode::Normal,
        };
    }
    d.validate()?;
    Ok(d)
}
pub fn controls(app: &mut StudioApp, ui: &mut egui::Ui) {
    ui.separator();
    ui.heading("3D-renderpassit");
    ui.label("Nykyinen ruutu omiksi muokattaviksi tasoiksi. Syvyysrajat muuttavat karttaa, eivät kuvassa näkyvää geometriaa.");
    ui.add_enabled_ui(!app.review.locked && app.aov.job.is_none(), |ui| {
        let s = &mut app.aov.settings;
        ui.add(egui::Slider::new(&mut s.ao_samples, 0..=64).text("AO-näytteet (0 = pois)"));
        ui.add(egui::Slider::new(&mut s.ao_strength, 0.0..=1.0).text("AO-voimakkuus"));
        ui.add(
            egui::DragValue::new(&mut s.ao_radius)
                .range(0.001..=5.0)
                .speed(0.01)
                .prefix("AO-säde ")
                .suffix(" m"),
        );
        ui.add(
            egui::DragValue::new(&mut s.depth_near)
                .range(0.0..=999.9)
                .speed(0.05)
                .prefix("Syvyys: lähellä ")
                .suffix(" m"),
        );
        ui.add(
            egui::DragValue::new(&mut s.depth_far)
                .range(0.001..=1000.0)
                .speed(0.1)
                .prefix("Syvyys: kaukana ")
                .suffix(" m"),
        );
    });
    if let Err(e) = app.aov.settings.validate() {
        ui.colored_label(egui::Color32::LIGHT_RED, e);
    }
    let ready = app.aov.settings.validate().is_ok()
        && !app.review.locked
        && !app.image.is_busy()
        && app.export.is_none()
        && app.aov.job.is_none()
        && !crate::project_ui::busy(app)
        && app.legacy.is_none();
    if ui
        .add_enabled(ready, egui::Button::new("Renderöi tasoiksi"))
        .on_hover_text("Korvaa Kuva-työtilan nykyisen dokumentin. Kumoa palauttaa sen.")
        .clicked()
    {
        start(app, ui.ctx());
    }
    if ui
        .add_enabled(ready, egui::Button::new("Vie PSD näillä asetuksilla…"))
        .clicked()
    {
        if let Some(path) = rfd::FileDialog::new()
            .set_file_name("render-passes.psd")
            .save_file()
        {
            crate::panels::start_psd_export(app, path);
        }
    }
    if let Some(job) = &app.aov.job {
        ui.horizontal(|ui| {
            ui.spinner();
            ui.label("Säteenseuranta…");
            if ui.button("Peruuta renderpassit").clicked() {
                job.cancel.store(true, Ordering::Relaxed);
            }
        });
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(100));
    }
}
fn start(app: &mut StudioApp, ctx: &egui::Context) {
    if app.review.locked
        || app.aov.job.is_some()
        || app.image.is_busy()
        || crate::project_ui::busy(app)
        || app.export.is_some()
    {
        return;
    }
    if app.script != app.production.script
        || app.pipeline_error.is_some()
        || !hs_agents::audit::inspect(&app.production).allowed()
    {
        app.status = "Korjaa tuotannon virheet ennen renderöintiä.".into();
        return;
    }
    let opts = match options(&app.aov.settings) {
        Ok(o) => o,
        Err(e) => {
            app.status = e;
            return;
        }
    };
    let frame = app.frame();
    let Some(scene) = app.viewport.builder.scene(
        &app.production,
        frame,
        app.production.width,
        app.production.height,
    ) else {
        app.status = app
            .viewport
            .builder
            .last_error
            .clone()
            .unwrap_or("Kohtaus puuttuu".into());
        return;
    };
    let episode = app.project.series.episodes[app.project.selected].id.clone();
    let image_revision = app.image.revision;
    let (tx, rx) = mpsc::channel();
    let cancel = Arc::new(AtomicBool::new(false));
    let signal = cancel.clone();
    let ctx = ctx.clone();
    std::thread::spawn(move || {
        let result = hs_render::raytrace::render_cancelable(&scene, opts, &signal)
            .map_err(|e| e.to_string())
            .and_then(document);
        let _ = tx.send(result);
        ctx.request_repaint();
    });
    app.aov.job = Some(Job {
        rx,
        cancel,
        episode,
        image_revision,
    });
    app.status = "Renderöidään nykyinen 3D-ruutu tasoiksi…".into();
}
pub fn update(app: &mut StudioApp, ctx: &egui::Context) {
    let Some(job) = &app.aov.job else {
        return;
    };
    let result = match job.rx.try_recv() {
        Ok(r) => r,
        Err(mpsc::TryRecvError::Empty) => {
            ctx.request_repaint_after(std::time::Duration::from_millis(100));
            return;
        }
        Err(_) => Err("Renderpassien taustatyö keskeytyi".into()),
    };
    let Some(job) = app.aov.job.take() else {
        return;
    };
    if job.cancel.load(Ordering::Relaxed) {
        app.status = "Renderpassit peruttu; nykyinen kuva säilyi.".into();
        return;
    }
    if job.episode != app.project.series.episodes[app.project.selected].id
        || job.image_revision != app.image.revision
        || app.review.locked
        || app.image.is_busy()
    {
        app.status = "Jakso tai kuva muuttui työn aikana; nykyinen kuva säilyi.".into();
        return;
    }
    match result {
        Ok(d) => {
            app.observe_edits();
            let revision = app.image.revision.wrapping_add(1);
            app.image.restore_document(d, revision);
            app.observe_edits();
            if app.image.revision != revision {
                return;
            }
            app.left_tab = LeftTab::Image;
            app.status =
                "Renderpassit avattu tasoeditoriin. Kumoa palauttaa edellisen kuvan.".into();
        }
        Err(e) => app.status = e,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rendered_layers_edit_export_and_series_reopen() {
        let mut p = hs_agents::Production::new("KALLE: [wave 2s]");
        hs_agents::Pipeline::default().run(&mut p).unwrap();
        let mut builder = hs_agents::agents::render::FrameBuilder::default();
        let scene = builder.scene(&p, 15, 32, 32).unwrap();
        let settings = RenderSettings {
            ao_samples: 4,
            ao_strength: 0.5,
            depth_near: 1.0,
            depth_far: 7.0,
            ..Default::default()
        };
        let buffers = hs_render::raytrace::render(&scene, options(&settings).unwrap()).unwrap();
        let mut d = document(buffers).unwrap();
        assert_eq!(d.layers.len(), 6);
        assert_eq!(d.layers[2].blend_mode, hs_image::BlendMode::Multiply);
        assert!(!d.layers[4].visible);
        d.layers[1].rgba[..4].copy_from_slice(&[10, 20, 30, 255]);
        d.layers[2].opacity = 127;
        let psd = d.export_psd().unwrap();
        let imported = hs_image::Document::import_psd(&psd).unwrap();
        assert_eq!(d.composite(), imported.composite());
        let mut e = hs_agents::project::capture(&p, "test".into(), 1, "AOV".into());
        e.assets.push(hs_project::ProjectAsset {
            id: "image".into(),
            kind: "image".into(),
            bytes: d.encode().unwrap(),
        });
        e.assets.push(hs_project::ProjectAsset {
            id: "render-settings".into(),
            kind: "render-settings".into(),
            bytes: settings.encode().unwrap(),
        });
        let series = hs_project::Series {
            id: "series".into(),
            name: "AOV".into(),
            episodes: vec![e],
        };
        let saved = hs_project::encode(&series).unwrap();
        let loaded = hs_project::decode(&saved).unwrap();
        let image = loaded.episodes[0]
            .assets
            .iter()
            .find(|a| a.kind == "image")
            .unwrap();
        assert_eq!(hs_image::Document::decode(&image.bytes).unwrap(), d);
        let resource = loaded.episodes[0]
            .assets
            .iter()
            .find(|a| a.kind == "render-settings")
            .unwrap();
        assert_eq!(RenderSettings::decode(&resource.bytes).unwrap(), settings);
    }
}
