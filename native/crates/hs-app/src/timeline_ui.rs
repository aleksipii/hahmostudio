//! Drag a source row on the timeline; commit only a checked, explicitly accepted draft.
use crate::app::StudioApp;
use eframe::egui;

pub struct Drag {
    pub motion: bool,
    pub resize: bool,
    pub original_duration: f32,
    pub line: usize,
    pub source: String,
    pub original_start: f32,
    pub pointer_start: f32,
    pub seconds: f32,
}
pub struct Pending {
    pub motion: bool,
    pub resize: bool,
    pub line: usize,
    pub source: String,
    pub seconds: f64,
    pub result: Result<String, String>,
}
impl StudioApp {
    pub fn preview_retime(&mut self, drag: Drag) {
        let check = match (drag.motion, drag.resize) {
            (true, true) => hs_agents::timing_edit::checked_motion_duration,
            (true, false) => hs_agents::timing_edit::checked_motion_start,
            (false, true) => hs_agents::timing_edit::checked_duration,
            (false, false) => hs_agents::timing_edit::checked_retime,
        };
        let result = check(
            &self.production,
            &drag.source,
            drag.line,
            drag.seconds as f64,
        );
        self.workflow.pending_timing = Some(Pending {
            motion: drag.motion,
            resize: drag.resize,
            line: drag.line,
            source: drag.source,
            seconds: drag.seconds as f64,
            result,
        });
    }
}
pub fn confirmation(app: &mut StudioApp, ctx: &egui::Context) {
    scene_confirmation(app, ctx);
    let Some(mut pending) = app.workflow.pending_timing.take() else {
        return;
    };
    let mut keep = true;
    egui::Modal::new(egui::Id::new("timeline-retime")).show(ctx, |ui| {
        ui.set_max_width(560.0);
        ui.heading(format!("Rivin {} ajoitusluonnos", pending.line));
        ui.label(format!("Uusi {} {:.3} s. Muutos koskee {}. Puhetta ei nopeuteta tai leikata. Myöhemmät oletusajoitukset voivat muuttua.", if pending.resize {"kesto"} else {"alkuaika"}, pending.seconds, if pending.motion {"vain liikettä; puheen alkuaika ja ääni säilyvät"} else {"vain repliikkiä; liikkeen alkuaika ja kesto säilyvät"}));
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
                let check = match (pending.motion,pending.resize) {
                    (true,true)=>hs_agents::timing_edit::checked_motion_duration,
                    (true,false)=>hs_agents::timing_edit::checked_motion_start,
                    (false,true)=>hs_agents::timing_edit::checked_duration,
                    (false,false)=>hs_agents::timing_edit::checked_retime,
                };
                pending.result = check(&app.production, &pending.source, pending.line, pending.seconds);
                if let Ok(source) = &pending.result {
                    app.script = source.clone(); app.script_changed(); app.workflow.line = None;
                    if !pending.resize {app.time = pending.seconds as f32;} app.status = "Ajoitus hyväksytty; Kumoa palauttaa muutoksen.".into(); keep = false;
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SceneKind {
    Camera,
    Background,
}
impl SceneKind {
    fn label(self) -> &'static str {
        match self {
            Self::Camera => "kamera",
            Self::Background => "tausta",
        }
    }
}
#[derive(Clone)]
struct SceneDrag {
    kind: SceneKind,
    line: usize,
    source: String,
    start: f32,
    pointer_x: f32,
    preview: f32,
}
#[derive(Clone)]
enum SceneEdit {
    Cue {
        kind: SceneKind,
        line: usize,
        seconds: f64,
    },
    Group {
        lines: Vec<usize>,
        delta: f64,
    },
}
#[derive(Clone)]
struct ScenePending {
    source: String,
    edit: SceneEdit,
    result: Result<String, String>,
}
#[derive(Default, Clone)]
struct GroupSelection {
    text: String,
    delta: f64,
    error: Option<String>,
}
fn scene_drag_id() -> egui::Id {
    egui::Id::new("koeta-scene-drag")
}
fn scene_pending_id() -> egui::Id {
    egui::Id::new("koeta-scene-pending")
}
fn group_selection_id() -> egui::Id {
    egui::Id::new("koeta-group-selection")
}
pub fn scene_pending(ctx: &egui::Context) -> bool {
    ctx.data(|d| d.get_temp::<ScenePending>(scene_pending_id()).is_some())
}
pub struct SceneInteraction {
    pub handled: bool,
    pub preview_start: Option<f32>,
}
/// Panels supply the existing clip response and pixels-per-second; this owns only the drag draft.
/// No action-clock or source mutation occurs before the common confirmation/recheck path.
pub fn handle_scene_drag(
    app: &mut StudioApp,
    ctx: &egui::Context,
    response: &egui::Response,
    kind: SceneKind,
    line: usize,
    start: f32,
    pixels_per_second: f32,
) -> SceneInteraction {
    let mut handled = false;
    if response.clicked() {
        if !ctx.input(|input| input.modifiers.command || input.modifiers.ctrl) {
            app.select_line(line);
            app.time = start;
        }
        handled = true;
    }
    if response.drag_started()
        && !scene_pending(ctx)
        && !app.review.locked
        && !crate::project_ui::busy(app)
    {
        let pointer_x = ctx
            .input(|input| input.pointer.press_origin())
            .map_or(response.rect.left(), |p| p.x);
        app.playing = false;
        app.select_line(line);
        ctx.data_mut(|d| {
            d.insert_temp(
                scene_drag_id(),
                SceneDrag {
                    kind,
                    line,
                    source: app.script.clone(),
                    start,
                    pointer_x,
                    preview: start,
                },
            )
        });
        handled = true;
    }
    let mut drag = ctx.data(|d| d.get_temp::<SceneDrag>(scene_drag_id()));
    let mut preview_start = None;
    if let Some(current) = drag.as_mut().filter(|d| d.line == line && d.kind == kind) {
        preview_start = Some(current.preview);
        if response.dragged() || response.drag_stopped() {
            handled = true;
            if let Some(pos) = ctx.input(|input| input.pointer.latest_pos()) {
                let seconds =
                    current.start + (pos.x - current.pointer_x) / pixels_per_second.max(0.001);
                let fps = app.production.fps.0.max(1) as f32;
                current.preview = ((seconds.max(0.0) * fps).round() / fps).min(59.5);
                app.time = current.preview.min(app.duration());
                preview_start = Some(current.preview);
            }
            if response.drag_stopped() {
                let edit = SceneEdit::Cue {
                    kind,
                    line,
                    seconds: current.preview as f64,
                };
                let result = check_scene_edit(app, &current.source, &edit);
                ctx.data_mut(|d| {
                    d.remove::<SceneDrag>(scene_drag_id());
                    d.insert_temp(
                        scene_pending_id(),
                        ScenePending {
                            source: current.source.clone(),
                            edit,
                            result,
                        },
                    );
                });
            } else {
                ctx.data_mut(|d| d.insert_temp(scene_drag_id(), current.clone()));
            }
        }
    }
    if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        ctx.data_mut(|d| d.remove::<SceneDrag>(scene_drag_id()));
        preview_start = None;
    }
    SceneInteraction {
        handled,
        preview_start,
    }
}
fn selected_lines(text: &str) -> Result<Vec<usize>, String> {
    let mut selected = std::collections::BTreeSet::new();
    for part in text
        .split(|c: char| c == ',' || c.is_whitespace())
        .filter(|p| !p.is_empty())
    {
        if let Some((start, end)) = part.split_once('-') {
            let start = start
                .parse::<usize>()
                .map_err(|_| "Virheellinen riviväli")?;
            let end = end.parse::<usize>().map_err(|_| "Virheellinen riviväli")?;
            if start == 0 || end < start || end - start >= 1000 {
                return Err("Riviväli: 1–1000 riviä, kasvavassa järjestyksessä.".into());
            }
            selected.extend(start..=end);
        } else {
            let line = part
                .parse::<usize>()
                .map_err(|_| "Kirjoita rivinumerot pilkuilla, esimerkiksi 3,5-7.")?;
            if line == 0 {
                return Err("Rivinumerot alkavat yhdestä.".into());
            }
            selected.insert(line);
        }
        if selected.len() > 1000 {
            return Err("Valitse enintään 1000 riviä.".into());
        }
    }
    if selected.is_empty() {
        return Err("Valitse vähintään yksi toimintorivi.".into());
    }
    Ok(selected.into_iter().collect())
}
pub fn toggle_group_line(ctx: &egui::Context, line: usize) {
    let mut selection = ctx
        .data(|d| d.get_temp::<GroupSelection>(group_selection_id()))
        .unwrap_or_default();
    let mut lines = selected_lines(&selection.text).unwrap_or_default();
    if let Some(index) = lines.iter().position(|selected| *selected == line) {
        lines.remove(index);
    } else {
        lines.push(line);
        lines.sort_unstable();
    }
    selection.text = lines
        .iter()
        .map(usize::to_string)
        .collect::<Vec<_>>()
        .join(",");
    selection.error = None;
    ctx.data_mut(|d| d.insert_temp(group_selection_id(), selection));
}
/// Explicit line selection also works by keyboard, without requiring pixel-precise multi-selection.
pub fn group_controls(app: &mut StudioApp, ui: &mut egui::Ui) {
    let ctx = ui.ctx().clone();
    let mut selected = ctx
        .data(|d| d.get_temp::<GroupSelection>(group_selection_id()))
        .unwrap_or_default();
    ui.horizontal(|ui| {
        ui.label("Ryhmä · rivit");
        ui.add(egui::TextEdit::singleline(&mut selected.text).desired_width(105.0).hint_text("3,5-7"));
        ui.add(egui::DragValue::new(&mut selected.delta).speed(0.1).range(-59.5..=59.5).prefix("Siirto ").suffix(" s"));
        let enabled = !app.review.locked && !crate::project_ui::busy(app) && !app.image.is_busy() && app.script == app.production.script && app.pipeline_error.is_none() && app.export.is_none() && app.voice.recorder.is_none() && app.workflow.pending_timing.is_none() && !scene_pending(&ctx);
        if ui.add_enabled(enabled, egui::Button::new("Tarkista ryhmä")).on_hover_text("Valitse rivit Ctrl/⌘-napsauttamalla tai kirjoita numerot. Siirto koskee valittujen rivien puhetta ja liikettä sekä valittuja erillisiä kuva-/taustaohjeita.").clicked() {
            match selected_lines(&selected.text) {
                Ok(lines) => {
                    let edit = SceneEdit::Group {lines,delta:selected.delta};
                    let source = app.script.clone();
                    let result = check_scene_edit(app, &source, &edit);
                    ctx.data_mut(|d| d.insert_temp(scene_pending_id(), ScenePending {source,edit,result}));
                    selected.error = None;
                }
                Err(error) => selected.error = Some(error),
            }
        }
    });
    if let Some(error) = &selected.error {
        ui.colored_label(egui::Color32::LIGHT_RED, error);
    }
    ctx.data_mut(|d| d.insert_temp(group_selection_id(), selected));
}
fn check_scene_edit(app: &StudioApp, source: &str, edit: &SceneEdit) -> Result<String, String> {
    if app.review.locked {
        return Err("Jakso on lukittu. Avaa lukitus ennen ajoituksen muuttamista.".into());
    }
    if crate::project_ui::busy(app)
        || app.export.is_some()
        || app.voice.recorder.is_some()
        || app.image.is_busy()
    {
        return Err(
            "Odota tallennuksen, viennin tai äänityksen valmistumista ennen ajoitusmuutosta."
                .into(),
        );
    }
    match edit {
        SceneEdit::Cue { line, seconds, .. } => hs_agents::scene_timing_edit::checked_scene_retime(
            &app.production,
            source,
            *line,
            *seconds,
        ),
        SceneEdit::Group { lines, delta } => hs_agents::scene_timing_edit::checked_shift_lines(
            &app.production,
            source,
            lines,
            *delta,
        ),
    }
}
fn scene_confirmation(app: &mut StudioApp, ctx: &egui::Context) {
    let Some(mut pending) = ctx.data(|d| d.get_temp::<ScenePending>(scene_pending_id())) else {
        return;
    };
    let mut keep = true;
    egui::Modal::new(egui::Id::new("scene-timing-confirmation")).show(ctx, |ui| {
        ui.set_max_width(620.0);
        match &pending.edit {
            SceneEdit::Cue {kind,line,seconds} => {ui.heading(format!("Rivin {line} {}luonnos",kind.label()));ui.label(format!("Uusi alku {seconds:.3} s. Puhe ja liike säilyvät; kuva-/taustavaihtojen rajat tarkistetaan."));}
            SceneEdit::Group {lines,delta} => {ui.heading("Ryhmän ajoitusluonnos");ui.label(format!("Rivit {} · siirto {delta:+.3} s. Valittujen rivien puhe ja liike siirtyvät yhdessä; muut toimintorivit ankkuroidaan nykyiseen ajoitukseensa.",lines.iter().map(usize::to_string).collect::<Vec<_>>().join(", ")));}
        }
        if app.script != pending.source {pending.result = Err("Käsikirjoitus muuttui: peruuta ja valitse uudelleen.".into());}
        match &pending.result {
            Ok(next) => {
                let originals = hs_edit::script::line_texts(&pending.source);
                egui::ScrollArea::vertical().max_height(180.0).show(ui, |ui| {
                    for (i,row) in hs_edit::script::line_texts(next).iter().enumerate() {
                        if originals.get(i) != Some(row) {ui.monospace(format!("{}: {row}",i+1));}
                    }
                });
                ui.label("Luonnos tarkistettu nykyisillä tallennetuilla äänillä ja kontakteilla. Hyväksyntä tarkistaa tilanteen uudelleen.");
            }
            Err(error) => {ui.colored_label(egui::Color32::LIGHT_RED,error);}
        }
        ui.horizontal(|ui| {
            if ui.button("Peruuta").clicked() {keep=false;}
            if ui.add_enabled(pending.result.is_ok(), egui::Button::new("Hyväksy ajoitus")).clicked() {
                pending.result = check_scene_edit(app,&pending.source,&pending.edit);
                if let Ok(source) = &pending.result {
                    app.script = source.clone();app.script_changed();app.workflow.line=None;
                    if let SceneEdit::Cue {seconds,..} = &pending.edit {app.time=*seconds as f32;}
                    app.status="Ajoitus hyväksytty; Kumoa palauttaa koko muutoksen.".into();keep=false;
                }
            }
            let line = pending.result.as_ref().err().and_then(|error| error.split_once("Rivi "))
                .and_then(|(_,rest)|rest.split(':').next()).and_then(|line|line.parse::<usize>().ok());
            if let Some(line) = line {if ui.button(format!("Näytä virherivi {line}")).clicked() {app.select_line(line);keep=false;}}
        });
    });
    ctx.data_mut(|d| {
        if keep {
            d.insert_temp(scene_pending_id(), pending);
        } else {
            d.remove::<ScenePending>(scene_pending_id());
        }
    });
}
