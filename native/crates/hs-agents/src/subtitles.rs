//! Tekstitykset repliikeistä: SRT ja WebVTT.
//!
//! Teksti on käsikirjoituksen repliikki sellaisenaan (nopeusohjeet kuten
//! `(quickly)` jätetään pois, kuten puheessakin). Tekstiä ei käännetä eikä
//! keksitä; kielen valinta kuuluu käsikirjoitukselle. Ajoitus tulee rivin
//! todellisesta paikasta aikajanalla: puheellisella rivillä puheen mittaan,
//! muuten rivin omaan kestoon.

use crate::Production;

#[derive(Clone, Debug, PartialEq)]
pub struct Cue {
    pub start: f32,
    pub end: f32,
    pub speaker: Option<String>,
    pub text: String,
}

/// Rivin enimmäisleveys merkkeinä; pidempi teksti jaetaan kahdeksi riviksi.
pub const MAX_LINE_CHARS: usize = 42;
/// Pienin näkyvissäoloaika sekunteina.
const MIN_SECONDS: f32 = 0.8;
const HOLD_AFTER_SPEECH: f32 = 0.15;

/// Tekstitysvihjeet nykyisestä tuotannosta, ajan mukaan järjestettynä.
pub fn cues(p: &Production) -> Vec<Cue> {
    let mut out: Vec<Cue> = Vec::new();
    for line in &p.voice_lines {
        let spoken = hs_voice::spoken::parse_spoken_text(&line.text).text;
        if spoken.trim().is_empty() {
            continue;
        }
        let Some(&(start, beat_len)) = p.beat_times.get(line.beat) else { continue };
        let shown = match &line.speech {
            Some(s) => (s.audio.duration() + HOLD_AFTER_SPEECH).min(beat_len),
            None => beat_len,
        }
        .max(MIN_SECONDS.min(beat_len));
        out.push(Cue { start, end: start + shown, speaker: line.speaker.clone(), text: wrap(&spoken) });
    }
    out.sort_by(|a, b| a.start.total_cmp(&b.start));
    // Seuraava vihje ei saa alkaa ennen edellisen loppua.
    for i in 1..out.len() {
        let next = out[i].start;
        if out[i - 1].end > next {
            out[i - 1].end = next;
        }
    }
    out
}

/// Jakaa tekstin enintään kahdelle riville sanarajalla.
pub fn wrap(text: &str) -> String {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.chars().count() <= MAX_LINE_CHARS {
        return text;
    }
    let words: Vec<&str> = text.split(' ').collect();
    let total: usize = text.chars().count();
    let mut best = (usize::MAX, 1);
    let mut left = 0;
    for i in 1..words.len() {
        left += words[i - 1].chars().count() + usize::from(i > 1);
        let right = total - left - 1;
        let diff = left.abs_diff(right);
        if diff < best.0 {
            best = (diff, i);
        }
    }
    format!("{}\n{}", words[..best.1].join(" "), words[best.1..].join(" "))
}

fn timestamp(seconds: f32, comma: bool) -> String {
    let ms = (seconds.max(0.0) * 1000.0).round() as u64;
    let sep = if comma { ',' } else { '.' };
    format!("{:02}:{:02}:{:02}{sep}{:03}", ms / 3_600_000, ms / 60_000 % 60, ms / 1000 % 60, ms % 1000)
}

pub fn to_srt(cues: &[Cue]) -> String {
    let mut out = String::new();
    for (i, c) in cues.iter().enumerate() {
        out.push_str(&format!("{}\n{} --> {}\n{}\n\n", i + 1, timestamp(c.start, true), timestamp(c.end, true), c.text));
    }
    out
}

pub fn to_vtt(cues: &[Cue]) -> String {
    let mut out = String::from("WEBVTT\n\n");
    for c in cues {
        let text = c.text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
        out.push_str(&format!("{} --> {}\n{}\n\n", timestamp(c.start, false), timestamp(c.end, false), text));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wraps_long_lines_at_word_boundaries() {
        assert_eq!(wrap("Short line"), "Short line");
        let w = wrap("This is a much longer line that really needs to be split in two");
        let parts: Vec<_> = w.split('\n').collect();
        assert_eq!(parts.len(), 2);
        assert!(parts.iter().all(|l| l.chars().count() <= MAX_LINE_CHARS), "{w}");
    }

    #[test]
    fn formats_srt_and_vtt() {
        let cues = [Cue { start: 1.5, end: 3661.25, speaker: None, text: "A < B".into() }];
        assert_eq!(to_srt(&cues), "1\n00:00:01,500 --> 01:01:01,250\nA < B\n\n");
        assert_eq!(to_vtt(&cues), "WEBVTT\n\n00:00:01.500 --> 01:01:01.250\nA &lt; B\n\n");
    }
}
