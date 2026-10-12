//! Native local image workspace. The portable domain document lives in hs-image.
use eframe::egui;
use hs_image::{Document, History};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc,
};
enum JobResult {
    Replace(Document),
    Png(Document, String),
    Written,
}
struct Job {
    receiver: mpsc::Receiver<Result<JobResult, String>>,
    cancel: Arc<AtomicBool>,
}
pub struct ImageWorkspace {
    document: Document,
    history: History,
    selected: usize,
    color: [u8; 4],
    radius: u32,
    erase: bool,
    texture: Option<egui::TextureHandle>,
    message: String,
    stroke: bool,
    draft_name: String,
    draft_opacity: u8,
    draft_id: u64,
    mask_mode: bool,
    shift: [i32; 2],
    job: Option<Job>,
    texture_dirty: bool,
}
impl Default for ImageWorkspace {
    fn default() -> Self {
        Self {
            document: Document::new(512, 512).expect("valid canvas"),
            history: History::default(),
            selected: 0,
            color: [30, 120, 240, 255],
            radius: 10,
            erase: false,
            texture: None,
            message: String::new(),
            stroke: false,
            draft_name: String::new(),
            draft_opacity: 255,
            draft_id: 0,
            mask_mode: false,
            shift: [0, 0],
            job: None,
            texture_dirty: true,
        }
    }
}
impl ImageWorkspace {
    pub fn is_busy(&self) -> bool {
        self.job.is_some()
    }
    pub fn update(&mut self) {
        self.poll();
    }
    pub fn snapshot(&self) -> Result<Vec<u8>, String> {
        if self.job.is_some() {
            return Err("Kuvatyö on kesken; odota tai peruuta ennen projektin tallennusta".into());
        }
        self.document.encode()
    }
    pub fn restore(&mut self, bytes: &[u8]) -> Result<(), String> {
        if self.job.is_some() {
            return Err("Kuvatyö on kesken; odota ennen projektin vaihtoa".into());
        }
        let d = Document::decode(bytes)?;
        self.document = d;
        self.history.clear();
        self.selected = 0;
        self.texture = None;
        self.stroke = false;
        self.draft_id = 0;
        Ok(())
    }
    fn checkpoint(&mut self) -> bool {
        match self.history.checkpoint(&self.document) {
            Ok(()) => {
                self.texture_dirty = true;
                true
            }
            Err(e) => {
                self.message = e;
                false
            }
        }
    }
    fn start(
        &mut self,
        ctx: &egui::Context,
        task: impl FnOnce(Arc<AtomicBool>) -> Result<JobResult, String> + Send + 'static,
    ) {
        let (sender, receiver) = mpsc::channel();
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let result = task(flag);
            let _ = sender.send(result);
            ctx.request_repaint();
        });
        self.job = Some(Job { receiver, cancel });
        self.stroke = false;
    }
    /// Poll even when the image panel is hidden so completed jobs reach canonical state.
    pub fn poll(&mut self) {
        let Some(job) = &self.job else {
            return;
        };
        let result = match job.receiver.try_recv() {
            Ok(r) => r,
            Err(mpsc::TryRecvError::Empty) => return,
            Err(_) => Err("Kuvatyön taustasäie keskeytyi; alkuperäinen kuva säilyi".into()),
        };
        let canceled = job.cancel.load(Ordering::Relaxed);
        self.job = None;
        match result {
            Ok(JobResult::Written) => self.message = "Kuvatiedosto tallennettu".into(),
            Ok(_) if canceled => {
                self.message = "Tuonti peruutettu; alkuperäinen kuva säilyi".into()
            }
            Ok(JobResult::Replace(d)) => {
                if self.checkpoint() {
                    self.document = d;
                    self.selected = 0;
                    self.draft_id = 0;
                    self.texture = None;
                    self.message="Kuvadokumentti avattu. Edellinen tila palautuu Kumoa-toiminnolla. PSD:n lähdetavut säilyvät; väriprofiilimuunnosta ei tehdä.".into();
                }
            }
            Ok(JobResult::Png(d, name)) => {
                if self.checkpoint() {
                    if d.width != self.document.width || d.height != self.document.height {
                        self.document = d;
                        self.selected = 0;
                        self.draft_id = 0;
                        self.texture = None;
                    } else {
                        match self.document.add_layer(name) {
                            Ok(id) => {
                                let mut l = d.layers.into_iter().next().unwrap();
                                l.id = id;
                                *self.document.layers.last_mut().unwrap() = l;
                                self.selected = self.document.layers.len() - 1;
                            }
                            Err(e) => {
                                self.message = e;
                                return;
                            }
                        }
                    }
                    self.message = "PNG tuotu; edellinen tila palautuu Kumoa-toiminnolla".into();
                }
            }
            Err(e) => self.message = e,
        }
    }
    pub fn ui(&mut self, ui: &mut egui::Ui) {
        self.poll();
        if self.job.is_some() {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label("Kuvatyö taustalla…");
                if ui.button("Peruuta kuvatyö").clicked() {
                    if let Some(job) = &self.job {
                        job.cancel.store(true, Ordering::Relaxed);
                    }
                }
            });
            ui.ctx()
                .request_repaint_after(std::time::Duration::from_millis(100));
        }
        ui.add_enabled_ui(self.job.is_none(), |ui| self.content_ui(ui));
    }
    fn content_ui(&mut self, ui: &mut egui::Ui) {
        ui.heading("Kuva — paikallinen tasoeditori");
        ui.label("PNG, rasteritasot, sivellin, pyyhekumi ja peittävyys. Rajattu PSD: RGB/harmaasävy 8-bit, RAW/RLE, normaali sekoitus ja läpikulkevat ryhmät. Vektorit ja 3D-materiaalieditointi odottavat toteutusta.");
        ui.label("PNG-tuonti lisää samankokoisen kuvan tasona. Eri koko avaa uuden piirtoalueen; edellinen kuva säilyy kumoushistoriassa.");
        if ui.button("Tuo PSD uutena kuvadokumenttina").clicked() {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("PSD", &["psd"])
                .pick_file()
            {
                self.start(ui.ctx(), move |cancel| {
                    let b = read_bounded(&path, 100 * 1024 * 1024)?;
                    if cancel.load(Ordering::Relaxed) {
                        return Err("PSD-tuonti peruutettu".into());
                    }
                    Ok(JobResult::Replace(Document::import_psd(&b)?))
                });
            }
        }
        ui.horizontal_wrapped(|ui| {
            if ui.button("Tuo PNG").clicked() {
                if let Some(path) = rfd::FileDialog::new()
                    .add_filter("PNG", &["png"])
                    .pick_file()
                {
                    self.start(ui.ctx(), move |cancel| {
                        let b = read_bounded(&path, hs_image::MAX_BYTES)?;
                        if cancel.load(Ordering::Relaxed) {
                            return Err("PNG-tuonti peruutettu".into());
                        }
                        Ok(JobResult::Png(
                            Document::import_png(&b)?,
                            path.file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .into(),
                        ))
                    });
                }
            }
            if ui.button("Vie PNG").clicked() {
                if let Some(path) = rfd::FileDialog::new()
                    .add_filter("PNG", &["png"])
                    .set_file_name("koeta-kuva.png")
                    .save_file()
                {
                    let d = self.document.clone();
                    self.start(ui.ctx(), move |cancel| {
                        let b = d.export_png()?;
                        write_atomic(&path, &b, &cancel)?;
                        Ok(JobResult::Written)
                    });
                }
            }
            if ui.button("Avaa kuvadokumentti").clicked() {
                if let Some(path) = rfd::FileDialog::new()
                    .add_filter("Koeta kuva", &["koetaimg"])
                    .pick_file()
                {
                    self.start(ui.ctx(), move |cancel| {
                        let b = read_bounded(&path, hs_image::MAX_BYTES)?;
                        if cancel.load(Ordering::Relaxed) {
                            return Err("Avaus peruutettu".into());
                        }
                        Ok(JobResult::Replace(Document::decode(&b)?))
                    });
                }
            }
            if ui.button("Tallenna kuva").clicked() {
                if let Some(path) = rfd::FileDialog::new()
                    .add_filter("Koeta kuva", &["koetaimg"])
                    .set_file_name("kuva.koetaimg")
                    .save_file()
                {
                    let d = self.document.clone();
                    self.start(ui.ctx(), move |cancel| {
                        let b = d.encode()?;
                        write_atomic(&path, &b, &cancel)?;
                        Ok(JobResult::Written)
                    });
                }
            }
        });
        ui.horizontal(|ui| {
            if ui.button("Kumoa").clicked() {
                if let Err(e) = self.history.undo(&mut self.document) {
                    self.message = e;
                }
                self.texture_dirty = true;
                self.draft_id = 0;
            }
            if ui.button("Tee uudelleen").clicked() {
                if let Err(e) = self.history.redo(&mut self.document) {
                    self.message = e;
                }
                self.texture_dirty = true;
                self.draft_id = 0;
            }
            if ui.button("Tyhjennä vain kumoushistoria").clicked() {
                self.history.clear();
                self.message = "Kumoushistoria tyhjennetty; kuva säilyy".into();
            }
        });
        ui.horizontal(|ui| {
            ui.color_edit_button_srgba_unmultiplied(&mut self.color);
            ui.add(egui::Slider::new(&mut self.radius, 1..=128).text("Sivellin"));
            ui.checkbox(&mut self.erase, "Pyyhekumi");
            ui.checkbox(&mut self.mask_mode, "Maalaa maskiin");
            if ui.button("Täytä taso").clicked() && self.checkpoint() {
                self.document.fill(self.selected, self.color);
            }
            if ui.button("Lisää taso").clicked() && self.checkpoint() {
                match self
                    .document
                    .add_layer(format!("Taso {}", self.document.layers.len() + 1))
                {
                    Ok(_) => self.selected = self.document.layers.len() - 1,
                    Err(e) => self.message = e,
                };
            }
        });
        self.selected = self.selected.min(self.document.layers.len() - 1);
        for group in &self.document.groups {
            ui.label(format!(
                "Ryhmä #{} {} — vanhempi {:?} — {}",
                group.id,
                group.name,
                group.parent_id,
                if group.visible {
                    "näkyvä"
                } else {
                    "piilotettu"
                }
            ));
        }
        let mut visibility = None;
        for i in (0..self.document.layers.len()).rev() {
            let l = &self.document.layers[i];
            let mut visible = l.visible;
            ui.horizontal(|ui| {
                if ui
                    .selectable_label(
                        self.selected == i,
                        format!("#{} {} (ryhmä {:?})", l.id, l.name, l.parent_id),
                    )
                    .clicked()
                {
                    self.selected = i;
                }
                if ui.checkbox(&mut visible, "Näkyvä").changed() {
                    visibility = Some((i, visible));
                }
            });
        }
        if let Some((i, v)) = visibility {
            if self.checkpoint() {
                self.document.layers[i].visible = v;
            }
        }
        let l = &self.document.layers[self.selected];
        if self.draft_id != l.id {
            self.draft_id = l.id;
            self.draft_name = l.name.clone();
            self.draft_opacity = l.opacity;
        }
        ui.horizontal(|ui| {
            ui.text_edit_singleline(&mut self.draft_name);
            ui.add(egui::Slider::new(&mut self.draft_opacity, 0..=255).text("Peittävyys"));
            if ui.button("Käytä tasoasetuksia").clicked() && self.checkpoint() {
                let l = &mut self.document.layers[self.selected];
                l.name = self.draft_name.chars().take(256).collect();
                l.opacity = self.draft_opacity;
            }
        });
        ui.horizontal(|ui| {
            if ui.button("Taso ylemmäs").clicked()
                && self.selected + 1 < self.document.layers.len()
                && self.checkpoint()
            {
                self.document.layers.swap(self.selected, self.selected + 1);
                self.selected += 1;
            }
            if ui.button("Taso alemmas").clicked() && self.selected > 0 && self.checkpoint() {
                self.document.layers.swap(self.selected, self.selected - 1);
                self.selected -= 1;
            }
            if ui.button("Valkoinen maski").clicked() && self.checkpoint() {
                if let Err(e) = self.document.add_white_mask(self.selected) {
                    self.message = e;
                }
            }
            if ui.button("Poista maski").clicked() && self.checkpoint() {
                self.document.layers[self.selected].mask = None;
            }
        });
        ui.horizontal(|ui| {
            ui.label("Tason rasterisiirto (ulkopuolelle jäävä osa rajautuu):");
            ui.add(
                egui::DragValue::new(&mut self.shift[0])
                    .range(-4096..=4096)
                    .prefix("X "),
            );
            ui.add(
                egui::DragValue::new(&mut self.shift[1])
                    .range(-4096..=4096)
                    .prefix("Y "),
            );
            if ui.button("Siirrä").clicked() && self.checkpoint() {
                self.document
                    .translate(self.selected, self.shift[0], self.shift[1]);
            }
        });
        if !self.message.is_empty() {
            ui.label(&self.message);
        }
        if self.texture.is_none() || self.texture_dirty {
            let image = egui::ColorImage::from_rgba_unmultiplied(
                [self.document.width as usize, self.document.height as usize],
                &self.document.composite(),
            );
            match &mut self.texture {
                Some(t) => t.set(image, egui::TextureOptions::NEAREST),
                None => {
                    self.texture = Some(ui.ctx().load_texture(
                        "koeta-image",
                        image,
                        egui::TextureOptions::NEAREST,
                    ))
                }
            }
            self.texture_dirty = false;
        }
        let t = self.texture.as_ref().unwrap();
        let scale = (ui.available_width() / self.document.width as f32).min(1.0);
        let size = egui::vec2(
            self.document.width as f32 * scale,
            self.document.height as f32 * scale,
        );
        let response = ui.add(
            egui::Image::new(t)
                .fit_to_exact_size(size)
                .sense(egui::Sense::click_and_drag()),
        );
        if response.drag_started() {
            self.stroke = self.checkpoint();
        }
        if response.clicked() {
            self.stroke = self.checkpoint();
        }
        if (response.dragged() || response.clicked()) && self.stroke {
            if let Some(p) = response.interact_pointer_pos() {
                let x = ((p.x - response.rect.left()) / scale) as i32;
                let y = ((p.y - response.rect.top()) / scale) as i32;
                if self.mask_mode {
                    if let Err(e) = self.document.paint_mask(
                        self.selected,
                        x,
                        y,
                        self.radius,
                        if self.erase { 0 } else { 255 },
                    ) {
                        self.message = e;
                    }
                } else {
                    self.document
                        .paint(self.selected, x, y, self.radius, self.color, self.erase);
                }
                self.texture_dirty = true;
                ui.ctx().request_repaint();
            }
        }
        if response.drag_stopped() || response.clicked() {
            self.stroke = false;
        }
    }
}

fn read_bounded(path: &std::path::Path, limit: usize) -> Result<Vec<u8>, String> {
    use std::io::Read;
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() > limit as u64 {
        return Err("Kuvatiedoston kokoraja ylittyy".into());
    }
    let mut b = vec![];
    file.take(limit as u64 + 1)
        .read_to_end(&mut b)
        .map_err(|e| e.to_string())?;
    if b.len() > limit {
        return Err("Kuvatiedoston kokoraja ylittyy".into());
    }
    Ok(b)
}
fn write_atomic(path: &std::path::Path, b: &[u8], cancel: &AtomicBool) -> Result<(), String> {
    use std::io::Write;
    if cancel.load(Ordering::Relaxed) {
        return Err("Tallennus peruutettu".into());
    }
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let tmp = path.with_file_name(format!(".koeta-image-{}-{nonce}.tmp", std::process::id()));
    let mut f = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp)
        .map_err(|e| e.to_string())?;
    let result = (|| {
        f.write_all(b).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
        drop(f);
        if cancel.load(Ordering::Relaxed) {
            return Err("Tallennus peruutettu; edellinen tiedosto säilyi".into());
        }
        std::fs::rename(&tmp, path).map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(tmp);
    }
    result
}
