//! Bounded shared undo for source, cast, publication, soundtrack and image edits.
use crate::app::StudioApp;
use std::sync::Arc;
const MAX_STATES: usize = 16;
const MAX_BYTES: usize = 128 * 1024 * 1024;

#[derive(Clone)]
struct State {
    script: String,
    library: crate::library_ui::SeriesLibrary,
    cast: Vec<hs_character::CharacterParams>,
    size: (u32, u32, hs_core::Fps),
    allow_silent: bool,
    captions: (hs_subtitle::CaptionSettings, Vec<hs_subtitle::CaptionCue>),
    tracks: Arc<Vec<hs_edit::Track>>,
    image: Arc<hs_image::Document>,
    editing_revision: u64,
    image_revision: u64,
    pose_tracks: hs_motion::pose_edit::PoseTracks,
    review: hs_project::production_review::ReviewState,
    legacy: Option<Arc<Vec<u8>>>,
    legacy_name: Option<String>,
    rig_revision: u64,
}
impl State {
    fn capture(app: &StudioApp, previous: Option<&Self>) -> Result<Self, String> {
        let tracks = previous
            .filter(|s| s.editing_revision == app.editing.revision)
            .map(|s| s.tracks.clone())
            .unwrap_or_else(|| Arc::new(app.editing.tracks.clone()));
        let image = previous
            .filter(|s| s.image_revision == app.image.revision)
            .map(|s| s.image.clone())
            .unwrap_or_else(|| Arc::new(app.image.document().clone()));
        let legacy = match &app.legacy {
            None => None,
            Some(project) => match previous
                .filter(|s| s.rig_revision == app.rig.revision && s.legacy.is_some())
            {
                Some(old) => old.legacy.clone(),
                None => Some(Arc::new(
                    project.project.encode().map_err(|e| e.to_string())?,
                )),
            },
        };
        Ok(Self {
            pose_tracks: app.production.pose_tracks.clone(),
            review: app.review.clone(),
            legacy,
            legacy_name: app.legacy.as_ref().map(|l| l.name.clone()),
            rig_revision: app.rig.revision,
            library: app.library.clone(),
            script: app.script.clone(),
            cast: app.production.cast_params.clone(),
            size: (
                app.production.width,
                app.production.height,
                app.production.fps,
            ),
            allow_silent: app.production.allow_silent_export,
            captions: (
                app.production.caption_settings.clone(),
                app.production.caption_overrides.clone(),
            ),
            tracks,
            image,
            editing_revision: app.editing.revision,
            image_revision: app.image.revision,
        })
    }
    fn matches(&self, app: &StudioApp) -> bool {
        self.pose_tracks == app.production.pose_tracks
            && self.review == app.review
            && self.rig_revision == app.rig.revision
            && self.legacy.is_some() == app.legacy.is_some()
            && self.legacy_name == app.legacy.as_ref().map(|l| l.name.clone())
            && self.library == app.library
            && self.script == app.script
            && self.cast == app.production.cast_params
            && self.allow_silent == app.production.allow_silent_export
            && self.size
                == (
                    app.production.width,
                    app.production.height,
                    app.production.fps,
                )
            && self.captions
                == (
                    app.production.caption_settings.clone(),
                    app.production.caption_overrides.clone(),
                )
            && self.editing_revision == app.editing.revision
            && self.image_revision == app.image.revision
    }
    fn bytes(&self) -> usize {
        self.script.len()
            + self
                .tracks
                .iter()
                .map(|t| t.audio.samples.len() * 4)
                .sum::<usize>()
            + self
                .image
                .layers
                .iter()
                .map(|l| l.rgba.len() + l.mask.as_ref().map_or(0, Vec::len))
                .sum::<usize>()
            + self.image.source_psd.as_ref().map_or(0, Vec::len)
            + self.legacy.as_ref().map_or(0, |b| b.len())
            + self.pose_tracks.encode().map_or(MAX_BYTES + 1, |b| b.len())
            + self.review.encode().map_or(MAX_BYTES + 1, |b| b.len())
            + 16_384
    }
    fn apply(&self, app: &mut StudioApp) -> Result<(), String> {
        app.review.ensure_editable()?;
        self.review.validate()?;
        let legacy = self
            .legacy
            .as_ref()
            .map(|bytes| {
                hs_hahmo::Project::open(bytes)
                    .map(|project| crate::app::LegacyProject {
                        name: self
                            .legacy_name
                            .clone()
                            .unwrap_or_else(|| project.document.name.clone()),
                        project,
                        texture: None,
                        frame: u32::MAX,
                    })
                    .map_err(|e| e.to_string())
            })
            .transpose()?;
        hs_motion::pose_edit::PoseTracks::decode(&self.pose_tracks.encode()?)?;
        app.legacy = legacy;
        app.rig.revision = self.rig_revision;
        app.rig.invalidate_preview();
        app.production.pose_tracks = self.pose_tracks.clone();
        app.pose.invalidate();
        app.review = self.review.clone();
        app.library = self.library.clone();
        app.script = self.script.clone();
        app.production.cast_params = self.cast.clone();
        (
            app.production.width,
            app.production.height,
            app.production.fps,
        ) = self.size;
        (
            app.production.caption_settings,
            app.production.caption_overrides,
        ) = self.captions.clone();
        app.editing.tracks = self.tracks.as_ref().clone();
        app.editing.revision = self.editing_revision;
        app.production.soundtrack = app.editing.tracks.clone();
        app.image
            .restore_document(self.image.as_ref().clone(), self.image_revision);
        app.production.allow_silent_export = self.allow_silent;
        if let Some(player) = &app.voice.player {
            player.pause();
        }
        app.playing = false;
        app.workflow.line = None;
        app.blocks = Default::default();
        app.script_assist = Default::default();
        app.dirty_since = None;
        app.pipeline = hs_agents::Pipeline::default();
        app.run_pipeline();
        let content = crate::review_integration::capture_content(app, &[])?;
        crate::review_integration::synchronize_review(&mut app.review, &content)?;
        Ok(())
    }
}
#[derive(Default)]
pub struct SessionHistory {
    states: Vec<State>,
    cursor: usize,
    episode: String,
}
impl SessionHistory {
    pub fn can_undo(&self) -> bool {
        self.cursor > 0
    }
    pub fn can_redo(&self) -> bool {
        self.cursor + 1 < self.states.len()
    }
    pub fn observe(&mut self, app: &mut StudioApp) {
        let episode = &app.project.series.episodes[app.project.selected].id;
        if self.episode != *episode || self.states.is_empty() {
            match State::capture(app, None) {
                Ok(state) => {
                    self.states = vec![state];
                    self.cursor = 0;
                    self.episode = episode.clone();
                }
                Err(e) => app.status = e,
            }
            return;
        }
        if self.states[self.cursor].matches(app) {
            return;
        }
        let next = match State::capture(app, Some(&self.states[self.cursor])) {
            Ok(s) => s,
            Err(e) => {
                app.status = e;
                return;
            }
        };
        // Conservative bound counts shared data too. Announce history eviction.
        if next.bytes() > MAX_BYTES {
            if let Err(e) = self.states[self.cursor].apply(app) {
                app.status = e;
                return;
            }
            app.status =
                "Muutos ylittää yhteisen kumoushistorian 128 MiB rajan ja peruttiin.".into();
            return;
        }
        let mut evicted = false;
        while self.cursor + 1 >= MAX_STATES
            || self.states[..=self.cursor]
                .iter()
                .map(State::bytes)
                .sum::<usize>()
                + next.bytes()
                > MAX_BYTES
        {
            if self.cursor == 0 {
                self.states.clear();
                break;
            }
            self.states.remove(0);
            self.cursor -= 1;
            evicted = true;
        }
        if evicted {
            app.status =
                "Kumoushistoria rajattu 16 tilaan / 128 MiB: vanhin kumoustila poistettiin.".into();
        }
        self.states
            .truncate((self.cursor + 1).min(self.states.len()));
        self.states.push(next);
        self.cursor = self.states.len() - 1;
    }
    pub fn step(&mut self, app: &mut StudioApp, redo: bool) {
        if let Err(e) = app.review.ensure_editable() {
            app.status = e;
            return;
        }
        let next = if redo && self.can_redo() {
            self.cursor + 1
        } else if !redo && self.can_undo() {
            self.cursor - 1
        } else {
            return;
        };
        match self.states[next].apply(app) {
            Ok(()) => self.cursor = next,
            Err(e) => app.status = e,
        }
    }
}
impl StudioApp {
    pub fn undo_edit(&mut self, redo: bool) {
        if let Err(e) = self.review.ensure_editable() {
            self.status = e;
            return;
        }
        if self.voice.recorder.is_some()
            || self.export.is_some()
            || self.image.is_busy()
            || crate::project_ui::busy(self)
        {
            return;
        }
        let mut history = std::mem::take(&mut self.history);
        history.observe(self);
        history.step(self, redo);
        self.history = history;
    }
    pub fn observe_edits(&mut self) {
        let mut history = std::mem::take(&mut self.history);
        history.observe(self);
        self.history = history;
    }
}
