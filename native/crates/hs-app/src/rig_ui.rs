//! Native cutout rig and transform-keyframe editor. Every accepted edit changes
//! the same validated animation used by Project::render and .hahmo persistence.
use eframe::egui;
use hs_hahmo::{Animation, Keyframe, Layer, Part, Point, Project, Rig, Track};
use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize)]
pub struct RigWorkspace {
    selected: String,
    pub frame: u32,
    #[serde(skip)]
    pub revision: u64,
    #[serde(skip)]
    undo: Vec<serde_json::Value>,
    #[serde(skip)]
    redo: Vec<serde_json::Value>,
    #[serde(skip)]
    message: String,
    #[serde(skip)]
    draft: Option<(String, u32, Keyframe)>,
    #[serde(skip)]
    preview: Option<(u32, u64, egui::TextureHandle)>,
}
fn layers<'a>(items: &'a [Layer], out: &mut Vec<&'a Layer>) {
    for layer in items {
        out.push(layer);
        layers(&layer.children, out);
    }
}
fn initialized(project: &Project) -> Animation {
    project.animation.clone().unwrap_or_else(|| {
        fn parts(items: &[Layer], parent: Option<&str>, output: &mut Vec<Part>) {
            for layer in items {
                output.push(Part {
                    key: layer.key.clone(),
                    pivot: Point {
                        x: layer.left + layer.width / 2.0,
                        y: layer.top + layer.height / 2.0,
                    },
                    parent_key: parent.map(str::to_owned),
                });
                parts(&layer.children, Some(&layer.key), output);
            }
        }
        let mut output = Vec::new();
        parts(&project.document.layers, None, &mut output);
        Animation {
            fps: 24.0,
            duration: 120.0,
            rig: Rig { parts: output },
            tracks: Vec::new(),
        }
    })
}
/// Preserve unknown animation/rig/part/keyframe metadata when editing known fields.
fn merge_animation(
    metadata: &serde_json::Value,
    animation: &Animation,
) -> Result<serde_json::Value, String> {
    let mut next = metadata.clone();
    let mut encoded = serde_json::to_value(animation).map_err(|e| e.to_string())?;
    fn preserve(old: &serde_json::Value, new: &mut serde_json::Value) {
        if let (Some(o), Some(n)) = (old.as_object(), new.as_object_mut()) {
            for (key, value) in o {
                if let Some(dst) = n.get_mut(key) {
                    preserve(value, dst);
                } else {
                    n.insert(key.clone(), value.clone());
                }
            }
        } else if let (Some(o), Some(n)) = (old.as_array(), new.as_array_mut()) {
            for item in n {
                let matched = o.iter().find(|old_item| {
                    let identity = item.get("key").or_else(|| item.get("frame"));
                    identity.is_some()
                        && identity == old_item.get("key").or_else(|| old_item.get("frame"))
                });
                if let Some(old_item) = matched {
                    preserve(old_item, item);
                }
            }
        }
    }
    if let Some(old) = next.get("animation") {
        preserve(old, &mut encoded);
    }
    next["animation"] = encoded;
    Ok(next)
}
impl RigWorkspace {
    /// Cached rendered animation with selectable joint points and attachment links.
    /// Call reset when changing the project, or invalidate after external edits.
    pub fn invalidate_preview(&mut self) {
        self.preview = None;
    }
    pub fn preview(&mut self, ui: &mut egui::Ui, project: &Project) {
        if self
            .preview
            .as_ref()
            .is_none_or(|(frame, revision, _)| *frame != self.frame || *revision != self.revision)
        {
            match project.render(self.frame) {
                Ok(image) => {
                    let color = egui::ColorImage::from_rgba_premultiplied(
                        [image.width() as usize, image.height() as usize],
                        image.data(),
                    );
                    self.preview = Some((
                        self.frame,
                        self.revision,
                        ui.ctx()
                            .load_texture("rig-preview", color, egui::TextureOptions::LINEAR),
                    ));
                }
                Err(error) => {
                    ui.colored_label(egui::Color32::RED, error.to_string());
                    return;
                }
            }
        }
        let Some((_, _, texture)) = &self.preview else {
            return;
        };
        let size = texture.size_vec2();
        let scale = (ui.available_width() / size.x).min(500.0 / size.y).min(1.0);
        let response = ui.add(
            egui::Image::new(texture)
                .fit_to_exact_size(size * scale)
                .sense(egui::Sense::click()),
        );
        let Some(animation) = &project.animation else {
            return;
        };
        let Ok(transforms) = hs_hahmo::animation_transforms(animation, self.frame as f64) else {
            return;
        };
        let mut points = std::collections::HashMap::new();
        for part in &animation.rig.parts {
            let Some(t) = transforms.get(&part.key) else {
                continue;
            };
            let mut x = t.a * part.pivot.x + t.c * part.pivot.y + t.e;
            let mut y = t.b * part.pivot.x + t.d * part.pivot.y + t.f;
            if let Some(scene) = &project.scene {
                x = x * scene.scale + scene.x - project.document.width * scene.scale / 2.0;
                y = y * scene.scale + scene.y - project.document.height * scene.scale / 2.0;
            }
            points.insert(
                part.key.clone(),
                response.rect.min + egui::vec2(x as f32, y as f32) * scale,
            );
        }
        let painter = ui.painter().with_clip_rect(response.rect);
        for part in &animation.rig.parts {
            let Some(point) = points.get(&part.key) else {
                continue;
            };
            if let Some(parent) = part.parent_key.as_ref().and_then(|key| points.get(key)) {
                painter.line_segment(
                    [*point, *parent],
                    egui::Stroke::new(1.5_f32, egui::Color32::LIGHT_BLUE),
                );
            }
            painter.circle_filled(
                *point,
                if part.key == self.selected { 6.0 } else { 4.0 },
                if part.key == self.selected {
                    egui::Color32::YELLOW
                } else {
                    egui::Color32::LIGHT_BLUE
                },
            );
        }
        if response.clicked() {
            if let Some(pointer) = response.interact_pointer_pos() {
                if let Some((key, _)) = points
                    .iter()
                    .filter(|(_, point)| point.distance(pointer) <= 12.0)
                    .min_by(|(_, a), (_, b)| a.distance(pointer).total_cmp(&b.distance(pointer)))
                {
                    self.selected = key.clone();
                    self.draft = None;
                }
            }
        }
    }
    pub fn snapshot(&self) -> Result<Vec<u8>, String> {
        serde_json::to_vec(self).map_err(|e| e.to_string())
    }
    pub fn restore(&mut self, bytes: &[u8]) -> Result<(), String> {
        if bytes.len() > 16_384 {
            return Err("Rig-editorin tila on liian suuri".into());
        }
        *self = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn reset(&mut self) {
        *self = Self::default();
    }
    fn commit(&mut self, project: &mut Project, animation: &Animation) -> bool {
        let old = project.metadata().clone();
        let result = merge_animation(&old, animation)
            .and_then(|next| project.replace_metadata(next).map_err(|e| e.to_string()));
        match result {
            Ok(()) => {
                self.undo.push(old);
                while self.undo.len() > 16
                    || self
                        .undo
                        .iter()
                        .map(|item| item.to_string().len())
                        .sum::<usize>()
                        > 16 * 1024 * 1024
                {
                    self.undo.remove(0);
                }
                self.redo.clear();
                self.revision = self.revision.wrapping_add(1);
                self.message.clear();
                self.draft = None;
                true
            }
            Err(e) => {
                self.message = e;
                false
            }
        }
    }
    pub fn undo(&mut self, project: &mut Project) -> bool {
        self.history(project, false)
    }
    pub fn redo(&mut self, project: &mut Project) -> bool {
        self.history(project, true)
    }
    fn history(&mut self, project: &mut Project, redo: bool) -> bool {
        let source = if redo { &mut self.redo } else { &mut self.undo };
        let Some(next) = source.last().cloned() else {
            return false;
        };
        let old = project.metadata().clone();
        match project.replace_metadata(next) {
            Ok(()) => {
                source.pop();
                if redo {
                    self.undo.push(old);
                } else {
                    self.redo.push(old);
                }
                self.revision = self.revision.wrapping_add(1);
                self.message.clear();
                self.draft = None;
                true
            }
            Err(e) => {
                self.message = e.to_string();
                false
            }
        }
    }
    /// Returns true when animation data changed. Set the legacy texture to None
    /// and render `frame` to update the application viewport immediately.
    pub fn ui(&mut self, ui: &mut egui::Ui, project: &mut Project) -> bool {
        let mut changed = false;
        ui.heading("Rig ja avainruudut");
        ui.label("2D-leikehahmon tasot, nivelpisteet ja periytyvät muunnokset");
        ui.horizontal(|ui| {
            if ui
                .add_enabled(!self.undo.is_empty(), egui::Button::new("Kumoa rig"))
                .clicked()
            {
                changed |= self.undo(project);
            }
            if ui
                .add_enabled(!self.redo.is_empty(), egui::Button::new("Tee uudelleen"))
                .clicked()
            {
                changed |= self.redo(project);
            }
        });
        let mut animation = initialized(project);
        if project.animation.is_none() && ui.button("Luo muokattava rig tasoista").clicked() {
            changed |= self.commit(project, &animation);
        }
        ui.horizontal(|ui| {
            ui.label("FPS");
            let a = ui
                .add(egui::DragValue::new(&mut animation.fps).range(1.0..=120.0))
                .changed();
            ui.label("Ruudut");
            let b = ui
                .add(egui::DragValue::new(&mut animation.duration).range(1.0..=7200.0))
                .changed();
            if a || b {
                changed |= self.commit(project, &animation);
            }
        });
        self.frame = self.frame.min(animation.duration.max(1.0) as u32 - 1);
        ui.add(
            egui::Slider::new(&mut self.frame, 0..=animation.duration.max(1.0) as u32 - 1)
                .text("Esikatseluruutu"),
        );
        let mut all = Vec::new();
        layers(&project.document.layers, &mut all);
        egui::ComboBox::from_id_salt("rig_selected")
            .selected_text(if self.selected.is_empty() {
                "Valitse taso"
            } else {
                &self.selected
            })
            .show_ui(ui, |ui| {
                for layer in &all {
                    ui.selectable_value(
                        &mut self.selected,
                        layer.key.clone(),
                        format!("{} [{}]", layer.name, layer.key),
                    );
                }
            });
        let Some(index) = animation
            .rig
            .parts
            .iter()
            .position(|p| p.key == self.selected)
        else {
            if !self.selected.is_empty() && ui.button("Lisää valittu taso rigiin").clicked() {
                if let Some(layer) = all.iter().find(|l| l.key == self.selected) {
                    animation.rig.parts.push(Part {
                        key: layer.key.clone(),
                        pivot: Point {
                            x: layer.left + layer.width / 2.0,
                            y: layer.top + layer.height / 2.0,
                        },
                        parent_key: None,
                    });
                    changed |= self.commit(project, &animation);
                }
            }
            if !self.message.is_empty() {
                ui.colored_label(egui::Color32::RED, &self.message);
            }
            return changed;
        };
        let mut parent = animation.rig.parts[index].parent_key.clone();
        egui::ComboBox::from_id_salt("rig_parent")
            .selected_text(parent.as_deref().unwrap_or("Ei emoniveltä"))
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut parent, None, "Ei emoniveltä");
                for part in &animation.rig.parts {
                    if part.key != self.selected {
                        ui.selectable_value(&mut parent, Some(part.key.clone()), &part.key);
                    }
                }
            });
        let mut pivot = Point {
            x: animation.rig.parts[index].pivot.x,
            y: animation.rig.parts[index].pivot.y,
        };
        let mut pivot_changed = false;
        ui.horizontal(|ui| {
            ui.label("Nivel X/Y");
            pivot_changed |= ui
                .add(egui::DragValue::new(&mut pivot.x).range(-100000.0..=100000.0))
                .changed();
            pivot_changed |= ui
                .add(egui::DragValue::new(&mut pivot.y).range(-100000.0..=100000.0))
                .changed();
        });
        if parent != animation.rig.parts[index].parent_key || pivot_changed {
            animation.rig.parts[index].parent_key = parent;
            animation.rig.parts[index].pivot = pivot;
            changed |= self.commit(project, &animation);
        }
        let track = animation.tracks.iter().find(|t| t.key == self.selected);
        let pose = hs_hahmo::sample_track(track, self.frame as f64);
        let mut key = track
            .and_then(|t| t.frames.iter().find(|k| k.frame == self.frame as f64))
            .cloned()
            .unwrap_or(Keyframe {
                frame: self.frame as f64,
                x: pose.x,
                y: pose.y,
                rotation: pose.rotation,
                scale: pose.scale,
                opacity: pose.opacity,
                easing: "linear".into(),
                bezier_curve: None,
            });
        if let Some((selected, frame, saved)) = &self.draft {
            if selected == &self.selected && *frame == self.frame {
                key = saved.clone();
            }
        }
        for (label, value, range) in [
            ("Siirto X", &mut key.x, -100000.0..=100000.0),
            ("Siirto Y", &mut key.y, -100000.0..=100000.0),
            ("Kierto °", &mut key.rotation, -3600.0..=3600.0),
            ("Mittakaava", &mut key.scale, 0.01..=100.0),
            ("Peittävyys", &mut key.opacity, 0.0..=1.0),
        ] {
            ui.horizontal(|ui| {
                ui.label(label);
                ui.add(egui::DragValue::new(value).range(range).speed(0.1));
            });
        }
        egui::ComboBox::from_id_salt("rig_easing")
            .selected_text(&key.easing)
            .show_ui(ui, |ui| {
                for mode in ["linear", "smooth", "hold"] {
                    ui.selectable_value(&mut key.easing, mode.into(), mode);
                }
            });
        self.draft = Some((self.selected.clone(), self.frame, key.clone()));
        if ui.button("Tallenna avainruutu").clicked() {
            upsert(&mut animation, &self.selected, key);
            changed |= self.commit(project, &animation);
        }
        if ui.button("Poista tämän ruudun avain").clicked() {
            if let Some(track) = animation.tracks.iter_mut().find(|t| t.key == self.selected) {
                track.frames.retain(|k| k.frame != self.frame as f64);
                changed |= self.commit(project, &animation);
            }
        }
        ui.horizontal_wrapped(|ui| {
            if let Some(track) = animation.tracks.iter().find(|t| t.key == self.selected) {
                for key in &track.frames {
                    if ui
                        .selectable_label(
                            key.frame == self.frame as f64,
                            format!("◆ {}", key.frame),
                        )
                        .clicked()
                    {
                        self.frame = key.frame as u32;
                    }
                }
            }
        });
        if !self.message.is_empty() {
            ui.colored_label(egui::Color32::RED, &self.message);
        }
        changed
    }
}
fn upsert(animation: &mut Animation, key: &str, frame: Keyframe) {
    if !animation.tracks.iter().any(|t| t.key == key) {
        animation.tracks.push(Track {
            key: key.into(),
            frames: vec![],
        });
    }
    let track = animation.tracks.iter_mut().find(|t| t.key == key).unwrap();
    track.frames.retain(|k| k.frame != frame.frame);
    track.frames.push(frame);
    track.frames.sort_by(|a, b| a.frame.total_cmp(&b.frame));
}
#[cfg(test)]
mod tests {
    use super::*;
    fn key(frame: f64, x: f64) -> Keyframe {
        Keyframe {
            frame,
            x,
            y: 0.0,
            rotation: 0.0,
            scale: 1.0,
            opacity: 1.0,
            easing: "linear".into(),
            bezier_curve: None,
        }
    }
    #[test]
    fn key_insert_replace_interpolate() {
        let mut a = Animation {
            fps: 24.0,
            duration: 24.0,
            rig: Rig { parts: vec![] },
            tracks: vec![],
        };
        upsert(&mut a, "hand", key(10.0, 100.0));
        upsert(&mut a, "hand", key(0.0, 0.0));
        assert_eq!(hs_hahmo::sample_track(a.tracks.first(), 5.0).x, 50.0);
        upsert(&mut a, "hand", key(10.0, 200.0));
        assert_eq!(a.tracks[0].frames.len(), 2);
        assert_eq!(hs_hahmo::sample_track(a.tracks.first(), 5.0).x, 100.0);
    }
    #[test]
    fn attachment_inherits_parent_motion_and_hold() {
        let mut a = Animation {
            fps: 24.0,
            duration: 24.0,
            rig: Rig {
                parts: vec![
                    Part {
                        key: "arm".into(),
                        pivot: Point { x: 0.0, y: 0.0 },
                        parent_key: None,
                    },
                    Part {
                        key: "hand".into(),
                        pivot: Point { x: 10.0, y: 0.0 },
                        parent_key: Some("arm".into()),
                    },
                ],
            },
            tracks: vec![],
        };
        upsert(&mut a, "arm", key(0.0, 0.0));
        upsert(&mut a, "arm", key(10.0, 100.0));
        let transform = hs_hahmo::animation_transforms(&a, 5.0).unwrap();
        assert_eq!(transform["hand"].e, 50.0);
        a.tracks[0].frames[0].easing = "hold".into();
        assert_eq!(
            hs_hahmo::animation_transforms(&a, 5.0).unwrap()["hand"].e,
            0.0
        );
        assert_eq!(
            hs_hahmo::animation_transforms(&a, 10.0).unwrap()["hand"].e,
            100.0
        );
    }
    #[test]
    fn cyclic_hierarchy_is_rejected() {
        let a = Animation {
            fps: 24.0,
            duration: 24.0,
            tracks: vec![],
            rig: Rig {
                parts: vec![
                    Part {
                        key: "a".into(),
                        pivot: Point { x: 0.0, y: 0.0 },
                        parent_key: Some("b".into()),
                    },
                    Part {
                        key: "b".into(),
                        pivot: Point { x: 0.0, y: 0.0 },
                        parent_key: Some("a".into()),
                    },
                ],
            },
        };
        assert!(hs_hahmo::animation_transforms(&a, 0.0).is_err());
    }
    #[test]
    fn actual_project_edit_render_save_and_undo() {
        let bytes = std::fs::read(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../Esimerkki-nivelet-ja-aannepuhe.hahmo"
        ));
        // Locate source fixture also when this module is checked in an isolated harness.
        let bytes = bytes
            .or_else(|_| {
                std::fs::read(
                    std::path::Path::new(file!())
                        .parent()
                        .unwrap()
                        .join("../../../../Esimerkki-nivelet-ja-aannepuhe.hahmo"),
                )
            })
            .unwrap();
        let mut project = Project::open(&bytes).unwrap();
        let mut workspace = RigWorkspace::default();
        let before = project.render(0).unwrap().data().to_vec();
        let mut animation = initialized(&project);
        let part = animation.rig.parts[0].key.clone();
        upsert(&mut animation, &part, key(0.0, 40.0));
        assert!(workspace.commit(&mut project, &animation));
        assert_ne!(project.render(0).unwrap().data(), before.as_slice());
        let encoded = project.encode().unwrap();
        let opened = Project::open(&encoded).unwrap();
        assert_eq!(
            opened.render(0).unwrap().data(),
            project.render(0).unwrap().data()
        );
        assert!(workspace.undo(&mut project));
        assert_eq!(project.render(0).unwrap().data(), before.as_slice());
        assert!(workspace.redo(&mut project));
        assert_ne!(project.render(0).unwrap().data(), before.as_slice());
        let old = project.metadata().clone();
        animation.rig.parts[0].parent_key = Some(part);
        assert!(!workspace.commit(&mut project, &animation));
        assert_eq!(project.metadata(), &old);
    }
    #[test]
    fn metadata_extensions_survive_known_field_edits() {
        let old = serde_json::json!({"animation":{"futureField":42,"rig":{"extension":"keep","parts":[{"key":"hand","custom":true}]},"tracks":[{"key":"hand","custom":"track","frames":[{"frame":0.0,"tag":"keep"}]}]}});
        let a = Animation {
            fps: 24.0,
            duration: 24.0,
            rig: Rig {
                parts: vec![Part {
                    key: "hand".into(),
                    pivot: Point { x: 0.0, y: 0.0 },
                    parent_key: None,
                }],
            },
            tracks: vec![Track {
                key: "hand".into(),
                frames: vec![key(0.0, 2.0)],
            }],
        };
        let merged = merge_animation(&old, &a).unwrap();
        assert_eq!(merged["animation"]["futureField"], 42);
        assert_eq!(merged["animation"]["rig"]["parts"][0]["custom"], true);
        assert_eq!(merged["animation"]["tracks"][0]["frames"][0]["tag"], "keep");
        assert_eq!(merged["animation"]["tracks"][0]["frames"][0]["x"], 2.0);
    }
}
