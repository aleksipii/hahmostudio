//! Thin adapters between portable review state and the native episode workspaces.
//! Call guards BEFORE mutation. Hashing is a content-change/save/approval/export operation,
//! not an every-frame task; PCM and image documents can be large.
use crate::app::StudioApp;
use hs_project::production_review::{episode_fingerprint, ReviewState};
use hs_project::{Episode, ProjectAsset};

pub const REVIEW_KIND: &str = "review";
pub const REVIEW_ID: &str = "production-review";

/// Capture the authored source, character/voice profiles, retained PCM/provenance,
/// captions, image, soundtrack and persistent series library. Additional artistic
/// resources (e.g. pose/rig workspace) MUST be supplied by the integrating editor.
pub fn capture_content(app: &StudioApp, additional: &[ProjectAsset]) -> Result<Episode, String> {
    let old = app
        .project
        .series
        .episodes
        .get(app.project.selected)
        .ok_or("Valittua jaksoa ei ole")?;
    let mut episode = hs_agents::project::capture_checked(
        &app.production,
        old.id.clone(),
        old.number,
        old.name.clone(),
    )?;
    // Source editor may have an unprocessed draft: the actual source still invalidates approval.
    episode.script = app.script.clone();
    if let Some(legacy) = &app.legacy {
        episode.assets.push(ProjectAsset {
            id: "legacy-hahmo".into(),
            kind: "legacy".into(),
            bytes: legacy.project.encode().map_err(|e| e.to_string())?,
        });
    }
    episode.assets.push(ProjectAsset {
        id: "image-workspace".into(),
        kind: "image".into(),
        bytes: app.image.snapshot()?,
    });
    episode.assets.push(ProjectAsset {
        id: "editing-workspace".into(),
        kind: "editing".into(),
        bytes: hs_edit::encode_workspace(&app.editing.tracks)?,
    });
    episode.assets.push(ProjectAsset {
        id: "series-library".into(),
        kind: "library".into(),
        bytes: app.library.encode()?,
    });
    for asset in additional {
        if asset.kind == REVIEW_KIND
            || episode
                .assets
                .iter()
                .any(|a| a.kind == asset.kind || a.id == asset.id)
        {
            return Err("Päällekkäinen tai virheellinen tarkistuksen aineistoresurssi".into());
        }
        episode.assets.push(asset.clone());
    }
    Ok(episode)
}

/// Fresh projects without review resources start as unlocked drafts. Existing metadata
/// is validated before publication; a different artistic payload clears approval,
/// preserving an explicit lock and all comments/source anchors.
pub fn restore_review(episode: &Episode) -> Result<ReviewState, String> {
    let mut found = episode.assets.iter().filter(|a| a.kind == REVIEW_KIND);
    let mut review = match found.next() {
        Some(asset) => {
            if asset.id != REVIEW_ID {
                return Err("Virheellinen tarkistusresurssin tunniste".into());
            }
            ReviewState::decode(&asset.bytes)?
        }
        None => ReviewState::default(),
    };
    if found.next().is_some() {
        return Err("Päällekkäinen tarkistusresurssi".into());
    }
    review.synchronize(&episode_fingerprint(episode)?)?;
    Ok(review)
}

/// Synchronize and attach bounded review metadata to the exact snapshot being saved.
/// Saving a locked but externally changed snapshot preserves its stale lock honestly;
/// export_guard blocks publication until explicit unlocking and another review.
pub fn attach_review(episode: &mut Episode, review: &mut ReviewState) -> Result<(), String> {
    review.synchronize(&episode_fingerprint(episode)?)?;
    let bytes = review.encode()?;
    episode.assets.retain(|a| a.kind != REVIEW_KIND);
    episode.assets.push(ProjectAsset {
        id: REVIEW_ID.into(),
        kind: REVIEW_KIND.into(),
        bytes,
    });
    Ok(())
}

pub fn edit_guard(review: &ReviewState) -> Result<(), String> {
    review.ensure_editable()
}

/// Synchronize immediately before existing technical export preflight. An unlocked
/// personal-use draft is allowed; this function never claims artistic/technical readiness.
pub fn export_guard(review: &mut ReviewState, episode: &Episode) -> Result<(), String> {
    let hash = episode_fingerprint(episode)?;
    review.synchronize(&hash)?;
    review.ensure_exportable(&hash)
}

pub fn synchronize_review(review: &mut ReviewState, episode: &Episode) -> Result<String, String> {
    let hash = episode_fingerprint(episode)?;
    review.synchronize(&hash)?;
    Ok(hash)
}

/// Recheck only at meaningful review boundaries, never for every idle rendered frame.
fn refresh_review_content(app: &mut StudioApp) -> Result<String, String> {
    let snapshot = capture_content(app, &[])?;
    synchronize_review(&mut app.review, &snapshot)
}

impl StudioApp {
    pub fn review_workspace(&mut self, ctx: &eframe::egui::Context) {
        let frame = ctx.cumulative_pass_nr();
        let episode_id = self
            .project
            .series
            .episodes
            .get(self.project.selected)
            .map(|e| e.id.clone())
            .unwrap_or_default();
        let key = eframe::egui::Id::new("koeta-review-tab-presence");
        let entering = ctx.data_mut(|data| {
            let previous = data.get_temp::<(u64, String)>(key);
            let entering = previous.is_none_or(|(last, episode)| {
                frame.saturating_sub(last) > 1 || episode != episode_id
            });
            data.insert_temp(key, (frame, episode_id));
            entering
        });
        if entering {
            if let Err(error) = refresh_review_content(self) {
                self.review.approval = None;
                self.status = error;
            }
        }
        let can_approve = self.dirty_since.is_none()
            && self.pipeline_error.is_none()
            && hs_agents::audit::inspect(&self.production).allowed();
        eframe::egui::CentralPanel::default().show(ctx, |ui| {
            eframe::egui::ScrollArea::vertical().show(ui, |ui| {
                ui.label("Tarkistustila päivitetään avatessa ja tarkistustoiminnon yhteydessä.");
                if ui.button("Tarkista nykyinen sisältö").clicked() {
                    match refresh_review_content(self) {
                        Ok(_) => self.status = "Sisällön tarkistustila päivitetty.".into(),
                        Err(e) => { self.review.approval = None; self.status = e; }
                    }
                }
                let hash = self.review.content_hash.clone();
                let was_locked = self.review.locked;
                if self.review_ui.show(ui, &mut self.review, &self.script, &hash, can_approve) {
                    // A pending asynchronous audio result may have changed actual content
                    // since entering the tab. Validate the exact payload before accepting
                    // any new approval/lock. Comments and explicit unlocks are retained.
                    match refresh_review_content(self) {
                        Ok(current) if current == hash => {
                            self.status = "Jakson tarkistustila päivitetty.".into();
                        }
                        Ok(_) => {
                            if !was_locked { self.review.locked = false; }
                            self.status = "Sisältö muuttui tarkistuksen aikana. Tarkista uusi versio ennen hyväksymistä.".into();
                        }
                        Err(error) => {
                            self.review.approval = None;
                            if !was_locked { self.review.locked = false; }
                            self.status = error;
                        }
                    }
                }
            });
        });
    }
}
