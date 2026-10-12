//! Huulisynkka: äänestä (ja tunnetusta tekstistä tai foneemeista) visemit.
//!
//! Kuten Adobe Characterissa, suu vaihtaa muotoa visemien mukaan. Kaksi tapaa:
//!
//! * **Teksti tai foneemit tunnetaan** (Kokoro antaa IPA:n; oma äänitys antaa
//!   käsikirjoituksen rivin): äänen energiasta etsitään puhejaksot, ja
//!   foneemit jaetaan niihin tyypillisten kestojen suhteessa. Tauot osuvat
//!   äänen hiljaisiin kohtiin. Suomi lausutaan kuten kirjoitetaan, joten
//!   kirjaimet toimivat suoraan foneemeina.
//! * **Pelkkä ääni** (mikrofoni, tuntematon teksti): jokainen 10 ms ruutu
//!   luokitellaan energian, nollanylitysten ja matalien taajuuksien osuuden
//!   perusteella.
//!
//! Molemmat ovat deterministisiä. Lyhyet välähdykset yhdistetään, jotta suu ei
//! värise (vähimmäiskesto), ja muodosta toiseen siirrytään lyhyellä ristihäivytyksellä.

use serde::{Deserialize, Serialize};

/// Monoääni liukulukuina (−1..1).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Audio {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
}

impl Audio {
    pub fn duration(&self) -> f32 {
        if self.sample_rate == 0 {
            0.0
        } else {
            self.samples.len() as f32 / self.sample_rate as f32
        }
    }

    /// Lineaarinen uudelleennäytteistys (riittää puheelle ja vientiin).
    pub fn resampled(&self, rate: u32) -> Audio {
        if rate == self.sample_rate || self.samples.is_empty() {
            return Audio { samples: self.samples.clone(), sample_rate: rate };
        }
        let n = ((self.samples.len() as u64 * rate as u64) / self.sample_rate as u64) as usize;
        let step = self.sample_rate as f64 / rate as f64;
        let last = self.samples.len() - 1;
        let samples = (0..n)
            .map(|i| {
                let x = i as f64 * step;
                let i0 = (x as usize).min(last);
                let i1 = (i0 + 1).min(last);
                let f = (x - i0 as f64) as f32;
                self.samples[i0] * (1.0 - f) + self.samples[i1] * f
            })
            .collect();
        Audio { samples, sample_rate: rate }
    }

    /// Testeille ja esikatselulle: jokainen sana on soinnillinen purske ja välimerkit taukoja.
    pub fn synthetic_speech(text: &str, speed: f32, pitch: f32) -> Audio {
        let rate = 24000u32;
        let mut samples = vec![0.0f32; (0.05 * rate as f32) as usize];
        for word in text.split_whitespace() {
            let letters = word.chars().filter(|c| c.is_alphanumeric()).count();
            let n = ((0.065 * letters.max(1) as f32 / speed) * rate as f32) as usize;
            for i in 0..n {
                let t = i as f32 / rate as f32;
                let env = (std::f32::consts::PI * i as f32 / n as f32).sin().powf(0.5);
                samples.push(0.3 * env * (std::f32::consts::TAU * pitch * t).sin());
            }
            let pause = if word.ends_with(['.', '!', '?', ',', ';', ':']) { 0.28 } else { 0.06 };
            samples.extend(std::iter::repeat_n(0.0, (pause / speed * rate as f32) as usize));
        }
        Audio { samples, sample_rate: rate }
    }
}

/// Suun muodot (Preston Blair / Rhubarb / Character Animator -tyyliin).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Viseme {
    /// Lepo, suu kiinni rentona.
    Rest,
    /// M, B, P: huulet yhdessä.
    Mbp,
    /// Useimmat konsonantit (S, T, K, D, N…): hampaat lähes yhdessä.
    Consonant,
    /// I, EE: leveä, vähän auki.
    Ee,
    /// A, AA: suu auki.
    Ah,
    /// E, Ä, Ö, schwa: puoliksi auki.
    Eh,
    /// O: pyöreä ja auki.
    Oh,
    /// U, W, OO: suppu.
    Oo,
    /// F, V: alahuuli ylähampaita vasten.
    Fv,
    /// L, TH: kieli näkyy.
    L,
}

impl Viseme {
    pub const ALL: [Viseme; 10] =
        [Viseme::Rest, Viseme::Mbp, Viseme::Consonant, Viseme::Ee, Viseme::Ah, Viseme::Eh, Viseme::Oh, Viseme::Oo, Viseme::Fv, Viseme::L];

    pub fn finnish(self) -> &'static str {
        match self {
            Viseme::Rest => "lepo",
            Viseme::Mbp => "M/B/P",
            Viseme::Consonant => "konsonantti",
            Viseme::Ee => "I",
            Viseme::Ah => "A",
            Viseme::Eh => "E",
            Viseme::Oh => "O",
            Viseme::Oo => "U/W",
            Viseme::Fv => "F/V",
            Viseme::L => "L",
        }
    }

    pub fn is_vowel(self) -> bool {
        matches!(self, Viseme::Ee | Viseme::Ah | Viseme::Eh | Viseme::Oh | Viseme::Oo)
    }

    /// Muodon parametrit, joita hahmon suu käyttää.
    pub fn shape(self) -> MouthShape {
        let s = |open, wide, round, closed, teeth, tongue| MouthShape { open, wide, round, closed, teeth, tongue };
        match self {
            Viseme::Rest => s(0.0, 0.0, 0.0, 0.6, 0.0, 0.0),
            Viseme::Mbp => s(0.0, 0.05, 0.0, 1.0, 0.0, 0.0),
            Viseme::Consonant => s(0.16, 0.35, 0.0, 0.0, 0.8, 0.0),
            Viseme::Ee => s(0.22, 0.9, 0.0, 0.0, 0.6, 0.0),
            Viseme::Ah => s(1.0, 0.25, 0.0, 0.0, 0.3, 0.2),
            Viseme::Eh => s(0.55, 0.5, 0.0, 0.0, 0.4, 0.1),
            Viseme::Oh => s(0.62, -0.45, 0.7, 0.0, 0.0, 0.0),
            Viseme::Oo => s(0.25, -0.9, 1.0, 0.0, 0.0, 0.0),
            Viseme::Fv => s(0.1, 0.25, 0.0, 0.0, 1.0, 0.0),
            Viseme::L => s(0.45, 0.2, 0.0, 0.0, 0.5, 1.0),
        }
    }
}

/// Jatkuvat suun parametrit (0..1, `wide` −1..1). Hahmon rigi tulkitsee nämä.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct MouthShape {
    pub open: f32,
    pub wide: f32,
    pub round: f32,
    pub closed: f32,
    pub teeth: f32,
    pub tongue: f32,
}

impl MouthShape {
    pub fn lerp(self, o: MouthShape, t: f32) -> MouthShape {
        let l = |a: f32, b: f32| a + (b - a) * t;
        MouthShape {
            open: l(self.open, o.open),
            wide: l(self.wide, o.wide),
            round: l(self.round, o.round),
            closed: l(self.closed, o.closed),
            teeth: l(self.teeth, o.teeth),
            tongue: l(self.tongue, o.tongue),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct VisemeKey {
    pub t: f32,
    pub viseme: Viseme,
}

/// Yhden äänileikkeen visemit leikkeen omassa ajassa (sekunteina).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct VisemeTrack {
    pub keys: Vec<VisemeKey>,
    /// Normalisoitu voimakkuus 10 ms välein (0..1), avaa vokaaleja voimakkuuden mukaan.
    pub envelope: Vec<f32>,
    pub duration: f32,
}

pub const HOP: f32 = 0.01;
const CROSSFADE: f32 = 0.045;
const MIN_HOLD: f32 = 0.05;

impl VisemeTrack {
    pub fn viseme_at(&self, t: f32) -> Viseme {
        match self.keys.partition_point(|k| k.t <= t) {
            0 => Viseme::Rest,
            i => self.keys[i - 1].viseme,
        }
    }

    pub fn shape_at(&self, t: f32) -> MouthShape {
        if t < 0.0 || t > self.duration + CROSSFADE {
            return Viseme::Rest.shape();
        }
        let i = self.keys.partition_point(|k| k.t <= t);
        let (cur, start) = if i == 0 { (Viseme::Rest, 0.0) } else { (self.keys[i - 1].viseme, self.keys[i - 1].t) };
        let prev = if i >= 2 { self.keys[i - 2].viseme } else { Viseme::Rest };
        let f = smoothstep(((t - start) / CROSSFADE).clamp(0.0, 1.0));
        let mut shape = prev.shape().lerp(cur.shape(), f);
        if cur.is_vowel() {
            let e = self.energy_at(t);
            shape.open *= 0.55 + 0.45 * e.sqrt();
        }
        if t > self.duration {
            shape = shape.lerp(Viseme::Rest.shape(), smoothstep((t - self.duration) / CROSSFADE));
        }
        shape
    }

    fn energy_at(&self, t: f32) -> f32 {
        if self.envelope.is_empty() {
            return 1.0;
        }
        let x = t / HOP;
        let i = (x as usize).min(self.envelope.len() - 1);
        let j = (i + 1).min(self.envelope.len() - 1);
        let f = (x - i as f32).clamp(0.0, 1.0);
        self.envelope[i] * (1.0 - f) + self.envelope[j] * f
    }
}

fn smoothstep(x: f32) -> f32 {
    x * x * (3.0 - 2.0 * x)
}

/// Yksi foneemi- tai kirjainyksikkö.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Unit {
    Sound(Viseme, f32),
    Pause,
}

fn classify(c: char) -> Option<Unit> {
    use Viseme::*;
    let s = |v, w| Some(Unit::Sound(v, w));
    match c {
        'p' | 'b' | 'm' => s(Mbp, 0.7),
        'f' | 'v' | 'ʋ' => s(Fv, 0.7),
        'θ' | 'ð' | 'l' | 'ɫ' => s(L, 0.6),
        'w' => s(Oo, 0.6),
        'u' | 'ʊ' | 'ɯ' => s(Oo, 1.0),
        'O' | 'Q' | 'Y' => s(Oh, 1.3),
        'o' | 'ɔ' | 'ɒ' => s(Oh, 1.0),
        'I' | 'W' => s(Ah, 1.3),
        'ɑ' | 'a' | 'æ' | 'ɐ' | 'ä' => s(Ah, 1.0),
        'A' => s(Eh, 1.2),
        'ɛ' | 'e' | 'ʌ' | 'ə' | 'ɜ' | 'ɚ' | 'ᵊ' | 'ö' | 'ø' | 'œ' => s(Eh, 0.9),
        'i' | 'ɪ' | 'y' | 'ᵻ' | 'ɨ' | 'å' => s(Ee, 0.9),
        'j' => s(Ee, 0.5),
        '.' | ',' | '!' | '?' | ';' | ':' | '—' | '…' | '–' => Some(Unit::Pause),
        c if c.is_alphanumeric() => s(Consonant, 0.55),
        _ => None,
    }
}

/// Foneemi- tai kirjainjono yksiköiksi. Pituusmerkki `ː` pidentää edellistä.
fn units(phonemes: &str) -> Vec<Unit> {
    let mut out: Vec<Unit> = Vec::new();
    for c in phonemes.chars() {
        if c == 'ː' {
            if let Some(Unit::Sound(_, w)) = out.last_mut() {
                *w += 0.5;
            }
            continue;
        }
        match classify(c) {
            Some(Unit::Pause) if matches!(out.last(), Some(Unit::Pause) | None) => {}
            Some(u) => out.push(u),
            None => {}
        }
    }
    out
}

/// Energiaverho ja puhejaksot.
struct Analysis {
    rms: Vec<f32>,
    zcr: Vec<f32>,
    low: Vec<f32>,
    speech: Vec<bool>,
    peak: f32,
}

fn analyze(audio: &Audio) -> Analysis {
    let rate = audio.sample_rate.max(1) as f32;
    let hop = (rate * HOP) as usize;
    let win = hop * 2;
    let n = audio.samples.len().div_ceil(hop.max(1));
    // Yksinapainen alipäästö ~900 Hz: matalien taajuuksien osuus erottaa O/U:n muista.
    let a = (-std::f32::consts::TAU * 900.0 / rate).exp();
    let mut lp = Vec::with_capacity(audio.samples.len());
    let mut y = 0.0;
    for &x in &audio.samples {
        y = (1.0 - a) * x + a * y;
        lp.push(y);
    }
    let (mut rms, mut zcr, mut low) = (Vec::with_capacity(n), Vec::with_capacity(n), Vec::with_capacity(n));
    for f in 0..n {
        let s = (f * hop).saturating_sub(hop / 2);
        let e = (s + win).min(audio.samples.len());
        let w = &audio.samples[s..e];
        let len = w.len().max(1) as f32;
        let energy: f32 = w.iter().map(|x| x * x).sum::<f32>();
        let low_energy: f32 = lp[s..e].iter().map(|x| x * x).sum::<f32>();
        rms.push((energy / len).sqrt());
        zcr.push(w.windows(2).filter(|p| (p[0] >= 0.0) != (p[1] >= 0.0)).count() as f32 / len);
        low.push(if energy > 0.0 { low_energy / energy } else { 0.0 });
    }
    let mut sorted = rms.clone();
    sorted.sort_by(f32::total_cmp);
    let pct = |p: f32| sorted.get(((sorted.len().saturating_sub(1)) as f32 * p) as usize).copied().unwrap_or(0.0);
    let peak = pct(0.95).max(1e-6);
    let floor = pct(0.1);
    let threshold = (peak * 0.08).max(floor * 3.0).max(1e-4);
    let mut speech: Vec<bool> = rms.iter().map(|r| *r > threshold).collect();
    // Täytä alle 100 ms aukot ja poista alle 40 ms purskeet.
    fill_runs(&mut speech, false, 10);
    fill_runs(&mut speech, true, 4);
    Analysis { rms, zcr, low, speech, peak }
}

/// Kääntää `value`-jaksot, jotka ovat lyhyempiä kuin `max_len` ja joita ympäröi vastakkainen arvo.
fn fill_runs(v: &mut [bool], value: bool, max_len: usize) {
    let mut i = 0;
    while i < v.len() {
        if v[i] == value {
            let start = i;
            while i < v.len() && v[i] == value {
                i += 1;
            }
            if start > 0 && i < v.len() && i - start < max_len {
                v[start..i].iter_mut().for_each(|x| *x = !value);
            }
        } else {
            i += 1;
        }
    }
}

fn envelope(a: &Analysis) -> Vec<f32> {
    a.rms.iter().map(|r| (r / a.peak).clamp(0.0, 1.0)).collect()
}

/// Puhejaksot sekunteina.
fn segments(a: &Analysis) -> Vec<(f32, f32)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < a.speech.len() {
        if a.speech[i] {
            let s = i;
            while i < a.speech.len() && a.speech[i] {
                i += 1;
            }
            out.push((s as f32 * HOP, i as f32 * HOP));
        } else {
            i += 1;
        }
    }
    out
}

/// Visemit, kun teksti tai foneemit tunnetaan.
pub fn from_text(audio: &Audio, phonemes: &str) -> VisemeTrack {
    let a = analyze(audio);
    let segs = segments(&a);
    let units = units(phonemes);
    let total_weight: f32 = units.iter().map(|u| if let Unit::Sound(_, w) = u { *w } else { 0.0 }).sum();
    if segs.is_empty() || total_weight <= 0.0 {
        return finish(Vec::new(), envelope(&a), audio.duration());
    }
    let speech_time: f32 = segs.iter().map(|(s, e)| e - s).sum();
    // Puheaika → todellinen aika (puhejaksot peräkkäin).
    let to_time = |x: f32| -> f32 {
        let mut acc = 0.0;
        for &(s, e) in &segs {
            if x < acc + (e - s) {
                return s + (x - acc);
            }
            acc += e - s;
        }
        segs.last().unwrap().1
    };
    let mut keys = Vec::new();
    let mut acc = 0.0;
    for u in &units {
        if let Unit::Sound(v, w) = *u {
            keys.push(VisemeKey { t: to_time(acc / total_weight * speech_time), viseme: v });
            acc += w;
        }
    }
    // Hiljaiset kohdat lepoon.
    for &(_, e) in &segs {
        keys.push(VisemeKey { t: e, viseme: Viseme::Rest });
    }
    keys.sort_by(|x, y| x.t.total_cmp(&y.t));
    finish(keys, envelope(&a), audio.duration())
}

/// Visemit ilman ääntä: teksti jaetaan annettuun kestoon tasaisesti, välimerkit
/// tauoiksi. Käytetään, kun rivillä ei (vielä) ole puhetta, jotta suu liikkuu
/// silti oikeiden äänteiden mukaan.
pub fn from_text_timed(text: &str, duration: f32) -> VisemeTrack {
    let lower = text.to_lowercase();
    let units = units(&lower);
    const PAUSE: f32 = 0.18;
    let pauses = units.iter().skip(1).filter(|u| matches!(u, Unit::Pause)).count() as f32;
    let total: f32 = units.iter().map(|u| if let Unit::Sound(_, w) = u { *w } else { 0.0 }).sum();
    if total <= 0.0 || duration <= 0.05 {
        return VisemeTrack { keys: Vec::new(), envelope: Vec::new(), duration };
    }
    let pause = PAUSE.min(duration * 0.15 / pauses.max(1.0));
    let speech = (duration - pause * pauses).max(duration * 0.5);
    let mut keys = Vec::new();
    let mut t = 0.0;
    for (i, u) in units.iter().enumerate() {
        match *u {
            Unit::Sound(v, w) => {
                keys.push(VisemeKey { t, viseme: v });
                t += w / total * speech;
            }
            Unit::Pause if i > 0 && i + 1 < units.len() => {
                keys.push(VisemeKey { t, viseme: Viseme::Rest });
                t += pause;
            }
            Unit::Pause => {}
        }
    }
    keys.push(VisemeKey { t: t.min(duration), viseme: Viseme::Rest });
    finish(keys, Vec::new(), duration)
}

/// Visemit pelkästä äänestä (mikrofoni tai tuntematon teksti).
pub fn from_audio(audio: &Audio) -> VisemeTrack {
    let a = analyze(audio);
    let mut keys = Vec::new();
    let mut frames: Vec<Viseme> = (0..a.rms.len())
        .map(|i| {
            if !a.speech[i] {
                return Viseme::Rest;
            }
            let e = (a.rms[i] / a.peak).clamp(0.0, 1.0);
            // Soinnittomat suhuäänteet: paljon nollanylityksiä, vähän energiaa.
            if a.zcr[i] > 0.22 && e < 0.6 {
                return if a.zcr[i] > 0.4 { Viseme::Fv } else { Viseme::Consonant };
            }
            if e < 0.18 {
                return Viseme::Mbp;
            }
            if a.low[i] > 0.82 {
                return if e > 0.5 { Viseme::Oh } else { Viseme::Oo };
            }
            if e > 0.7 {
                Viseme::Ah
            } else if e > 0.4 {
                Viseme::Eh
            } else {
                Viseme::Ee
            }
        })
        .collect();
    // Mediaanisuodatus viiden ruudun ikkunalla vaimentaa värinää.
    let orig = frames.clone();
    for i in 2..orig.len().saturating_sub(2) {
        let w = &orig[i - 2..=i + 2];
        let best = w.iter().max_by_key(|v| w.iter().filter(|x| x == v).count()).copied().unwrap();
        frames[i] = best;
    }
    let mut last = None;
    for (i, v) in frames.iter().enumerate() {
        if Some(*v) != last {
            keys.push(VisemeKey { t: i as f32 * HOP, viseme: *v });
            last = Some(*v);
        }
    }
    finish(keys, envelope(&a), audio.duration())
}

/// Yhdistää peräkkäiset samat muodot ja liian lyhyet välähdykset.
fn finish(mut keys: Vec<VisemeKey>, envelope: Vec<f32>, duration: f32) -> VisemeTrack {
    keys.dedup_by(|b, a| a.viseme == b.viseme);
    let mut i = 0;
    while i + 1 < keys.len() {
        let len = keys[i + 1].t - keys[i].t;
        // M/B/P saa olla lyhyempi: huulten sulkeutuminen pitää näkyä.
        let min = if keys[i].viseme == Viseme::Mbp { MIN_HOLD * 0.7 } else { MIN_HOLD };
        if len < min && keys[i].viseme != Viseme::Rest {
            keys.remove(i);
            keys.dedup_by(|b, a| a.viseme == b.viseme);
            i = i.saturating_sub(1);
        } else {
            i += 1;
        }
    }
    if keys.first().is_some_and(|k| k.viseme == Viseme::Rest && k.t <= 0.0) {
        keys.remove(0);
    }
    VisemeTrack { keys, envelope, duration }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn speak(text: &str) -> (Audio, String) {
        (Audio::synthetic_speech(text, 1.0, 200.0), text.to_lowercase())
    }

    #[test]
    fn text_only_track_spans_the_line() {
        let t = from_text_timed("Moi, mitä kuuluu?", 2.0);
        assert_eq!(t.keys[0].viseme, Viseme::Mbp);
        assert!(t.keys.iter().any(|k| k.viseme == Viseme::Rest && k.t > 0.2 && k.t < 1.5));
        assert!(t.keys.last().unwrap().t <= 2.0 + 1e-4);
        assert!(t.shape_at(1.0).open >= 0.0);
        assert!(from_text_timed("", 2.0).keys.is_empty());
    }

    #[test]
    fn text_alignment_follows_pauses_and_closes_lips() {
        let (audio, ph) = speak("Mama, papa. Boo!");
        let track = from_text(&audio, &ph);
        assert!(!track.keys.is_empty());
        // Ensimmäinen ääni alkaa M:llä ja suu sulkeutuu B/P-kohdissa.
        assert_eq!(track.keys[0].viseme, Viseme::Mbp);
        assert!(track.keys.iter().filter(|k| k.viseme == Viseme::Mbp).count() >= 3);
        // Tauko pilkun kohdalla: jossain puheen keskellä suu lepää.
        let mid_rest = track.keys.iter().any(|k| k.viseme == Viseme::Rest && k.t > 0.2 && k.t < track.duration - 0.3);
        assert!(mid_rest, "{:?}", track.keys);
        // Hiljaisuudessa alussa ja lopussa suu on kiinni.
        assert_eq!(track.shape_at(0.0).open, 0.0);
        assert!(track.shape_at(track.duration + 0.2).open < 0.01);
        // Vokaali avaa suun.
        let open = (0..(track.duration * 100.0) as usize).map(|i| track.shape_at(i as f32 * 0.01).open).fold(0.0, f32::max);
        assert!(open > 0.5);
    }

    #[test]
    fn keys_respect_minimum_hold() {
        let (audio, ph) = speak("Supercalifragilistic expialidocious, extraordinarily!");
        let track = from_text(&audio, &ph);
        for w in track.keys.windows(2) {
            if w[0].viseme != Viseme::Rest {
                assert!(w[1].t - w[0].t >= MIN_HOLD * 0.7 - 1e-4, "{w:?}");
            }
        }
    }

    #[test]
    fn audio_only_detects_speech_and_silence() {
        let (mut audio, _) = speak("Hello there. How are you?");
        // Lisää kohinaa: luokittelun pitää silti löytää puhe.
        for (i, s) in audio.samples.iter_mut().enumerate() {
            *s += ((i * 7919) % 13) as f32 * 0.0004 - 0.0024;
        }
        let track = from_audio(&audio);
        assert!(track.keys.iter().any(|k| k.viseme.is_vowel()));
        assert!(track.keys.iter().any(|k| k.viseme == Viseme::Rest));
        assert_eq!(track.viseme_at(0.0), Viseme::Rest);
    }

    #[test]
    fn finnish_letters_work_as_phonemes() {
        let u = units("pöö, uu");
        assert_eq!(u[0], Unit::Sound(Viseme::Mbp, 0.7));
        assert!(matches!(u[1], Unit::Sound(Viseme::Eh, _)));
        assert_eq!(u[3], Unit::Pause);
        assert!(matches!(u[4], Unit::Sound(Viseme::Oo, _)));
    }
}
