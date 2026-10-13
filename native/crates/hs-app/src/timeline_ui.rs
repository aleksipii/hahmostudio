//! Drag a source row on the timeline; commit only a checked, explicitly accepted draft.
use crate::app::StudioApp;
use eframe::egui;

pub struct Drag {
    pub line: usize,
    pub source: String,
    pub original_start: f32,
    pub pointer_start: f32,
    pub seconds: f32,
}
pub struct Pending {
    pub line: usize,
    pub source: String,
    pub seconds: f64,
    pub result: Result<String, String>,
}
impl StudioApp {
    pub fn preview_retime(&mut self, drag: Drag) {
        let result = hs_agents::timing_edit::checked_retime(
            &self.production,
            &drag.source,
            drag.line,
            drag.seconds as f64,
        );
        self.workflow.pending_timing = Some(Pending {
            line: drag.line,
            source: drag.source,
            seconds: drag.seconds as f64,
            result,
        });
    }
}
pub fn confirmation(app: &mut StudioApp, ctx: &egui::Context) {
    let Some(mut pending) = app.workflow.pending_timing.take() else {
        return;
    };
    let mut keep = true;
    egui::Modal::new(egui::Id::new("timeline-retime")).show(ctx, |ui| {
        ui.set_max_width(560.0);
        ui.heading(format!("Rivin {} ajoitusluonnos", pending.line));
        ui.label(format!("Uusi alkuaika {:.3} s. Puhe ja liike siirtyvät yhdessä. Myöhemmät oletusajoitukset voivat muuttua.", pending.seconds));
        if app.script != pending.source {
            pending.result = Err("Käsikirjoitus muuttui: peruuta ja raahaa uudelleen.".into());
        }
        match &pending.result {
            Ok(next) => {
                if let Some(line) = hs_edit::script::line_texts(next).get(pending.line - 1) { ui.monospace(*line); }
                ui.label("Ajoitus ja kontaktit tarkistettu nykyisillä tallennetuilla äänillä. Puuttuva puhe tarvitsee oman tarkistuksen tuotannon jälkeen.");
            }
            Err(error) => { ui.colored_label(egui::Color32::LIGHT_RED, error); }
        }
        ui.horizontal(|ui| {
            if ui.button("Peruuta").clicked() { keep = false; }
            if ui.add_enabled(pending.result.is_ok(), egui::Button::new("Hyväksy ajoitus")).clicked() {
                // Recheck audio/cast/contacts that may have changed while the dialog was open.
                pending.result = hs_agents::timing_edit::checked_retime(&app.production, &pending.source, pending.line, pending.seconds);
                if let Ok(source) = &pending.result {
                    app.script = source.clone(); app.script_changed(); app.workflow.line = None;
                    app.time = pending.seconds as f32; app.status = "Ajoitus hyväksytty; Kumoa palauttaa muutoksen.".into(); keep = false;
                }
            }
            let error_line = pending.result.as_ref().err().and_then(|error| error.split_once("Rivi "))
                .and_then(|(_, rest)| rest.split(':').next()).and_then(|line| line.parse::<usize>().ok())
                .filter(|line| *line > 0).unwrap_or(pending.line);
            if pending.result.is_err() && ui.button(format!("Näytä virherivi {error_line}")).clicked() {
                app.select_line(error_line); keep = false;
            }
        });
    });
    if keep {
        app.workflow.pending_timing = Some(pending);
    }
}
