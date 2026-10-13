//! Suggestions are previews; accepting is the only source mutation.
use eframe::egui;
use hs_core::Severity;
use hs_script::assist::{self, EditProposal, LineCheck};

#[derive(Default)]
pub struct ScriptAssistState {
    pub line: usize,
    library: crate::motion_assets_ui::MotionAssetsState,
    query: String,
    source: String,
    checks: Vec<LineCheck>,
    preview: Option<EditProposal>,
    suggestions:Option<Result<Vec<EditProposal>,String>>,
    suggestion_key:Option<(usize,String)>,
    error: Option<String>,
}
impl ScriptAssistState {
    pub fn cursor(&mut self, script: &str, index: usize) {
        self.line = script.chars().take(index).filter(|c| *c == '\n').count();
    }
    pub fn ui(&mut self, ui: &mut egui::Ui, script: &str, p: &hs_agents::Production) {
        if self.source != script || self.checks.is_empty() {
            self.source = script.into();
            self.suggestion_key=None;
            match assist::inspect(script) {
                Ok(checks) => {
                    self.checks = checks;
                    self.error = None;
                }
                Err(error) => {
                    self.checks.clear();
                    self.error = Some(error);
                }
            }
        }
        self.line = self.line.min(self.checks.len().saturating_sub(1));
        let selected = self.line + 1;
        let key=(selected,self.query.clone());
        if self.suggestion_key.as_ref()!=Some(&key) {
            self.suggestions=Some(assist::completions(script,selected,&self.query));
            self.suggestion_key=Some(key);
        }
        egui::ScrollArea::vertical().id_salt("script-assist").max_height(240.0).show(ui,|ui| {
            self.library.ui(ui, script);
            egui::CollapsingHeader::new("Rivikohtainen tarkistus").show(ui,|ui| {
            ui.label("Valitse rivi tarkistaaksesi sen ohjeet. Puuttuva ääni tarkistetaan myös Vienti-välilehdellä.");
            egui::ScrollArea::vertical().id_salt("script-line-checks").max_height(120.0).show_rows(ui,ui.text_style_height(&egui::TextStyle::Body)+6.0,self.checks.len(),|ui,range| {
                for index in range {
                    let check=&self.checks[index];
                    let error=check.diagnostics.iter().any(|d|d.severity==Severity::Error);
                    let status=if error {"Virhe"}else if check.interpretation.is_some() || check.interpretation_error.is_some(){"Tarkista tulkinta"}else if check.source.trim().is_empty(){"Tyhjä"}else if check.dialogue {"Repliikki"}else {"Ohje / teksti"};
                    let color=if error {egui::Color32::LIGHT_RED}else{ui.visuals().text_color()};
                    let audio=if p.script==script {
                        p.plan.as_ref().and_then(|plan| p.voice_lines.iter().find(|line|plan.beats.get(line.beat).is_some_and(|beat|beat.line==check.line))).map(|line|line.status.finnish())
                    }else {None};
                    let label=format!("{} · {}{}",check.line,status,audio.map(|s|format!(" · {s}")).unwrap_or_default());
                    if ui.selectable_label(self.line==index,egui::RichText::new(label).color(color)).on_hover_text(&check.source).clicked() {self.line=index;self.query.clear();}
                }
            });
            });
            ui.heading(format!("Rivin {selected} ohje-ehdotukset"));
            ui.label("Ehdotus ei muuta käsikirjoitusta ennen hyväksymistä.");
            ui.horizontal(|ui| {ui.label("Etsi ohjetta");ui.text_edit_singleline(&mut self.query);});
            if let Some(check)=self.checks.get(self.line) {
                if let Some(proposal)=&check.interpretation {
                    ui.label("Teksti vastaa tunnettua toimintaohjetta. Nykyisessä muodossa se on puhetta.");
                    if ui.button("Esikatsele tulkintaehdotusta").clicked() {self.preview=Some(proposal.clone());}
                }
                if let Some(error)=&check.interpretation_error {ui.colored_label(egui::Color32::YELLOW,error);}
                for diagnostic in &check.diagnostics {
                    ui.colored_label(if diagnostic.severity==Severity::Error {egui::Color32::LIGHT_RED}else{egui::Color32::YELLOW},&diagnostic.message);
                }
            }
            match self.suggestions.as_ref().unwrap() {
                Ok(edits)=>{
                    if edits.is_empty() {ui.label("Ristiriidatonta ehdotusta ei löytynyt. Muokkaa hakua tai lähderivin ohjeita.");}
                    for edit in edits {
                        if ui.button(edit.command.as_deref().unwrap_or(&edit.reason)).on_hover_text(format!("{}\n{}",edit.reason,edit.after)).clicked() {self.preview=Some(edit.clone());}
                    }
                }
                Err(error)=>{ui.colored_label(egui::Color32::LIGHT_RED,error);},
            }
            if let Some(error)=&self.error {ui.colored_label(egui::Color32::LIGHT_RED,error);}
        });
    }
    pub fn preview(&mut self, ctx: &egui::Context, script: &str) -> Option<String> {
        let mut accepted = None;
        if let Some(proposal) = self.preview.clone() {
            egui::Modal::new(egui::Id::new("review-script-proposal"))
                .frame(egui::Frame::popup(&ctx.style()).fill(egui::Color32::from_gray(24)))
                .show(ctx, |ui| {
                    ui.set_max_width(580.0);
                    ui.heading(format!("Tarkista rivin {} muutos", proposal.line));
                    ui.label(&proposal.reason);
                    ui.label("Nykyinen rivi:");
                    ui.monospace(&proposal.before);
                    ui.label("Ehdotettu rivi:");
                    ui.monospace(&proposal.after);
                    ui.horizontal(|ui| {
                        if ui.button("Peruuta").clicked() {
                            self.preview = None;
                        }
                        if ui.button("Hyväksy muutos").clicked() {
                            match assist::apply(script, &proposal) {
                                Ok(next) => {
                                    accepted = Some(next);
                                    self.preview = None;
                                    self.query.clear();
                                    self.error = None;
                                }
                                Err(error) => {
                                    self.error = Some(error);
                                    self.preview = None;
                                }
                            }
                        }
                    });
                });
        }
        if self.preview.is_none() && accepted.is_none() {
            accepted = self.library.preview(ctx, script);
        }
        accepted
    }
}
