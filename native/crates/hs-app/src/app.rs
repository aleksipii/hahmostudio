use crate::export_job::ExportJob;
use crate::panels;
use crate::viewport::Viewport;
use crate::camera_ui::CameraState;
use crate::voice_ui::VoiceState;
use eframe::egui;
use hs_agents::{AgentRun, Pipeline, Production, Slot};
use hs_character::CharacterParams;
use std::path::PathBuf;
use std::time::{Duration, Instant};

pub const EXAMPLE: &str = "[tausta studio]\nPIPSA: Hei! Tervetuloa mukaan. [vilkuta 2s]\n[juokse oikealle 2s]\nPIPSA: Laitan viestin. [näpyttele puhelinta 3s]\n[tausta kaupunki ilta]\nVILLE: Nähdään! [hyppää]\n[kuva lähikuva]\nPIPSA: Moikka! [nyökkää 2s]";

#[derive(Default)]
pub struct LaunchOptions {
    pub script_path: Option<PathBuf>,
    pub screenshot: Option<PathBuf>,
    pub time: Option<f32>,
    pub force_cpu: bool,
    pub tab: Option<String>,
}

pub struct StudioApp {
    pub production: Production,
    pub pipeline: Pipeline,
    pub script: String,
    pub script_path: Option<PathBuf>,
    pub dirty_since: Option<Instant>,
    pub last_runs: Vec<AgentRun>,
    pub pipeline_error: Option<String>,
    pub time: f32,
    pub playing: bool,
    pub looping: bool,
    pub selected_cast: usize,
    pub viewport: Viewport,
    pub export: Option<ExportJob>,
    pub status: String,
    pub show_about: bool,
    pub legacy: Option<LegacyProject>,
    pub voice: VoiceState,
    pub camera: CameraState,
    pub left_tab: LeftTab,
    screenshot: Option<PathBuf>,
    screenshot_frames: u32,
}

/// Vasemman paneelin välilehti.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LeftTab {
    Script,
    Voice,
    Performance,
}

/// Avattu vanha `.hahmo`-projekti (2D-leikehahmo) esikatselua varten.
pub struct LegacyProject {
    pub name: String,
    pub project: hs_hahmo::Project,
    pub texture: Option<egui::TextureHandle>,
    pub frame: u32,
}

const STORAGE_SCRIPT: &str = "kasikirjoitus";
const STORAGE_CAST: &str = "hahmot";

impl StudioApp {
    pub fn new(cc: &eframe::CreationContext<'_>, options: LaunchOptions) -> Self {
        let mut script = EXAMPLE.to_string();
        let mut cast: Vec<CharacterParams> = Vec::new();
        if options.screenshot.is_none() {
            if let Some(storage) = cc.storage {
                if let Some(s) = storage.get_string(STORAGE_SCRIPT) {
                    script = s;
                }
                if let Some(c) = storage.get_string(STORAGE_CAST).and_then(|s| serde_json::from_str(&s).ok()) {
                    cast = c;
                }
            }
        }
        if let Some(p) = &options.script_path {
            match std::fs::read_to_string(p) {
                Ok(s) => script = s,
                Err(e) => eprintln!("{}: {e}", p.display()),
            }
        }
        let mut production = Production::new(script.clone());
        production.cast_params = cast;
        production.width = 1080;
        production.height = 1920;
        let viewport = Viewport::new(cc, options.force_cpu);
        let voice = VoiceState::new(&cc.egui_ctx, options.screenshot.is_some());
        production.own_audio = voice.load_recordings().into_iter().collect();
        let mut app = StudioApp {
            production,
            pipeline: Pipeline::default(),
            script,
            script_path: options.script_path,
            dirty_since: None,
            last_runs: Vec::new(),
            pipeline_error: None,
            time: options.time.unwrap_or(0.0),
            playing: false,
            looping: true,
            selected_cast: 0,
            viewport,
            export: None,
            status: String::new(),
            show_about: false,
            legacy: None,
            voice,
            camera: CameraState::default(),
            left_tab: match options.tab.as_deref() {
                Some("ääni" | "voice") => LeftTab::Voice,
                Some("esitys" | "performance") => LeftTab::Performance,
                _ => LeftTab::Script,
            },
            screenshot: options.screenshot,
            screenshot_frames: 0,
        };
        app.run_pipeline();
        app
    }

    pub fn run_pipeline(&mut self) {
        self.production.script = self.script.clone();
        match self.pipeline.run(&mut self.production) {
            Ok(runs) => {
                if !runs.is_empty() {
                    self.last_runs = runs;
                }
                self.pipeline_error = None;
            }
            Err(e) => self.pipeline_error = Some(e.to_string()),
        }
        let d = self.duration();
        if self.time > d {
            self.time = d;
        }
    }

    pub fn script_changed(&mut self) {
        self.dirty_since = Some(Instant::now());
    }

    pub fn cast_changed(&mut self) {
        self.pipeline.mark_dirty(Slot::CastParams);
        self.run_pipeline();
    }

    pub fn duration(&self) -> f32 {
        self.production.timeline.as_ref().map_or(0.0, |t| t.duration.seconds() as f32)
    }

    pub fn frame(&self) -> u32 {
        let fps = self.production.fps.0 as f32;
        ((self.time * fps) as u32).min(self.production.frame_count().saturating_sub(1))
    }

    /// Varmistaa, että jokaisella näyttämön hahmolla on muokattava parametrijoukko.
    pub fn ensure_cast_params(&mut self) {
        for member in &self.production.cast {
            let name = &member.character.params.name;
            if !self.production.cast_params.iter().any(|c| &c.name == name) {
                self.production.cast_params.push(member.character.params.clone());
            }
        }
    }

    pub fn open_script(&mut self, path: PathBuf) {
        match std::fs::read_to_string(&path) {
            Ok(s) => {
                self.script = s;
                self.status = format!("Avattu {}", path.display());
                self.script_path = Some(path);
                self.pipeline.mark_dirty(Slot::Script);
                self.run_pipeline();
                self.legacy = None;
            }
            Err(e) => self.status = format!("Avaus epäonnistui: {e}"),
        }
    }

    pub fn save_script(&mut self, path: PathBuf) {
        match std::fs::write(&path, &self.script) {
            Ok(()) => {
                self.status = format!("Tallennettu {}", path.display());
                self.script_path = Some(path);
            }
            Err(e) => self.status = format!("Tallennus epäonnistui: {e}"),
        }
    }

    pub fn open_hahmo(&mut self, path: PathBuf) {
        let result = std::fs::read(&path).map_err(|e| e.to_string()).and_then(|b| hs_hahmo::Project::open(&b).map_err(|e| e.to_string()));
        match result {
            Ok(project) => {
                self.status = format!("Avattu 2D-projekti {} (muoto v{})", path.display(), project.version);
                self.legacy = Some(LegacyProject { name: project.document.name.clone(), project, texture: None, frame: u32::MAX });
                self.time = 0.0;
            }
            Err(e) => self.status = format!("Projektin avaus epäonnistui: {e}"),
        }
    }

    fn handle_screenshot(&mut self, ctx: &egui::Context) {
        let Some(path) = self.screenshot.clone() else { return };
        self.screenshot_frames += 1;
        if self.screenshot_frames == 6 {
            ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(egui::UserData::default()));
        }
        let shot = ctx.input(|i| {
            i.events.iter().find_map(|e| match e {
                egui::Event::Screenshot { image, .. } => Some(image.clone()),
                _ => None,
            })
        });
        if let Some(image) = shot {
            let mut img = hs_render::Image::new(image.size[0] as u32, image.size[1] as u32);
            for (i, p) in image.pixels.iter().enumerate() {
                img.rgba[i * 4..i * 4 + 4].copy_from_slice(&p.to_array());
            }
            match hs_render::export::write_png(&img, &path) {
                Ok(()) => eprintln!("kuvakaappaus: {}", path.display()),
                Err(e) => eprintln!("kuvakaappaus epäonnistui: {e}"),
            }
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
        }
        ctx.request_repaint();
    }
}

impl eframe::App for StudioApp {
    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        storage.set_string(STORAGE_SCRIPT, self.script.clone());
        if let Ok(s) = serde_json::to_string(&self.production.cast_params) {
            storage.set_string(STORAGE_CAST, s);
        }
    }

    fn update(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        // Käsikirjoituksen muutokset ajetaan putkeen pienen tauon jälkeen.
        if let Some(since) = self.dirty_since {
            if since.elapsed() > Duration::from_millis(250) {
                self.dirty_since = None;
                self.pipeline.mark_dirty(Slot::Script);
                self.run_pipeline();
            } else {
                ctx.request_repaint_after(Duration::from_millis(60));
            }
        }
        crate::voice_ui::update(self, ctx);
        if self.playing && !crate::voice_ui::has_player(self) {
            let dt = ctx.input(|i| i.stable_dt).min(0.1);
            self.time += dt;
            let d = self.duration();
            if self.time >= d {
                if self.looping {
                    self.time = 0.0;
                } else {
                    self.time = d;
                    self.playing = false;
                }
            }
            ctx.request_repaint();
        }
        if ctx.input(|i| i.key_pressed(egui::Key::Space)) && !ctx.wants_keyboard_input() {
            self.playing = !self.playing;
        }
        if let Some(job) = &mut self.export {
            if let Some(result) = job.poll() {
                self.status = result;
                self.export = None;
            } else {
                ctx.request_repaint_after(Duration::from_millis(100));
            }
        }

        panels::menu_bar(self, ctx);
        panels::status_bar(self, ctx);
        panels::timeline(self, ctx);
        panels::script_panel(self, ctx);
        panels::cast_panel(self, ctx);
        panels::stage(self, ctx, frame);
        panels::dialogs(self, ctx);
        self.handle_screenshot(ctx);
    }
}
