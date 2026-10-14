//! Editorial review widgets use ordinary focusable egui controls and explicit local actions.
use eframe::egui;
use hs_project::production_review::{ReviewState, SourceAnchor};

#[derive(Default)]
pub struct ReviewUi {
    comment: String,
    task: String,
    reviewer: String,
    bind_line: bool,
    line: usize,
    error: Option<String>,
}
impl ReviewUi {
    /// Integration must synchronize the exact content hash before calling this method and
    /// gate artistic approval with current technical preflight. Returns whether metadata changed.
    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        state: &mut ReviewState,
        source: &str,
        hash: &str,
        can_approve: bool,
    ) -> bool {
        let before = state.clone();
        ui.heading("Jakson tarkistus");
        ui.label(
            "Oma toimituksellinen hyväksyntä ei todista animaation tai äänen teknistä laatua.",
        );
        if let Err(error) = state.validate() {
            ui.colored_label(egui::Color32::RED, error);
            return false;
        }
        ui.label(if state.approved() {
            "Nykyinen sisältö on hyväksytty."
        } else {
            "Nykyistä sisältöä ei ole hyväksytty."
        });
        if let Some(a) = &state.approval {
            ui.label(format!("Hyväksyjä: {}", a.reviewer));
        }
        if state.locked {
            ui.label("Jakso on lukittu. Muokkaus vaatii lukituksen avaamisen.");
            if ui.button("Avaa jakson lukitus").clicked() {
                self.result(state.set_locked(false));
            }
        } else {
            ui.add_enabled_ui(state.approved(), |ui| {
                if ui.button("Lukitse hyväksytty jakso").clicked() {
                    self.result(state.set_locked(true));
                }
            });
        }
        ui.separator();
        ui.label("Kommentit");
        let mut resolutions = Vec::new();
        for c in &state.comments {
            ui.push_id(("comment", c.id), |ui| {
                let mut resolved = c.resolved;
                ui.add_enabled_ui(!state.locked, |ui| {
                    if ui
                        .checkbox(&mut resolved, format!("Ratkaistu · kommentti {}", c.id))
                        .changed()
                    {
                        resolutions.push((c.id, resolved));
                    }
                });
                ui.label(&c.text);
                if let Some(anchor) = &c.anchor {
                    if anchor.is_current(source) {
                        ui.label(format!("Lähderivi {}: {}", anchor.line, anchor.excerpt));
                    } else {
                        ui.colored_label(
                            egui::Color32::YELLOW,
                            format!(
                                "Vanhentunut lähdeviite, alkuperäinen rivi {}: {}",
                                anchor.line, anchor.excerpt
                            ),
                        );
                    }
                }
            });
        }
        for (id, resolved) in resolutions {
            self.result(state.resolve_comment(id, resolved));
        }
        ui.add_enabled_ui(!state.locked, |ui| {
            ui.label("Uusi kommentti");
            ui.add(
                egui::TextEdit::multiline(&mut self.comment)
                    .id_salt("review-new-comment")
                    .hint_text("Kirjoita tarkistettava asia")
                    .char_limit(8192),
            );
            ui.checkbox(&mut self.bind_line, "Liitä kommentti käsikirjoitusriviin");
            if self.bind_line {
                self.line = self.line.max(1);
                ui.horizontal(|ui| {
                    ui.label("Lähderivi");
                    ui.add(
                        egui::DragValue::new(&mut self.line)
                            .range(1..=source.lines().count().max(1)),
                    );
                });
            }
            if ui
                .add_enabled(
                    !self.comment.trim().is_empty(),
                    egui::Button::new("Lisää kommentti"),
                )
                .clicked()
            {
                let anchor = if self.bind_line {
                    SourceAnchor::from_line(source, self.line).map(Some)
                } else {
                    Ok(None)
                };
                let result = anchor.and_then(|a| state.add_comment(&self.comment, a));
                if result.is_ok() {
                    self.comment.clear();
                }
                self.result(result.map(|_| ()));
            }
        });
        ui.separator();
        ui.label("Tehtävät");
        let mut completions = Vec::new();
        for t in &state.tasks {
            ui.push_id(("task", t.id), |ui| {
                let mut done = t.done;
                ui.add_enabled_ui(!state.locked, |ui| {
                    if ui
                        .checkbox(&mut done, format!("Tehtävä {}: {}", t.id, t.text))
                        .changed()
                    {
                        completions.push((t.id, done));
                    }
                });
            });
        }
        for (id, done) in completions {
            self.result(state.complete_task(id, done));
        }
        ui.add_enabled_ui(!state.locked, |ui| {
            ui.label("Uusi tehtävä");
            ui.add(
                egui::TextEdit::singleline(&mut self.task)
                    .id_salt("review-new-task")
                    .hint_text("Kirjoita tehtävä")
                    .char_limit(8192),
            );
            if ui
                .add_enabled(
                    !self.task.trim().is_empty(),
                    egui::Button::new("Lisää tehtävä"),
                )
                .clicked()
            {
                let result = state.add_task(&self.task);
                if result.is_ok() {
                    self.task.clear();
                }
                self.result(result.map(|_| ()));
            }
            ui.separator();
            ui.label("Hyväksyjän nimi");
            ui.add(
                egui::TextEdit::singleline(&mut self.reviewer)
                    .id_salt("review-reviewer")
                    .hint_text("Oma nimi")
                    .char_limit(8192),
            );
            if state.has_open_items() {
                ui.label("Ratkaise avoimet kommentit ja tehtävät ennen hyväksymistä.");
            }
            if !can_approve {
                ui.label("Korjaa tuotannon tarkistuksen esteet ennen hyväksymistä.");
            }
            if ui
                .add_enabled(
                    can_approve && !state.has_open_items() && !self.reviewer.trim().is_empty(),
                    egui::Button::new("Hyväksy tarkistettu sisältö"),
                )
                .clicked()
            {
                self.result(state.approve(&self.reviewer, hash));
            }
        });
        if let Some(error) = &self.error {
            ui.colored_label(egui::Color32::RED, error);
        }
        *state != before
    }
    fn result(&mut self, result: Result<(), String>) {
        self.error = result.err();
    }
}
