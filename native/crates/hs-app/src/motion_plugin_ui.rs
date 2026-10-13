//! Reviewed bindings for the built-in humanoid motion plugin.
use eframe::egui;
use hs_agents::{
    motion_plugin::{self, BoundMotion, MotionTemplate, Orientation},
    Production,
};
use hs_character::CharacterParams;

fn targets(p: &Production) -> Vec<CharacterParams> {
    // Explicit project profiles take precedence over stale built meshes and presets.
    let mut result = Vec::new();
    for target in p
        .cast_params
        .iter()
        .cloned()
        .chain(p.cast.iter().map(|c| c.character.params.clone()))
        .chain(CharacterParams::presets())
    {
        if !result
            .iter()
            .any(|existing: &CharacterParams| existing.name.eq_ignore_ascii_case(&target.name))
        {
            result.push(target);
        }
    }
    result
}
struct Preview {
    source: String,
    next: String,
    bound: BoundMotion,
}
impl Preview {
    fn accept(&self, source: &str, p: &Production) -> Result<String, String> {
        if self.source != source {
            return Err("Käsikirjoitus muuttui. Valitse liike uudelleen.".into());
        }
        if !targets(p).iter().any(|target| target == &self.bound.target) {
            return Err("Hahmoprofiili muuttui. Sovita liike uudelleen nykyiseen hahmoon.".into());
        }
        let next = motion_plugin::append_checked(source, &self.bound)?;
        if next != self.next {
            return Err("Liikepohja muuttui. Valitse uudelleen.".into());
        }
        Ok(next)
    }
}
pub struct MotionPluginState {
    templates: Vec<MotionTemplate>,
    target: String,
    duration: usize,
    orientation: Orientation,
    query: String,
    preview: Option<Preview>,
    error: Option<String>,
}
impl Default for MotionPluginState {
    fn default() -> Self {
        Self {
            templates: motion_plugin::templates(),
            target: String::new(),
            duration: 0,
            orientation: Orientation::Front,
            query: String::new(),
            preview: None,
            error: None,
        }
    }
}
fn orientation_label(value: Orientation) -> &'static str {
    match value {
        Orientation::Front => "Eteen",
        Orientation::Left => "Vasemmalle",
        Orientation::Right => "Oikealle",
        Orientation::Back => "Taakse",
    }
}
impl MotionPluginState {
    fn select(&mut self, source: &str, index: usize, target: &CharacterParams) {
        let result = motion_plugin::variant(index, self.duration, self.orientation)
            .and_then(|variant| {
                let plugin = motion_plugin::plugins()
                    .into_iter()
                    .find(|plugin| plugin.info().id == motion_plugin::PLUGIN_ID)
                    .ok_or_else(|| "Sisäistä liikepluginia ei ole rekisteröity.".to_string())?;
                plugin.bind(&variant, target)
            })
            .and_then(|bound| {
                motion_plugin::append_checked(source, &bound).map(|next| Preview {
                    source: source.into(),
                    next,
                    bound,
                })
            });
        match result {
            Ok(preview) => {
                self.preview = Some(preview);
                self.error = None;
            }
            Err(error) => self.error = Some(error.to_string()),
        }
    }
    pub fn ui(&mut self, ui: &mut egui::Ui, source: &str, p: &Production) {
        egui::CollapsingHeader::new("Sisäinen liikeplugin · 32 400 variaatiota").show(ui,|ui| {
            ui.label("18 liikettä, 306 järjestettyä kahden liikkeen sarjaa, 25 kestoa ja 4 alkusuuntaa. Variaatioita, ei 32 400 uutta perustoimintoa.");
            ui.label("Sovitus Koetan natiiveihin humanoidihahmoihin, myös omiin vartaloprofiileihin. Muut luurangot tarvitsevat erillisen nivelkartoituksen.");
            let choices=targets(p);
            if self.target.is_empty() { self.target=p.cast.iter().find(|c|c.lead).or_else(||p.cast.first()).map(|c|c.character.params.name.clone()).or_else(||choices.first().map(|c|c.name.clone())).unwrap_or_default(); }
            egui::ComboBox::from_id_salt("plugin-target").selected_text(&self.target).show_ui(ui,|ui| {
                for target in &choices { ui.selectable_value(&mut self.target,target.name.clone(),&target.name); }
            });
            egui::ComboBox::from_id_salt("plugin-duration").selected_text(format!("{:.1} s / liike",1.0+self.duration as f64/10.0)).show_ui(ui,|ui| {
                for index in 0..25 {ui.selectable_value(&mut self.duration,index,format!("{:.1} s / liike",1.0+index as f64/10.0));}
            });
            egui::ComboBox::from_id_salt("plugin-orientation").selected_text(orientation_label(self.orientation)).show_ui(ui,|ui| {
                for orientation in [Orientation::Front,Orientation::Left,Orientation::Right,Orientation::Back] {ui.selectable_value(&mut self.orientation,orientation,orientation_label(orientation));}
            });
            ui.add(egui::TextEdit::singleline(&mut self.query).hint_text("Etsi liike tai kahden liikkeen pohja").char_limit(128));
            let query=self.query.to_lowercase();
            let found:Vec<usize>=self.templates.iter().enumerate().filter(|(_,t)|query.is_empty()||t.name.to_lowercase().contains(&query)).take(50).map(|(i,_)|i).collect();
            ui.label("Enintään 50 hakutulosta. Rivit lisätään vain hyväksymällä esikatselu.");
            if found.is_empty() {ui.label("Liikepohjaa ei löytynyt.");}
            egui::ScrollArea::vertical().id_salt("plugin-motion-results").max_height(150.0).show_rows(ui,ui.text_style_height(&egui::TextStyle::Body)+6.0,found.len(),|ui,range| {
                for row in range {
                    let index=found[row]; let template=&self.templates[index];
                    let total=0.5+template.steps.len() as f64*(1.0+self.duration as f64/10.0);
                    let label=format!("{} · {total:.1} s",template.name);
                    if ui.button(label).on_hover_text("Sisältää 0,5 s alkusuunnan asetuksen. Valitse tarkistaaksesi lisättävät rivit.").clicked() {
                        if let Some(target)=choices.iter().find(|t|t.name==self.target) {self.select(source,index,target);}
                        else {self.error=Some("Valitse nykyinen hahmoprofiili.".into());}
                    }
                }
            });
            if let Some(error)=&self.error {ui.colored_label(egui::Color32::LIGHT_RED,error);}
        });
    }
    pub fn preview(&mut self, ctx: &egui::Context, source: &str, p: &Production) -> Option<String> {
        let preview = self.preview.as_ref()?;
        let mut accept = false;
        let mut cancel = false;
        egui::Modal::new(egui::Id::new("review-motion-plugin")).show(ctx,|ui| {
            ui.set_max_width(560.0);ui.heading("Tarkista hahmoon sovitettu liikepohja");
            ui.label(format!("{} · {:.1} s · {}",preview.bound.target.name,preview.bound.total_seconds,orientation_label(preview.bound.variant.orientation)));
            ui.label(format!("Hahmo: pituus {:.2} m, vartalo {:.2}, jalkasuhde {:.2}",preview.bound.target.height,preview.bound.target.build,preview.bound.target.leg_ratio));
            ui.label("Nämä rivit lisätään loppuun. Käsikirjoituksen tai hahmoprofiilin muutos mitätöi esikatselun.");
            ui.monospace(&preview.bound.script);
            ui.horizontal(|ui| {cancel=ui.button("Peruuta").clicked();accept=ui.button("Hyväksy lisäys").clicked();});
        });
        let result = if accept {
            match self.preview.as_ref().unwrap().accept(source, p) {
                Ok(next) => {
                    self.error = None;
                    Some(next)
                }
                Err(error) => {
                    self.error = Some(error);
                    None
                }
            }
        } else {
            None
        };
        if accept || cancel {
            self.preview = None;
        }
        result
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn custom() -> Production {
        let mut p = Production::new("");
        let mut jane = CharacterParams::presets()[0].clone();
        jane.name = "Jane".into();
        p.cast_params.push(jane);
        p
    }
    #[test]
    fn custom_project_target_is_available_and_project_profile_wins() {
        let mut p = custom();
        assert!(targets(&p).iter().any(|t| t.name == "Jane"));
        let mut overridden = CharacterParams::presets()[0].clone();
        overridden.height += 0.2;
        p.cast_params.push(overridden.clone());
        let candidates = targets(&p);
        assert_eq!(
            candidates
                .iter()
                .filter(|t| t.name.eq_ignore_ascii_case(&overridden.name))
                .count(),
            1
        );
        assert_eq!(
            candidates.iter().find(|t| t.name == overridden.name),
            Some(&overridden)
        );
    }
    #[test]
    fn selection_only_previews_and_checks_source_and_body() {
        let mut p = custom();
        let source = "JANE: Hello.\r\n";
        let target = p.cast_params[0].clone();
        let mut state = MotionPluginState::default();
        state.select(source, 0, &target);
        let preview = state.preview.as_ref().expect("valid selection");
        assert_eq!(preview.source, source);
        assert!(preview.accept(source, &p).unwrap().starts_with(source));
        assert!(preview.accept("JANE: Changed.", &p).is_err());
        p.cast_params[0].height += 0.1;
        assert!(preview.accept(source, &p).is_err());
    }
}
