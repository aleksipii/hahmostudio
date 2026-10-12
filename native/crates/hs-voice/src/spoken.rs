//! Puhuttavan tekstin säännöt (portti: lib/kokoro.ts).
//!
//! Sulkeohjeista tulkitaan vain nopeus; muut ohjeet, esim. `(whispers)`,
//! poistetaan puhutusta tekstistä ja palautetaan huomautuksena. Tunnetta ei
//! arvata eikä korvata toisella.

use sha2::{Digest, Sha256};

pub const MAX_LINE: usize = 600;
pub const MAX_SECONDS: f32 = 120.0;
pub const MODEL_VERSION: &str = "Kokoro-82M-v1.0";

/// Kokoro-äänet, joita studio tarjoaa (sama lista kuin Electron-versiossa).
pub const VOICES: &[(&str, &str)] = &[
    ("af_heart", "Heart · nainen"),
    ("af_bella", "Bella · nainen"),
    ("af_nicole", "Nicole · nainen"),
    ("am_adam", "Adam · mies"),
    ("am_michael", "Michael · mies"),
    ("bf_emma", "Emma · nainen (UK)"),
    ("bm_george", "George · mies (UK)"),
];

pub fn is_voice(id: &str) -> bool {
    VOICES.iter().any(|(v, _)| *v == id)
}

#[derive(Clone, Debug, PartialEq)]
pub struct SpokenLine {
    pub text: String,
    pub speed: f32,
    pub notices: Vec<String>,
}

fn is_fast(cue: &str) -> bool {
    matches!(cue.to_lowercase().as_str(), "quickly" | "fast" | "rapidly" | "nopeasti" | "nopea")
}
fn is_slow(cue: &str) -> bool {
    matches!(cue.to_lowercase().as_str(), "slowly" | "slow" | "hitaasti" | "hidas")
}

pub fn parse_spoken_text(raw: &str) -> SpokenLine {
    let mut notices = Vec::new();
    let mut speed: f32 = 1.0;
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(open) = rest.find('(') {
        let after = &rest[open + 1..];
        match after.find([')', '(']) {
            Some(close) if after.as_bytes()[close] == b')' && after[..close].chars().count() <= 60 => {
                out.push_str(&rest[..open]);
                out.push(' ');
                let cue = after[..close].trim();
                if is_fast(cue) {
                    speed = (speed * 1.2).min(1.25);
                } else if is_slow(cue) {
                    speed = (speed * 0.85).max(0.7);
                } else {
                    notices.push(format!("Kokoro ei tue ohjetta ({cue}); sitä ei arvata."));
                }
                rest = &after[close + 1..];
            }
            _ => {
                out.push_str(&rest[..=open]);
                rest = after;
            }
        }
    }
    out.push_str(rest);
    let text = out.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.chars().count() > MAX_LINE {
        notices.push(format!("Rivi on yli {MAX_LINE} merkkiä."));
    }
    SpokenLine { text, speed: (speed * 1000.0).round() / 1000.0, notices }
}

const FINNISH_WORDS: &[&str] =
    &["että", "mutta", "minä", "sinä", "mitä", "kun", "niin", "olen", "oli", "joo", "ei", "kyllä", "hän", "siirsitkö", "eilen"];

/// Kokoro-ääni tässä vaiheessa vain englanniksi; suomalaista riviä ei yritetä
/// lausua englantilaisella äänellä.
pub fn is_english_line(text: &str) -> bool {
    if !text.chars().any(|c| c.is_ascii_alphabetic()) || text.chars().any(|c| matches!(c, 'ä' | 'ö' | 'Ä' | 'Ö')) {
        return false;
    }
    !text
        .split(|c: char| !c.is_alphanumeric())
        .any(|w| FINNISH_WORDS.iter().any(|f| f.eq_ignore_ascii_case(w)))
}

/// Välimuistiavain: sama teksti, ääni, nopeus ja malli → sama ääni.
pub fn cache_key(text: &str, voice: &str, speed: f32, model_version: &str) -> String {
    let json = serde_json::json!(["kokoro", text, voice, speed, model_version]).to_string();
    let digest = Sha256::digest(json.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

/// Rivin pysyvä tunniste puhujan ja tekstin mukaan (oma äänitys säilyy, vaikka
/// rivejä lisätään ennen sitä).
pub fn line_key(speaker: &str, text: &str) -> String {
    let digest = Sha256::digest(format!("{}\u{0}{}", speaker.to_lowercase(), text.trim()).as_bytes());
    digest.iter().take(8).map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_speed_cues_are_interpreted() {
        let s = parse_spoken_text("Hello (quickly) there (whispers) friend");
        assert_eq!(s.text, "Hello there friend");
        assert_eq!(s.speed, 1.2);
        assert_eq!(s.notices.len(), 1);
        assert!(s.notices[0].contains("whispers"));
        assert_eq!(parse_spoken_text("Slow (slowly)").speed, 0.85);
        assert_eq!(parse_spoken_text("(a (b) c").text, "(a c");
    }

    #[test]
    fn finnish_lines_are_not_spoken_in_english() {
        assert!(is_english_line("Hello, see you tomorrow!"));
        assert!(!is_english_line("Hei, nähdään huomenna!"));
        assert!(!is_english_line("Joo ok"));
        assert!(!is_english_line("1234"));
    }

    #[test]
    fn cache_key_is_stable_and_sensitive() {
        let a = cache_key("Hi", "af_heart", 1.0, MODEL_VERSION);
        assert_eq!(a, cache_key("Hi", "af_heart", 1.0, MODEL_VERSION));
        assert_ne!(a, cache_key("Hi", "am_adam", 1.0, MODEL_VERSION));
        assert_eq!(a.len(), 64);
    }
}
