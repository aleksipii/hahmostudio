use crate::app::{LeftTab, StudioApp, EXAMPLE};
use crate::export_job::{ExportJob, ExportVoice};
use eframe::egui::{self, Color32, RichText, Stroke};
use hs_agents::agents::cinematography::ShotKind;
use hs_agents::{Backend, RenderRequest, Slot};
use hs_character::{CharacterParams, ClothingStyle, HairStyle, HatStyle, RenderStyle};
use hs_core::{EventKind, Severity, TrackKind};

const ACCENT: Color32 = Color32::from_rgb(0xf2, 0xc2, 0x30);

pub fn menu_bar(app: &mut StudioApp, ctx: &egui::Context) {
    egui::TopBottomPanel::top("valikko").show(ctx, |ui| {
        egui::menu::bar(ui, |ui| {
            ui.menu_button("Tiedosto", |ui| {
                crate::project_ui::menu(app, ui);
                ui.separator();
                if ui.button("Uusi käsikirjoitus").clicked() {
                    app.script_assist=Default::default();
                    app.script = EXAMPLE.into();
                    app.script_path = None;
                    app.legacy = None;
                    app.pipeline.mark_dirty(Slot::Script);
                    app.run_pipeline();
                    ui.close_menu();
                }
                if ui.button("Avaa käsikirjoitus…").clicked() {
                    ui.close_menu();
                    if let Some(p) = rfd::FileDialog::new().add_filter("Käsikirjoitus", &["txt", "md"]).pick_file() {
                        app.open_script(p);
                    }
                }
                if ui.button("Tallenna käsikirjoitus…").clicked() {
                    ui.close_menu();
                    if let Some(p) = rfd::FileDialog::new().set_file_name("kasikirjoitus.txt").save_file() {
                        app.save_script(p);
                    }
                }
                ui.separator();
                if ui.button("Avaa 2D-projekti (.hahmo)…").clicked() {
                    ui.close_menu();
                    if let Some(p) = rfd::FileDialog::new().add_filter("Hahmostudio", &["hahmo"]).pick_file() {
                        app.open_hahmo(p);
                    }
                }
                ui.separator();
                let can_export = app.pipeline_error.is_none() && app.production.script==app.script && hs_agents::audit::inspect(&app.production).allowed() && app.voice.recorder.is_none() && app.export.is_none() && app.production.plan.as_ref().is_some_and(|p| p.is_assemblable());
                if ui.add_enabled(can_export && (app.production.allow_silent_export || app.production.voice_lines.iter().all(|l| l.speech.is_some())), egui::Button::new("Vie MP4…")).clicked() {
                    ui.close_menu();
                    if let Some(p) = rfd::FileDialog::new().set_file_name("jakso.mp4").save_file() {
                        start_export(app, RenderRequest::Mp4(p));
                    }
                }
                if ui.add_enabled(can_export, egui::Button::new("Vie PNG-sarja…")).clicked() {
                    ui.close_menu();
                    if let Some(p) = rfd::FileDialog::new().pick_folder() {
                        start_export(app, RenderRequest::PngSequence(p));
                    }
                }
                if ui.add_enabled(can_export, egui::Button::new("Vie nykyinen ruutu PNG:ksi…")).clicked() {
                    ui.close_menu();
                    if let Some(p) = rfd::FileDialog::new().set_file_name("ruutu.png").save_file() {
                        start_export(app, RenderRequest::Still { frame: app.frame(), path: p });
                    }
                }
                ui.separator();
                if ui.button("Lopeta").clicked() {
                    ui.close_menu();
                    ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close);
                }
            });
            ui.menu_button("Muokkaa", |ui| {
                if ui.add_enabled(app.history.can_undo(), egui::Button::new("Kumoa ⌘Z")).clicked() { app.undo_edit(false); ui.close_menu(); }
                if ui.add_enabled(app.history.can_redo(), egui::Button::new("Tee uudelleen ⌘⇧Z")).clicked() { app.undo_edit(true); ui.close_menu(); }
                if ui.button("Tyhjennä yhteinen kumoushistoria").clicked() { app.history = Default::default(); app.observe_edits(); ui.close_menu(); }
            });
            ui.menu_button("Toisto", |ui| {
                if ui.button(if app.playing { "Pysäytä (välilyönti)" } else { "Toista (välilyönti)" }).clicked() {
                    app.playing = !app.playing;
                    ui.close_menu();
                }
                ui.checkbox(&mut app.looping, "Toista silmukassa");
                if ui.button("Alkuun").clicked() {
                    app.time = 0.0;
                    ui.close_menu();
                }
            });
            ui.menu_button("Ohje", |ui| {
                if ui.button("Tietoja Hahmostudiosta").clicked() {
                    app.show_about = true;
                    ui.close_menu();
                }
            });
        });
    });
}

pub fn start_export(app: &mut StudioApp, request: RenderRequest) {
    if app.voice.recorder.is_some() || app.export.is_some() {
        app.status = "Lopeta äänitys tai nykyinen vienti ennen uutta vientiä.".into();
        return;
    }
    let backend = if app.viewport.is_gpu() { Backend::Auto } else { Backend::Cpu };
    // Vienti käyttää mallia suoraan (odottaa puheen valmistumisen), ei käyttöliittymän taustajonoa.
    let voice = ExportVoice {
        fps: Some(app.production.fps),
        allow_silent: app.production.allow_silent_export,
        recorded_lines: app.production.recorded_lines.clone(),
        soundtrack: app.production.soundtrack.clone(),
        caption_settings: app.production.caption_settings.clone(),
        caption_overrides: app.production.caption_overrides.clone(),
        engine: app.voice.engine.as_ref().map(|bg| bg.inner()),
        cache: app.production.speech_cache.clone(),
        own_audio: app.production.own_audio.clone(),
        saved_speech: app.production.saved_speech.clone(),
        accepted_notices: app.production.accepted_notices.clone(),
    };
    app.export = Some(ExportJob::start(app.script.clone(), app.production.cast_params.clone(), voice, request, backend, (app.production.width, app.production.height)));
    app.status = "Vienti käynnissä…".into();
}

pub fn status_bar(app: &mut StudioApp, ctx: &egui::Context) {
    egui::TopBottomPanel::bottom("tila").show(ctx, |ui| {
        ui.horizontal(|ui| {
            if let Some(job) = &app.export {
                ui.add(egui::ProgressBar::new(job.progress()).desired_width(220.0).show_percentage());
                ui.label(format!("Viedään {}", job.label));
                if ui.button("Peruuta").clicked() {
                    job.cancel.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            } else {
                ui.label(&app.status);
            }
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.label(RichText::new(format!("{} · {:.1} ms/ruutu", app.viewport.backend_name, app.viewport.last_ms)).weak());
            });
        });
    });
}

fn track_label(track: TrackKind) -> &'static str {
    match track {
        TrackKind::Dialogue => "Puhe",
        TrackKind::Motion => "Liike",
        TrackKind::Camera => "Kamera",
        TrackKind::Environment => "Tausta",
    }
}

fn event_text(kind: &EventKind) -> String {
    match kind {
        EventKind::WorldObject { object } => format!("Esine {}", object.id),
        EventKind::ObjectContact { character, contact } => match contact {
            hs_core::ObjectContact::PickUp { object } => format!("{}: Nosto · {object}",character.as_deref().unwrap_or("Hahmo")),
            hs_core::ObjectContact::Give { object, recipient } => format!("{object} -> {recipient}"),
        },
        EventKind::Dialogue { speaker, text } => match speaker {
            Some(s) => format!("{s}: {text}"),
            None => text.clone(),
        },
        EventKind::Motion { motion, character } => match character {
            Some(c) => format!("{c}: {}", motion.finnish_name()),
            None => motion.finnish_name().to_string(),
        },
        EventKind::Background { id } => id.clone(),
        EventKind::CharacterView { view, character } => format!("{}: suunta {view:?}",character.as_deref().unwrap_or("päähenkilö")),
        EventKind::Phone { view, character } => format!("{}: puhelin {view:?}",character.as_deref().unwrap_or("päähenkilö")),
        EventKind::Prop { character, item } => format!("{}esine {}", character.as_ref().map(|c| format!("{c}: ")).unwrap_or_default(), item.as_deref().unwrap_or("pois")),
        EventKind::Camera { hint } => format!("Kuva {hint:?}"),
        EventKind::Expression {expression,..}=>format!("Ilme {expression:?}"),
        EventKind::LookAt {target,..}=>format!("Katse {target:?}"),
    }
}

pub fn timeline(app: &mut StudioApp, ctx: &egui::Context) {
    egui::TopBottomPanel::bottom("aikajana").resizable(true).default_height(300.0).min_height(120.0).show(ctx, |ui| {
        ui.horizontal(|ui| {
            if ui.button(if app.playing { "⏸ Pysäytä" } else { "▶ Toista" }).clicked() {
                app.playing = !app.playing;
            }
            if ui.button("⏮").on_hover_text("Alkuun").clicked() {
                app.time = 0.0;
            }
            let d = app.duration();
            ui.label(RichText::new(format!("{:05.2} / {:05.2} s · ruutu {} / {}", app.time, d, app.frame(), app.production.frame_count())).monospace());
            if let Some(cam) = &app.production.camera {
                if let Some(s) = cam.shot_at(app.time) {
                    ui.separator();
                    ui.label(format!("Otos: {}", s.kind.finnish()));
                }
            }
        });
        let Some(tl) = app.production.timeline.clone() else { return };
        let episode_duration = tl.duration.seconds().max(0.1) as f32;
        let duration = (episode_duration + 2.0).min(60.0);
        type Clip = (f32, f32, String, Color32, Option<usize>);
        let rows: Vec<(String, Vec<Clip>)> = {
            let mut rows = Vec::new();
            for track in [TrackKind::Dialogue, TrackKind::Motion, TrackKind::Environment] {
                let color = match track {
                    TrackKind::Dialogue => Color32::from_rgb(0x4e, 0x8c, 0xc2),
                    TrackKind::Motion => Color32::from_rgb(0x5d, 0xa8, 0x6c),
                    _ => Color32::from_rgb(0x8c, 0x6c, 0xb8),
                };
                if matches!(track, TrackKind::Dialogue | TrackKind::Motion) {
                    for (index, member) in app.production.cast.iter().enumerate() {
                        let name = &member.character.params.name;
                        let items = tl.on_track(track).filter(|e| match &e.kind {
                            EventKind::Dialogue { speaker, .. } | EventKind::Motion { character: speaker, .. }
                            | EventKind::ObjectContact { character: speaker, .. }
                            | EventKind::LookAt { character: speaker, .. } | EventKind::Expression { character: speaker, .. } =>
                                speaker.as_ref().map_or(index == 0, |s| s.eq_ignore_ascii_case(name)),
                            _ => false,
                        }).filter(|e| !matches!(e.kind, EventKind::Motion { motion: hs_core::MotionKind::Wait, .. }) || !tl.events.iter().any(|other| other.start == e.start && other.source.line == e.source.line && matches!(other.kind, EventKind::ObjectContact { .. }))).map(|e| (e.start.seconds() as f32, e.end().seconds() as f32, event_text(&e.kind), color, Some(e.source.line))).collect();
                        rows.push((format!("{} · {name}", track_label(track)), items));
                    }
                } else {
                    let items = tl.on_track(track).filter(|e| !matches!(e.kind, EventKind::WorldObject { .. })).map(|e| (e.start.seconds() as f32, e.end().seconds() as f32, event_text(&e.kind), color, None)).collect();
                    rows.push((track_label(track).to_string(), items));
                }
            }
            if let Some(cam) = &app.production.camera {
                let items = cam
                    .shots
                    .iter()
                    .map(|s| {
                        let c = match s.kind {
                            ShotKind::Wide => Color32::from_rgb(0xc2, 0x7c, 0x3a),
                            ShotKind::Full => Color32::from_rgb(0xb8, 0x6a, 0x2a),
                            ShotKind::Medium => Color32::from_rgb(0xa8, 0x5a, 0x4a),
                            ShotKind::CloseUp => Color32::from_rgb(0x98, 0x4a, 0x5a),
                            ShotKind::Insert => Color32::from_rgb(0x7a, 0x4a, 0x8a),
                            ShotKind::TwoShot => Color32::from_rgb(0x4a, 0x7a, 0x8a),
                            ShotKind::OverShoulder => Color32::from_rgb(0x3a, 0x6a, 0x9a),
                            ShotKind::LowAngle => Color32::from_rgb(0x5a, 0x8a, 0x4a),
                            ShotKind::HighAngle => Color32::from_rgb(0x4a, 0x8a, 0x6a),
                        };
                        (s.start, s.end, format!("{}{}", s.kind.finnish(), if s.tracking { " · seuranta" } else { "" }), c, None)
                    })
                    .collect();
                rows.insert(2, ("Kamera".to_string(), items));
            }
            rows
        };
        let label_w = 110.0;
        let row_h = 26.0;
        let (rect, response) = ui.allocate_exact_size(egui::vec2(ui.available_width(), row_h * rows.len() as f32 + 18.0), egui::Sense::click_and_drag());
        let painter = ui.painter_at(rect);
        let lane = egui::Rect::from_min_max(egui::pos2(rect.left() + label_w, rect.top() + 18.0), rect.max);
        let x_of = |t: f32| lane.left() + t / duration * lane.width();
        // Sekuntiviivain.
        let step = if duration > 30.0 { 5.0 } else if duration > 10.0 { 2.0 } else { 1.0 };
        let mut s = 0.0;
        while s <= duration {
            let x = x_of(s);
            painter.line_segment([egui::pos2(x, rect.top() + 12.0), egui::pos2(x, rect.bottom())], Stroke::new(1.0_f32, ui.visuals().faint_bg_color.gamma_multiply(2.0)));
            painter.text(egui::pos2(x + 2.0, rect.top()), egui::Align2::LEFT_TOP, format!("{s:.0}s"), egui::FontId::proportional(11.0), ui.visuals().weak_text_color());
            s += step;
        }
        let can_edit = app.script == app.production.script && app.pipeline_error.is_none() && app.workflow.pending_timing.is_none() && app.export.is_none() && app.voice.recorder.is_none();
        let mut clip_handled = false;
        let mut dropped = None;
        for (i, (name, items)) in rows.iter().enumerate() {
            let y = lane.top() + i as f32 * row_h;
            painter.text(egui::pos2(rect.left() + 4.0, y + row_h * 0.5), egui::Align2::LEFT_CENTER, name, egui::FontId::proportional(13.0), ui.visuals().text_color());
            for (clip_index, (a, b, text, color, line)) in items.iter().enumerate() {
                let r = egui::Rect::from_min_max(egui::pos2(x_of(*a) + 1.0, y + 3.0), egui::pos2(x_of(*b) - 1.0, y + row_h - 3.0));
                if let Some(line) = line.filter(|_| can_edit) {
                    let hit = ui.interact(r, ui.id().with(("timing-clip", i, clip_index)), egui::Sense::click_and_drag());
                    if hit.clicked() { app.select_line(line); clip_handled = true; }
                    if hit.drag_started() {
                        app.select_line(line); app.playing = false;
                        let pointer_start = ctx.input(|input| input.pointer.press_origin()).map_or(r.left(), |p| p.x);
                        let resize = pointer_start >= r.right() - 10.0;
                        let original_duration = *b - *a;
                        app.workflow.timeline_drag = Some(crate::timeline_ui::Drag { resize, original_duration, line, source: app.script.clone(), original_start: *a, pointer_start, seconds: if resize {original_duration} else {*a} });
                    }
                    if hit.dragged() || hit.drag_stopped() {
                        clip_handled = true;
                        if let Some(drag) = app.workflow.timeline_drag.as_mut().filter(|drag| drag.line == line) {
                            if let Some(pos) = ctx.input(|input| input.pointer.latest_pos()) {
                                let time = if drag.resize {drag.original_duration} else {drag.original_start} + (pos.x - drag.pointer_start) / lane.width() * duration;
                                let fps = app.production.fps.0.max(1) as f32;
                                drag.seconds = ((time.max(if drag.resize {0.5} else {0.0}) * fps).round() / fps).min(if drag.resize {20.0} else {59.5});
                                app.time = (if drag.resize {drag.original_start + drag.seconds} else {drag.seconds}).min(episode_duration);
                            }
                        }
                        if hit.drag_stopped() { dropped = app.workflow.timeline_drag.take(); }
                    }
                    hit.on_hover_text("Raahaa korttia siirtääksesi alkuaikaa tai sen oikeaa reunaa muuttaaksesi kestoa. Pudotus näyttää tarkistetun luonnoksen.");
                }
                painter.rect_filled(r, 4.0, *color);
                if line.is_some() {painter.line_segment([egui::pos2(r.right()-4.0,r.top()+3.0),egui::pos2(r.right()-4.0,r.bottom()-3.0)],Stroke::new(1.0_f32, Color32::WHITE));}
                if let Some(drag) = app.workflow.timeline_drag.as_ref().filter(|drag| Some(drag.line) == *line) {
                    let mut ghost = r;
                    if drag.resize {ghost.max.x = x_of(*a + drag.seconds);} else {ghost = r.translate(egui::vec2((drag.seconds - *a) / duration * lane.width(), 0.0));}
                    painter.rect_stroke(ghost, 4.0, Stroke::new(2.0_f32, ACCENT), egui::StrokeKind::Inside);
                    painter.text(ghost.left_top(), egui::Align2::LEFT_BOTTOM, format!("{:.3} s", drag.seconds), egui::FontId::proportional(12.0), ACCENT);
                }
                let galley = painter.layout_no_wrap(text.clone(), egui::FontId::proportional(12.0), Color32::WHITE);
                let clip = painter.with_clip_rect(r.shrink(2.0));
                clip.galley(egui::pos2(r.left() + 5.0, r.center().y - galley.size().y * 0.5), galley, Color32::WHITE);
            }
        }
        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) { app.workflow.timeline_drag = None; dropped = None; }
        if let Some(drag) = dropped { app.preview_retime(drag); }
        // Toistopää.
        let x = x_of(app.time);
        painter.line_segment([egui::pos2(x, rect.top() + 12.0), egui::pos2(x, rect.bottom())], Stroke::new(2.0_f32, ACCENT));
        if let Some(pos) = response.interact_pointer_pos() {
            if !clip_handled && app.workflow.timeline_drag.is_none() && (response.dragged() || response.clicked()) {
                app.time = ((pos.x - lane.left()) / lane.width() * duration).clamp(0.0, episode_duration);
                app.playing = false;
                let index = ((pos.y - lane.top()) / row_h).max(0.0) as usize;
                let actor = rows.get(index).and_then(|(name, _)| name.strip_prefix("Puhe · ").or_else(|| name.strip_prefix("Liike · ")));
                if let Some(row) = hs_agents::audit::inspect(&app.production).rows.iter().find(|r| r.start_seconds <= app.time as f64 && (app.time as f64) < r.end_seconds && actor.map_or(true, |name| r.actor.as_ref().is_some_and(|s| s.eq_ignore_ascii_case(name)))) { let time = app.time; app.select_line(row.line); app.time = time; }
            }
        }
    });
}

pub fn script_panel(app: &mut StudioApp, ctx: &egui::Context) {
    egui::SidePanel::left("kasikirjoitus").resizable(true).default_width(380.0).min_width(260.0).show(ctx, |ui| {
        ui.horizontal(|ui| {
            ui.selectable_value(&mut app.left_tab, LeftTab::Script, "Käsikirjoitus");
            ui.selectable_value(&mut app.left_tab, LeftTab::Voice, "Ääni");
            ui.selectable_value(&mut app.left_tab, LeftTab::Performance, "Esitys");
            ui.selectable_value(&mut app.left_tab, LeftTab::Image, "Kuva");
            ui.selectable_value(&mut app.left_tab, LeftTab::Edit, "Leikkaus");
            ui.selectable_value(&mut app.left_tab, LeftTab::Export, "Vienti");
        });
        ui.separator();
        match app.left_tab {
            LeftTab::Script => script_tab(app, ui),
            LeftTab::Voice => crate::voice_ui::voice_tab(app, ui),
            LeftTab::Performance => crate::voice_ui::performance_tab(app, ui),
            LeftTab::Image | LeftTab::Edit | LeftTab::Export => { ui.label("Työtila avautuu keskialueelle."); },
        }
    });
}

fn script_tab(app: &mut StudioApp, ui: &mut egui::Ui) {
    {
        ui.heading("Käsikirjoitus");
        ui.label(RichText::new("Englanninkielinen puhe: NAME: dialogue. Ohjeet hakasulkeissa: [walk left 2s], [wave hello], [camera close up], [emotion cheerful]. Ohjehaku ja rivitarkistus ovat editorin alla.").weak().small());
        ui.add_space(4.0);
        let errors: Vec<_> = app.production.diagnostics.iter().filter(|d| d.severity != Severity::Info).cloned().collect();
        let editor_h = (ui.available_height() - 315.0).max(130.0);
        egui::ScrollArea::vertical().max_height(editor_h).show(ui, |ui| {
            let edit = egui::TextEdit::multiline(&mut app.script).code_editor().desired_width(f32::INFINITY).desired_rows(18).lock_focus(true);
            let output=edit.show(ui);
            if output.response.has_focus() {
                if let Some(range)=output.cursor_range {app.script_assist.cursor(&app.script,range.primary.ccursor.index);}
            }
            if output.response.changed() {app.script_changed();}
        });
        ui.separator();
        if errors.is_empty() {
            if let Some(plan) = &app.production.plan {
                ui.label(RichText::new(format!("{} repliikki-/toimintariviä, {:.1} s · ohjetarkistus valmis", plan.beats.len(), plan.seconds)).color(Color32::from_rgb(0x5d, 0xa8, 0x6c)));
            }
        } else {
            egui::ScrollArea::vertical().id_salt("huomautukset").max_height(140.0).show(ui, |ui| {
                for d in errors {
                    let color = if d.severity == Severity::Error { Color32::from_rgb(0xe0, 0x6c, 0x5a) } else { Color32::from_rgb(0xd8, 0xa8, 0x3a) };
                    if ui.button(RichText::new(format!("Rivi {}: {}", d.line, d.message)).color(color)).clicked() { app.select_line(d.line); }
                }
            });
        }
        app.script_assist.ui(ui,&app.script,&app.production);
        if let Some(e) = &app.pipeline_error {
            ui.label(RichText::new(e).color(Color32::from_rgb(0xe0, 0x6c, 0x5a)));
        }
    }
}

fn color_row(ui: &mut egui::Ui, label: &str, c: &mut [u8; 3]) -> bool {
    ui.horizontal(|ui| {
        ui.label(label);
        ui.color_edit_button_srgb(c).changed()
    })
    .inner
}

pub fn cast_panel(app: &mut StudioApp, ctx: &egui::Context) {
    egui::SidePanel::right("hahmot").resizable(true).default_width(300.0).min_width(240.0).max_width(400.0).show(ctx, |ui| {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.heading("Hahmot");
            app.ensure_cast_params();
            let names: Vec<String> = app.production.cast.iter().map(|c| c.character.params.name.clone()).collect();
            if names.is_empty() {
                ui.label("Ei hahmoja.");
            } else {
                app.selected_cast = app.selected_cast.min(names.len() - 1);
                ui.horizontal_wrapped(|ui| {
                    for (i, n) in names.iter().enumerate() {
                        ui.selectable_value(&mut app.selected_cast, i, n);
                    }
                });
                let name = names[app.selected_cast].clone();
                let Some(idx) = app.production.cast_params.iter().position(|c| c.name == name) else { return };
                let mut changed = false;
                {
                    let p: &mut CharacterParams = &mut app.production.cast_params[idx];
                    ui.add_space(4.0);
                    let voice_name = |v: &Option<String>| match v {
                        Some(id) => hs_voice::spoken::VOICES.iter().find(|(i, _)| i == id).map_or(id.clone(), |(_, n)| n.to_string()),
                        None => "ei ääntä".to_string(),
                    };
                    egui::ComboBox::from_label("ääni").selected_text(voice_name(&p.voice)).show_ui(ui, |ui| {
                        changed |= ui.selectable_value(&mut p.voice, None, "ei ääntä").changed();
                        for (id, n) in hs_voice::spoken::VOICES {
                            changed |= ui.selectable_value(&mut p.voice, Some(id.to_string()), *n).changed();
                        }
                    });
                    ui.label(RichText::new("Mitat").strong());
                    changed |= ui.add(egui::Slider::new(&mut p.height, 0.8..=2.0).text("pituus (m)")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.build, 0.7..=1.5).text("vartalo")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.head_scale, 0.7..=1.8).text("pää")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.leg_ratio, 0.38..=0.52).text("jalat")).changed();
                    ui.label(RichText::new("Kasvot").strong());
                    changed |= ui.add(egui::Slider::new(&mut p.face.eye_size, 0.6..=1.8).text("silmät")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.face.eye_spacing, 0.7..=1.4).text("silmäväli")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.face.mouth_width, 0.5..=1.8).text("suu")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.face.nose_size, 0.5..=1.8).text("nenä")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.face.brow_thickness, 0.4..=2.2).text("kulmat")).changed();
                    changed |= ui.checkbox(&mut p.face.cheeks, "posket").changed();
                    changed |= color_row(ui, "Silmät", &mut p.face.eye_color);
                    ui.label(RichText::new("Hiukset ja iho").strong());
                    egui::ComboBox::from_label("kampaus").selected_text(format!("{:?}", p.hair_style)).show_ui(ui, |ui| {
                        for (v, n) in [(HairStyle::Short, "lyhyt"), (HairStyle::Bob, "polkka"), (HairStyle::Ponytail, "poninhäntä"), (HairStyle::Bald, "kalju")] {
                            changed |= ui.selectable_value(&mut p.hair_style, v, n).changed();
                        }
                    });
                    changed |= color_row(ui, "Hiukset", &mut p.hair);
                    changed |= color_row(ui, "Iho", &mut p.skin);
                    ui.label(RichText::new("Vaatteet").strong());
                    egui::ComboBox::from_label("asu").selected_text(format!("{:?}", p.clothing)).show_ui(ui, |ui| {
                        for (v, n) in [(ClothingStyle::Shirt, "paita"), (ClothingStyle::Hoodie, "huppari"), (ClothingStyle::Dress, "mekko")] {
                            changed |= ui.selectable_value(&mut p.clothing, v, n).changed();
                        }
                    });
                    changed |= ui.add(egui::Slider::new(&mut p.sleeve, 0.0..=1.0).text("hiha")).changed();
                    changed |= ui.add(egui::Slider::new(&mut p.trouser, 0.0..=1.0).text("lahje")).changed();
                    changed |= color_row(ui, "Yläosa", &mut p.top);
                    changed |= color_row(ui, "Alaosa", &mut p.bottom);
                    changed |= color_row(ui, "Kengät", &mut p.shoes);
                    ui.label(RichText::new("Lisävarusteet").strong());
                    egui::ComboBox::from_label("päähine").selected_text(match p.extras.hat {
                        HatStyle::None => "ei",
                        HatStyle::Beanie => "pipo",
                        HatStyle::Cap => "lippis",
                    }).show_ui(ui, |ui| {
                        for (v, n) in [(HatStyle::None, "ei"), (HatStyle::Beanie, "pipo"), (HatStyle::Cap, "lippis")] {
                            changed |= ui.selectable_value(&mut p.extras.hat, v, n).changed();
                        }
                    });
                    if p.extras.hat != HatStyle::None {
                        changed |= color_row(ui, "Päähine", &mut p.extras.hat_color);
                    }
                    changed |= ui.checkbox(&mut p.extras.glasses, "silmälasit").changed();
                    changed |= ui.add(egui::Slider::new(&mut p.extras.belly, 0.0..=1.0).text("vatsa")).changed();
                    changed |= ui.checkbox(&mut p.extras.outline, "ääriviiva").changed();
                    ui.horizontal(|ui| {
                        ui.label("Tyyli");
                        changed |= ui.selectable_value(&mut p.render_style, RenderStyle::Flat, "tasavärit").changed();
                        changed |= ui.selectable_value(&mut p.render_style, RenderStyle::Cel, "sävytetty").changed();
                    });
                }
                ui.horizontal(|ui| {
                    if ui.button("Palauta esiasetus").clicked() {
                        if let Some(preset) = CharacterParams::presets().into_iter().find(|c| c.name == name) {
                            app.production.cast_params[idx] = preset;
                            changed = true;
                        }
                    }
                });
                if changed {
                    app.cast_changed();
                }
            }
            ui.separator();
            ui.heading("Agentit");
            egui::Grid::new("agentit").striped(true).num_columns(3).max_col_width(110.0).show(ui, |ui| {
                for r in &app.last_runs {
                    ui.label(r.name);
                    ui.label(RichText::new(format!("{:.1} ms", r.took.as_secs_f64() * 1000.0)).monospace());
                    match &r.outcome {
                        Ok(s) => ui.add(egui::Label::new(RichText::new(s).small()).wrap()),
                        Err(e) => ui.add(egui::Label::new(RichText::new(e).small().color(Color32::from_rgb(0xe0, 0x6c, 0x5a))).wrap()),
                    };
                    ui.end_row();
                }
            });
        });
    });
}

pub fn stage(app: &mut StudioApp, ctx: &egui::Context, frame: &eframe::Frame) {
    egui::CentralPanel::default().frame(egui::Frame::default().fill(Color32::from_rgb(0x16, 0x1b, 0x22))).show(ctx, |ui| {
        let avail = ui.available_size();
        let aspect = app.production.width as f32 / app.production.height as f32;
        let (w, h) = if avail.x / avail.y > aspect { (avail.y * aspect, avail.y) } else { (avail.x, avail.x / aspect) };
        let ppp = ctx.pixels_per_point();
        if let Some(legacy) = &mut app.legacy {
            // Vanha 2D-projekti: piirretään hs-hahmolla.
            let fps = legacy.project.fps() as f32;
            let f = ((app.time * fps) as u32) % legacy.project.frame_count().max(1);
            if legacy.frame != f || legacy.texture.is_none() {
                if let Ok(pix) = legacy.project.render(f) {
                    // tiny-skia käyttää esikerrottua alfaa.
                    let img = egui::ColorImage::from_rgba_premultiplied([pix.width() as usize, pix.height() as usize], pix.data());
                    match &mut legacy.texture {
                        Some(t) => t.set(img, egui::TextureOptions::LINEAR),
                        None => legacy.texture = Some(ctx.load_texture("hahmo2d", img, egui::TextureOptions::LINEAR)),
                    }
                    legacy.frame = f;
                }
            }
            ui.label(egui::RichText::new(format!("{} (2D, vain katselu)", legacy.name)).weak());
            let avail = ui.available_size();
            if let Some(t) = &legacy.texture {
                let a = t.size()[0] as f32 / t.size()[1] as f32;
                let (w, h) = if avail.x / avail.y > a { (avail.y * a, avail.y) } else { (avail.x, avail.x / a) };
                ui.centered_and_justified(|ui| ui.image((t.id(), egui::vec2(w, h))));
            }
            return;
        }
        let ppp = ppp * app.workflow.preview_scale.clamp(0.25, 1.0);
        let px = [((w * ppp) as u32).min(app.production.width), ((h * ppp) as u32).min(app.production.height)];
        let time = app.time;
        if let Some(id) = app.viewport.draw(ui, frame, &app.production, time, px) {
            let response=ui.centered_and_justified(|ui| ui.image((id, egui::vec2(w, h)))).inner;
            if app.production.caption_settings.enabled {
                let now=hs_core::Tick::from_seconds(time as f64);
                if let Some(cue)=hs_agents::captions::cues(&app.production).iter().find(|c|c.start<=now && now<c.end) {
                    let painter=ui.painter_at(response.rect);
                    let font=egui::FontId::proportional((response.rect.height()*app.production.caption_settings.style.font_height).max(12.0));
                    let galley=painter.layout(cue.text.clone(),font,Color32::WHITE,response.rect.width()*0.86);
                    let pos=egui::pos2(response.rect.center().x-galley.size().x/2.0,response.rect.bottom()-response.rect.height()*app.production.caption_settings.style.bottom_margin-galley.size().y);
                    painter.rect_filled(egui::Rect::from_min_size(pos-egui::vec2(6.0,3.0),galley.size()+egui::vec2(12.0,6.0)),3.0,Color32::from_black_alpha(210));
                    painter.galley(pos,galley,Color32::WHITE);
                }
            }
        } else {
            if let Some(error)=&app.viewport.builder.last_error {ui.colored_label(Color32::LIGHT_RED,error);}
            ui.centered_and_justified(|ui| ui.label("Korjaa käsikirjoituksen virheet nähdäksesi näyttämön."));
        }
    });
}

pub fn dialogs(app: &mut StudioApp, ctx: &egui::Context) {
    if app.show_about {
        egui::Window::new("Tietoja").collapsible(false).resizable(false).open(&mut app.show_about).show(ctx, |ui| {
            ui.heading("Koeta – natiivi");
            ui.label(format!("Versio {}", env!("CARGO_PKG_VERSION")));
            ui.label("Rust, egui/eframe ja wgpu. Agenttiputki: käsikirjoitus → hahmot → liike → kamera → renderöinti.");
            ui.label("Kaikki käsittely tapahtuu paikallisesti.");
        });
    }
}
