//! Source-backed line blocks. This does not claim free timing or ripple editing.
use eframe::egui;
use hs_edit::script::{line_texts, rewrite, LineEdit, SourceHistory};
#[derive(Default)]
pub struct BlocksState {
    history: SourceHistory,
    selected: Option<usize>,
    draft: String,
    notice: Option<String>,
}
impl BlocksState {
    pub fn ui(&mut self, ui: &mut egui::Ui, script: &str) -> Option<String> {
        if self.history.observe(script) {
            self.selected = None;
            self.notice=Some("Käsikirjoitusta muutettiin muualla. Palikkaeditorin historia nollattiin; teksti säilyi.".into());
        }
        ui.heading("Käsikirjoituksen palikat");
        ui.label(
            "Rivit ovat lähdetekstiä. Siirto muuttaa järjestystä; ajoitus lasketaan uudelleen.",
        );
        let mut history_result = None;
        ui.horizontal(|ui| {
            if ui
                .add_enabled(
                    self.history.can_undo(),
                    egui::Button::new("Kumoa palikkamuutos"),
                )
                .clicked()
            {
                history_result = self.history.undo();
            }
            if ui
                .add_enabled(self.history.can_redo(), egui::Button::new("Tee uudelleen"))
                .clicked()
            {
                history_result = self.history.redo();
            }
            if ui.button("Tyhjennä palikkahistoria").clicked() {
                self.history.clear();
                self.notice = Some("Historia tyhjennetty. Käsikirjoitus säilyi.".into());
            }
        });
        if let Some(text) = history_result {
            self.selected = None;
            return Some(text);
        }
        let lines = line_texts(script);
        let plan = hs_script::parse(script);
        egui::ScrollArea::vertical()
            .max_height(280.0)
            .show(ui, |ui| {
                for (index, line) in lines.iter().enumerate() {
                    if ui
                        .selectable_label(
                            self.selected == Some(index),
                            format!(
                                "{}  {}",
                                index + 1,
                                if line.is_empty() { "(tyhjä)" } else { line }
                            ),
                        )
                        .clicked()
                    {
                        self.selected = Some(index);
                        self.draft = (*line).into();
                    }
                    for diagnostic in plan.diagnostics.iter().filter(|d| d.line == index + 1) {
                        ui.colored_label(egui::Color32::YELLOW, &diagnostic.message);
                    }
                }
            });
        let mut command = None;
        if let Some(index) = self.selected.filter(|i| *i < lines.len()) {
            ui.label(format!("Muokkaa riviä {}", index + 1));
            ui.text_edit_singleline(&mut self.draft);
            ui.horizontal(|ui| {
                if ui.button("Tallenna rivi").clicked() {
                    command = Some(LineEdit::Replace(self.draft.clone()));
                }
                if ui
                    .add_enabled(index > 0, egui::Button::new("Ylös"))
                    .clicked()
                {
                    command = Some(LineEdit::Up);
                }
                if ui
                    .add_enabled(index + 1 < lines.len(), egui::Button::new("Alas"))
                    .clicked()
                {
                    command = Some(LineEdit::Down);
                }
                if ui.button("Monista").clicked() {
                    command = Some(LineEdit::Duplicate);
                }
                if ui.button("Tauko 1 s jälkeen").clicked() {
                    command = Some(LineEdit::PauseAfter);
                }
                if ui.button("Poista rivi").clicked() {
                    command = Some(LineEdit::Delete);
                }
            });
            if let Some(edit) = command {
                match rewrite(script, index, lines[index], edit)
                    .and_then(|next| self.history.apply(script, next))
                {
                    Ok(next) => {
                        self.selected = None;
                        self.notice = None;
                        return Some(next);
                    }
                    Err(e) => self.notice = Some(e),
                }
            }
        } else if lines.is_empty() && ui.button("Lisää ensimmäinen tauko").clicked() {
            match self.history.apply(script, "[wait 1s]".into()) {
                Ok(next) => return Some(next),
                Err(e) => self.notice = Some(e),
            }
        }
        if let Some(message) = &self.notice {
            ui.colored_label(egui::Color32::YELLOW, message);
        }
        None
    }
}
