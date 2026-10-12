//! Aikajanan tietomalli. Käsikirjoitus on totuuden lähde; aikajana on siitä
//! deterministisesti johdettu, ja jokainen tapahtuma muistaa lähderivinsä.

use crate::time::{Fps, Tick};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Direction {
    Left,
    Right,
    /// Kohti katsojaa.
    Front,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum View {
    Front,
    Left,
    Right,
    Back,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PhoneView {
    Front,
    Back,
    Side,
    Hidden,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MotionKind {
    /// Puhe tai tauko ilman erillistä liikettä (hengitys ja tyhjäkäynti jatkuvat).
    Wait,
    Walk(Direction),
    Run(Direction),
    Wave,
    Jump,
    Crouch,
    Nod,
    /// Puhelimen näpyttely: peukalo ja sormet IK:lla ruudun kohteisiin.
    PhoneTap,
}

impl MotionKind {
    pub fn is_locomotion(self) -> bool {
        matches!(self, MotionKind::Walk(_) | MotionKind::Run(_))
    }
    pub fn finnish_name(self) -> &'static str {
        match self {
            MotionKind::Wait => "Puhe / tauko",
            MotionKind::Walk(Direction::Left) => "Kävely vasemmalle",
            MotionKind::Walk(Direction::Right) => "Kävely oikealle",
            MotionKind::Walk(Direction::Front) => "Kävely kohti katsojaa",
            MotionKind::Run(Direction::Left) => "Juoksu vasemmalle",
            MotionKind::Run(Direction::Right) => "Juoksu oikealle",
            MotionKind::Run(Direction::Front) => "Juoksu kohti katsojaa",
            MotionKind::Wave => "Vilkutus",
            MotionKind::Jump => "Hyppy",
            MotionKind::Crouch => "Kyykistys",
            MotionKind::Nod => "Nyökkäys",
            MotionKind::PhoneTap => "Puhelimen näpyttely",
        }
    }
}

/// Käsikirjoittajan nimenomainen kuvaohje. Ilman ohjetta kamera-agentti valitsee itse.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CameraHint {
    Wide,
    Medium,
    CloseUp,
    /// Lähikuva puhelimen ruudusta / käsistä.
    Insert,
    /// Kaksi hahmoa samassa kuvassa (puhuja ja keskustelukumppani).
    TwoShot,
    /// Olan yli: kumppanin olka etualalla, puhuja kuvan keskellä.
    OverShoulder,
    /// Alakulma: kamera alhaalla, hahmo näyttää suurelta.
    LowAngle,
    /// Yläkulma: kamera ylhäällä, hahmo näyttää pieneltä.
    HighAngle,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TrackKind {
    Dialogue,
    Motion,
    Camera,
    Environment,
}

/// Explicit authored emotion; never inferred from dialogue text.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Expression {
    #[default]
    Neutral,
    Happy,
    Angry,
    Sad,
    Surprised,
    Scared,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LookTarget {
    Camera,
    Character(String),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum EventKind {
    Dialogue { speaker: Option<String>, text: String },
    Motion { character: Option<String>, motion: MotionKind },
    Background { id: String },
    CharacterView { view: View },
    Phone { view: PhoneView },
    /// Hahmo ottaa käteensä esineen (`item`) tai laskee sen pois (`None`).
    Prop { character: Option<String>, item: Option<String> },
    Camera { hint: CameraHint },
    Expression { character: Option<String>, expression: Expression },
    LookAt { character: Option<String>, target: LookTarget },
}

impl EventKind {
    pub fn track(&self) -> TrackKind {
        match self {
            EventKind::Dialogue { .. } => TrackKind::Dialogue,
            EventKind::Motion { .. } | EventKind::CharacterView { .. } | EventKind::Phone { .. } | EventKind::Prop { .. } | EventKind::Expression { .. } | EventKind::LookAt { .. } => {
                TrackKind::Motion
            }
            EventKind::Camera { .. } => TrackKind::Camera,
            EventKind::Background { .. } => TrackKind::Environment,
        }
    }
}

/// Alkuperäinen lähdekohta käsikirjoituksessa.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceSpan {
    /// 1-pohjainen rivinumero.
    pub line: usize,
    pub text: String,
}

/// Sisältöön perustuva tunniste: sama repliikki saa saman tunnisteen, vaikka
/// rivi siirtyisi, jotta äänet, hyväksynnät ja lukitukset säilyvät.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct EventId(pub u64);

impl EventId {
    fn fnv1a(bytes: &[u8]) -> u64 {
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for b in bytes {
            h ^= *b as u64;
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
        h
    }
}

impl std::fmt::Display for EventId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:016x}", self.0)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub id: EventId,
    pub start: Tick,
    pub duration: Tick,
    pub kind: EventKind,
    pub source: SourceSpan,
}

impl TimelineEvent {
    pub fn end(&self) -> Tick {
        self.start + self.duration
    }
    pub fn contains(&self, t: Tick) -> bool {
        t >= self.start && t < self.end()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Timeline {
    pub fps: Fps,
    pub duration: Tick,
    pub events: Vec<TimelineEvent>,
}

impl Timeline {
    pub fn new(fps: Fps) -> Self {
        Self { fps, duration: Tick::ZERO, events: Vec::new() }
    }

    /// Lisää tapahtuman ja antaa sille sisältöön perustuvan tunnisteen.
    /// Samansisältöiset tapahtumat erotetaan järjestysnumerolla.
    pub fn push(&mut self, start: Tick, duration: Tick, kind: EventKind, source: SourceSpan) -> EventId {
        let key = format!("{kind:?}");
        let occurrence = self
            .events
            .iter()
            .filter(|e| format!("{:?}", e.kind) == key)
            .count();
        let id = EventId(EventId::fnv1a(format!("{key}#{occurrence}").as_bytes()));
        self.events.push(TimelineEvent { id, start, duration, kind, source });
        self.duration = self.duration.max(start + duration);
        id
    }

    pub fn frame_count(&self) -> u32 {
        self.fps.frames_covering(self.duration)
    }

    pub fn events_at(&self, t: Tick) -> impl Iterator<Item = &TimelineEvent> {
        self.events.iter().filter(move |e| e.contains(t))
    }

    pub fn on_track(&self, track: TrackKind) -> impl Iterator<Item = &TimelineEvent> {
        self.events.iter().filter(move |e| e.kind.track() == track)
    }

    /// Liike, joka on käynnissä hetkellä `t`, ja sen suhteellinen edistyminen 0..1.
    pub fn motion_at(&self, t: Tick) -> Option<(MotionKind, f32, &TimelineEvent)> {
        self.events.iter().find_map(|e| match e.kind {
            EventKind::Motion { motion, .. } if e.contains(t) => {
                let p = (t - e.start).0 as f64 / e.duration.0.max(1) as f64;
                Some((motion, p as f32, e))
            }
            _ => None,
        })
    }

    /// Viimeisin voimassa oleva tausta hetkellä `t`.
    pub fn background_at(&self, t: Tick) -> Option<&str> {
        self.events
            .iter()
            .filter(|e| e.start <= t)
            .filter_map(|e| match &e.kind {
                EventKind::Background { id } => Some((e.start, id.as_str())),
                _ => None,
            })
            .max_by_key(|(s, _)| *s)
            .map(|(_, id)| id)
    }

    /// Tarkistaa, ettei sama tunniste esiinny kahdesti.
    pub fn ids_are_unique(&self) -> bool {
        let mut seen = HashMap::new();
        self.events.iter().all(|e| seen.insert(e.id, ()).is_none())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn span(line: usize) -> SourceSpan {
        SourceSpan { line, text: String::new() }
    }

    #[test]
    fn ids_follow_content_not_position() {
        let say = |t: &str| EventKind::Dialogue { speaker: None, text: t.into() };
        let mut a = Timeline::new(Fps(30));
        let first = a.push(Tick::ZERO, Tick::from_seconds(1.0), say("Hei"), span(1));
        let mut b = Timeline::new(Fps(30));
        b.push(Tick::ZERO, Tick::from_seconds(2.0), say("Moi"), span(1));
        let moved = b.push(Tick::from_seconds(2.0), Tick::from_seconds(1.0), say("Hei"), span(2));
        assert_eq!(first, moved);
        let dup = b.push(Tick::from_seconds(3.0), Tick::from_seconds(1.0), say("Hei"), span(3));
        assert_ne!(moved, dup);
        assert!(b.ids_are_unique());
    }

    #[test]
    fn serializes_round_trip() {
        let mut t = Timeline::new(Fps(30));
        t.push(
            Tick::ZERO,
            Tick::from_seconds(2.0),
            EventKind::Motion { character: None, motion: MotionKind::Run(Direction::Left) },
            span(1),
        );
        t.push(Tick::ZERO, Tick::from_seconds(2.0),
            EventKind::Expression { character: Some("Kalle".into()), expression: Expression::Happy }, span(1));
        t.push(Tick::ZERO, Tick::from_seconds(2.0),
            EventKind::LookAt { character: Some("Kalle".into()), target: LookTarget::Character("Maija".into()) }, span(1));
        t.push(Tick::from_seconds(2.0), Tick::from_seconds(1.0),
            EventKind::LookAt { character: Some("Kalle".into()), target: LookTarget::Camera }, span(2));
        let json = serde_json::to_string(&t).unwrap();
        assert_eq!(serde_json::from_str::<Timeline>(&json).unwrap(), t);
    }
}
