//! Aikajanasta asentoon ilman avainruutuja.
//!
//! [`ProceduralMotion::prepare`] laskee kerran juuren radan (paikka, suunta,
//! hyppykorkeus) tiheänä taulukkona. Sen jälkeen [`PreparedMotion::evaluate`]
//! on puhdas funktio ajasta asentoon: tyhjäkäynti (hengitys, painonsiirto),
//! tapahtuman liike sekoitettuna sisään/ulos, jalkojen maakontakti-IK,
//! puhelimen näpyttely sekä hiusten ja vaatteiden toisioliike.

use crate::gait::{self, GaitParams};
use crate::gestures;
use crate::hands::{self, PhoneSpec, PhoneState, TapParams};
use crate::humanoid::{Humanoid, Side};
use crate::ik;
use crate::secondary::DampedSine;
use crate::skeleton::Pose;
use glam::{Quat, Vec3};
use hs_core::{Direction, EventKind, MotionKind, PhoneView, Timeline, TimelineEvent, View};
use std::f32::consts::{FRAC_PI_2, PI, TAU};

/// Juuren rata-taulukon näytteenottotaajuus.
const PATH_HZ: f32 = 240.0;
/// Liikkeiden sisään/ulos-sekoituksen kesto (s).
const BLEND: f32 = 0.28;

#[derive(Clone, Debug)]
pub struct ProceduralMotion {
    pub humanoid: Humanoid,
    pub walk: GaitParams,
    pub run: GaitParams,
    pub tap: TapParams,
    pub phone: PhoneSpec,
    pub hair: DampedSine,
    pub cloth: DampedSine,
    /// Hahmon nimi (puhuja); `None` = päähahmo, joka saa myös nimeämättömät rivit.
    pub name: Option<String>,
    pub lead: bool,
    pub start: Vec3,
}

#[derive(Clone, Debug)]
pub struct PropFrame {
    pub phone: Option<PhoneState>,
}

#[derive(Clone, Debug)]
pub struct CharacterFrame {
    pub pose: Pose,
    pub props: PropFrame,
    /// Suun avautuminen 0..1 (sama kuin `mouth.open`).
    pub mouth_open: f32,
    /// Suun muoto: tekstistä johdetut visemit. Äänellinen huulisynkka korvaa
    /// tämän renderöinnissä ([`crate::face::apply_mouth`]).
    pub mouth: hs_lipsync::MouthShape,
    pub motion: Option<MotionKind>,
    pub speaking: bool,
    pub root: Vec3,
    pub yaw: f32,
    pub velocity: Vec3,
}

#[derive(Clone, Copy, Debug)]
struct PathSample {
    pos: Vec3,
    yaw: f32,
}

#[derive(Clone, Debug)]
pub struct PreparedMotion {
    pub motion: ProceduralMotion,
    events: Vec<TimelineEvent>,
    /// Repliikkien tekstivisemit tapahtuman tunnisteen mukaan.
    mouths: std::collections::HashMap<hs_core::EventId, hs_lipsync::VisemeTrack>,
    path: Vec<PathSample>,
    duration: f32,
}

fn smoothstep(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

/// Sisään/ulos-sekoituksen paino tapahtuman paikallisessa ajassa.
fn ramp(tau: f32, duration: f32, blend: f32) -> f32 {
    let b = blend.min(duration * 0.5).max(1e-3);
    smoothstep(tau / b) * smoothstep((duration - tau) / b)
}

fn yaw_of(dir: Direction) -> f32 {
    match dir {
        Direction::Right => FRAC_PI_2,
        Direction::Left => -FRAC_PI_2,
        Direction::Front => 0.0,
    }
}

fn view_yaw(view: View) -> f32 {
    match view {
        View::Front => 0.0,
        View::Right => FRAC_PI_2,
        View::Left => -FRAC_PI_2,
        View::Back => PI,
    }
}

/// Hypyn juuren korkeus ja kyykistys tapahtuman edistymisestä 0..1.
fn jump_profile(p: f32, height: f32) -> (f32, f32) {
    if p < 0.25 {
        (0.0, smoothstep(p / 0.25))
    } else if p < 0.75 {
        let u = (p - 0.25) / 0.5;
        (
            height * 4.0 * u * (1.0 - u),
            (1.0 - smoothstep(u * 4.0)) * 0.5,
        )
    } else {
        let u = (p - 0.75) / 0.25;
        (0.0, (1.0 - u) * smoothstep(u * 6.0) * 0.9)
    }
}

impl ProceduralMotion {
    pub fn new(humanoid: Humanoid) -> Self {
        ProceduralMotion {
            humanoid,
            walk: GaitParams::walk(),
            run: GaitParams::run(),
            tap: TapParams::default(),
            phone: PhoneSpec::default(),
            hair: DampedSine::HAIR,
            cloth: DampedSine::CLOTH,
            name: None,
            lead: true,
            start: Vec3::ZERO,
        }
    }

    fn applies(&self, e: &TimelineEvent) -> bool {
        match &e.kind {
            EventKind::Motion { character, .. }
            | EventKind::CharacterView { character, .. }
            | EventKind::Phone { character, .. } => match (character, &self.name) {
                (None, _) => self.lead,
                (Some(c), Some(n)) => c.eq_ignore_ascii_case(n),
                (Some(_), None) => self.lead,
            },
            _ => false,
        }
    }

    /// Laskee juuren radan kerran koko aikajanalle.
    pub fn prepare(self, timeline: &Timeline) -> PreparedMotion {
        let events: Vec<TimelineEvent> = timeline
            .events
            .iter()
            .filter(|e| self.applies(e))
            .cloned()
            .collect();
        let has_chair = events.iter().any(|e| {
            matches!(
                e.kind,
                EventKind::Motion {
                    motion: MotionKind::Sit,
                    ..
                }
            )
        });
        let duration = timeline.duration.seconds() as f32;
        let n = (duration * PATH_HZ).ceil() as usize + 2;
        let leg = self.humanoid.pelvis_height();
        let mut path = Vec::with_capacity(n);
        let mut pos = self.start;
        let mut yaw = 0.0f32;
        let dt = 1.0 / PATH_HZ;
        let mut turned = false;
        let mut turn_starts = std::collections::HashMap::new();
        for k in 0..n {
            let t = k as f32 * dt;
            let mut velocity = Vec3::ZERO;
            // Chair contact preserves authored orientation through Sit/Stand and idle.
            let mut target_yaw = if has_chair || turned { yaw } else { 0.0 };
            let mut jump_y = 0.0;
            let mut authored_turn = None;
            for e in &events {
                let (s, d) = (e.start.seconds() as f32, e.duration.seconds() as f32);
                if t < s || t >= s + d {
                    continue;
                }
                let tau = t - s;
                match &e.kind {
                    EventKind::Motion {
                        motion: MotionKind::Walk(dir),
                        ..
                    } => {
                        target_yaw = yaw_of(*dir);
                        let w = ramp(tau, d, 0.35);
                        velocity = Quat::from_rotation_y(yaw) * Vec3::Z * self.walk.speed(leg) * w;
                        if *dir == Direction::Front {
                            velocity *= 0.35;
                        }
                    }
                    EventKind::Motion {
                        motion: MotionKind::WalkBackward,
                        ..
                    } => {
                        turned = true;
                        target_yaw = yaw;
                        velocity = -(Quat::from_rotation_y(yaw) * Vec3::Z)
                            * self.walk.speed(leg)
                            * ramp(tau, d, 0.35);
                    }
                    EventKind::Motion {
                        motion: mk @ (MotionKind::TurnLeft | MotionKind::TurnRight),
                        ..
                    } => {
                        let start = *turn_starts.entry(e.id).or_insert(yaw);
                        let sign = if *mk == MotionKind::TurnLeft {
                            -1.0
                        } else {
                            1.0
                        };
                        // Finish at the endpoint of the authored interval, not the speech scene.
                        authored_turn = Some(start + sign * FRAC_PI_2 * smoothstep((tau + dt) / d));
                        turned = true;
                    }
                    EventKind::Motion {
                        motion: MotionKind::Run(dir),
                        ..
                    } => {
                        target_yaw = yaw_of(*dir);
                        let w = ramp(tau, d, 0.3);
                        velocity = Quat::from_rotation_y(yaw) * Vec3::Z * self.run.speed(leg) * w;
                        if *dir == Direction::Front {
                            velocity *= 0.35;
                        }
                    }
                    EventKind::Motion {
                        motion: MotionKind::Jump,
                        ..
                    } => {
                        jump_y = jump_profile(tau / d.max(1e-3), leg * 0.35).0;
                    }
                    EventKind::CharacterView { view, .. } => target_yaw = view_yaw(*view),
                    _ => {}
                }
            }
            // Kriittisesti vaimennettu kääntyminen kohti tavoitesuuntaa.
            let diff = (target_yaw - yaw + PI).rem_euclid(TAU) - PI;
            yaw = authored_turn.unwrap_or(yaw + diff * (1.0 - (-dt * 9.0).exp()));
            pos += velocity * dt;
            path.push(PathSample {
                pos: Vec3::new(pos.x, jump_y, pos.z),
                yaw,
            });
        }
        let mut mouths = std::collections::HashMap::new();
        for e in &timeline.events {
            if let EventKind::Dialogue { speaker, text } = &e.kind {
                if self.speaks(speaker) {
                    let d = e.duration.seconds() as f32;
                    mouths.insert(
                        e.id,
                        hs_lipsync::from_text_timed(text, speech_length(text, d)),
                    );
                }
            }
        }
        PreparedMotion {
            motion: self,
            events,
            mouths,
            path,
            duration,
        }
    }

    /// Onko repliikki tämän hahmon? Nimetön repliikki kuuluu päähenkilölle.
    pub fn speaks(&self, speaker: &Option<String>) -> bool {
        match (speaker, &self.name) {
            (None, _) => self.lead,
            (Some(s), Some(n)) => s.eq_ignore_ascii_case(n),
            (Some(_), None) => self.lead,
        }
    }
}

/// Puheen kesto tekstistä (noin 4,5 tavua sekunnissa), enintään repliikin pituus.
pub fn speech_length(text: &str, duration: f32) -> f32 {
    let syllables = text
        .chars()
        .filter(|c| "aeiouyäöåAEIOUYÄÖÅ".contains(*c))
        .count()
        .max(1) as f32;
    (syllables / 4.5).min(duration)
}

impl PreparedMotion {
    pub fn duration(&self) -> f32 {
        self.duration
    }

    fn path_at(&self, t: f32) -> PathSample {
        let x = (t.max(0.0) * PATH_HZ).min((self.path.len() - 1) as f32);
        let i = x.floor() as usize;
        let j = (i + 1).min(self.path.len() - 1);
        let f = x - i as f32;
        let (a, b) = (self.path[i], self.path[j]);
        let diff = (b.yaw - a.yaw + PI).rem_euclid(TAU) - PI;
        PathSample {
            pos: a.pos.lerp(b.pos, f),
            yaw: a.yaw + diff * f,
        }
    }

    /// Juuren paikka (maassa, y = hypyn korkeus) ja suunta hetkellä `t`.
    pub fn root_at(&self, t: f32) -> (Vec3, f32) {
        let p = self.path_at(t);
        (p.pos, p.yaw)
    }

    pub fn events(&self) -> &[TimelineEvent] {
        &self.events
    }

    fn velocity(&self, t: f32) -> Vec3 {
        const H: f32 = 1.0 / 120.0;
        (self.path_at(t + H).pos - self.path_at(t - H).pos) / (2.0 * H)
    }

    fn acceleration(&self, t: f32) -> Vec3 {
        const H: f32 = 1.0 / 60.0;
        (self.path_at(t + H).pos - self.path_at(t).pos * 2.0 + self.path_at(t - H).pos) / (H * H)
    }

    fn active(&self, t: f32) -> impl Iterator<Item = (&TimelineEvent, f32, f32)> {
        self.events.iter().filter_map(move |e| {
            let (s, d) = (e.start.seconds() as f32, e.duration.seconds() as f32);
            (t >= s && t < s + d).then_some((e, t - s, d))
        })
    }

    pub fn evaluate(&self, timeline: &Timeline, t: f32) -> CharacterFrame {
        let m = &self.motion;
        let h = &m.humanoid;
        let sk = &h.skeleton;
        let mut pose = h.rest_pose();
        let path = self.path_at(t);
        pose.root_pos = Vec3::new(path.pos.x, 0.0, path.pos.z);
        pose.root_rot = Quat::from_rotation_y(path.yaw);
        let leg = h.pelvis_height();

        // Tyhjäkäynti: hengitys, painonsiirto, pään mikroliike, kädet rennosti.
        let breath = (TAU * 0.27 * t).sin();
        pose.local[h.chest] = Quat::from_rotation_x(-0.025 * breath);
        pose.translate[h.pelvis].x = 0.006 * (TAU * 0.11 * t).sin();
        pose.local[h.neck] = Quat::from_rotation_y(0.05 * (TAU * 0.07 * t).sin())
            * Quat::from_rotation_x(0.02 * (TAU * 0.19 * t).sin());
        for side in Side::BOTH {
            let arm = h.arm(side);
            pose.local[arm.upper] = Quat::from_rotation_z(side.sign() * 0.09);
            pose.local[arm.fore] = Quat::from_rotation_x(-0.18);
            hands::curl_fingers(h, &mut pose, side, 0.22);
        }

        let mut motion = None;
        let mut phone = None;
        let mut phone_view: Option<PhoneView> = None;
        let mut feet_grounded = true;
        let mut crouch = 0.0f32;
        let mut gait_sample = None;

        for (e, tau, d) in self.active(t) {
            let w = ramp(tau, d, BLEND);
            let p = tau / d.max(1e-3);
            match &e.kind {
                EventKind::Phone { view, .. } => phone_view = Some(*view),
                EventKind::Motion { motion: mk, .. } => {
                    motion = Some(*mk);
                    match mk {
                        MotionKind::Walk(_) | MotionKind::Run(_) | MotionKind::WalkBackward => {
                            let params = if matches!(mk, MotionKind::Run(_)) {
                                &m.run
                            } else {
                                &m.walk
                            };
                            let mut g = gait::sample(h, params, tau * params.frequency);
                            if *mk == MotionKind::WalkBackward {
                                gait::reverse(&mut g);
                            }
                            gait_sample = Some((g, ramp(tau, d, 0.35)));
                            feet_grounded = false;
                        }
                        MotionKind::Wave => {
                            let arm = h.arm(Side::Left);
                            let env = (PI * p).sin().powi(2);
                            pose.local[arm.upper] = Quat::from_rotation_z(0.09 + 2.45 * env)
                                * Quat::from_rotation_x(-0.25 * env);
                            pose.local[arm.fore] =
                                Quat::from_rotation_z((0.45 * (tau * TAU * 2.0).sin() + 0.3) * env)
                                    * Quat::from_rotation_x(-0.3 * env);
                            hands::curl_fingers(h, &mut pose, Side::Left, 0.22 * (1.0 - env));
                        }
                        MotionKind::PointForward => {
                            let env = (PI * p).sin().powi(2);
                            let arm = h.arm(Side::Right);
                            pose.local[arm.upper] = Quat::from_rotation_x(-FRAC_PI_2 * env);
                            pose.local[arm.fore] = Quat::from_rotation_x(-0.08 * env);
                            hands::curl_fingers(h, &mut pose, Side::Right, 0.8 * env);
                            for joint in arm.fingers[1].joints {
                                pose.local[joint] = Quat::IDENTITY;
                            }
                        }
                        MotionKind::Shrug => {
                            let env = (PI * p).sin().powi(2);
                            for side in Side::BOTH {
                                let arm = h.arm(side);
                                pose.translate[arm.clavicle].y +=
                                    h.proportions.height * 0.035 * env;
                                pose.local[arm.upper] =
                                    Quat::from_rotation_z(side.sign() * 0.42 * env);
                                pose.local[arm.fore] = Quat::from_rotation_x(-1.35 * env);
                                let current = sk.world(&pose)[arm.hand].rot;
                                let up =
                                    pose.root_rot * Quat::from_rotation_z(-side.sign() * FRAC_PI_2);
                                sk.set_world_rotation(&mut pose, arm.hand, current.slerp(up, env));
                                hands::curl_fingers(h, &mut pose, side, 0.1);
                            }
                        }
                        MotionKind::ShakeHead => {
                            pose.local[h.head] = Quat::from_rotation_y(
                                0.36 * (TAU * 2.0 * p).sin() * (PI * p).sin().powi(2),
                            );
                        }
                        MotionKind::Clap => {
                            gestures::clap(h, &mut pose, p);
                        }
                        MotionKind::TurnLeft | MotionKind::TurnRight => {}
                        MotionKind::Nod => {
                            let env = (PI * p).sin().powi(2);
                            pose.local[h.head] = Quat::from_rotation_x(
                                (0.21 * (tau * 3.0 * PI).sin()).max(-0.05) * env,
                            );
                        }
                        MotionKind::Crouch => {
                            let env = (PI * p).sin().powi(2);
                            crouch = crouch.max(env * 0.36);
                            pose.local[h.spine] = Quat::from_rotation_x(0.35 * env);
                            for side in Side::BOTH {
                                let arm = h.arm(side);
                                pose.local[arm.upper] =
                                    Quat::from_rotation_x(-0.6 * env) * pose.local[arm.upper];
                            }
                        }
                        MotionKind::Jump => {
                            let (_, squash) = jump_profile(p, leg * 0.35);
                            crouch = crouch.max(squash * 0.32);
                            let airborne = path.pos.y > 1e-3;
                            for side in Side::BOTH {
                                let arm = h.arm(side);
                                let up = if airborne { 2.2 } else { -0.5 * squash };
                                pose.local[arm.upper] = Quat::from_rotation_x(-up * w)
                                    * Quat::from_rotation_z(side.sign() * 0.25);
                            }
                            if airborne {
                                feet_grounded = false;
                                for side in Side::BOTH {
                                    let l = h.leg(side);
                                    pose.local[l.thigh] = Quat::from_rotation_x(-0.6);
                                    pose.local[l.shin] = Quat::from_rotation_x(1.0);
                                }
                            }
                        }
                        MotionKind::PhoneTap => {
                            phone = Some((tau, w, true));
                        }
                        MotionKind::Wait | MotionKind::Sit | MotionKind::Stand => {}
                    }
                }
                _ => {}
            }
        }
        if phone.is_none() {
            if let Some(view) = phone_view.filter(|v| *v != PhoneView::Hidden) {
                let _ = view;
                phone = Some((0.0, 1.0, false));
            }
        }

        // Puhe: pää elää repliikin tahdissa ja suu muodostaa tekstin äänteet.
        let mut speaking = false;
        let mut mouth = hs_lipsync::Viseme::Rest.shape();
        for e in timeline.events_at(hs_core::Tick::from_seconds(t as f64)) {
            if let EventKind::Dialogue { speaker, .. } = &e.kind {
                if m.speaks(speaker) {
                    speaking = true;
                    let tau = t - e.start.seconds() as f32;
                    if let Some(track) = self.mouths.get(&e.id) {
                        mouth = track.shape_at(tau);
                    }
                    let held = timeline.events.iter().filter(|e| e.start.seconds() as f32 <= t)
                        .filter_map(|e| match &e.kind { EventKind::Prop { character, item } if m.speaks(character) => Some((e.start, item)), _ => None })
                        .max_by_key(|(start, _)| *start).is_some_and(|(_, item)| item.is_some());
                    if phone.is_none() && !held && matches!(motion, None | Some(MotionKind::Wait)) {
                        let w = ramp(tau, e.duration.seconds() as f32, 0.3);
                        let arm = h.arm(Side::Right);
                        pose.local[arm.upper] = Quat::from_rotation_x(-0.12 * w) * pose.local[arm.upper];
                        pose.local[arm.fore] = Quat::from_rotation_x(-0.16 * w * (0.5 + 0.5 * (TAU * 0.7 * tau).sin())) * pose.local[arm.fore];
                    }
                    pose.local[h.head] =
                        Quat::from_rotation_x(0.035 * ramp(tau, e.duration.seconds() as f32, 0.25) * (TAU * 1.3 * tau).sin()) * pose.local[h.head];
                }
            }
        }
        let mouth_open = mouth.open;
        crate::face::apply_mouth(h, &mut pose, &mouth);
        if crouch > 0.0 {
            pose.translate[h.pelvis].y -= crouch * leg * 0.5;
        }
        if let Some((g, w)) = gait_sample {
            gait::apply(h, &mut pose, &g, w);
            // Sekoitus seisontaan: rampin reunoilla jalat palaavat maahan.
            if w < 0.999 {
                feet_grounded = false;
            }
        }
        if feet_grounded {
            // Jalat pysyvät maassa lepopaikoillaan; polvet joustavat.
            let world = sk.world(&pose);
            for side in Side::BOTH {
                let l = h.leg(side);
                let target = pose.root_pos
                    + pose.root_rot
                        * Vec3::new(
                            side.sign() * h.proportions.hip_width * 0.5,
                            l.ankle_height,
                            0.0,
                        );
                let pole = world[l.shin].pos + pose.root_rot * Vec3::Z;
                ik::two_bone(sk, &mut pose, l.thigh, l.shin, l.foot, target, pole);
                let flat = pose.root_rot;
                sk.set_world_rotation(&mut pose, l.foot, flat);
            }
        }
        pose.root_pos.y = path.pos.y;

        if let Some(chair) = self.chair_at(t) {
            crate::seating::apply(h, &mut pose, &chair);
        }

        let props = PropFrame {
            phone: phone.map(|(tau, w, tapping)| {
                let t_phone = if tapping { tau } else { 0.0 };
                let mut st = hands::phone_tapping(h, &mut pose, t_phone, &m.tap, &m.phone, w);
                if !tapping {
                    st.touching = [false; 2];
                    st.pressed = None;
                }
                st
            }),
        };

        // Toisioliike: kiihtyvyys hahmon omassa koordinaatistossa.
        let inv = pose.root_rot.inverse();
        let accel = |tau: f32| inv * self.acceleration(tau);
        let hair = m.hair.response(t, accel);
        let cloth = m.cloth.response(t, accel);
        let bounce = gait_sample.map_or(0.0, |(g, w)| g.pelvis_offset.y * w);
        if let [h0, h1] = h.hair[..] {
            // Kiihdytys eteen heilauttaa hiuksia taakse; sivuttain kallistaa.
            pose.local[h0] =
                Quat::from_rotation_x(0.08 + (-hair.z * 0.06).clamp(-0.9, 0.9) + bounce * 2.0)
                    * Quat::from_rotation_z((hair.x * 0.05).clamp(-0.6, 0.6));
            pose.local[h1] = Quat::from_rotation_x(
                (-hair.z * 0.04).clamp(-0.7, 0.7) + 0.1 * (TAU * 0.5 * t).sin() * 0.2,
            );
        }
        let swing = gait_sample.map_or(0.0, |(g, w)| g.arm_pitch[0] * w * 0.15);
        pose.local[h.hem_front] = Quat::from_rotation_x((-cloth.z * 0.05 + swing).clamp(-0.6, 0.6));
        pose.local[h.hem_back] = Quat::from_rotation_x((-cloth.z * 0.05 - swing).clamp(-0.6, 0.6));

        let root = Vec3::new(pose.root_pos.x, path.pos.y, pose.root_pos.z);
        CharacterFrame {
            pose,
            props,
            mouth_open,
            mouth,
            motion,
            speaking,
            root,
            yaw: path.yaw,
            velocity: self.velocity(t),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::humanoid::Proportions;
    use hs_core::{Fps, SourceSpan, Tick};

    fn timeline(events: &[(f64, f64, MotionKind)]) -> Timeline {
        let mut tl = Timeline::new(Fps(30));
        for (s, d, m) in events {
            tl.push(
                Tick::from_seconds(*s),
                Tick::from_seconds(*d),
                EventKind::Motion {
                    character: None,
                    motion: *m,
                },
                SourceSpan {
                    line: 1,
                    text: String::new(),
                },
            );
        }
        tl
    }

    #[test]
    fn walking_right_travels_right_and_turns() {
        let tl = timeline(&[
            (0.0, 3.0, MotionKind::Walk(Direction::Right)),
            (3.0, 1.0, MotionKind::Wait),
        ]);
        let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
        let mid = m.evaluate(&tl, 1.5);
        assert!(mid.root.x > 0.3, "kulki {}", mid.root.x);
        assert!((mid.yaw - FRAC_PI_2).abs() < 0.05);
        let end = m.evaluate(&tl, 3.9);
        assert!(
            end.yaw.abs() < 0.2,
            "kääntyy takaisin katsojaan: {}",
            end.yaw
        );
    }

    #[test]
    fn feet_stay_on_ground_when_standing_and_hair_reacts_to_stop() {
        let tl = timeline(&[
            (0.0, 2.0, MotionKind::Run(Direction::Left)),
            (2.0, 2.0, MotionKind::Wait),
        ]);
        let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
        let h = &m.motion.humanoid;
        let f = m.evaluate(&tl, 3.5);
        let w = h.skeleton.world(&f.pose);
        for side in Side::BOTH {
            let ankle = w[h.leg(side).foot].pos.y;
            assert!(
                (ankle - h.leg(side).ankle_height).abs() < 2e-3,
                "nilkka {ankle}"
            );
        }
        let hair_still = m.evaluate(&tl, 1.0).pose.local[h.hair[0]];
        let hair_after_stop = m.evaluate(&tl, 2.1).pose.local[h.hair[0]];
        assert!(hair_still.angle_between(hair_after_stop) > 0.02);
    }

    #[test]
    fn jump_leaves_ground_and_phone_appears_for_tapping() {
        let tl = timeline(&[
            (0.0, 1.2, MotionKind::Jump),
            (1.2, 3.0, MotionKind::PhoneTap),
        ]);
        let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
        assert!(m.evaluate(&tl, 0.6).root.y > 0.1);
        assert!(m.evaluate(&tl, 0.6).props.phone.is_none());
        let f = m.evaluate(&tl, 2.5);
        let phone = f.props.phone.expect("puhelin näkyy");
        assert!(phone.thumb_error.iter().all(|e| *e < 6e-3));
    }

    #[test]
    fn evaluation_is_order_independent() {
        let tl = timeline(&[
            (0.0, 2.0, MotionKind::Walk(Direction::Left)),
            (2.0, 2.0, MotionKind::Wave),
        ]);
        let m = ProceduralMotion::new(Humanoid::new(Proportions::default())).prepare(&tl);
        let a = m.evaluate(&tl, 2.7).pose;
        let _ = m.evaluate(&tl, 0.3);
        assert_eq!(a, m.evaluate(&tl, 2.7).pose);
    }
}
