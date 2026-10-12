//! Kamera esitystilassa: pään liike siirtyy valitulle hahmolle reaaliajassa.

use crate::app::StudioApp;
use eframe::egui::{self, Color32, RichText};
use hs_camera::CameraFeed;
use std::sync::Arc;

pub struct CameraState {
    pub feed: Option<CameraFeed>,
    texture: Option<(egui::TextureHandle, u64)>,
    pub gain: f32,
    pub smoothing: f32,
}

impl Default for CameraState {
    fn default() -> Self {
        CameraState { feed: None, texture: None, gain: 1.0, smoothing: 0.6 }
    }
}

impl StudioApp {
    /// Kameran pään asento (kääntö, nyökkäys, kallistus), kun kamera on päällä ja kalibroitu.
    pub fn camera_head(&self) -> Option<[f32; 3]> {
        self.camera.feed.as_ref().and_then(|f| f.pose())
    }
}

pub fn camera_section(app: &mut StudioApp, ui: &mut egui::Ui) {
    ui.label(RichText::new("Kamera").strong());
    let cam = &mut app.camera;
    match &cam.feed {
        None => {
            ui.label(RichText::new("Kuva käsitellään vain tällä koneella; mitään ei tallenneta eikä lähetetä.").weak().small());
            if ui.button("Kamera päälle").clicked() {
                let ctx = ui.ctx().clone();
                cam.feed = Some(CameraFeed::start(Arc::new(move || ctx.request_repaint())));
                cam.texture = None;
            }
        }
        Some(feed) => {
            let mut stop = false;
            if let Some(e) = feed.error() {
                ui.label(RichText::new(e).color(Color32::from_rgb(0xe0, 0x6c, 0x5a)).small());
                stop = ui.button("Sulje").clicked();
            } else {
                let name = feed.name();
                ui.label(RichText::new(if name.is_empty() { "Avataan kameraa…".to_string() } else { name }).weak().small());
                if let Some(p) = feed.preview() {
                    if cam.texture.as_ref().map(|t| t.1) != Some(p.frame) {
                        let img = egui::ColorImage::from_rgb([p.image.width as usize, p.image.height as usize], &p.image.data);
                        match &mut cam.texture {
                            Some((t, f)) => {
                                t.set(img, egui::TextureOptions::LINEAR);
                                *f = p.frame;
                            }
                            None => cam.texture = Some((ui.ctx().load_texture("kamera", img, egui::TextureOptions::LINEAR), p.frame)),
                        }
                    }
                    if let Some((t, _)) = &cam.texture {
                        let w = ui.available_width().min(240.0);
                        let size = egui::vec2(w, w * p.image.height as f32 / p.image.width.max(1) as f32);
                        // Peilikuva, kuten kameran esikatselu yleensä näytetään.
                        let r = ui.add(egui::Image::new((t.id(), size)).uv(egui::Rect::from_min_max(egui::pos2(1.0, 0.0), egui::pos2(0.0, 1.0))));
                        if let Some(b) = p.blob {
                            let c = egui::pos2(r.rect.left() + (1.0 - b.x) * size.x, r.rect.top() + b.y * size.y);
                            let half = egui::vec2(b.size * size.x * 0.45, b.size * size.x * 0.55);
                            let color = if b.confidence > 0.15 { Color32::from_rgb(0x5d, 0xa8, 0x6c) } else { Color32::from_rgb(0xd8, 0xa8, 0x3a) };
                            ui.painter().rect_stroke(egui::Rect::from_center_size(c, half * 2.0), 4.0, (2.0, color), egui::StrokeKind::Middle);
                        }
                    }
                }
                ui.label(
                    RichText::new(if feed.is_calibrated() {
                        "Seuranta käynnissä."
                    } else {
                        "Katso suoraan kameraan: neutraali asento kalibroidaan."
                    })
                    .small(),
                );
                ui.horizontal(|ui| {
                    if ui.button("Kalibroi uudelleen").clicked() {
                        feed.recalibrate();
                    }
                    stop = ui.button("Kamera pois").clicked();
                });
                let mut changed = ui.add(egui::Slider::new(&mut cam.gain, 0.3..=2.5).text("herkkyys")).changed();
                changed |= ui.add(egui::Slider::new(&mut cam.smoothing, 0.0..=0.9).text("pehmennys")).changed();
                if changed {
                    feed.set_tuning(cam.gain, cam.smoothing);
                }
                if let Some([y, p, r]) = feed.pose() {
                    ui.label(RichText::new(format!("kääntö {:+.0}° · nyökkäys {:+.0}° · kallistus {:+.0}°", y.to_degrees(), p.to_degrees(), r.to_degrees())).monospace().small());
                }
            }
            if stop {
                cam.feed = None;
                cam.texture = None;
            }
        }
    }
}
