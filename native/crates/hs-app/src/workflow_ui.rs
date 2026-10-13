//! Read-only production progress and source-backed scene navigation.
use crate::app::{LeftTab, StudioApp};
use eframe::egui;

#[derive(Default)]
pub struct WorkflowState {
    pub line: Option<usize>,
    pub expected: String,
    pub draft: String,
    pub preview_scale: f32,
    pub delay: f32,
}

impl StudioApp {
    pub fn select_line(&mut self, line: usize) {
        if line == 0 { self.status = "Tarkistus koskee koko projektia.".into(); return; }
        if let Some(text) = hs_edit::script::line_texts(&self.script).get(line.saturating_sub(1)) {
            self.workflow.line = Some(line);
            self.workflow.expected = (*text).into();
            self.workflow.draft = (*text).into();
            self.playing = false;
            if let Some(row) = hs_agents::audit::inspect(&self.production).rows.iter().find(|r| r.line == line) {
                self.time = row.start_seconds as f32;
            }
        }
    }
}

pub fn overview(app: &mut StudioApp, ctx: &egui::Context) {
    let proof = hs_agents::audit::inspect(&app.production);
    let current = app.script == app.production.script && app.pipeline_error.is_none();
    let missing = app.production.voice_lines.iter().filter(|l| l.speech.is_none()).count();
    egui::TopBottomPanel::top("production-progress").show(ctx, |ui| {
        ui.horizontal_wrapped(|ui| {
            for (title, ready, tab) in [
                ("1 Käsikirjoitus", current && proof.allowed(), LeftTab::Script),
                ("2 Hahmot", !app.production.cast.is_empty() && proof.allowed(), LeftTab::Script),
                ("3 Puhe", !app.production.voice_lines.is_empty() && missing == 0, LeftTab::Voice),
                ("4 Animaatio", current && proof.allowed(), LeftTab::Edit),
                ("5 Vienti", current && proof.allowed() && missing == 0, LeftTab::Export),
            ] {
                if ui.button(format!("{} {title}", if ready { "OK" } else { "–" })).clicked() { app.left_tab = tab; }
            }
            ui.separator();
            ui.label("OK = tekninen tarkistus, esikatselu hyväksytään itse.");
            ui.label(if !current || !proof.allowed() { "Seuraavaksi: korjaa käsikirjoituksen tarkistus." }
                else if missing > 0 { "Seuraavaksi: tuota tai tuo puuttuvat repliikkiäänet." }
                else { "Seuraavaksi: tarkista esikatselu, tallenna sarja ja vie jakso." });
        });
    });
}

pub fn inspector(app: &mut StudioApp, ctx: &egui::Context) {
    let Some(line) = app.workflow.line else { return };
    egui::SidePanel::right("scene-inspector").resizable(true).default_width(280.0).show(ctx, |ui| {
        ui.heading(format!("Valittu rivi {line}"));
        if ui.button("Näytä hahmosäätimet").clicked() { app.workflow.line = None; }
        if let Some(row) = hs_agents::audit::inspect(&app.production).rows.into_iter().find(|r| r.line == line) {
            ui.label(format!("{} · {:.2}–{:.2} s", row.actor.as_deref().unwrap_or("Kohtaus"), row.start_seconds, row.end_seconds));
            ui.label(format!("Liike: {} · {:.2} s", row.motion, row.motion_seconds));
            ui.label(format!("Tausta: {}", row.background));
            ui.label(format!("Esine: {}", row.prop.as_deref().unwrap_or("ei")));
            ui.label(format!("Kamera: {}", row.shots.join(" → ")));
        }
        ui.separator();
        ui.label("Repliikki ja toimintaohjeet");
        ui.text_edit_multiline(&mut app.workflow.draft);
        ui.label("Muutos näkyy ensin tässä luonnoksessa. Ääntä ei nopeuteta.");
        if ui.button("Hyväksy rivimuutos").clicked() {
            match hs_edit::script::rewrite(&app.script, line - 1, &app.workflow.expected,
                hs_edit::script::LineEdit::Replace(app.workflow.draft.clone())) {
                Ok(mut next) => {
                    if commands(&app.workflow.draft).any(|(_, _, tag)| hs_script::command_category(tag) == Some("camera")) {
                        let headers = hs_edit::script::line_texts(&app.script);
                        let mut index = line - 1;
                        while index > 0 {
                            let header = headers[index - 1];
                            if !camera_header(header) { break; }
                            match hs_edit::script::rewrite(&next, index - 1, header, hs_edit::script::LineEdit::Delete) {
                                Ok(value) => next = value, Err(e) => { app.status = e; return; }
                            }
                            index -= 1;
                        }
                    }
                    app.script = next; app.workflow.line = None; app.script_changed();
                },
                Err(e) => app.status = e,
            }
        }
        ui.separator();
        ui.add(egui::DragValue::new(&mut app.workflow.delay).range(0.05..=60.0).speed(0.05).suffix(" s tauko ennen riviä"));
        if ui.button("Lisää tauko ennen riviä").clicked() {
            match hs_edit::script::rewrite(&app.script, line - 1, &app.workflow.expected,
                hs_edit::script::LineEdit::PauseBefore(app.workflow.delay)) {
                Ok(next) => { app.script = next; app.workflow.line = None; app.script_changed(); },
                Err(e) => app.status = e,
            }
        }
        ui.label("Tauko siirtää tämän ja myöhemmät rivit. Puheen kesto säilyy.");
        ui.separator();
        ui.label("Valitse ohje luonnokseen (korvaa saman ryhmän ohje)");
        for (title, tag) in [("Lähikuva", "[camera close up]"), ("Kaksikko", "[camera two shot]"),
            ("Katso kameraan", "[look at camera]"), ("Nyökkäys", "[nod 1s]"),
            ("Vilkutus", "[wave hello 2s]"), ("Tauko", "[wait 1s]")] {
            if ui.button(title).clicked() { app.workflow.draft = choose_command(&app.workflow.draft, tag); }
        }
        ui.separator();
        ui.label("Esikatselun laatu (ei muuta vientiä)");
        for (label, scale) in [("Kevyt", 0.5), ("Normaali", 0.75), ("Tarkka", 1.0)] {
            ui.selectable_value(&mut app.workflow.preview_scale, scale, label);
        }
    });
}

pub fn scenes(app: &mut StudioApp, ui: &mut egui::Ui) {
    let proof = hs_agents::audit::inspect(&app.production);
    ui.heading("Kohtausrivit · valitse aikajanan kohta");
    ui.label("Raahaa rivi toisen päälle: rivi ja sitä edeltävä kamerakortti siirtyvät, ajoitus lasketaan uudelleen.");
    let mut move_line = None;
    for row in proof.rows {
        let response = ui.add(egui::Label::new(format!("Rivi {} · {:.2}–{:.2} s · {}", row.line, row.start_seconds, row.end_seconds, row.source)).selectable(false).sense(egui::Sense::click_and_drag()));
        if response.clicked() { app.select_line(row.line); }
        if response.drag_started() { response.dnd_set_drag_payload(DraggedLine { line: row.line, script: app.script.clone() }); }
        if let Some(from) = response.dnd_release_payload::<DraggedLine>() { move_line = Some((from, row.line)); }
    }
    if let Some((from, target)) = move_line {
        if from.script != app.script { app.status = "Käsikirjoitus muuttui raahauksen aikana. Valitse rivi uudelleen.".into(); }
        else if let Some(expected) = hs_edit::script::line_texts(&app.script).get(from.line - 1) {
            match hs_edit::script::rewrite(&app.script, from.line - 1, expected, hs_edit::script::LineEdit::MoveSceneTo(target - 1)) {
                Ok(next) => { app.script = next; app.workflow.line = None; app.script_changed(); },
                Err(e) => app.status = e,
            }
        }
    }
}

struct DraggedLine { line: usize, script: String }

fn commands(source: &str) -> impl Iterator<Item = (usize, usize, &str)> {
    let mut offset = 0;
    std::iter::from_fn(move || {
        let start = offset + source[offset..].find('[')?;
        let end = start + source[start..].find(']')? + 1;
        offset = end; Some((start, end, &source[start + 1..end - 1]))
    })
}
fn camera_header(source: &str) -> bool {
    let mut copied = 0; let mut found = false;
    for (start, end, tag) in commands(source) {
        if !source[copied..start].trim().is_empty() || hs_script::command_category(tag) != Some("camera") { return false; }
        copied = end; found = true;
    }
    found && source[copied..].trim().is_empty()
}
fn choose_command(source: &str, command: &str) -> String {
    let category = hs_script::command_category(command.trim_matches(['[', ']']));
    let mut output = String::new(); let mut copied = 0;
    for (start, end, tag) in commands(source) {
        if category.is_some() && hs_script::command_category(tag) == category {
            output.push_str(&source[copied..start]); copied = end;
        }
    }
    output.push_str(&source[copied..]);
    format!("{} {command}", output.trim_end())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn visual_action_choice_preserves_words_and_unknown_cues() {
        let text = "KALLE: I will wait and wave. [wait 6s] [look at Maija] [unknown cue]";
        let next = choose_command(text, "[nod 1s]");
        assert!(next.contains("I will wait and wave."));
        assert!(next.contains("[look at Maija]"));
        assert!(next.contains("[unknown cue]"));
        assert!(!next.contains("[wait 6s]"));
        assert!(next.ends_with("[nod 1s]"));
        assert!(camera_header("[camera close up]"));
        assert!(!camera_header("MAIJA: Keep this dialogue. [camera close up]"));
        assert!(!camera_header("[camera close up] [prop coffee cup]"));
    }
}
