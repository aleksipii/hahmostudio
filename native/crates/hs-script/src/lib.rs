//! Sääntöpohjainen käsikirjoitusjäsennin.
//!
//! Siirretty TypeScript-versiosta `lib/screenplay.ts` samoin säännöin:
//! hakasulkeissa olevat tagit ovat ohjeita, muu teksti on puhetta. Jäsennin
//! on deterministinen eikä koskaan arvaa: tuntematon tagi tuottaa virheen
//! eikä muutu joksikin muuksi liikkeeksi. Jäsennin ei koskaan kaadu; jokainen
//! rivi saa tuloksen (aikajanalle tai diagnostiikkaan).
//!
//! Lisäykset natiiviversioon (taaksepäin yhteensopivia):
//! * `NIMI: repliikki` -puhujaetuliite.
//! * `[näpyttele puhelinta 3s]` -> [`MotionKind::PhoneTap`].
//! * `[kuva laaja|puolilähi|lähikuva|insertti]` -> kameraohje.

use hs_core::{
    CameraHint, Diagnostic, Direction, EventKind, Fps, MotionKind, PhoneView, Severity,
    SourceSpan, Tick, Timeline, View,
};
use serde::{Deserialize, Serialize};

pub const MAX_SCRIPT_CHARS: usize = 12_000;
pub const MAX_TOTAL_SECONDS: f64 = 60.0;
pub const MIN_LINE_SECONDS: f64 = 0.5;
pub const MAX_LINE_SECONDS: f64 = 20.0;

/// Taustojen nimet, samat kuin `lib/screenplay.ts`.
pub const BACKGROUND_ALIASES: &[(&str, &str)] = &[
    ("studio", "studio-v1"),
    ("studio valoisa", "studio-premium-v1"),
    ("olohuone", "apartment-v1"),
    ("kaupunki ilta", "city-evening-v1"),
    ("auto moderni", "car-interior-v2"),
    ("puhelin edestä", "phone-front-v1"),
    ("phone front", "phone-front-v1"),
    ("puhelin sivuviisto", "phone-angle-v1"),
    ("phone angle", "phone-angle-v1"),
    ("auto kuljettaja", "car-driver-v1"),
    ("car driver", "car-driver-v1"),
    ("auto matkustaja", "car-passenger-v1"),
    ("car passenger", "car-passenger-v1"),
    ("auto takapenkki", "car-back-v1"),
    ("car back", "car-back-v1"),
];

/// Yksi käsikirjoituksen rivi tulkittuna.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Beat {
    pub line: usize,
    pub speaker: Option<String>,
    pub text: String,
    pub motion: MotionKind,
    pub seconds: f64,
    pub background: Option<String>,
    pub view: Option<View>,
    pub phone: Option<PhoneView>,
    pub camera: Option<CameraHint>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ScriptPlan {
    pub beats: Vec<Beat>,
    pub diagnostics: Vec<Diagnostic>,
    pub seconds: f64,
}

impl ScriptPlan {
    /// Lopullinen kokoaminen sallitaan vain, kun virheitä ei ole.
    pub fn is_assemblable(&self) -> bool {
        !self.beats.is_empty() && !self.diagnostics.iter().any(|d| d.severity == Severity::Error)
    }
}

fn lower(s: &str) -> String {
    s.to_lowercase()
}

/// Sanat Unicode-kirjaimina/numeroina; heittomerkki pidetään sanan osana (don't).
fn words(s: &str) -> Vec<String> {
    s.split(|c: char| !(c.is_alphanumeric() || c == '\'' || c == '’'))
        .filter(|w| !w.is_empty())
        .map(|w| w.to_lowercase().replace('’', "'"))
        .collect()
}

fn has_negation(s: &str) -> bool {
    words(s).iter().any(|w| matches!(w.as_str(), "ei" | "en" | "älä" | "don't" | "dont" | "not"))
}

/// Tunnistaa liikkeen tekstistä. Kieltosana estää tulkinnan kokonaan.
pub fn motion_from_text(text: &str) -> Option<MotionKind> {
    if has_negation(text) {
        return None;
    }
    let t = lower(text);
    let any = |keys: &[&str]| keys.iter().any(|k| t.contains(k));
    let dir = || {
        if any(&["vasem", "left"]) {
            Direction::Left
        } else if any(&["suoraan", "kohti", "front", "forward"]) {
            Direction::Front
        } else {
            Direction::Right
        }
    };
    if any(&["näpytt", "näppäil", "tekstaa", "tekstaile", "texting", "tap phone", "type on phone"]) {
        return Some(MotionKind::PhoneTap);
    }
    if any(&["juoks", "juokse", "run"]) {
        return Some(MotionKind::Run(dir()));
    }
    if any(&["kävel", "kävele", "walk"]) {
        return Some(MotionKind::Walk(dir()));
    }
    if any(&["vilkut", "vilkuta", "heilut", "wave"]) {
        return Some(MotionKind::Wave);
    }
    if any(&["hypp", "jump"]) {
        return Some(MotionKind::Jump);
    }
    if any(&["kyyk", "crouch"]) {
        return Some(MotionKind::Crouch);
    }
    if any(&["nyökk", "nyökä", "nod"]) {
        return Some(MotionKind::Nod);
    }
    if any(&["odot", "tauko", "wait", "pause"]) {
        return Some(MotionKind::Wait);
    }
    None
}

/// Etsii kestoa muotoa `2s`, `2,5 s`, `3 sek`, `1.5 seconds`.
pub fn duration_in(tag: &str) -> Option<f64> {
    let chars: Vec<char> = tag.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i].is_ascii_digit() && (i == 0 || !chars[i - 1].is_alphanumeric()) {
            let start = i;
            while i < chars.len() && chars[i].is_ascii_digit() {
                i += 1;
            }
            if i + 1 < chars.len() && (chars[i] == '.' || chars[i] == ',') && chars[i + 1].is_ascii_digit() {
                i += 1;
                while i < chars.len() && chars[i].is_ascii_digit() {
                    i += 1;
                }
            }
            let number: String = chars[start..i].iter().collect::<String>().replace(',', ".");
            let mut j = i;
            while j < chars.len() && chars[j] == ' ' {
                j += 1;
            }
            let rest: String = chars[j..].iter().collect::<String>().to_lowercase();
            for unit in ["seconds", "sek", "s"] {
                if let Some(after) = rest.strip_prefix(unit) {
                    if after.chars().next().map_or(true, |c| !c.is_alphanumeric()) {
                        return number.parse().ok();
                    }
                }
            }
        } else {
            i += 1;
        }
    }
    None
}

fn strip_keyword<'a>(tag: &'a str, keys: &[&str]) -> Option<&'a str> {
    let low = lower(tag);
    for k in keys {
        if low.starts_with(k) {
            let rest = &tag[k.len()..];
            let rest = rest.trim_start();
            let rest = rest.strip_prefix(':').unwrap_or(rest).trim();
            if !rest.is_empty() && (tag.len() == k.len() || !tag[k.len()..].starts_with(|c: char| c.is_alphanumeric())) {
                return Some(rest);
            }
        }
    }
    None
}

enum Tag {
    Phone(PhoneView),
    View(View),
    Background(String),
    Camera(CameraHint),
    Motion(MotionKind, Option<f64>),
}

fn classify(tag: &str) -> Result<Tag, String> {
    let low = lower(tag);
    let low = low.trim();
    // [puhelin edestä] / [esine puhelin pois]
    let phone_part = low.strip_prefix("esine ").unwrap_or(low);
    if let Some(rest) = phone_part.strip_prefix("puhelin ") {
        let v = match rest.trim() {
            "edestä" => Some(PhoneView::Front),
            "takaa" => Some(PhoneView::Back),
            "sivulta" => Some(PhoneView::Side),
            "pois" => Some(PhoneView::Hidden),
            _ => None,
        };
        if let Some(v) = v {
            return Ok(Tag::Phone(v));
        }
    }
    if let Some(rest) = strip_keyword(tag, &["hahmo", "suunta", "view"]) {
        let v = match lower(rest).as_str() {
            "edestä" | "front" => Some(View::Front),
            "vasen" | "vasemmalle" | "left" => Some(View::Left),
            "oikea" | "oikealle" | "right" => Some(View::Right),
            "takaa" | "selin" | "back" => Some(View::Back),
            _ => None,
        };
        if let Some(v) = v {
            return Ok(Tag::View(v));
        }
    }
    if let Some(rest) = strip_keyword(tag, &["tausta", "kuvakulma", "background"]) {
        let key = lower(rest);
        return BACKGROUND_ALIASES
            .iter()
            .find(|(alias, _)| *alias == key)
            .map(|(_, id)| Tag::Background((*id).to_string()))
            .ok_or_else(|| format!("Tuntematon kuvausympäristö: {rest}. Valitse ohjeessa mainittu nimi."));
    }
    if let Some(rest) = strip_keyword(tag, &["kuva", "shot"]) {
        let hint = match lower(rest).as_str() {
            "laaja" | "kokokuva" | "yleiskuva" | "wide" => Some(CameraHint::Wide),
            "puolilähi" | "puolikuva" | "medium" => Some(CameraHint::Medium),
            "lähikuva" | "lähi" | "close" | "closeup" | "close-up" => Some(CameraHint::CloseUp),
            "insertti" | "insert" => Some(CameraHint::Insert),
            _ => None,
        };
        return hint
            .map(Tag::Camera)
            .ok_or_else(|| format!("Tuntematon kuvaohje: [{tag}]. Käytä laaja, puolilähi, lähikuva tai insertti."));
    }
    match motion_from_text(tag) {
        Some(m) => Ok(Tag::Motion(m, duration_in(tag))),
        None => Err(format!("Tuntematon liikeohje: [{tag}]. Käytä esimerkiksi [vilkuta 2s].")),
    }
}

/// Erottaa `NIMI: repliikki` -puhujan, jos etuliite on yksi sana isolla alkukirjaimella.
fn split_speaker(spoken: &str) -> (Option<String>, String) {
    if let Some((head, rest)) = spoken.split_once(':') {
        let head = head.trim();
        let ok = !head.is_empty()
            && head.chars().count() <= 32
            && head.chars().next().is_some_and(|c| c.is_uppercase())
            && head.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '.');
        if ok {
            let mut name: String = head.to_lowercase();
            if let Some(first) = name.chars().next() {
                name = first.to_uppercase().collect::<String>() + &name[first.len_utf8()..];
            }
            return (Some(name), rest.trim().to_string());
        }
    }
    (None, spoken.to_string())
}

/// Jäsentää käsikirjoituksen. Ei koskaan kaadu.
pub fn parse(text: &str) -> ScriptPlan {
    let mut plan = ScriptPlan { beats: Vec::new(), diagnostics: Vec::new(), seconds: 0.0 };
    if text.trim().is_empty() {
        plan.diagnostics.push(Diagnostic::error(0, "Kirjoita ensin käsikirjoitus."));
        return plan;
    }
    if text.chars().count() > MAX_SCRIPT_CHARS {
        plan.diagnostics.push(Diagnostic::error(0, "Käsikirjoituksen enimmäispituus on 12 000 merkkiä."));
        return plan;
    }
    let mut pending_bg: Option<String> = None;
    let mut pending_view: Option<View> = None;
    let mut pending_phone: Option<PhoneView> = None;
    let mut pending_camera: Option<CameraHint> = None;
    let mut pending_line = 0;

    for (index, raw) in text.lines().enumerate() {
        let line_no = index + 1;
        let raw = raw.trim();
        if raw.is_empty() {
            continue;
        }
        // Erota tagit ja puhe.
        let mut tags = Vec::new();
        let mut spoken = String::new();
        let mut rest = raw;
        let mut broken = false;
        while let Some(open) = rest.find('[') {
            spoken.push_str(&rest[..open]);
            match rest[open + 1..].find(']') {
                Some(close) => {
                    tags.push(rest[open + 1..open + 1 + close].trim().to_string());
                    rest = &rest[open + 1 + close + 1..];
                }
                None => {
                    broken = true;
                    rest = "";
                }
            }
        }
        spoken.push_str(rest);
        if broken {
            plan.diagnostics.push(Diagnostic::error(line_no, "Hakasulku jäi sulkematta; riviä ei tulkittu."));
            continue;
        }
        let spoken = spoken.split_whitespace().collect::<Vec<_>>().join(" ");

        let mut motion: Option<MotionKind> = None;
        let mut seconds: Option<f64> = None;
        let mut line_ok = true;
        for tag in &tags {
            match classify(tag) {
                Ok(Tag::Phone(v)) => pending_phone = Some(v),
                Ok(Tag::View(v)) => pending_view = Some(v),
                Ok(Tag::Background(id)) => pending_bg = Some(id),
                Ok(Tag::Camera(c)) => pending_camera = Some(c),
                Ok(Tag::Motion(m, d)) => {
                    if motion.is_some() {
                        plan.diagnostics.push(Diagnostic::error(line_no, "Kirjoita eri liikkeet omille riveilleen."));
                        line_ok = false;
                    }
                    motion = Some(m);
                    if d.is_some() {
                        seconds = d;
                    }
                }
                Err(message) => {
                    plan.diagnostics.push(Diagnostic::error(line_no, message));
                    line_ok = false;
                }
            }
        }
        if !tags.is_empty() && (pending_bg.is_some() || pending_view.is_some() || pending_phone.is_some() || pending_camera.is_some()) {
            pending_line = line_no;
        }
        if !line_ok {
            continue;
        }
        if spoken.is_empty() && motion.is_none() {
            continue;
        }
        let (speaker, spoken) = split_speaker(&spoken);
        let motion = match motion.or_else(|| motion_from_text(&spoken)) {
            Some(m) => m,
            None => {
                if !spoken.is_empty() {
                    let preview: String = spoken.chars().take(80).collect();
                    plan.diagnostics.push(Diagnostic::warning(
                        line_no,
                        format!("Pelkkä puhe / tauko: ”{preview}”. Lisää liike hakasulkeisiin tarvittaessa."),
                    ));
                }
                MotionKind::Wait
            }
        };
        let seconds = seconds.unwrap_or_else(|| {
            if motion == MotionKind::Jump {
                1.2
            } else if !spoken.is_empty() {
                (spoken.split_whitespace().count() as f64 / 2.5).max(2.0)
            } else {
                2.0
            }
        });
        if !seconds.is_finite() || !(MIN_LINE_SECONDS..=MAX_LINE_SECONDS).contains(&seconds) {
            plan.diagnostics.push(Diagnostic::error(line_no, "Yhden rivin kesto on 0,5–20 sekuntia."));
            continue;
        }
        if plan.seconds + seconds > MAX_TOTAL_SECONDS + 1e-9 {
            plan.diagnostics.push(Diagnostic::error(
                line_no,
                "Lyhytanimaatio voi kestää enintään 60 sekuntia. Rivi ja sitä seuraavat jätettiin pois.",
            ));
            break;
        }
        plan.seconds += seconds;
        plan.beats.push(Beat {
            line: line_no,
            speaker,
            text: spoken,
            motion,
            seconds,
            background: pending_bg.take(),
            view: pending_view.take(),
            phone: pending_phone.take(),
            camera: pending_camera.take(),
        });
    }
    if pending_bg.is_some() || pending_view.is_some() || pending_phone.is_some() || pending_camera.is_some() {
        plan.diagnostics.push(Diagnostic::error(pending_line, "Lisää kuvakulmaohjeen jälkeen puhetta tai liike."));
    }
    if plan.beats.is_empty() && !plan.diagnostics.iter().any(|d| d.severity == Severity::Error) {
        plan.diagnostics.push(Diagnostic::error(0, "Käsikirjoituksesta ei löytynyt animaation rivejä."));
    }
    plan
}

/// Muuntaa suunnitelman aikajanaksi. Jokainen tapahtuma muistaa lähderivinsä.
pub fn to_timeline(plan: &ScriptPlan, source: &str, fps: Fps) -> Timeline {
    let lines: Vec<&str> = source.lines().collect();
    let mut timeline = Timeline::new(fps);
    let mut t = Tick::ZERO;
    let mut backgrounds: Vec<(Tick, String, SourceSpan)> = Vec::new();
    for beat in &plan.beats {
        let span = SourceSpan { line: beat.line, text: lines.get(beat.line - 1).unwrap_or(&"").trim().to_string() };
        let d = Tick::from_seconds(beat.seconds);
        if let Some(bg) = &beat.background {
            backgrounds.push((t, bg.clone(), span.clone()));
        }
        if let Some(view) = beat.view {
            timeline.push(t, d, EventKind::CharacterView { view }, span.clone());
        }
        if let Some(view) = beat.phone {
            timeline.push(t, d, EventKind::Phone { view }, span.clone());
        }
        if let Some(hint) = beat.camera {
            timeline.push(t, d, EventKind::Camera { hint }, span.clone());
        }
        if !beat.text.is_empty() {
            timeline.push(t, d, EventKind::Dialogue { speaker: beat.speaker.clone(), text: beat.text.clone() }, span.clone());
        }
        timeline.push(t, d, EventKind::Motion { character: beat.speaker.clone(), motion: beat.motion }, span);
        t += d;
    }
    // Tausta on voimassa seuraavaan taustanvaihtoon tai loppuun asti.
    for (i, (start, id, span)) in backgrounds.iter().enumerate() {
        let end = backgrounds.get(i + 1).map_or(t, |n| n.0);
        timeline.push(*start, end - *start, EventKind::Background { id: id.clone() }, span.clone());
    }
    timeline.duration = t;
    timeline
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str = "[tausta studio]\nHei! Tervetuloa mukaan. [vilkuta 2s]\nKävelen oikealle. [kävele oikealle 3s]\n[tausta auto kuljettaja]\nNyt ollaan autossa. [nyökkää 2s]\n[tausta puhelin edestä]\nNähdään seuraavassa jaksossa! [vilkuta 2s]";

    #[test]
    fn parses_the_shipped_example_like_typescript() {
        let plan = parse(EXAMPLE);
        assert!(plan.is_assemblable(), "{:?}", plan.diagnostics);
        let motions: Vec<_> = plan.beats.iter().map(|b| b.motion).collect();
        assert_eq!(
            motions,
            [MotionKind::Wave, MotionKind::Walk(Direction::Right), MotionKind::Nod, MotionKind::Wave]
        );
        assert_eq!(plan.beats[0].background.as_deref(), Some("studio-v1"));
        assert_eq!(plan.beats[2].background.as_deref(), Some("car-driver-v1"));
        assert_eq!(plan.beats[3].background.as_deref(), Some("phone-front-v1"));
        assert!((plan.seconds - 9.0).abs() < 1e-9);
    }

    #[test]
    fn never_guesses_unknown_or_negated_tags() {
        let plan = parse("Hei [lennä kuuhun 2s]\n[älä kävele]");
        assert!(!plan.is_assemblable());
        assert_eq!(plan.diagnostics.iter().filter(|d| d.severity == Severity::Error).count(), 2);
        assert!(plan.beats.is_empty());
        assert_eq!(motion_from_text("en juokse"), None);
        assert_eq!(motion_from_text("don't run"), None);
    }

    #[test]
    fn durations_and_limits() {
        assert_eq!(duration_in("vilkuta 2s"), Some(2.0));
        assert_eq!(duration_in("kävele 2,5 sek"), Some(2.5));
        assert_eq!(duration_in("odota 1.5 seconds"), Some(1.5));
        assert_eq!(duration_in("kävele5s"), None);
        assert_eq!(parse("[hyppää]").beats[0].seconds, 1.2);
        assert!(!parse("[kävele 25s]").is_assemblable());
        let long = "[kävele 15s]\n".repeat(5);
        let plan = parse(&long);
        assert_eq!(plan.beats.len(), 4);
        assert!(!plan.is_assemblable());
    }

    #[test]
    fn speakers_phone_and_camera() {
        let plan = parse("[kuva insertti]\nPIPSA: Laitan viestin. [näpyttele puhelinta 3s]\n[puhelin pois]\nVILLE: Selvä. [juokse vasemmalle 2s]");
        assert!(plan.is_assemblable(), "{:?}", plan.diagnostics);
        assert_eq!(plan.beats[0].speaker.as_deref(), Some("Pipsa"));
        assert_eq!(plan.beats[0].motion, MotionKind::PhoneTap);
        assert_eq!(plan.beats[0].camera, Some(CameraHint::Insert));
        assert_eq!(plan.beats[1].phone, Some(PhoneView::Hidden));
        assert_eq!(plan.beats[1].motion, MotionKind::Run(Direction::Left));
    }

    #[test]
    fn dangling_direction_and_multiple_motions_are_errors() {
        assert!(!parse("Hei [vilkuta]\n[tausta studio]").is_assemblable());
        assert!(!parse("[vilkuta][hyppää]").is_assemblable());
        assert!(!parse("Hei [vilkuta").is_assemblable());
    }

    #[test]
    fn timeline_keeps_sources_and_background_spans() {
        let plan = parse(EXAMPLE);
        let tl = to_timeline(&plan, EXAMPLE, Fps(30));
        assert_eq!(tl.frame_count(), 270);
        assert_eq!(tl.background_at(Tick::from_seconds(6.0)), Some("car-driver-v1"));
        assert_eq!(tl.background_at(Tick::from_seconds(8.5)), Some("phone-front-v1"));
        let walk = tl.motion_at(Tick::from_seconds(3.5)).unwrap();
        assert_eq!(walk.0, MotionKind::Walk(Direction::Right));
        assert_eq!(walk.2.source.line, 3);
        assert!(tl.ids_are_unique());
    }
}
