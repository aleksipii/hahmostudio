//! A bounded motion recipe picker. Selection never edits the screenplay.
use eframe::egui;
use hs_agents::motion_library::{self, Preset};

struct Preview {
    source: String,
    next: String,
    preset: Preset,
}
impl Preview {
    fn accept(&self, current: &str) -> Result<String, String> {
        if current != self.source {
            return Err(
                "Käsikirjoitus muuttui esikatselun jälkeen. Valitse liike uudelleen.".into(),
            );
        }
        // Revalidate the recipe and limits at acceptance, too.
        let next = motion_library::append_checked(current, &self.preset)?;
        if next != self.next {
            return Err("Liikeaineisto muuttui. Valitse liike uudelleen.".into());
        }
        Ok(next)
    }
}

pub struct MotionAssetsState {
    items: Vec<Preset>,
    profile: String,
    family: String,
    duration: usize,
    query: String,
    preview: Option<Preview>,
    error: Option<String>,
}
impl Default for MotionAssetsState {
    fn default() -> Self {
        Self {
            items: motion_library::catalog(),
            profile: "Kalle".into(),
            family: String::new(),
            duration: 0,
            query: String::new(),
            preview: None,
            error: None,
        }
    }
}
impl MotionAssetsState {
    fn select(&mut self, source: &str, preset: Preset) {
        match motion_library::append_checked(source, &preset) {
            Ok(next) => {
                self.preview = Some(Preview {
                    source: source.into(),
                    next,
                    preset,
                });
                self.error = None;
            }
            Err(error) => self.error = Some(error),
        }
    }
    pub fn ui(&mut self, ui: &mut egui::Ui, source: &str) {
        egui::CollapsingHeader::new("Liikeaineistot · 2 000 variaatiota").show(ui, |ui| {
            ui.label("18 yksittäistä liikettä ja 2 kahden liikkeen sarjaa. Neljä hahmoa ja 25 kestoa: 2 000 variaatiota, ei 2 000 uutta toimintoa.");
            ui.label("Sovellus tuottaa liikkeen sarjan nykyiselle hahmoprofiilille; glTF-aineisto käyttää vakiohahmoa.");
            egui::ComboBox::from_id_salt("motion-asset-profile").selected_text(&self.profile).show_ui(ui, |ui| {
                for profile in ["Kalle", "Maija", "Eetu", "Ronja"] {
                    ui.selectable_value(&mut self.profile, profile.into(), profile);
                }
            });
            let family_label = motion_library::RECIPES.iter().find(|(id, _, _)| *id == self.family).map(|(_, label, _)| *label).unwrap_or("Kaikki liikkeet");
            egui::ComboBox::from_id_salt("motion-asset-family").selected_text(family_label).show_ui(ui, |ui| {
                ui.selectable_value(&mut self.family, String::new(), "Kaikki liikkeet");
                for (id, name, _) in motion_library::RECIPES {
                    ui.selectable_value(&mut self.family, (*id).into(), *name);
                }
            });
            egui::ComboBox::from_id_salt("motion-asset-duration").selected_text(format!("{:.1} s / vaihe", 1.0 + self.duration as f64 / 10.0)).show_ui(ui, |ui| {
                for index in 0..25 {
                    ui.selectable_value(&mut self.duration, index, format!("{:.1} s / vaihe", 1.0 + index as f64 / 10.0));
                }
            });
            ui.add(egui::TextEdit::singleline(&mut self.query).hint_text("Etsi liikettä").char_limit(128));
            let query = self.query.to_lowercase();
            let seconds = 1.0 + self.duration as f64 / 10.0;
            let found: Vec<Preset> = self.items.iter().filter(|item| item.profile == self.profile && (self.family.is_empty() || item.family == self.family) && (item.seconds - seconds).abs() < 0.001 && (query.is_empty() || item.name.to_lowercase().contains(&query) || item.family.contains(&query))).take(50).cloned().collect();
            ui.label("Valitse esikatselu. Liike lisätään loppuun vasta hyväksyttäessä.");
            if found.is_empty() { ui.label("Hakua vastaavaa liikettä ei löytynyt."); }
            egui::ScrollArea::vertical().id_salt("motion-assets-list").max_height(140.0).show_rows(ui, ui.text_style_height(&egui::TextStyle::Body) + 6.0, found.len(), |ui, range| {
                for index in range {
                    let item = &found[index];
                    if ui.button(&item.name).on_hover_text(&item.script).clicked() {
                        self.select(source, item.clone());
                    }
                }
            });
            if let Some(error) = &self.error { ui.colored_label(egui::Color32::LIGHT_RED, error); }
        });
    }
    pub fn preview(&mut self, ctx: &egui::Context, source: &str) -> Option<String> {
        let mut accepted = None;
        let Some(preview) = &self.preview else {
            return None;
        };
        let title = preview.preset.name.clone();
        let rows = preview.preset.script.clone();
        let mut cancel = false;
        let mut accept = false;
        egui::Modal::new(egui::Id::new("review-motion-asset")).show(ctx, |ui| {
            ui.set_max_width(520.0);
            ui.heading("Tarkista lisättävä liike");
            ui.label(title);
            ui.label("Nämä rivit lisätään käsikirjoituksen loppuun. Nykyiset repliikit säilyvät.");
            ui.monospace(rows);
            ui.horizontal(|ui| {
                cancel = ui.button("Peruuta").clicked();
                accept = ui.button("Hyväksy lisäys").clicked();
            });
        });
        if accept {
            match self.preview.as_ref().unwrap().accept(source) {
                Ok(next) => {
                    accepted = Some(next);
                    self.error = None;
                }
                Err(error) => self.error = Some(error),
            }
        }
        if cancel || accept {
            self.preview = None;
        }
        accepted
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn selection_is_preview_only_and_preserves_crlf_on_acceptance() {
        let source = "KALLE: Hello.\r\nMAIJA: Hi.\r\n";
        let mut state = MotionAssetsState::default();
        let preset = state
            .items
            .iter()
            .find(|item| item.family == "turn-point" && item.profile == "Kalle")
            .unwrap()
            .clone();
        state.select(source, preset);
        let preview = state.preview.as_ref().unwrap();
        assert_eq!(preview.source, source);
        let next = preview.accept(source).unwrap();
        assert!(next.starts_with(source));
        assert_eq!(next.matches("\r\n").count(), 3);
        assert!(next.ends_with("KALLE: [point forward 1.0s]"));
    }
    #[test]
    fn editing_an_unrelated_line_invalidates_the_whole_preview() {
        let source = "KALLE: Hello.\nMAIJA: Hi.";
        let mut state = MotionAssetsState::default();
        state.select(source, state.items[0].clone());
        assert!(state
            .preview
            .as_ref()
            .unwrap()
            .accept("KALLE: Hello.\nMAIJA: Changed.")
            .is_err());
        assert_eq!(state.preview.as_ref().unwrap().source, source);
    }
}
