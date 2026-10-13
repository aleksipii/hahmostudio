//! Editing and publication settings for the current episode.
use crate::app::StudioApp;
use eframe::egui;
use hs_core::Tick;
pub fn show(app: &mut StudioApp, ctx: &egui::Context) {
    egui::CentralPanel::default().show(ctx, |ui| {
        egui::ScrollArea::vertical().show(ui, |ui| {
            crate::library_ui::show(app, ui);
            crate::workflow_ui::scenes(app, ui);
            ui.separator();
            if let Some(next)=app.blocks.ui(ui,&app.script) {app.script=next;app.script_changed();}
            ui.separator();
            let duration = Tick::from_seconds(app.duration() as f64);
            if app.editing.ui(ui, duration) {
                app.editing.revision = app.editing.revision.wrapping_add(1);
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
            ui.label("Kun tekstitykset ovat käytössä, MP4 sisältää myös valittavan englanninkielisen tekstitysraidan.");
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

pub fn export(app:&mut StudioApp,ctx:&egui::Context) {
    egui::CentralPanel::default().show(ctx,|ui| {
        ui.heading("Vie englanninkielinen jakso");
        if let Some(error)=&app.pipeline_error {ui.colored_label(egui::Color32::LIGHT_RED,error); }
        let missing=app.production.voice_lines.iter().filter(|line|line.speech.is_none()).count();
        ui.label(format!("{:.2} s · {} × {} · {} fps",app.duration(),app.production.width,app.production.height,app.production.fps.0));
        if missing>0 {ui.colored_label(egui::Color32::YELLOW,format!("{missing} repliikiltä puuttuu valmis ääni."));}
        ui.checkbox(&mut app.production.allow_silent_export,"Salli luonnos, jossa puuttuvat repliikit jäävät hiljaisiksi");
        ui.checkbox(&mut app.production.caption_settings.enabled,"Tekstitykset käytössä");
        ui.checkbox(&mut app.production.caption_settings.burn_in,"Polta tekstitykset videoon");
            ui.label("Kun tekstitykset ovat käytössä, MP4 sisältää myös valittavan englanninkielisen tekstitysraidan.");
        ui.horizontal(|ui|for (label,size) in [("Pystyvideo",(1080,1920)),("YouTube",(1920,1080)),("Neliö",(1080,1080))] {
            if ui.button(label).clicked(){app.production.width=size.0;app.production.height=size.1;app.production.fps=hs_core::Fps::EXPORT;app.pipeline.mark_dirty(hs_agents::Slot::Audio);app.run_pipeline();}
        });
        ui.label("MP4: H.264 + AAC, 30 fps, enintään 60 sekuntia ja 128 MiB. Aiempi tiedosto säilyy, jos vienti epäonnistuu.");
        let proof=hs_agents::audit::inspect(&app.production);
        let current=app.production.script==app.script;
        if !current {ui.label("Käsikirjoituksen uusi versio odottaa tarkistusta.");}
        for diagnostic in proof.diagnostics.iter().filter(|d|d.severity!=hs_core::Severity::Info) {
            if ui.button(format!("Näytä rivi {}", diagnostic.line)).clicked() { app.select_line(diagnostic.line); }
            ui.colored_label(if diagnostic.severity==hs_core::Severity::Error{egui::Color32::LIGHT_RED}else{egui::Color32::YELLOW},format!("Rivi {}: {}",diagnostic.line,diagnostic.message));
        }
        egui::CollapsingHeader::new("Toteutuvan animaation tarkistus").show(ui,|ui| {
            ui.label("Automaattinen kamera käyttää näkyviä kuvaussääntöjä. Kirjoitettu kuvakulma säilyy.");
            egui::ScrollArea::vertical().max_height(200.0).show(ui,|ui| {
                for row in &proof.rows {
                    ui.label(format!("Rivi {} · {} · {:.2}–{:.2} s",row.line,row.actor.as_deref().unwrap_or("ei nimettyä hahmoa"),row.start_seconds,row.end_seconds));
                    let background=hs_script::BACKGROUND_ALIASES.iter().find(|(_,id)|*id==row.background).map(|(name,_)|*name).unwrap_or(&row.background);
                    let prop=row.prop.as_deref().map(|id|hs_script::PROP_ALIASES.iter().find(|(_,known)|*known==id).map(|(name,_)|*name).unwrap_or(id)).unwrap_or("ei");
                    ui.label(format!("{} ({:.2} s) · {} · esine {} · {} ({})",row.motion,row.motion_seconds,background,prop,row.shots.join(" → "),if row.authored_camera{"kirjoitettu"}else{"kuvaussääntö"}));
                    let look=match &row.look_at {Some(hs_core::LookTarget::Camera)=>"kamera",Some(hs_core::LookTarget::Character(name))=>name,None=>"oletus"};
                    ui.label(format!("Ilme {:?} · katsetavoite {} · puhelin {}",row.expression,look,if row.phone_visible{"näkyy"}else{"ei näy"}));
                    if let Some(contact) = &row.object_contact { ui.label(format!("Esinekontakti: {contact}")); }
                    if let Some(contact) = &row.chair_contact { ui.label(format!("Tuolikontakti: {contact}")); }
                    ui.separator();
                }
            });
        });
        let ready=app.pipeline_error.is_none() && current && proof.allowed() && app.export.is_none() && app.voice.recorder.is_none();
        if ui.add_enabled(ready && (missing==0 || app.production.allow_silent_export),egui::Button::new("Vie MP4…")).clicked(){
            if let Some(path)=rfd::FileDialog::new().set_file_name("jakso.mp4").save_file(){crate::panels::start_export(app,hs_agents::RenderRequest::Mp4(path));}
        }
        if ui.add_enabled(ready,egui::Button::new("Vie kansikuva PNG…")).clicked(){
            if let Some(path)=rfd::FileDialog::new().set_file_name("kansikuva.png").save_file(){crate::panels::start_export(app,hs_agents::RenderRequest::Still{frame:app.frame(),path});}
        }
        for line in &app.production.voice_lines {ui.label(format!("{}: {} · {}",line.speaker.as_deref().unwrap_or("Repliikki"),line.text,line.status.finnish()));}
    });
}
