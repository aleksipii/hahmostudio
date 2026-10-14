use crate::app::StudioApp;
use eframe::egui;

impl StudioApp {
    pub fn rig_workspace(&mut self, ctx: &egui::Context, frame: &eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            if self.review.locked {
                ui.label("Jakso on lukittu. Avaa lukitus Tarkistus-välilehdellä.");
            }
            ui.add_enabled_ui(!self.review.locked, |ui| {
                if let Some(legacy) = &mut self.legacy {
                    ui.horizontal(|ui| {
                        if ui.button("Tallenna .hahmo…").clicked() {
                            if let Some(path) = rfd::FileDialog::new()
                                .set_file_name(format!("{}.hahmo", legacy.name))
                                .save_file()
                            {
                                self.status = match legacy.project.save_atomic(&path) {
                                    Ok(()) => format!("Tallennettu {}", path.display()),
                                    Err(e) => e.to_string(),
                                };
                            }
                        }
                    });
                    egui::ScrollArea::vertical().show(ui, |ui| {
                        if self.rig.ui(ui, &mut legacy.project) {
                            legacy.texture = None;
                            legacy.frame = u32::MAX;
                        }
                        self.rig.preview(ui, &legacy.project);
                    });
                } else {
                    let actors: Vec<_> = self
                        .production
                        .cast
                        .iter()
                        .map(|c| {
                            (
                                c.character.params.name.as_str(),
                                &c.character.humanoid.skeleton,
                            )
                        })
                        .collect();
                    let duration = self
                        .production
                        .timeline
                        .as_ref()
                        .map_or(0.0, |t| t.duration.seconds());
                    let mut pose_changed = false;
                    egui::ScrollArea::vertical().show(ui, |ui| {
                        if self
                            .pose
                            .ui(ui, &mut self.production.pose_tracks, &actors, duration)
                        {
                            pose_changed = true;
                            self.status =
                                "3D-avainruudut päivitetty; tarkista liike esikatselussa.".into();
                        }
                    });
                    if pose_changed {
                        self.pipeline.mark_dirty(hs_agents::Slot::Camera);
                        self.run_pipeline();
                    }
                    self.time = self.pose.time as f32;
                    self.playing = false;
                    ui.separator();
                    let side = ui
                        .available_height()
                        .min(ui.available_width())
                        .clamp(32.0, 400.0);
                    let pixels = side.ceil() as u32;
                    if let Some(id) =
                        self.viewport
                            .draw(ui, frame, &self.production, self.time, [pixels, pixels])
                    {
                        ui.image((id, egui::vec2(side, side)));
                    } else if let Some(error) = &self.viewport.builder.last_error {
                        ui.colored_label(egui::Color32::LIGHT_RED, error);
                    }
                }
            });
        });
    }
}
