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
//! * `[kuva laaja|puolilähi|lähikuva|insertti|kaksikko|olan yli|alakulma|yläkulma]` -> kameraohje.
//! * Englanninkieliset tagit viittaavat samoihin domain-tunnisteisiin: esimerkiksi
//!   `[background living room]`, `[shot over the shoulder]`, `[prop coffee cup]`
//!   ja `[wave 2s]`. `[expression happy]` ja `[look at Maija]` ovat eksplisiittisiä ohjeita.

use hs_core::{
    CameraHint, Diagnostic, Direction, EventKind, Expression, Fps, LookTarget, MotionKind,
    PhoneView, Severity, SourceSpan, Tick, Timeline, View,
};
use serde::{Deserialize, Serialize};

pub mod english;

pub const MAX_SCRIPT_CHARS: usize = 12_000;
pub const MAX_TOTAL_SECONDS: f64 = 60.0;
pub const MIN_LINE_SECONDS: f64 = 0.5;
pub const MAX_LINE_SECONDS: f64 = 20.0;

/// Taustojen nimet, samat kuin `lib/screenplay.ts`.
pub const BACKGROUND_ALIASES: &[(&str, &str)] = &[
    ("studio", "studio-v1"),
    ("studio valoisa", "studio-premium-v1"),
    ("bright studio", "studio-premium-v1"),
    ("olohuone", "apartment-v1"),
    ("living room", "apartment-v1"),
    ("keittiö", "kitchen-v1"),
    ("kitchen", "kitchen-v1"),
    ("luokka", "classroom-v1"),
    ("koulu", "classroom-v1"),
    ("classroom", "classroom-v1"),
    ("school", "classroom-v1"),
    ("puisto", "park-day-v1"),
    ("takapiha", "park-day-v1"),
    ("park", "park-day-v1"),
    ("backyard", "park-day-v1"),
    ("park day", "park-day-v1"),
    ("katu", "street-day-v1"),
    ("katu päivä", "street-day-v1"),
    ("street", "street-day-v1"),
    ("street day", "street-day-v1"),
    ("kaupunki ilta", "city-evening-v1"),
    ("city evening", "city-evening-v1"),
    ("auto moderni", "car-interior-v2"),
    ("modern car", "car-interior-v2"),
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

/// Käteen otettavat esineet: `[esine kahvikuppi]`, pois `[esine pois]`.
/// Tuntematonta esinettä ei arvata vaan siitä tulee virhe.
pub const PROP_ALIASES: &[(&str, &str)] = &[
    ("kahvikuppi", "mug"),
    ("kuppi", "mug"),
    ("muki", "mug"),
    ("mug", "mug"),
    ("coffee cup", "mug"),
    ("cup", "mug"),
    ("pizza", "pizza-box"),
    ("pizzalaatikko", "pizza-box"),
    ("pizza box", "pizza-box"),
    ("kirja", "book"),
    ("book", "book"),
    ("lahja", "gift"),
    ("lahjapaketti", "gift"),
    ("paketti", "gift"),
    ("gift", "gift"),
    ("gift box", "gift"),
    ("pallo", "ball"),
    ("ball", "ball"),
    ("kukat", "flowers"),
    ("kukkakimppu", "flowers"),
    ("flowers", "flowers"),
    ("bouquet", "flowers"),
    ("tölkki", "can"),
    ("limsa", "can"),
    ("can", "can"),
    ("soda can", "can"),
    ("mikrofoni", "microphone"),
    ("microphone", "microphone"),
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
    /// Esine käteen (`Some(Some(id))`) tai pois (`Some(None)`).
    #[serde(default)]
    pub prop: Option<Option<String>>,
    #[serde(default)]
    pub expression: Option<Expression>,
    #[serde(default)]
    pub look_at: Option<LookTarget>,
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
        !self.beats.is_empty()
            && !self
                .diagnostics
                .iter()
                .any(|d| d.severity == Severity::Error)
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
    words(s)
        .iter()
        .any(|w| matches!(w.as_str(), "ei" | "en" | "älä" | "don't" | "dont" | "not"))
}

/// Tunnistaa liikkeen tekstistä. Kieltosana estää tulkinnan kokonaan.
pub fn motion_from_text(text: &str) -> Option<MotionKind> {
    recognize_motion(text, true)
}

fn motion_from_finnish_text(text: &str) -> Option<MotionKind> {
    recognize_motion(text, false)
}

fn recognize_motion(text: &str, english: bool) -> Option<MotionKind> {
    if has_negation(text) {
        return None;
    }
    let t = lower(text);
    let tokens = words(text);
    // Finnish inflection stems remain compatible. English keywords must be
    // whole words: "brunch", "microwave" and "knowledge" are not actions.
    let any = |keys: &[&str]| {
        keys.iter().any(|k| {
            if matches!(
                *k,
                "left"
                    | "front"
                    | "forward"
                    | "texting"
                    | "tap phone"
                    | "type on phone"
                    | "run"
                    | "walk"
                    | "wave"
                    | "jump"
                    | "crouch"
                    | "nod"
                    | "wait"
                    | "pause"
            ) {
                let wanted = words(k);
                english && !wanted.is_empty() && tokens.windows(wanted.len()).any(|w| w == wanted)
            } else {
                t.contains(k)
            }
        })
    };
    let dir = || {
        if any(&["vasem", "left"]) {
            Direction::Left
        } else if any(&["suoraan", "kohti", "front", "forward"]) {
            Direction::Front
        } else {
            Direction::Right
        }
    };
    if any(&[
        "näpytt",
        "näppäil",
        "tekstaa",
        "tekstaile",
        "texting",
        "tap phone",
        "type on phone",
    ]) {
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
            if i + 1 < chars.len()
                && (chars[i] == '.' || chars[i] == ',')
                && chars[i + 1].is_ascii_digit()
            {
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
                    if after.chars().next().is_none_or(|c| !c.is_alphanumeric()) {
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
            if !rest.is_empty()
                && (tag.len() == k.len()
                    || !tag[k.len()..].starts_with(|c: char| c.is_alphanumeric()))
            {
                return Some(rest);
            }
        }
    }
    None
}

enum Tag {
    Phone(PhoneView),
    Prop(Option<String>),
    View(View),
    Background(String),
    Camera(CameraHint),
    Expression(Expression),
    LookAt(LookTarget),
    Motion(MotionKind, Option<f64>),
}

fn classify(tag: &str) -> Result<Tag, String> {
    match english::normalize_tag(tag)? {
        Some(canonical) => classify_canonical(&canonical),
        None => classify_canonical(tag),
    }
}

fn classify_canonical(tag: &str) -> Result<Tag, String> {
    let low = lower(tag);
    let low = low.trim();
    for (prefix, command, motion) in [
        ("kävele taaksepäin", "walk backward", MotionKind::WalkBackward),
        ("käänny vasemmalle", "turn left", MotionKind::TurnLeft),
        ("käänny oikealle", "turn right", MotionKind::TurnRight),
        ("osoita eteen", "point forward", MotionKind::PointForward),
        ("kohauta olkapäitä", "shrug shoulders", MotionKind::Shrug),
        ("pudista päätä", "shake head", MotionKind::ShakeHead),
        ("taputa", "clap hands", MotionKind::Clap),
    ] {
        if let Some(rest) = low.strip_prefix(prefix) {
            if !rest.is_empty() && !rest.starts_with(' ') { return Err("Tuntematon liikeohje.".into()); }
            let canonical = english::normalize_tag(&format!("{command}{rest}"))?.ok_or("Tuntematon liikeohje.")?;
            return Ok(Tag::Motion(motion, duration_in(&canonical)));
        }
    }
    for (prefix, command, motion) in [("istu tuolille", "sit on chair", MotionKind::Sit), ("nouse tuolilta", "stand up", MotionKind::Stand)] {
        if let Some(rest) = low.strip_prefix(prefix) {
            if !rest.is_empty() && !rest.starts_with(' ') { return Err("Tuntematon tuolikontakti.".into()); }
            let canonical = english::normalize_tag(&format!("{command}{rest}"))?.ok_or("Tuntematon tuolikontakti.")?;
            let duration = duration_in(&canonical);
            if duration.is_some_and(|d| d < 1.0) { return Err("Tuolille istuminen ja nouseminen tarvitsevat vähintään 1 sekunnin.".into()); }
            return Ok(Tag::Motion(motion, duration));
        }
    }
    if let Some(rest) = strip_keyword(tag, &["expression", "ilme"]) {
        let expression = match lower(rest).as_str() {
            "neutral" | "neutraali" => Some(Expression::Neutral),
            "happy" | "iloinen" => Some(Expression::Happy),
            "angry" | "vihainen" => Some(Expression::Angry),
            "sad" | "surullinen" => Some(Expression::Sad),
            "surprised" | "yllättynyt" => Some(Expression::Surprised),
            "scared" | "peloissaan" => Some(Expression::Scared),
            _ => None,
        };
        return expression
            .map(Tag::Expression)
            .ok_or_else(|| format!("Tuntematon ilme: {rest}."));
    }
    if let Some(rest) = strip_keyword(tag, &["look at", "katso"]) {
        if matches!(lower(rest).as_str(), "camera" | "kamera" | "kameraan") {
            return Ok(Tag::LookAt(LookTarget::Camera));
        }
        // Same bounded one-word naming scheme as dialogue speakers. Resolution
        // to an actual cast member is a downstream preflight responsibility.
        if rest.chars().count() <= 32
            && rest.chars().next().is_some_and(char::is_alphabetic)
            && rest
                .chars()
                .all(|c| c.is_alphanumeric() || c == '-' || c == '.')
        {
            let canonical = canonical_name(rest);
            return Ok(Tag::LookAt(LookTarget::Character(canonical)));
        }
        return Err(format!(
            "Virheellinen katseen kohde: {rest}. Käytä hahmon nimeä tai camera."
        ));
    }
    // [puhelin edestä] / [esine puhelin pois]
    let phone_part = low
        .strip_prefix("esine ")
        .or_else(|| low.strip_prefix("prop "))
        .unwrap_or(low);
    if let Some(rest) = phone_part
        .strip_prefix("puhelin ")
        .or_else(|| phone_part.strip_prefix("phone "))
    {
        let v = match rest.trim() {
            "edestä" | "front" => Some(PhoneView::Front),
            "takaa" | "back" => Some(PhoneView::Back),
            "sivulta" | "side" => Some(PhoneView::Side),
            "pois" | "hidden" | "away" | "none" => Some(PhoneView::Hidden),
            _ => None,
        };
        if let Some(v) = v {
            return Ok(Tag::Phone(v));
        }
    }
    if let Some(rest) = strip_keyword(tag, &["esine", "prop"]) {
        let key = lower(rest);
        if matches!(key.as_str(), "pois" | "none" | "away") {
            return Ok(Tag::Prop(None));
        }
        return PROP_ALIASES
            .iter()
            .find(|(alias, _)| *alias == key)
            .map(|(_, id)| Tag::Prop(Some((*id).to_string())))
            .ok_or_else(|| format!("Tuntematon esine: {rest}. Valitse kahvikuppi, pizza, kirja, lahja, pallo, kukat, tölkki tai mikrofoni."));
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
            .ok_or_else(|| {
                format!("Tuntematon kuvausympäristö: {rest}. Valitse ohjeessa mainittu nimi.")
            });
    }
    if let Some(rest) = strip_keyword(tag, &["kuva", "shot"]) {
        let hint = match lower(rest).as_str() {
            "laaja" | "kokokuva" | "yleiskuva" | "wide" => Some(CameraHint::Wide),
            "puolilähi" | "puolikuva" | "medium" => Some(CameraHint::Medium),
            "lähikuva" | "lähi" | "close" | "closeup" | "close-up" => Some(CameraHint::CloseUp),
            "insertti" | "insert" => Some(CameraHint::Insert),
            "kaksikko" | "kaksoiskuva" | "two-shot" | "twoshot" | "two shot" => {
                Some(CameraHint::TwoShot)
            }
            "olan yli" | "olanyli" | "over-shoulder" | "over the shoulder" | "over shoulder"
            | "ots" => Some(CameraHint::OverShoulder),
            "alakulma" | "sammakko" | "low" | "low-angle" | "low angle" => {
                Some(CameraHint::LowAngle)
            }
            "yläkulma" | "lintu" | "high" | "high-angle" | "high angle" => {
                Some(CameraHint::HighAngle)
            }
            _ => None,
        };
        return hint
            .map(Tag::Camera)
            .ok_or_else(|| format!("Tuntematon kuvaohje: [{tag}]. Käytä laaja, puolilähi, lähikuva, insertti, kaksikko, olan yli, alakulma tai yläkulma."));
    }
    match motion_from_finnish_text(tag) {
        Some(m) => Ok(Tag::Motion(m, duration_in(tag))),
        None => Err(format!(
            "Tuntematon liikeohje: [{tag}]. Käytä esimerkiksi [vilkuta 2s]."
        )),
    }
}

fn canonical_name(name: &str) -> String {
    let name = name.to_lowercase();
    let first = name.chars().next().expect("nonempty validated name");
    first.to_uppercase().collect::<String>() + &name[first.len_utf8()..]
}

/// Erottaa `NIMI: repliikki` -puhujan, jos etuliite on yksi sana isolla alkukirjaimella.
fn split_speaker(spoken: &str) -> (Option<String>, String) {
    if let Some((head, rest)) = spoken.split_once(':') {
        let head = head.trim();
        let ok = !head.is_empty()
            && head.chars().count() <= 32
            && head.chars().next().is_some_and(|c| c.is_uppercase())
            && head
                .chars()
                .all(|c| c.is_alphanumeric() || c == '-' || c == '.');
        if ok {
            return (Some(canonical_name(head)), rest.trim().to_string());
        }
    }
    (None, spoken.to_string())
}

/// Parse bracket syntax before publishing any setting from this line.
fn split_tags(raw: &str) -> Result<(Vec<String>, String), &'static str> {
    let mut tags = Vec::new();
    let mut spoken = String::new();
    let mut cursor = 0;
    let mut opened = None;
    for (offset, ch) in raw.char_indices() {
        match ch {
            '[' => {
                if opened.is_some() {
                    return Err("Sisäkkäisiä hakasulkuja ei tueta; riviä ei tulkittu.");
                }
                spoken.push_str(&raw[cursor..offset]);
                opened = Some(offset + 1);
            }
            ']' => {
                let start = opened
                    .take()
                    .ok_or("Sulkeva hakasulku ilman avaavaa hakasulkua; riviä ei tulkittu.")?;
                tags.push(raw[start..offset].trim().to_string());
                cursor = offset + 1;
            }
            _ => {}
        }
    }
    if opened.is_some() {
        return Err("Hakasulku jäi sulkematta; riviä ei tulkittu.");
    }
    spoken.push_str(&raw[cursor..]);
    Ok((tags, spoken))
}

fn set_pending_once<T>(slot: &mut Option<T>, value: T, name: &str) -> Result<(), String> {
    if slot.is_some() {
        return Err(format!(
            "Useampi {name}-ohje ennen samaa animaatioriviä. Kirjoita ohje vain kerran."
        ));
    }
    *slot = Some(value);
    Ok(())
}

/// Jäsentää käsikirjoituksen. Ei koskaan kaadu.
pub fn parse(text: &str) -> ScriptPlan {
    let mut plan = ScriptPlan {
        beats: Vec::new(),
        diagnostics: Vec::new(),
        seconds: 0.0,
    };
    if text.trim().is_empty() {
        plan.diagnostics
            .push(Diagnostic::error(0, "Kirjoita ensin käsikirjoitus."));
        return plan;
    }
    if text.chars().count() > MAX_SCRIPT_CHARS {
        plan.diagnostics.push(Diagnostic::error(
            0,
            "Käsikirjoituksen enimmäispituus on 12 000 merkkiä.",
        ));
        return plan;
    }
    let mut pending_bg: Option<String> = None;
    let mut pending_view: Option<View> = None;
    let mut pending_phone: Option<PhoneView> = None;
    let mut pending_camera: Option<CameraHint> = None;
    let mut pending_prop: Option<Option<String>> = None;
    let mut pending_expression = None;
    let mut pending_look_at = None;
    let mut pending_line = 0;

    for (index, raw) in text.lines().enumerate() {
        let line_no = index + 1;
        let raw = raw.trim();
        if raw.is_empty() {
            continue;
        }
        let (tags, spoken) = match split_tags(raw) {
            Ok(parts) => parts,
            Err(message) => {
                plan.diagnostics.push(Diagnostic::error(line_no, message));
                continue;
            }
        };
        let spoken = spoken.split_whitespace().collect::<Vec<_>>().join(" ");

        let previous_settings = (
            pending_bg.clone(),
            pending_view,
            pending_phone,
            pending_camera,
            pending_prop.clone(),
            pending_expression,
            pending_look_at.clone(),
            pending_line,
        );
        let mut motion: Option<MotionKind> = None;
        let mut seconds: Option<f64> = None;
        let mut line_ok = true;
        for tag in &tags {
            let applied = match classify(tag) {
                Ok(Tag::Phone(v)) => set_pending_once(&mut pending_phone, v, "puhelin"),
                Ok(Tag::Prop(p)) => set_pending_once(&mut pending_prop, p, "esine"),
                Ok(Tag::View(v)) => set_pending_once(&mut pending_view, v, "hahmosuunta"),
                Ok(Tag::Background(id)) => set_pending_once(&mut pending_bg, id, "tausta"),
                Ok(Tag::Camera(c)) => set_pending_once(&mut pending_camera, c, "kamera"),
                Ok(Tag::Expression(e)) => set_pending_once(&mut pending_expression, e, "ilme"),
                Ok(Tag::LookAt(target)) => set_pending_once(&mut pending_look_at, target, "katse"),
                Ok(Tag::Motion(m, d)) => {
                    if motion.is_some() {
                        Err("Kirjoita eri liikkeet omille riveilleen.".to_string())
                    } else {
                        motion = Some(m);
                        seconds = d;
                        Ok(())
                    }
                }
                Err(message) => Err(message),
            };
            if let Err(message) = applied {
                plan.diagnostics.push(Diagnostic::error(line_no, message));
                line_ok = false;
            }
        }
        if !tags.is_empty()
            && (pending_bg.is_some()
                || pending_view.is_some()
                || pending_phone.is_some()
                || pending_camera.is_some()
                || pending_prop.is_some()
                || pending_expression.is_some()
                || pending_look_at.is_some())
        {
            pending_line = line_no;
        }
        if !line_ok {
            (
                pending_bg,
                pending_view,
                pending_phone,
                pending_camera,
                pending_prop,
                pending_expression,
                pending_look_at,
                pending_line,
            ) = previous_settings;
            continue;
        }
        if spoken.is_empty() && motion.is_none() {
            continue;
        }
        let (speaker, spoken) = split_speaker(&spoken);
        let motion = match motion.or_else(|| motion_from_finnish_text(&spoken)) {
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
            plan.diagnostics.push(Diagnostic::error(
                line_no,
                "Yhden rivin kesto on 0,5–20 sekuntia.",
            ));
            (
                pending_bg,
                pending_view,
                pending_phone,
                pending_camera,
                pending_prop,
                pending_expression,
                pending_look_at,
                pending_line,
            ) = previous_settings;
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
            prop: pending_prop.take(),
            expression: pending_expression.take(),
            look_at: pending_look_at.take(),
        });
    }
    if pending_bg.is_some()
        || pending_view.is_some()
        || pending_phone.is_some()
        || pending_camera.is_some()
        || pending_prop.is_some()
        || pending_expression.is_some()
        || pending_look_at.is_some()
    {
        plan.diagnostics.push(Diagnostic::error(
            pending_line,
            "Lisää kuvakulmaohjeen jälkeen puhetta tai liike.",
        ));
    }
    if plan.beats.is_empty()
        && !plan
            .diagnostics
            .iter()
            .any(|d| d.severity == Severity::Error)
    {
        plan.diagnostics.push(Diagnostic::error(
            0,
            "Käsikirjoituksesta ei löytynyt animaation rivejä.",
        ));
    }
    plan
}

/// Muuntaa suunnitelman aikajanaksi. Jokainen tapahtuma muistaa lähderivinsä.
pub fn to_timeline(plan: &ScriptPlan, source: &str, fps: Fps) -> Timeline {
    let seconds: Vec<f64> = plan.beats.iter().map(|b| b.seconds).collect();
    to_timeline_with(plan, source, fps, &seconds)
}

/// Kuten [`to_timeline`], mutta rivien kestot annetaan erikseen (esim. puheen
/// pituuden mukaan pidennettyinä). `seconds[i]` koskee `plan.beats[i]`:tä.
pub fn to_timeline_with(plan: &ScriptPlan, source: &str, fps: Fps, seconds: &[f64]) -> Timeline {
    let lines: Vec<&str> = source.lines().collect();
    let mut timeline = Timeline::new(fps);
    let mut t = Tick::ZERO;
    let mut backgrounds: Vec<(Tick, String, SourceSpan)> = Vec::new();
    for (i, beat) in plan.beats.iter().enumerate() {
        let span = SourceSpan {
            line: beat.line,
            text: lines.get(beat.line - 1).unwrap_or(&"").trim().to_string(),
        };
        let d = Tick::from_seconds(seconds.get(i).copied().unwrap_or(beat.seconds));
        if let Some(bg) = &beat.background {
            backgrounds.push((t, bg.clone(), span.clone()));
        }
        if let Some(view) = beat.view {
            timeline.push(t, d, EventKind::CharacterView { view, character:beat.speaker.clone() }, span.clone());
        }
        if let Some(view) = beat.phone.or_else(|| (beat.motion==MotionKind::PhoneTap).then_some(PhoneView::Front)) {
            timeline.push(t, d, EventKind::Phone { view, character:beat.speaker.clone() }, span.clone());
        }
        if let Some(hint) = beat.camera {
            timeline.push(t, d, EventKind::Camera { hint }, span.clone());
        }
        if let Some(item) = &beat.prop {
            timeline.push(
                t,
                d,
                EventKind::Prop {
                    character: beat.speaker.clone(),
                    item: item.clone(),
                },
                span.clone(),
            );
        }
        if let Some(expression) = beat.expression {
            timeline.push(
                t,
                d,
                EventKind::Expression {
                    character: beat.speaker.clone(),
                    expression,
                },
                span.clone(),
            );
        }
        if let Some(target) = &beat.look_at {
            timeline.push(
                t,
                d,
                EventKind::LookAt {
                    character: beat.speaker.clone(),
                    target: target.clone(),
                },
                span.clone(),
            );
        }
        if !beat.text.is_empty() {
            timeline.push(
                t,
                d,
                EventKind::Dialogue {
                    speaker: beat.speaker.clone(),
                    text: beat.text.clone(),
                },
                span.clone(),
            );
        }
        timeline.push(
            t,
            d.min(Tick::from_seconds(beat.seconds)),
            EventKind::Motion {
                character: beat.speaker.clone(),
                motion: beat.motion,
            },
            span,
        );
        t += d;
    }
    // Tausta on voimassa seuraavaan taustanvaihtoon tai loppuun asti.
    for (i, (start, id, span)) in backgrounds.iter().enumerate() {
        let end = backgrounds.get(i + 1).map_or(t, |n| n.0);
        timeline.push(
            *start,
            end - *start,
            EventKind::Background { id: id.clone() },
            span.clone(),
        );
    }
    timeline.duration = t;
    timeline
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str = "[tausta studio]\nHei! Tervetuloa mukaan. [vilkuta 2s]\nKävelen oikealle. [kävele oikealle 3s]\n[tausta auto kuljettaja]\nNyt ollaan autossa. [nyökkää 2s]\n[tausta puhelin edestä]\nNähdään seuraavassa jaksossa! [vilkuta 2s]";

    const ENGLISH_FAMILY: &str = include_str!("../tests/fixtures/english-family.txt");

    #[test]
    fn duplicate_scene_declarations_reject_the_whole_line_instead_of_last_wins() {
        for (first, conflicting) in [
            ("background living room", "background kitchen"),
            ("view front", "view left"),
            ("phone front", "phone hidden"),
            ("shot wide", "shot close up"),
            ("prop coffee cup", "prop none"),
            ("expression happy", "expression angry"),
            ("look at camera", "look at Maija"),
        ] {
            for second in [first, conflicting] {
                let same_line = parse(&format!(
                    "[{first}][{second}] KALLE: Rejected. [wait]\n[wait]"
                ));
                assert!(!same_line.is_assemblable(), "{first}, {second}");
                assert_eq!(same_line.beats, parse("\n[wait]").beats);
                assert!(same_line
                    .diagnostics
                    .iter()
                    .any(|d| d.line == 1 && d.severity == Severity::Error));

                // Previously accepted pending settings survive a rejected next
                // line; the duplicate is never silently applied to the beat.
                let across = parse(&format!(
                    "[{first}]\n[{second}] KALLE: Rejected. [wait]\nKALLE: Accepted. [wait]"
                ));
                let expected = parse(&format!("[{first}]\n\nKALLE: Accepted. [wait]"));
                assert!(!across.is_assemblable(), "{first}, {second}");
                assert_eq!(across.beats, expected.beats);
                assert!(across
                    .diagnostics
                    .iter()
                    .any(|d| d.line == 2 && d.severity == Severity::Error));
            }
        }
    }

    #[test]
    fn conflicting_line_rolls_back_every_field_and_pending_origin() {
        let source = "[tausta olohuone]\n[expression happy][look at camera][prop coffee cup][view left][phone front][shot wide][background kitchen]\nKALLE: Accepted. [wait]";
        let rejected = parse(source);
        let expected = parse("[tausta olohuone]\n\nKALLE: Accepted. [wait]");
        assert!(!rejected.is_assemblable());
        assert_eq!(rejected.beats, expected.beats);
        let dangling = parse("[background living room]\n[background kitchen]");
        assert!(dangling
            .diagnostics
            .iter()
            .any(|d| d.line == 1 && d.message.contains("Lisää")));
        assert!(dangling
            .diagnostics
            .iter()
            .any(|d| d.line == 2 && d.message.contains("Useampi")));
    }

    #[test]
    fn malformed_brackets_never_become_spoken_text_or_apply_partial_settings() {
        for bad in [
            "KALLE: Hello ] [wait]",
            "KALLE: Hello [wait]]",
            "[background [kitchen]]",
            "[background kitchen] KALLE: Hello ]",
            "KALLE: Tässä on ääntä [wave [hello]]",
            "KALLE: Hello [wait",
            "KALLE: Hello ][wait]",
        ] {
            let source = format!("[background living room]\n{bad}\nKALLE: Valid. [wait]");
            let plan = parse(&source);
            assert!(!plan.is_assemblable(), "{bad}");
            assert_eq!(
                plan.beats,
                parse("[background living room]\n\nKALLE: Valid. [wait]").beats,
                "{bad}"
            );
            assert!(
                plan.diagnostics
                    .iter()
                    .any(|d| d.line == 2 && d.severity == Severity::Error),
                "{bad}"
            );
        }
    }

    #[test]
    fn mixed_language_pending_settings_reset_after_each_accepted_beat() {
        let source = "[tausta olohuone]\n[shot wide]\n[ilme iloinen]\nKALLE: Don't run the studio alone. [odota 2s]\n[background kitchen]\n[kuva lähikuva]\n[expression neutral]\nMAIJA: I love to walk. [wait 2s]";
        let plan = parse(source);
        assert!(plan.is_assemblable(), "{:?}", plan.diagnostics);
        assert_eq!(plan.beats.len(), 2);
        assert_eq!(plan.beats[0].background.as_deref(), Some("apartment-v1"));
        assert_eq!(plan.beats[1].background.as_deref(), Some("kitchen-v1"));
        assert_eq!(plan.beats[0].camera, Some(CameraHint::Wide));
        assert_eq!(plan.beats[1].camera, Some(CameraHint::CloseUp));
        assert_eq!(plan.beats[0].text, "Don't run the studio alone.");
        assert_eq!(plan.beats[1].text, "I love to walk.");
        assert!(plan.beats.iter().all(|b| b.motion == MotionKind::Wait));
        for negated in ["don't run left", "do not wave", "never jump", "älä kävele"] {
            let source =
                format!("[tausta olohuone]\n[shot wide][{negated}]\nKALLE: Accepted. [wait]");
            let plan = parse(&source);
            assert!(!plan.is_assemblable(), "{negated}");
            assert_eq!(plan.beats[0].background.as_deref(), Some("apartment-v1"));
            assert_eq!(plan.beats[0].camera, None);
        }
    }

    #[test]
    fn english_dialogue_is_never_automatically_interpreted_as_action() {
        for spoken in [
            "I love to walk.",
            "We run the studio.",
            "Wave goodbye to those old ideas.",
            "I cannot wait.",
        ] {
            let plan = parse(&format!("KALLE: {spoken}"));
            assert!(plan.is_assemblable());
            assert_eq!(plan.beats[0].text, spoken);
            assert_eq!(plan.beats[0].motion, MotionKind::Wait);
        }
        let explicit = parse("KALLE: I love to walk. [walk left 2s]");
        assert_eq!(explicit.beats[0].text, "I love to walk.");
        assert_eq!(explicit.beats[0].motion, MotionKind::Walk(Direction::Left));
        // Existing Finnish legacy prose recognition remains compatible.
        assert_eq!(
            parse("Kävelen vasemmalle.").beats[0].motion,
            MotionKind::Walk(Direction::Left)
        );
    }

    #[test]
    fn explicit_expressions_and_looks_keep_source_character_and_duration() {
        for (english, finnish, expression) in [
            ("neutral", "neutraali", Expression::Neutral),
            ("happy", "iloinen", Expression::Happy),
            ("angry", "vihainen", Expression::Angry),
            ("sad", "surullinen", Expression::Sad),
            ("surprised", "yllättynyt", Expression::Surprised),
            ("scared", "peloissaan", Expression::Scared),
        ] {
            let source = format!("KALLE: Hello. [expression {english}] [look at mAiJa] [wait 3s]");
            let plan = parse(&source);
            assert!(plan.is_assemblable(), "{:?}", plan.diagnostics);
            assert_eq!(plan.beats[0].expression, Some(expression));
            assert_eq!(
                plan.beats[0].look_at,
                Some(LookTarget::Character("Maija".into()))
            );
            assert_eq!(
                parse(&format!("[ilme {finnish}]\n[wait]")).beats[0].expression,
                Some(expression)
            );
            let timeline = to_timeline(&plan, &source, Fps(30));
            for kind in [
                EventKind::Expression {
                    character: Some("Kalle".into()),
                    expression,
                },
                EventKind::LookAt {
                    character: Some("Kalle".into()),
                    target: LookTarget::Character("Maija".into()),
                },
            ] {
                let event = timeline.events.iter().find(|e| e.kind == kind).unwrap();
                assert_eq!(event.start, Tick::ZERO);
                assert_eq!(event.duration, Tick::from_seconds(3.0));
                assert_eq!(event.source.line, 1);
                assert_eq!(event.source.text, source);
            }
        }
        assert_eq!(
            parse("[look at camera]\n[wait]").beats[0].look_at,
            Some(LookTarget::Camera)
        );
        assert_eq!(
            parse("[katso kameraan]\n[odota]").beats[0].look_at,
            Some(LookTarget::Camera)
        );
    }

    #[test]
    fn malformed_look_targets_and_unknown_expressions_are_errors() {
        for tag in [
            "expression ecstatic",
            "look at",
            "look at 123",
            "look at Maija and Kalle",
            "look at ../Kalle",
        ] {
            assert!(
                !parse(&format!("KALLE: Hello. [{tag}]")).is_assemblable(),
                "{tag}"
            );
        }
        let long = "A".repeat(33);
        assert!(!parse(&format!("[look at {long}]\n[wait]")).is_assemblable());
        assert!(!parse("[expression happy]").is_assemblable());
        assert!(!parse("[look at camera]").is_assemblable());
        let plan = parse("KALLE: I am happy and look at the camera. [wait]");
        assert_eq!(plan.beats[0].expression, None);
        assert_eq!(plan.beats[0].look_at, None);
    }

    #[test]
    fn english_family_fixture_maps_supported_cues_without_changing_dialogue() {
        let plan = parse(ENGLISH_FAMILY);
        assert!(plan.is_assemblable(), "{:?}", plan.diagnostics);
        assert_eq!(plan.beats.len(), 5);
        assert_eq!(plan.beats[0].speaker.as_deref(), Some("Kalle"));
        assert_eq!(plan.beats[0].text, "Welcome to our first episode!");
        assert_eq!(plan.beats[0].background.as_deref(), Some("apartment-v1"));
        assert_eq!(plan.beats[2].prop, Some(Some("mug".into())));
        assert_eq!(plan.beats[2].camera, Some(CameraHint::OverShoulder));
        assert_eq!(plan.beats[3].background.as_deref(), Some("kitchen-v1"));
        assert_eq!(plan.beats[3].prop, Some(None));
        assert_eq!(plan.beats[3].camera, Some(CameraHint::LowAngle));
        assert_eq!(plan.beats[4].camera, Some(CameraHint::HighAngle));
        assert_eq!(plan.beats[4].motion, MotionKind::Walk(Direction::Left));
        let timeline = to_timeline(&plan, ENGLISH_FAMILY, Fps(30));
        assert_eq!(
            timeline.background_at(Tick::from_seconds(7.0)),
            Some("kitchen-v1")
        );
        assert!(timeline.ids_are_unique());
    }

    #[test]
    fn english_aliases_reuse_existing_finnish_domain_ids() {
        for (english, finnish) in [
            ("living room", "olohuone"),
            ("bright studio", "studio valoisa"),
            ("school", "koulu"),
            ("backyard", "takapiha"),
            ("street day", "katu päivä"),
            ("city evening", "kaupunki ilta"),
            ("modern car", "auto moderni"),
        ] {
            let en = parse(&format!("[background {english}]\n[wait 2s]"));
            let fi = parse(&format!("[tausta {finnish}]\n[odota 2s]"));
            assert!(en.is_assemblable(), "{english}");
            assert_eq!(en.beats[0].background, fi.beats[0].background);
        }
        for (english, finnish) in [
            ("coffee cup", "kahvikuppi"),
            ("pizza box", "pizzalaatikko"),
            ("gift box", "lahjapaketti"),
            ("bouquet", "kukkakimppu"),
            ("soda can", "tölkki"),
        ] {
            let en = parse(&format!("[prop {english}]\n[wait]"));
            let fi = parse(&format!("[esine {finnish}]\n[odota]"));
            assert!(en.is_assemblable(), "{english}");
            assert_eq!(en.beats[0].prop, fi.beats[0].prop);
        }
        for (word, view) in [
            ("front", PhoneView::Front),
            ("back", PhoneView::Back),
            ("side", PhoneView::Side),
            ("hidden", PhoneView::Hidden),
        ] {
            assert_eq!(
                parse(&format!("[prop phone {word}]\n[wait]")).beats[0].phone,
                Some(view)
            );
        }
    }

    #[test]
    fn english_motion_keywords_do_not_match_inside_unrelated_words() {
        for word in ["brunch", "runway", "microwave", "knowledge", "awaiting"] {
            assert_eq!(motion_from_text(word), None, "{word}");
            assert!(!parse(&format!("[{word}]")).is_assemblable(), "{word}");
        }
        assert_eq!(
            motion_from_text("walk left"),
            Some(MotionKind::Walk(Direction::Left))
        );
        assert_eq!(
            motion_from_text("juokse vasemmalle"),
            Some(MotionKind::Run(Direction::Left))
        );
        assert_eq!(
            motion_from_text("kävele suoraan"),
            Some(MotionKind::Walk(Direction::Front))
        );
        assert_eq!(motion_from_text("do not wave"), None);
    }

    #[test]
    fn rejected_cues_do_not_leak_scene_settings_into_valid_lines() {
        for rejected in ["expression puzzled", "wait 25s", "wave][jump"] {
            let plan = parse(&format!(
                "[background living room]\n[background kitchen][{rejected}]\nKALLE: Hello. [wait]"
            ));
            assert!(!plan.is_assemblable());
            assert_eq!(plan.beats.len(), 1);
            assert_eq!(plan.beats[0].background.as_deref(), Some("apartment-v1"));
            assert!(plan
                .diagnostics
                .iter()
                .any(|d| d.line == 2 && d.severity == Severity::Error));
        }
        for tag in [
            "expression puzzled",
            "look at",
            "background spaceship",
            "prop dragon",
            "shot orbit",
        ] {
            let plan = parse(&format!("KALLE: Hello. [{tag}]"));
            assert!(!plan.is_assemblable(), "{tag}");
            assert!(plan.beats.is_empty(), "{tag}");
        }
    }

    #[test]
    fn moving_source_lines_preserves_event_ids_and_updates_source_locations() {
        let first = to_timeline(&parse(ENGLISH_FAMILY), ENGLISH_FAMILY, Fps(30));
        let source = format!("\n\n{ENGLISH_FAMILY}");
        let moved = to_timeline(&parse(&source), &source, Fps(30));
        assert_eq!(first.events.len(), moved.events.len());
        for (original, shifted) in first.events.iter().zip(&moved.events) {
            assert_eq!(original.id, shifted.id);
            assert_eq!(original.kind, shifted.kind);
            assert_eq!(original.start, shifted.start);
            assert_eq!(original.source.text, shifted.source.text);
            assert_eq!(original.source.line + 2, shifted.source.line);
        }
    }

    #[test]
    fn parses_the_shipped_example_like_typescript() {
        let plan = parse(EXAMPLE);
        assert!(plan.is_assemblable(), "{:?}", plan.diagnostics);
        let motions: Vec<_> = plan.beats.iter().map(|b| b.motion).collect();
        assert_eq!(
            motions,
            [
                MotionKind::Wave,
                MotionKind::Walk(Direction::Right),
                MotionKind::Nod,
                MotionKind::Wave
            ]
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
        assert_eq!(
            plan.diagnostics
                .iter()
                .filter(|d| d.severity == Severity::Error)
                .count(),
            2
        );
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
        let props = parse("PIPSA: Kahvia! [esine kahvikuppi]\n[esine pois]\nPIPSA: Valmis.");
        assert_eq!(props.beats[0].prop, Some(Some("mug".to_string())));
        assert_eq!(props.beats[1].prop, Some(None));
        let bad = parse("PIPSA: Hei! [esine lohikäärme]");
        assert!(bad
            .diagnostics
            .iter()
            .any(|d| d.severity == Severity::Error && d.message.contains("lohikäärme")));
        for (word, hint) in [
            ("kaksikko", CameraHint::TwoShot),
            ("olan yli", CameraHint::OverShoulder),
            ("alakulma", CameraHint::LowAngle),
            ("yläkulma", CameraHint::HighAngle),
        ] {
            assert_eq!(
                parse(&format!("[kuva {word}]\nPIPSA: Hei!")).beats[0].camera,
                Some(hint),
                "{word}"
            );
        }
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
        assert_eq!(
            tl.background_at(Tick::from_seconds(6.0)),
            Some("car-driver-v1")
        );
        assert_eq!(
            tl.background_at(Tick::from_seconds(8.5)),
            Some("phone-front-v1")
        );
        let walk = tl.motion_at(Tick::from_seconds(3.5)).unwrap();
        assert_eq!(walk.0, MotionKind::Walk(Direction::Right));
        assert_eq!(walk.2.source.line, 3);
        assert!(tl.ids_are_unique());
    }
}

pub mod assist;

#[cfg(test)]
mod chair_grammar_tests {
    use super::*;
    #[test]
    fn chair_actions_are_explicit_bounded_and_never_inferred_from_speech() {
        for (tag, expected) in [("sit on chair 2s", MotionKind::Sit), ("sitting on the chair 1s", MotionKind::Sit), ("stand up 2s", MotionKind::Stand), ("istu tuolille 2s", MotionKind::Sit), ("nouse tuolilta 2s", MotionKind::Stand)] {
            let p=parse(&format!("KALLE: [{tag}]"));
            assert!(p.is_assemblable(), "{tag}: {:?}", p.diagnostics);
            assert_eq!(p.beats[0].motion, expected);
        }
        for tag in ["sit down", "sit on sofa", "sit on chair quickly", "sit on chair 0.5s", "stand up 0.5s", "sit on chair 1e1s", "istu tuolille väärin", "stand beside chair"] {
            assert!(!parse(&format!("KALLE: [{tag}]")).is_assemblable(), "{tag}");
        }
        assert_eq!(parse("KALLE: Please sit on the chair.").beats[0].motion, MotionKind::Wait);
    }
}

#[cfg(test)]
mod movement_library_grammar {
    use super::*;
    #[test]
    fn new_motion_corpus_is_explicit_and_strict() {
        for (tag, kind) in [
            ("walking backwards 2s", MotionKind::WalkBackward),
            ("turning left for 2 seconds", MotionKind::TurnLeft),
            ("turn right 1s", MotionKind::TurnRight),
            ("pointing forward 2s", MotionKind::PointForward),
            ("shrugging shoulders 2s", MotionKind::Shrug),
            ("shaking head 2s", MotionKind::ShakeHead),
            ("clapping hands 2s", MotionKind::Clap),
            ("kävele taaksepäin 2s", MotionKind::WalkBackward),
            ("taputa 2s", MotionKind::Clap),
        ] {
            let p=parse(&format!("KALLE: [{tag}]"));
            assert!(p.is_assemblable(), "{tag}: {:?}",p.diagnostics);
            assert_eq!(p.beats[0].motion,kind);
        }
        for tag in ["turn", "turn left 180 degrees", "point at Maija", "shake hands", "shrug sadly", "clap while jumping", "walk backward quickly", "run backward", "clap 0s"] {
            assert!(!parse(&format!("KALLE: [{tag}]")).is_assemblable(), "{tag}");
        }
        for text in ["Please turn left.", "I clap my hands.", "Walk backward, please."] {
            assert_eq!(parse(&format!("KALLE: {text}")).beats[0].motion, MotionKind::Wait);
        }
    }
}
