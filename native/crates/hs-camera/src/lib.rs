//! Kamera ja pään seuranta esitystilaan (Adobe Character Animatorin tapaan).
//!
//! Seuranta on puhdasta Rustia eikä tarvitse mallitiedostoja eikä verkkoa:
//! ihonväriset pikselit (YCbCr-alue) erotetaan, ja CamShift-tyyppinen ikkuna
//! seuraa suurinta ihonväristä aluetta. Alueen paikka suhteessa neutraaliin
//! asentoon antaa kääntön ja nyökkäyksen, pääakselin kulma kallistuksen.
//! Kuva käsitellään pienennettynä (enintään 160 px leveä), joten seuranta on kevyt.

#[cfg(feature = "capture")]
mod capture;
#[cfg(feature = "capture")]
pub use capture::{CameraFeed, Preview};

/// RGB-kuva (8 bit, rivit peräkkäin).
#[derive(Clone, Debug)]
pub struct Rgb {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

impl Rgb {
    /// Pienentää kuvan laatikkosuotimella niin, että leveys on enintään `max_w`.
    pub fn downscaled(&self, max_w: u32) -> Rgb {
        let step = self.width.div_ceil(max_w).max(1);
        if step == 1 {
            return self.clone();
        }
        let (w, h) = (self.width / step, self.height / step);
        let mut data = vec![0u8; (w * h * 3) as usize];
        for y in 0..h {
            for x in 0..w {
                let mut sum = [0u32; 3];
                for dy in 0..step {
                    for dx in 0..step {
                        let i = (((y * step + dy) * self.width + x * step + dx) * 3) as usize;
                        for (s, v) in sum.iter_mut().zip(&self.data[i..i + 3]) {
                            *s += *v as u32;
                        }
                    }
                }
                let o = ((y * w + x) * 3) as usize;
                for (d, s) in data[o..o + 3].iter_mut().zip(sum) {
                    *d = (s / (step * step)) as u8;
                }
            }
        }
        Rgb { width: w, height: h, data }
    }
}

/// Ihonvärin todennäköisyys 0..1 (Chai & Ngan -alue YCbCr-avaruudessa, pehmeät reunat).
pub fn skin(r: u8, g: u8, b: u8) -> f32 {
    let (r, g, b) = (r as f32, g as f32, b as f32);
    let y = 0.299 * r + 0.587 * g + 0.114 * b;
    let cb = 128.0 - 0.168_736 * r - 0.331_264 * g + 0.5 * b;
    let cr = 128.0 + 0.5 * r - 0.418_688 * g - 0.081_312 * b;
    if !(35.0..=245.0).contains(&y) {
        return 0.0;
    }
    let soft = |v: f32, lo: f32, hi: f32| ((v - lo).min(hi - v) / 6.0).clamp(0.0, 1.0);
    soft(cb, 77.0, 127.0) * soft(cr, 133.0, 173.0)
}

/// Seurannan tulos yhdeltä kuvalta.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Blob {
    /// Keskipiste kuvan mittasuhteissa (0..1).
    pub x: f32,
    pub y: f32,
    /// Koko kuvan leveyteen suhteutettuna.
    pub size: f32,
    /// Pääakselin kulma pystysuorasta (rad), myötäpäivään positiivinen.
    pub angle: f32,
    /// Kuinka varma havainto on (0..1).
    pub confidence: f32,
}

/// Pään asento radiaaneina: kääntö (yaw), nyökkäys (pitch), kallistus (roll).
pub type HeadPose = [f32; 3];

pub struct HeadTracker {
    window: Option<(f32, f32, f32, f32)>,
    neutral: Option<Blob>,
    calibration: Vec<Blob>,
    smooth: Option<HeadPose>,
    /// Peilaa liikkeen (hahmo liikkuu kuin peilikuva). Oletus päällä.
    pub mirror: bool,
    /// Herkkyys: 1.0 = pää kääntyy ~35° kun kasvot siirtyvät neljänneksen kuvasta.
    pub gain: f32,
    /// Pehmennys 0..1 (suurempi = rauhallisempi).
    pub smoothing: f32,
    pub last: Option<Blob>,
}

impl Default for HeadTracker {
    fn default() -> Self {
        HeadTracker { window: None, neutral: None, calibration: Vec::new(), smooth: None, mirror: true, gain: 1.0, smoothing: 0.6, last: None }
    }
}

/// Kalibrointiin käytettävien kuvien määrä (noin sekunti).
const CALIBRATION_FRAMES: usize = 20;

impl HeadTracker {
    /// Asettaa nykyisen asennon neutraaliksi seuraavien kuvien perusteella.
    pub fn recalibrate(&mut self) {
        self.neutral = None;
        self.calibration.clear();
        self.smooth = None;
    }

    pub fn is_calibrated(&self) -> bool {
        self.neutral.is_some()
    }

    /// Etsii ihonvärisen alueen. Ikkuna seuraa edellistä havaintoa; jos kohde katoaa, haetaan koko kuvasta.
    pub fn locate(&mut self, img: &Rgb) -> Option<Blob> {
        let (w, h) = (img.width as f32, img.height as f32);
        if img.width < 8 || img.height < 8 {
            return None;
        }
        let weights: Vec<f32> = img.data.chunks_exact(3).map(|p| skin(p[0], p[1], p[2])).collect();
        let total: f32 = weights.iter().sum();
        let mut win = self.window.unwrap_or((0.0, 0.0, w, h));
        let mut result = None;
        for _ in 0..8 {
            let (x0, y0) = (win.0.max(0.0) as usize, win.1.max(0.0) as usize);
            let (x1, y1) = ((win.0 + win.2).min(w) as usize, (win.1 + win.3).min(h) as usize);
            let (mut m00, mut m10, mut m01, mut m20, mut m02, mut m11) = (0f32, 0f32, 0f32, 0f32, 0f32, 0f32);
            for y in y0..y1 {
                for x in x0..x1 {
                    let v = weights[y * img.width as usize + x];
                    if v > 0.0 {
                        let (fx, fy) = (x as f32, y as f32);
                        m00 += v;
                        m10 += v * fx;
                        m01 += v * fy;
                        m20 += v * fx * fx;
                        m02 += v * fy * fy;
                        m11 += v * fx * fy;
                    }
                }
            }
            // Liian pieni alue: ei kasvoja.
            if m00 < w * h * 0.004 {
                result = None;
                break;
            }
            let (cx, cy) = (m10 / m00, m01 / m00);
            let (a, b, c) = (m20 / m00 - cx * cx, m11 / m00 - cx * cy, m02 / m00 - cy * cy);
            // Pääakselin kulma pystysuorasta.
            let angle = -0.5 * (2.0 * b).atan2(c - a);
            let side = 2.2 * m00.sqrt();
            let next = (cx - side * 0.45, cy - side * 0.55, side * 0.9, side * 1.1);
            let conf = (m00 / (next.2 * next.3).max(1.0) * 2.0).clamp(0.0, 1.0) * (m00 / total.max(1.0)).sqrt().clamp(0.0, 1.0);
            result = Some(Blob { x: cx / w, y: cy / h, size: side / w, angle, confidence: conf });
            let moved = (next.0 - win.0).abs() + (next.1 - win.1).abs();
            win = next;
            if moved < 0.5 {
                break;
            }
        }
        self.window = result.map(|_| win);
        self.last = result;
        result
    }

    /// Seuraa yhden kuvan; palauttaa pään asennon, kun neutraali asento on kalibroitu.
    pub fn track(&mut self, img: &Rgb) -> Option<HeadPose> {
        let blob = self.locate(&img.downscaled(160))?;
        if blob.confidence < 0.15 {
            return None;
        }
        let Some(n) = self.neutral else {
            self.calibration.push(blob);
            if self.calibration.len() >= CALIBRATION_FRAMES {
                let k = self.calibration.len() as f32;
                let avg = |f: fn(&Blob) -> f32| self.calibration.iter().map(f).sum::<f32>() / k;
                self.neutral = Some(Blob { x: avg(|b| b.x), y: avg(|b| b.y), size: avg(|b| b.size), angle: avg(|b| b.angle), confidence: 1.0 });
            }
            return None;
        };
        let scale = self.gain / n.size.max(0.05);
        let dx = (blob.x - n.x) * if self.mirror { -1.0 } else { 1.0 };
        let yaw = (dx * scale * 1.6).clamp(-0.8, 0.8);
        let pitch = ((blob.y - n.y) * scale * 1.4).clamp(-0.5, 0.5);
        let mut roll = blob.angle - n.angle;
        if self.mirror {
            roll = -roll;
        }
        let roll = roll.clamp(-0.5, 0.5);
        let pose = [yaw, pitch, roll];
        let a = self.smoothing.clamp(0.0, 0.95);
        let s = match self.smooth {
            Some(p) => [p[0] * a + pose[0] * (1.0 - a), p[1] * a + pose[1] * (1.0 - a), p[2] * a + pose[2] * (1.0 - a)],
            None => pose,
        };
        self.smooth = Some(s);
        Some(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sininen tausta ja ihonvärinen ellipsi annettuun kohtaan ja kulmaan.
    fn face(w: u32, h: u32, cx: f32, cy: f32, angle: f32) -> Rgb {
        let mut data = Vec::with_capacity((w * h * 3) as usize);
        let (s, c) = angle.sin_cos();
        for y in 0..h {
            for x in 0..w {
                let (dx, dy) = (x as f32 - cx * w as f32, y as f32 - cy * h as f32);
                let (u, v) = (dx * c + dy * s, -dx * s + dy * c);
                let inside = (u / (w as f32 * 0.09)).powi(2) + (v / (w as f32 * 0.13)).powi(2) <= 1.0;
                data.extend_from_slice(if inside { &[224, 172, 140] } else { &[40, 70, 120] });
            }
        }
        Rgb { width: w, height: h, data }
    }

    #[test]
    fn skin_detection() {
        assert!(skin(224, 172, 140) > 0.5);
        assert!(skin(180, 120, 90) > 0.5);
        assert_eq!(skin(40, 70, 120), 0.0);
        assert_eq!(skin(20, 200, 30), 0.0);
    }

    #[test]
    fn finds_face_position_and_tilt() {
        let mut t = HeadTracker::default();
        let b = t.locate(&face(160, 120, 0.3, 0.5, 0.0)).unwrap();
        assert!((b.x - 0.3).abs() < 0.03 && (b.y - 0.5).abs() < 0.03, "{b:?}");
        assert!(b.angle.abs() < 0.05);
        let b = t.locate(&face(160, 120, 0.35, 0.5, 0.3)).unwrap();
        assert!((b.angle - 0.3).abs() < 0.08, "{b:?}");
        assert!(t.locate(&Rgb { width: 160, height: 120, data: vec![30; 160 * 120 * 3] }).is_none());
    }

    #[test]
    fn calibrates_then_reports_turns() {
        let mut t = HeadTracker { smoothing: 0.0, ..Default::default() };
        for _ in 0..CALIBRATION_FRAMES {
            assert!(t.track(&face(640, 480, 0.5, 0.5, 0.0)).is_none());
        }
        assert!(t.is_calibrated());
        let p = t.track(&face(640, 480, 0.5, 0.5, 0.0)).unwrap();
        assert!(p.iter().all(|v| v.abs() < 0.03), "{p:?}");
        // Kasvot siirtyvät kuvassa oikealle → peilattuna hahmo kääntyy vasemmalle (negatiivinen).
        let p = t.track(&face(640, 480, 0.62, 0.5, 0.0)).unwrap();
        assert!(p[0] < -0.2, "{p:?}");
        let p = t.track(&face(640, 480, 0.5, 0.58, 0.0)).unwrap();
        assert!(p[1] > 0.1, "{p:?}");
        let p = t.track(&face(640, 480, 0.5, 0.5, 0.25)).unwrap();
        assert!(p[2] < -0.1, "{p:?}");
    }
}
