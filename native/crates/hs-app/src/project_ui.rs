//! Portable series workflow. Files are read/written off the UI thread.
use crate::app::StudioApp;
use eframe::egui;
use hs_project::{Episode, Series, ProjectAsset};
use hs_project::recovery::{RecoveryStore, RecoveredSnapshot};
use std::time::{Duration, Instant};
use std::{
    path::PathBuf,
    sync::mpsc::{self, Receiver},
};

pub struct ProjectState {
    pub series: Series,
    pub selected: usize,
    pub path: Option<PathBuf>,
    job: Option<Receiver<Result<JobResult, String>>>,
    confirm_replace: bool,
    pending_open: Option<PathBuf>,
    new_series: bool,
    import_directory: bool,
    confirm_close: bool,
    close_after_save: bool,
    allow_close: bool,
    recovery: Option<RecoveryStore>,
    recovery_job: Option<Receiver<Result<RecoveryOutcome,String>>>,
    recoveries: Vec<RecoveredSnapshot>,
    recovery_due: Instant,

}
enum RecoveryOutcome { Discovered(Vec<RecoveredSnapshot>), Saved(String) }
enum JobResult {
    Open(Series, PathBuf),
    Saved(PathBuf),
}
fn fresh_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    format!(
        "koeta-{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    )
}
impl ProjectState {
    pub fn new(p: &hs_agents::Production) -> Self {
        Self {
            series: Series {
                id: fresh_id(),
                name: "Uusi sarja".into(),
                episodes: vec![hs_agents::project::capture(
                    p,
                    fresh_id(),
                    1,
                    "Jakso 1".into(),
                )],
            },
            selected: 0,
            path: None,
            job: None,
            confirm_replace: false,
            pending_open: None,
            new_series: false,
            import_directory: false,
            confirm_close: false,
            close_after_save: false,
            allow_close: false,
            recovery: hs_voice::store::ModelStore::default_data_dir().map(|dir| RecoveryStore::new(dir.join("koeta-recovery"),512*1024*1024)),
            recovery_job: None, recoveries: Vec::new(), recovery_due:Instant::now()+Duration::from_secs(30),
        }
    }
}
impl StudioApp {
    pub fn open_series(&mut self, path: PathBuf, ctx: &egui::Context) {
        let (tx, rx) = mpsc::channel();
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let result = load_series_or_legacy(&path)
                .and_then(|s| { validate_workspaces(&s)?; Ok(JobResult::Open(s,if path.is_dir() || path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("sarja")){PathBuf::new()}else{path})) })
                .map_err(|e| e.to_string());
            let _ = tx.send(result);
            ctx.request_repaint();
        });
        self.project.job = Some(rx);
        self.status = "Avataan sarjaprojektia…".into();
    }

    fn capture_episode(&mut self) -> Result<(),String> {
        self.production.script = self.script.clone();
        let old = &self.project.series.episodes[self.project.selected];
        let mut snapshot = hs_agents::project::capture_checked(&self.production,old.id.clone(),old.number,old.name.clone())?;
        if let Some(legacy) = &self.legacy {
            snapshot.assets.push(ProjectAsset { id: "legacy-hahmo".into(), kind: "legacy".into(), bytes: legacy.project.encode().map_err(|e| e.to_string())? });
        }
        snapshot.assets.push(ProjectAsset{id:"render-settings".into(),kind:"render-settings".into(),bytes:self.aov.settings.encode()?});
        snapshot.assets.extend(vec![
            ProjectAsset{id:"image-workspace".into(),kind:"image".into(),bytes:self.image.snapshot()?},
            ProjectAsset{id:"editing-workspace".into(),kind:"editing".into(),bytes:hs_edit::encode_workspace(&self.editing.tracks)?},
        ]);
        let bytes = self.library.encode()?;
        for e in &mut self.project.series.episodes { e.assets.retain(|a| a.kind != "library"); e.assets.push(ProjectAsset { id: "series-library".into(), kind: "library".into(), bytes: bytes.clone() }); }
        snapshot.assets.push(ProjectAsset { id: "series-library".into(), kind: "library".into(), bytes });
        crate::review_integration::attach_review(&mut snapshot,&mut self.review)?;
        self.project.series.episodes[self.project.selected] = snapshot;
        Ok(())
    }
    fn activate_episode(&mut self, index:usize, ctx:&egui::Context) {
        let episode=&self.project.series.episodes[index];
        let review=match crate::review_integration::restore_review(episode) { Ok(review)=>review,Err(error)=>{self.status=error;return;} };
        let mut aov=crate::aov_ui::AovState::default();
        let mut image=crate::image_ui::ImageWorkspace::default();
        let mut editing=crate::editing_ui::EditingState::default();
        let mut library=crate::library_ui::SeriesLibrary::default();
        let mut legacy=None;
        for asset in &episode.assets {
            let result=match asset.kind.as_str() {
                "acting-style" => hs_motion::acting_style::ActingStyle::decode(&asset.bytes).map(|_|()),
                "render-settings" => hs_project::render_settings::RenderSettings::decode(&asset.bytes).map(|value|aov.settings=value),
                "image" => image.restore(&asset.bytes),
                "editing" => hs_edit::decode_workspace(&asset.bytes).map(|tracks| editing.tracks=tracks),
                "library" => hs_agents::project::validate_library(&asset.bytes).map(|v| library=v),
                "legacy" => hs_hahmo::Project::open(&asset.bytes).map(|project| {
                    legacy=Some(crate::app::LegacyProject { name: project.document.name.clone(), project, texture: None, frame: u32::MAX });
                }).map_err(|e|e.to_string()),
                "review" => hs_project::production_review::ReviewState::decode(&asset.bytes).map(|_|()),
                "pose" => hs_motion::pose_edit::PoseTracks::decode(&asset.bytes).map(|_|()),
                "recordings"=>Ok(()),
                _ => Err("Tuntematon työtilaresurssi".into()),
            };
            if let Err(e)=result {self.status=e;return;}
        }
        let mut production=match hs_agents::project::restore_checked(episode){Ok(p)=>p,Err(e)=>{self.status=e;return;}};
        production.soundtrack=editing.tracks.clone();
        self.review=review;self.rig=Default::default();self.pose=Default::default();self.review_ui=Default::default();
        self.playing=false;
        self.voice.attach_project(&mut production,ctx);
        self.production=production;self.image=image;self.aov=aov;self.editing=editing;self.library=library;self.workflow.line=None;self.history=Default::default();
        self.script=self.production.script.clone();self.script_path=None;self.dirty_since=None;self.legacy=legacy;
        self.time=0.0;self.selected_cast=0;self.project.selected=index;self.blocks=Default::default();self.script_assist=Default::default();
        self.pipeline=hs_agents::Pipeline::default();self.run_pipeline();
    }
    pub fn scan_recovery(&mut self,ctx:&egui::Context) {
        let Some(store)=self.project.recovery.clone() else {return};
        let (tx,rx)=mpsc::channel();let ctx=ctx.clone();
        std::thread::spawn(move || {let result=store.discover().map(RecoveryOutcome::Discovered).map_err(|e|e.to_string());let _=tx.send(result);ctx.request_repaint();});
        self.project.recovery_job=Some(rx);
    }
    fn checkpoint_project(&mut self,ctx:&egui::Context,named:bool) {
        self.project.recovery_due=Instant::now()+Duration::from_secs(30);
        if self.project.recovery_job.is_some() {return;}
        let Some(store)=self.project.recovery.clone() else {return};
        if let Err(e)=self.capture_episode(){self.status=e;return;}
        let snapshot=self.project.series.clone();let name=fresh_id();
        let (tx,rx)=mpsc::channel();let ctx=ctx.clone();
        std::thread::spawn(move || {
            let r=if named {store.save_revision(&snapshot,&name)} else {store.autosave(&snapshot)};
            let result=r.map(|_|RecoveryOutcome::Saved(if named {"Nimetty palautusrevisio tallennettu.".into()} else {"Automaattinen palautuspiste tallennettu.".into()})).map_err(|e|e.to_string());
            let _=tx.send(result);ctx.request_repaint();
        });
        self.project.recovery_job=Some(rx);
        self.project.recovery_due=Instant::now()+Duration::from_secs(30);
    }
    fn save_series(&mut self, path: PathBuf, ctx: &egui::Context) {
        if let Err(e)=self.capture_episode(){self.project.close_after_save=false;self.status=e;return;}
        let snapshot = self.project.series.clone();
        let (tx, rx) = mpsc::channel();
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let result = hs_project::save_atomic(&path, &snapshot)
                .map(|_| JobResult::Saved(path))
                .map_err(|e| e.to_string());
            let _ = tx.send(result);
            ctx.request_repaint();
        });
        self.project.job = Some(rx);
        self.status = "Tallennetaan sarjaprojektia…".into();
    }
}
pub fn menu(app: &mut StudioApp, ui: &mut egui::Ui) {
    let ctx = ui.ctx().clone();
    let can_change =
        app.project.job.is_none() && app.voice.recorder.is_none() && app.export.is_none() && !app.image.is_busy();
    ui.add_enabled_ui(can_change, |ui| {
        if ui.button("Uusi sarjaprojekti").clicked() {
            app.project.import_directory = false;
            app.project.new_series = true;
            app.project.confirm_replace = true;
            ui.close_menu();
        }
        if ui.button("Avaa sarjaprojekti (.koeta / .sarja)…").clicked() {
            app.project.import_directory = false;
            app.project.new_series = false;
            app.project.confirm_replace = true;
            ui.close_menu();
        }
        if ui.button("Tuo aiempi Koeta-sarjakansio…").clicked() {
            app.project.new_series=false;app.project.import_directory=true;
            app.project.confirm_replace=true;ui.close_menu();
        }
        if ui.button("Tallenna sarjaprojekti").clicked() {
            let path = app.project.path.clone().or_else(|| {
                rfd::FileDialog::new()
                    .add_filter("Koeta", &["koeta"])
                    .set_file_name("sarja.koeta")
                    .save_file()
            });
            if let Some(path) = path {
                app.save_series(path, &ctx);
            }
            ui.close_menu();
        }
        if ui.button("Tallenna sarjaprojekti nimellä…").clicked() {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("Koeta", &["koeta"])
                .set_file_name("sarja.koeta")
                .save_file()
            {
                app.save_series(path, &ctx);
            }
            ui.close_menu();
        }
        ui.separator();
        ui.label("Sarjan nimi");
        ui.text_edit_singleline(&mut app.project.series.name);
        let selected = app.project.selected;
        ui.label("Jakson nimi ja numero");
        ui.text_edit_singleline(&mut app.project.series.episodes[selected].name);
        ui.add(
            egui::DragValue::new(&mut app.project.series.episodes[selected].number)
                .range(1..=u32::MAX),
        );
        let mut selected_after = selected;
        egui::ComboBox::from_id_salt("sarjan-jaksot")
            .selected_text(&app.project.series.episodes[selected].name)
            .show_ui(ui, |ui| {
                for (i, episode) in app.project.series.episodes.iter().enumerate() {
                    ui.selectable_value(
                        &mut selected_after,
                        i,
                        format!("{}: {}", episode.number, episode.name),
                    );
                }
            });
        if selected_after != selected {
            if let Err(e)=app.capture_episode(){app.status=e;return;}
            app.activate_episode(selected_after, &ctx);
        }
        if ui.button("Tallenna palautusrevisio").clicked() { app.checkpoint_project(&ctx,true);ui.close_menu(); }
        if ui.button("Lisää uusi jakso").clicked() {
            if let Err(e)=app.capture_episode(){app.status=e;return;}
            let number = app
                .project
                .series
                .episodes
                .iter()
                .map(|e| e.number)
                .max()
                .unwrap_or(0)
                .saturating_add(1);
            let mut p = hs_agents::Production::new("");
            // Cast/voice choices are shared by copying the previous episode's settings.
            p.cast_params = app.production.cast_params.clone();
            p.width = app.production.width;
            p.height = app.production.height;
            p.fps = app.production.fps;
            let mut episode: Episode =
                hs_agents::project::capture(&p, fresh_id(), number, format!("Jakso {number}"));
            if let Ok(bytes) = app.library.encode() { episode.assets.push(ProjectAsset { id: "series-library".into(), kind: "library".into(), bytes }); }
            app.project.series.episodes.push(episode);
            app.activate_episode(app.project.series.episodes.len() - 1, &ctx);
            ui.close_menu();
        }
    });
    if !can_change {
        ui.label("Odota tiedostotyön/viennin valmistumista ja lopeta äänitys.");
    }
}
pub fn busy(app: &StudioApp) -> bool {
    app.project.job.is_some()
}

pub fn update(app: &mut StudioApp, ctx: &egui::Context) {
    if let Some(error) = app.file_open.take_error() { app.status = error; }
    for file in ctx.input(|i| i.raw.dropped_files.clone()) {
        if let Some(path) = file.path { if let Err(e) = app.file_open.push(path) { app.status = e; } }
    }
    if !app.project.confirm_replace && !app.project.confirm_close && !busy(app) && app.voice.recorder.is_none() && app.export.is_none() && !app.image.is_busy() {
        if let Some(path) = app.file_open.pop() {
            app.project.pending_open = Some(path); app.project.new_series = false; app.project.import_directory = false; app.project.confirm_replace = true;
        }
    }
    let recovered=app.project.recovery_job.as_ref().and_then(|rx|match rx.try_recv() {
        Ok(result)=>Some(result),
        Err(mpsc::TryRecvError::Disconnected)=>Some(Err("Palautustyö keskeytyi.".into())),
        Err(mpsc::TryRecvError::Empty)=>None,
    });
    if let Some(result)=recovered {
        app.project.recovery_job=None;
        match result {
            Ok(RecoveryOutcome::Discovered(items))=>app.project.recoveries=items,
            Ok(RecoveryOutcome::Saved(message))=>app.status=message,
            Err(e)=>app.status=format!("Palautuspisteen virhe: {e}"),
        }
    }
    if app.project.recovery_job.is_some() {ctx.request_repaint_after(Duration::from_millis(100));}
    if !app.project.recoveries.is_empty() && !app.project.confirm_close && app.project.job.is_none() {
        let mut choice=None;
        egui::Modal::new(egui::Id::new("koeta-recovery")).show(ctx,|ui| {
            ui.heading("Palauta aiempi työ?");ui.label("Palautus avaa kopion. Alkuperäistä projektitiedostoa ei korvata.");
            for (index,rec) in app.project.recoveries.iter().enumerate() {
                if ui.button(format!("Palauta {} · revisio {}",rec.series.name,rec.sequence)).clicked(){choice=Some(index);}
            }
            if ui.button("Jatka palauttamatta").clicked(){choice=Some(usize::MAX);}
        });
        if let Some(index)=choice {
            if index<app.project.recoveries.len() {
                let item=app.project.recoveries.remove(index);
                match validate_workspaces(&item.series) {
                    Ok(())=>{app.project.series=item.series;app.project.path=None;app.activate_episode(0,ctx);app.status="Palautettu kopio; tallenna sarjaprojektina.".into();},
                    Err(e)=>app.status=e,
                }
            }
            app.project.recoveries.clear();
        }
    }
    if app.project.recovery_due<=Instant::now() && app.project.job.is_none() && app.project.recovery_job.is_none()
        && app.voice.recorder.is_none() && app.export.is_none() && !app.image.is_busy() && !app.screenshot_mode() && app.project.recoveries.is_empty() {
        app.checkpoint_project(ctx,false);
    }
    if !app.screenshot_mode() {ctx.request_repaint_after(Duration::from_secs(5));}
    let result = app.project.job.as_ref().and_then(|rx| match rx.try_recv() {
        Ok(r) => Some(r),
        Err(mpsc::TryRecvError::Disconnected) => {
            Some(Err("Projektin tiedostotyö keskeytyi.".into()))
        }
        Err(mpsc::TryRecvError::Empty) => None,
    });
    if let Some(result) = result {
        app.project.job = None;
        match result {
            Ok(JobResult::Open(series, path)) => {
                app.project.series = series;
                app.project.path = (!path.as_os_str().is_empty()).then_some(path);
                app.activate_episode(0, ctx);
                app.status = if app.legacy.is_some() { "Vanha sarja avattu 2D-rigityötilaan; animaatiot säilyvät. Tallenna .koeta-muodossa.".into() } else { "Sarjaprojekti avattu; äänet palautettu projektista.".into() };
            }
            Ok(JobResult::Saved(path)) => {
                app.status = format!(
                    "Sarjaprojekti tallennettu: {} (tallennuksen aloitushetken tila)",
                    path.display()
                );
                app.project.path = Some(path);
                if app.project.close_after_save {
                    app.project.allow_close = true;
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
            Err(e) => {
                app.status = format!("Projektitoiminto epäonnistui: {e}");
                app.project.close_after_save = false;
            }
        }
    }
    if ctx.input(|i| i.viewport().close_requested())
        && !app.project.allow_close
        && !app.screenshot_mode()
    {
        ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        app.project.confirm_close = true;
        app.project.confirm_replace = false;
    }
    if app.project.confirm_close && app.project.job.is_none() {
        egui::Modal::new(egui::Id::new("koeta-close")).show(ctx, |ui| {
            ui.set_max_width(480.0);
            ui.heading("Sulje Koeta?");
            ui.label("Säilytä koko sarja tallentamalla .koeta-projekti. Sovelluksen asetukset eivät korvaa sarjaprojektia.");
            if ui.button("Peruuta").clicked() { app.project.confirm_close = false; }
            if ui.button("Tallenna sarja ja sulje").clicked() && app.voice.recorder.is_none() && app.export.is_none() && !app.image.is_busy() {
                let path = app.project.path.clone().or_else(|| rfd::FileDialog::new().add_filter("Koeta", &["koeta"]).set_file_name("sarja.koeta").save_file());
                if let Some(path) = path { app.project.close_after_save = true; app.save_series(path, ctx); }
            }
            if ui.button("Sulje tallentamatta").clicked() {
                app.project.allow_close = true;
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            }
        });
    }
    if app.project.job.is_some() {
        ctx.request_repaint_after(std::time::Duration::from_millis(100));
    }
    if app.project.confirm_replace {
        egui::Modal::new(egui::Id::new("koeta-replace")).show(ctx, |ui| {
            ui.set_max_width(480.0);
            ui.heading("Vaihda sarjaprojektia?");
            if let Some(path) = &app.project.pending_open { ui.monospace(path.display().to_string()); }
            ui.label("Nykyisen sarjan tallentamattomat muutokset jäävät pois. Tallenna sarja ensin, jos haluat säilyttää ne.");
            if ui.button("Peruuta").clicked() { app.project.confirm_replace = false; app.project.pending_open = None; }
            if ui.add_enabled(app.project.job.is_none() && app.voice.recorder.is_none() && app.export.is_none() && !app.image.is_busy(), egui::Button::new(if app.project.new_series { "Luo uusi sarja" } else { "Jatka avaamiseen…" })).clicked() {
                app.project.confirm_replace = false;
                if app.project.new_series {
                    let p = hs_agents::Production::new("");
                    app.project = ProjectState::new(&p);
                    app.activate_episode(0, ctx);
                    app.status = "Uusi sarjaprojekti luotu.".into();
                } else if app.project.import_directory {
                    if let Some(path)=rfd::FileDialog::new().pick_folder() {app.open_series(path,ctx);}
                } else if let Some(path) = app.project.pending_open.take().or_else(|| rfd::FileDialog::new().add_filter("Koeta ja vanha sarja", &["koeta", "sarja"]).pick_file()) {
                    app.open_series(path, ctx);
                }
            }
        });
    }
}

fn validate_workspaces(series:&Series)->Result<(),String> {
    for e in &series.episodes { hs_agents::project::restore_checked(e)?; crate::review_integration::restore_review(e)?; for a in &e.assets {
        match a.kind.as_str() {
            "image"=>{hs_image::Document::decode(&a.bytes)?;},
            "editing"=>{hs_edit::decode_workspace(&a.bytes)?;},
            "library"=>{hs_agents::project::validate_library(&a.bytes)?;},
            "recordings"=>{hs_agents::recording::decode(&a.bytes)?;},
            "legacy"=>{hs_hahmo::Project::open(&a.bytes).map_err(|e|e.to_string())?;},
            "review"=>{hs_project::production_review::ReviewState::decode(&a.bytes)?;},
            "acting-style"=>{hs_motion::acting_style::ActingStyle::decode(&a.bytes)?;},
            "render-settings"=>{hs_project::render_settings::RenderSettings::decode(&a.bytes)?;},
            "pose"=>{hs_motion::pose_edit::PoseTracks::decode(&a.bytes)?;},
            _=>return Err("Tuntematon työtilaresurssi".into()),
        }
    }} Ok(())
}

/// Validate every episode before replacing the active series; never guess a native script.
fn load_series_or_legacy(path: &std::path::Path) -> Result<Series, String> {
    if !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("sarja")) {
        return hs_agents::project::load_series(path).map_err(|e| e.to_string());
    }
    let file=std::fs::File::open(path).map_err(|e|e.to_string())?;
    if file.metadata().map_err(|e|e.to_string())?.len()>hs_project::MAX_BYTES as u64 { return Err("Vanha sarja ylittää 128 MiB".into()); }
    use std::io::Read;
    let mut bytes=Vec::new(); file.take(hs_project::MAX_BYTES as u64+1).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
    let old=hs_project::legacy_series::decode(&bytes).map_err(|e|e.to_string())?;
    let mut episodes=Vec::new();
    for entry in old.episodes {
        let project=hs_hahmo::Project::open(&entry.bytes).map_err(|e|format!("Jakso {}: {e}",entry.number))?;
        let mut episode=hs_agents::project::capture(&hs_agents::Production::new(""),entry.id,entry.number,entry.name);
        episode.script.clear(); episode.cast.clear(); episode.audio.clear(); episode.captions.clear();
        episode.width=project.document.width as u32; episode.height=project.document.height as u32;
        episode.fps=project.fps().round().clamp(1.0,60.0) as u32;
        episode.assets.push(ProjectAsset{id:"legacy-hahmo".into(),kind:"legacy".into(),bytes:entry.bytes});
        episodes.push(episode);
    }
    let series=Series{id:old.id,name:path.file_stem().map_or_else(||"Vanha sarja".into(),|name|name.to_string_lossy().into_owned()),episodes};
    hs_project::encode(&series).map_err(|e|e.to_string())?;
    Ok(series)
}

#[cfg(test)]
mod legacy_import_tests {
    use super::*;
    #[test]
    fn actual_legacy_series_roundtrip_preserves_all_episode_archives_without_guessing_script() {
        let source=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../Esimerkki-viisi-jaksoa.sarja");
        let series=load_series_or_legacy(&source).unwrap();
        assert_eq!(series.episodes.len(),5);
        let original=hs_project::legacy_series::decode(&std::fs::read(source).unwrap()).unwrap();
        let reopened=hs_project::decode(&hs_project::encode(&series).unwrap()).unwrap();
        validate_workspaces(&reopened).unwrap();
        for (episode,old) in reopened.episodes.iter().zip(original.episodes) {
            assert_eq!(episode.number,old.number);assert_eq!(episode.name,old.name);
            assert!(episode.script.is_empty()&&episode.cast.is_empty()&&episode.audio.is_empty());
            let asset=episode.assets.iter().find(|asset|asset.kind=="legacy").unwrap();
            assert_eq!(asset.bytes,old.bytes);
            assert_eq!(hs_hahmo::Project::open(&asset.bytes).unwrap().encode().unwrap(),asset.bytes);
        }
    }
}
