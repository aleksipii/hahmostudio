//! Editing and publication settings for the current episode.
use crate::app::StudioApp;
use eframe::egui;
use hs_core::Tick;
pub fn show(app: &mut StudioApp, ctx: &egui::Context) {
    egui::CentralPanel::default().show(ctx, |ui| {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.heading("Käsikirjoituksen palikat");
            if let Some(next)=app.blocks.ui(ui,&app.script) {app.script=next;app.script_changed();}
            ui.separator();
            let duration = Tick::from_seconds(app.duration() as f64);
            if app.editing.ui(ui, duration) {
                app.production.soundtrack = app.editing.tracks.clone();
                app.pipeline.mark_dirty(hs_agents::Slot::Audio);
                app.run_pipeline();
            }
            ui.separator(); ui.heading("Julkaisuprofiili");
            ui.horizontal(|ui| {
                for (label,size) in [("TikTok / Reels / Shorts",(1080,1920)),("YouTube",(1920,1080)),("Neliö",(1080,1080))] {
                    if ui.button(label).clicked() { app.production.width=size.0;app.production.height=size.1; }
                }
            });
            ui.label(format!("{} × {} · {} fps",app.production.width,app.production.height,app.production.fps.0));
            ui.separator(); ui.heading("Englanninkieliset tekstitykset");
            ui.checkbox(&mut app.production.caption_settings.enabled,"Tekstitykset käytössä");
            ui.checkbox(&mut app.production.caption_settings.burn_in,"Polta tekstitykset videoon");
            let mut cues = hs_agents::captions::cues(&app.production);
            if cues.is_empty() { ui.label("Tekstitysten ajoitus muodostuu, kun repliikkien ääni on valmis."); }
            ui.horizontal(|ui| {
                for (label,ext) in [("Vie SRT","srt"),("Vie WebVTT","vtt")] {
                    if ui.add_enabled(!cues.is_empty(),egui::Button::new(label)).clicked() {
                        if let Some(path)=rfd::FileDialog::new().set_file_name(format!("jakso.{ext}")).save_file() {
                            let text=if ext=="srt" { hs_subtitle::to_srt(&cues) } else { hs_subtitle::to_vtt(&cues) };
                            app.status=match text.map_err(|e|e.to_string()).and_then(|s|std::fs::write(path,s).map_err(|e|e.to_string())) { Ok(())=>"Tekstitykset viety.".into(),Err(e)=>e };
                        }
                    }
                }
            });
            for cue in &mut cues {
                let mut changed=false;
                ui.push_id(&cue.id,|ui|ui.group(|ui| {
                    ui.label(cue.speaker.as_deref().unwrap_or("Repliikki"));
                    changed |= ui.text_edit_multiline(&mut cue.text).changed();
                    let (mut start,mut end)=(cue.start.seconds(),cue.end.seconds());
                    ui.horizontal(|ui| {
                        changed |= ui.add(egui::DragValue::new(&mut start).range(0.0..=60.0).speed(0.05).prefix("Alku ").suffix(" s")).changed();
                        changed |= ui.add(egui::DragValue::new(&mut end).range(0.0..=60.0).speed(0.05).prefix("Loppu ").suffix(" s")).changed();
                    });
                    if changed { cue.start=Tick::from_seconds(start);cue.end=Tick::from_seconds(end); }
                }));
                if changed {
                    match hs_subtitle::validate_cues(std::slice::from_ref(cue)) {
                        Ok(())=>{
                            app.production.caption_overrides.retain(|c|c.id!=cue.id);
                            app.production.caption_overrides.push(cue.clone());
                        }
                        Err(e)=>app.status=e.to_string(),
                    }
                }
            }
        });
    });
}
