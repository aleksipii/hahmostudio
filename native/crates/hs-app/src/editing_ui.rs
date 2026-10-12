//! Soundtrack workspace; animation stays source-derived, not a fake ripple editor.
use eframe::egui;
use hs_core::Tick;
use hs_edit::Track;
#[derive(Default)]
pub struct EditingState {
    pub tracks: Vec<Track>,
    pub error: Option<String>,
}
impl EditingState {
    pub fn ui(&mut self, ui: &mut egui::Ui, duration: Tick) -> bool {
        let mut changed = false;
        ui.heading("Leikkaus · musiikki ja tehosteet");
        ui.label("Puheen ajoitus säilyy. Lisää paikallinen WAV musiikiksi tai tehosteeksi.");
        if ui.button("Tuo WAV-ääni…").clicked() {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("WAV", &["wav"])
                .pick_file()
            {
                let result = (|| {
                    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
                    if metadata.len() > hs_edit::MAX_BYTES as u64 {
                        return Err("WAV ylittää 128 MiB".into());
                    }
                    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
                    preflight_wav(&bytes)?;
                    let audio = hs_voice::wav::decode(&bytes).map_err(|e| e.to_string())?;
                    let mut i = 1usize;
                    while self
                        .tracks
                        .iter()
                        .any(|t| t.id == format!("soundtrack-{i}"))
                    {
                        i += 1;
                    }
                    let name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let t = Track::new(format!("soundtrack-{i}"), name, audio);
                    self.tracks.push(t);
                    if let Err(e) = hs_edit::validate_tracks(&self.tracks) {
                        self.tracks.pop();
                        return Err(e);
                    }
                    Ok(())
                })();
                match result {
                    Ok(()) => {
                        changed = true;
                        self.error = None
                    }
                    Err(e) => self.error = Some(e),
                }
            }
        }
        if let Some(error) = &self.error {
            ui.colored_label(egui::Color32::LIGHT_RED, error);
        }
        let mut remove = None;
        for (index, track) in self.tracks.iter_mut().enumerate() {
            ui.push_id(&track.id, |ui| {
                ui.group(|ui| {
                    ui.horizontal(|ui| {
                        ui.strong(&track.name);
                        if ui.button("Poista raita").clicked() {
                            remove = Some(index);
                        }
                    });
                    ui.label(format!(
                        "{:.2} s · {} Hz",
                        track.audio.duration(),
                        track.audio.sample_rate
                    ));
                    let mut start = track.start.seconds();
                    let mut fi = track.fade_in.seconds();
                    let mut fo = track.fade_out.seconds();
                    changed |= ui
                        .add(
                            egui::Slider::new(
                                &mut start,
                                0.0..=duration.seconds().clamp(0.0, 60.0),
                            )
                            .text("Alkaa (s)"),
                        )
                        .changed();
                    changed |= ui
                        .add(egui::Slider::new(&mut track.gain, 0.0..=2.0).text("Voimakkuus"))
                        .changed();
                    changed |= ui
                        .add(egui::Slider::new(&mut fi, 0.0..=60.0).text("Häivytys sisään (s)"))
                        .changed();
                    changed |= ui
                        .add(egui::Slider::new(&mut fo, 0.0..=60.0).text("Häivytys ulos (s)"))
                        .changed();
                    track.start = Tick::from_seconds(start);
                    track.fade_in = Tick::from_seconds(fi);
                    track.fade_out = Tick::from_seconds(fo);
                    ui.horizontal(|ui| {
                        changed |= ui
                            .checkbox(&mut track.loop_audio, "Toista silmukkana")
                            .changed();
                        changed |= ui.checkbox(&mut track.mute, "Mykistä").changed();
                        changed |= ui
                            .checkbox(&mut track.duck, "Hiljennä puheen aikana")
                            .changed();
                    });
                    waveform(ui, &track.audio.samples);
                });
            });
        }
        if let Some(index) = remove {
            self.tracks.remove(index);
            changed = true;
        }
        changed
    }
}
fn waveform(ui: &mut egui::Ui, samples: &[f32]) {
    let (rect, _) = ui.allocate_exact_size(
        egui::vec2(ui.available_width().max(1.0), 48.0),
        egui::Sense::hover(),
    );
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, egui::Color32::from_gray(24));
    if samples.is_empty() {
        return;
    }
    let columns = (rect.width() as usize).clamp(1, 2048);
    for x in 0..columns {
        let lo = x * samples.len() / columns;
        let hi = ((x + 1) * samples.len() / columns)
            .max(lo + 1)
            .min(samples.len());
        let peak = samples[lo..hi]
            .iter()
            .fold(0.0f32, |v, s| v.max(s.abs()))
            .min(1.0);
        let px = rect.left() + x as f32 * rect.width() / columns as f32;
        let h = peak * rect.height() * 0.45;
        painter.line_segment(
            [
                egui::pos2(px, rect.center().y - h),
                egui::pos2(px, rect.center().y + h),
            ],
            egui::Stroke::new(1.0_f32, egui::Color32::LIGHT_BLUE),
        );
    }
}

// Bound decoded allocation before the shared WAV decoder allocates PCM.
fn preflight_wav(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() < 12 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err("Tiedosto ei ole WAV".into());
    }
    let mut pos = 12usize;
    let mut format = None;
    while pos + 8 <= bytes.len() {
        let len = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        let body = pos + 8;
        let end = body
            .checked_add(len)
            .filter(|e| *e <= bytes.len())
            .ok_or("Katkennut WAV")?;
        if &bytes[pos..pos + 4] == b"fmt " && len >= 16 {
            let channels =
                u16::from_le_bytes(bytes[body + 2..body + 4].try_into().unwrap()) as usize;
            let rate = u32::from_le_bytes(bytes[body + 4..body + 8].try_into().unwrap());
            let bits = u16::from_le_bytes(bytes[body + 14..body + 16].try_into().unwrap()) as usize;
            if channels == 0
                || channels > 8
                || !(8000..=192000).contains(&rate)
                || ![8, 16, 24, 32].contains(&bits)
            {
                return Err("WAV-muoto ei kelpaa".into());
            }
            format = Some((channels * bits / 8, rate));
        } else if &bytes[pos..pos + 4] == b"data" {
            let (frame, rate) = format.ok_or("WAV-muoto puuttuu")?;
            if len / frame > rate as usize * 60 {
                return Err("Ääni ylittää 60 sekuntia".into());
            }
            return Ok(());
        }
        pos = end.checked_add(len & 1).ok_or("WAV liian suuri")?;
    }
    Err("WAV-ääni puuttuu".into())
}
