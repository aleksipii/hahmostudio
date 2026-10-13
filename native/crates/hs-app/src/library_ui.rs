//! Portable series presets. Applying a preset is an explicit source/profile edit.
use crate::app::StudioApp;
use eframe::egui;
pub use hs_project::library::{SeriesLibrary, WorldPreset};
pub fn show(app: &mut StudioApp, ui: &mut egui::Ui) {
    egui::CollapsingHeader::new("Sarjan hahmot ja maailma").show(ui, |ui| {
        ui.label("Pohjat säilyvät .koeta-sarjassa. Käyttö ei muuta muita jaksoja.");
        if ui.button("Tallenna nykyiset hahmot ja äänet sarjakirjastoon").clicked() {
            let mut next = app.library.clone(); next.cast = app.production.cast_params.clone();
            match next.encode().and_then(|bytes| hs_agents::project::validate_library(&bytes)) { Ok(_) => app.library = next, Err(e) => app.status = e }
        }
        let mut apply = None;
        for c in &app.library.cast {
            if ui.button(format!("Käytä hahmoa {}", c.name)).clicked() { apply = Some(c.clone()); }
        }
        if let Some(c) = apply {
            if let Some(old) = app.production.cast_params.iter_mut().find(|p| p.name.eq_ignore_ascii_case(&c.name)) { *old = c; }
            else if app.production.cast_params.len() < 4 { app.production.cast_params.push(c); }
            else { app.status = "Jaksoon mahtuu enintään neljä hahmoa.".into(); }
            app.cast_changed();
        }
        for (name, source) in [("Perheen koti", "[background living room]\n[camera wide shot]"),
            ("Keittiö", "[background kitchen]\n[camera two shot]"),
            ("Puisto", "[background park]\n[camera wide shot]")] {
            if ui.button(format!("Lisää maailmapohja: {name}")).clicked() && !app.library.worlds.iter().any(|w| w.name == name) {
                let mut next = app.library.clone(); next.worlds.push(WorldPreset { name: name.into(), source: source.into() });
                match next.encode().and_then(|bytes| hs_agents::project::validate_library(&bytes)) { Ok(_) => app.library = next, Err(e) => app.status = e }
            }
        }
        for w in app.library.worlds.clone() {
            if ui.button(format!("Käytä maailmaa {} jakson alussa", w.name)).clicked() {
                app.script = format!("{}\n{}", w.source, app.script); app.script_changed();
            }
        }
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn portable_presets_roundtrip_and_reject_unknown_actions() {
        let mut library = SeriesLibrary::default();
        library.worlds.push(WorldPreset { name: "Home".into(), source: "[background living room]\n[camera wide shot]".into() });
        assert!(SeriesLibrary::decode(&library.encode().unwrap()).unwrap() == library);
        library.worlds[0].source = "[invent a flying castle]".into();
        assert!(hs_agents::project::validate_library(&library.encode().unwrap()).is_err());
    }
}
