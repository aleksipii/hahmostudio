//! Explicit native 3D keyframe authoring against the actors' real skeletons.
use eframe::egui;
use hs_motion::{
    pose_edit::{sample_euler_degrees, Interpolation, PoseKey, PoseTracks},
    Skeleton,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PoseWorkspace {
    actor: String,
    joint: Option<String>,
    pub time: f64,
    rotation: [f32; 3],
    translation: [f32; 3],
    interpolation: Interpolation,
    #[serde(skip)]
    target: Option<(String, Option<String>, u64)>,
    #[serde(skip)]
    message: String,
}
impl Default for PoseWorkspace {
    fn default() -> Self {
        Self {
            actor: String::new(),
            joint: None,
            time: 0.0,
            rotation: [0.0; 3],
            translation: [0.0; 3],
            interpolation: Interpolation::Linear,
            target: None,
            message: String::new(),
        }
    }
}
impl PoseWorkspace {
    pub fn reset(&mut self) {
        *self = Self::default();
    }
    pub fn invalidate(&mut self) {
        self.target = None;
    }
    pub fn snapshot(&self) -> Result<Vec<u8>, String> {
        serde_json::to_vec(self).map_err(|e| e.to_string())
    }
    pub fn restore(&mut self, bytes: &[u8]) -> Result<(), String> {
        if bytes.len() > 16_384 {
            return Err("3D-editorin tila on liian suuri".into());
        }
        let next: Self = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        if next.actor.len() > 200
            || next.joint.as_ref().is_some_and(|j| j.len() > 200)
            || !next.time.is_finite()
            || !(0.0..=60.0).contains(&next.time)
            || next
                .rotation
                .iter()
                .chain(next.translation.iter())
                .any(|v| !v.is_finite())
        {
            return Err("Virheellinen 3D-editorin tila".into());
        }
        *self = next;
        Ok(())
    }
    /// `time` is the requested preview position. The host updates its viewport
    /// playhead even if the return value is false; true means authored data changed.
    pub fn ui(
        &mut self,
        ui: &mut egui::Ui,
        tracks: &mut PoseTracks,
        actors: &[(&str, &Skeleton)],
        duration: f64,
    ) -> bool {
        ui.heading("3D-avainruudut");
        ui.label("Olemassa olevan luurangon nivelmuunnokset. Juuri käyttää maailmakoordinaatteja; muut nivelet paikallisia koordinaatteja.");
        if actors.is_empty() {
            ui.label("Lisää käsikirjoitukseen hahmo ennen avainruutujen muokkaamista.");
            return false;
        }
        if !actors.iter().any(|(name, _)| *name == self.actor) {
            self.actor = actors[0].0.into();
            self.joint = None;
        }
        egui::ComboBox::from_id_salt("pose_actor")
            .selected_text(&self.actor)
            .show_ui(ui, |ui| {
                for (name, _) in actors {
                    ui.selectable_value(&mut self.actor, (*name).into(), *name);
                }
            });
        let Some((_, skeleton)) = actors.iter().find(|(name, _)| *name == self.actor) else {
            return false;
        };
        if self
            .joint
            .as_ref()
            .is_some_and(|name| skeleton.find(name).is_none())
        {
            self.joint = None;
        }
        egui::ComboBox::from_id_salt("pose_joint")
            .selected_text(self.joint.as_deref().unwrap_or("Juuri (maailma)"))
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut self.joint, None, "Juuri (maailma)");
                for joint in &skeleton.joints {
                    ui.selectable_value(&mut self.joint, Some(joint.name.clone()), &joint.name);
                }
            });
        let duration = if duration.is_finite() {
            duration.clamp(0.0, 60.0)
        } else {
            0.0
        };
        self.time = self.time.min(duration);
        ui.add(
            egui::Slider::new(&mut self.time, 0.0..=duration)
                .text("Aika (s)")
                .step_by(0.01),
        );
        let target = (self.actor.clone(), self.joint.clone(), self.time.to_bits());
        if self.target.as_ref() != Some(&target) {
            let selected = tracks.tracks.iter().find(|track| {
                track.actor.eq_ignore_ascii_case(&self.actor) && track.joint == self.joint
            });
            let (rotation, translation) = selected
                .and_then(|track| sample_euler_degrees(track, self.time))
                .unwrap_or(([0.0; 3], [0.0; 3]));
            self.rotation = rotation;
            self.translation = translation;
            self.interpolation = selected
                .and_then(|track| track.keys.iter().find(|key| key.time == self.time))
                .map_or(Interpolation::Linear, |key| key.interpolation);
            self.target = Some(target);
        }
        ui.label("Kierto XYZ (astetta)");
        ui.horizontal(|ui| {
            for value in &mut self.rotation {
                ui.add(egui::DragValue::new(value).range(-360.0..=360.0).speed(0.5));
            }
        });
        ui.label("Siirto XYZ (metriä)");
        ui.horizontal(|ui| {
            for value in &mut self.translation {
                ui.add(egui::DragValue::new(value).range(-5.0..=5.0).speed(0.01));
            }
        });
        egui::ComboBox::from_id_salt("pose_interpolation")
            .selected_text(format!("{:?}", self.interpolation))
            .show_ui(ui, |ui| {
                for mode in [
                    Interpolation::Linear,
                    Interpolation::Smooth,
                    Interpolation::Hold,
                ] {
                    ui.selectable_value(&mut self.interpolation, mode, format!("{mode:?}"));
                }
            });
        let mut changed = false;
        if ui.button("Tallenna 3D-avainruutu").clicked() {
            let key = PoseKey::from_euler_degrees(
                self.time,
                self.rotation,
                self.translation,
                self.interpolation,
            );
            let mut candidate = tracks.clone();
            match candidate
                .upsert(&self.actor, self.joint.as_deref(), key)
                .and_then(|_| candidate.validate(actors))
                .and_then(|_| candidate.validate_duration(duration))
            {
                Ok(()) => {
                    *tracks = candidate;
                    changed = true;
                    self.message.clear();
                }
                Err(error) => self.message = error,
            }
        }
        if ui.button("Poista avain tästä ajasta").clicked() {
            changed |= tracks.remove(&self.actor, self.joint.as_deref(), self.time);
            self.target = None;
        }
        ui.horizontal_wrapped(|ui| {
            if let Some(track) = tracks
                .tracks
                .iter()
                .find(|t| t.actor.eq_ignore_ascii_case(&self.actor) && t.joint == self.joint)
            {
                for key in &track.keys {
                    if ui
                        .selectable_label(key.time == self.time, format!("◆ {:.2}s", key.time))
                        .clicked()
                    {
                        self.time = key.time;
                        self.target = None;
                    }
                }
            }
        });
        if let Err(error) = tracks
            .validate(actors)
            .and_then(|_| tracks.validate_duration(duration))
        {
            ui.colored_label(egui::Color32::RED, error);
        }
        if !self.message.is_empty() {
            ui.colored_label(egui::Color32::RED, &self.message);
        }
        changed
    }
}
