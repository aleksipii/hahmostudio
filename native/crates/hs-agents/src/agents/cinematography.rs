//! Automaattinen kuvaus: kuvakoot, leikkaukset, kameran ajot ja kolmipistevalaistus.
//!
//! Säännöt (deterministiset):
//! * Liikkuva hahmo kuvataan laajana ja kamera seuraa (tracking), muut liikkeet kokokuvana.
//! * Repliikki puolilähikuvana; peräkkäiset repliikit vaihtelevat kuvakokoa ja kulmaa
//!   (30 asteen sääntö), jotta ei synny hyppyleikkausta.
//! * Näpyttely: ensin puolilähi, sitten insertti puhelimeen.
//! * Kamera pysyy aina toiminta-akselin samalla puolella (180 asteen sääntö).
//! * Vain saman automaattisen kuvan jatkuvat otokset yhdistetään; kirjoitetut leikkaukset säilyvät.
//! * Valot sijoitetaan kameran suhteen: avain 45° vasemmalla ylhäällä, täyte oikealla, takavalo vastapäätä.

use crate::{AgentError, AgentReport, Production, Slot, StudioAgent};
use glam::{Quat, Vec3};
use hs_core::{CameraHint, EventKind, MotionKind, Timeline};
use hs_motion::procedural::PreparedMotion;
use hs_render::{Camera, Light, Lights};
use serde::Serialize;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum ShotKind {
    Wide,
    Full,
    Medium,
    CloseUp,
    Insert,
    TwoShot,
    OverShoulder,
    LowAngle,
    HighAngle,
}

impl ShotKind {
    pub fn finnish(self) -> &'static str {
        match self {
            ShotKind::Wide => "Laaja",
            ShotKind::Full => "Kokokuva",
            ShotKind::Medium => "Puolilähi",
            ShotKind::CloseUp => "Lähikuva",
            ShotKind::Insert => "Insertti",
            ShotKind::TwoShot => "Kaksikko",
            ShotKind::OverShoulder => "Olan yli",
            ShotKind::LowAngle => "Alakulma",
            ShotKind::HighAngle => "Yläkulma",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Shot {
    pub start: f32,
    pub end: f32,
    pub kind: ShotKind,
    pub subject: usize,
    /// Keskustelukumppani (kaksikko ja olan yli -kuvat).
    pub partner: Option<usize>,
    /// Kameran atsimuuttipoikkeama (radiaaneina) etusuunnasta.
    pub angle: f32,
    pub tracking: bool,
}

pub struct CameraTrack {
    pub shots: Vec<Shot>,
    motion: Vec<Arc<PreparedMotion>>,
    heights: Vec<f32>,
    head_heights: Vec<f32>,
    backgrounds: Vec<(f32, String)>,
    timeline: Timeline,
    pub fov_y: f32,
}


fn smoothstep(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

impl CameraTrack {
    pub fn plan(tl: &Timeline, motion: Vec<Arc<PreparedMotion>>, heights: Vec<f32>, head_heights: Vec<f32>, names: &[String]) -> CameraTrack {
        let subject_of = |name: Option<&String>| name.and_then(|n| names.iter().position(|x| x.eq_ignore_ascii_case(n))).unwrap_or(0);
        let mut beats: Vec<&hs_core::TimelineEvent> = tl.events.iter().filter(|e| matches!(e.kind, EventKind::Motion { .. })).collect();
        beats.sort_by_key(|e| e.start);
        let mut shots: Vec<Shot> = Vec::new();
        let mut dialogue_run = 0;
        // Puhujat aikajärjestyksessä keskustelukumppanin päättelyä varten.
        let mut speakers: Vec<(f32, usize)> = tl
            .events
            .iter()
            .filter_map(|d| match &d.kind {
                EventKind::Dialogue { speaker: Some(sp), .. } => Some((d.start.seconds() as f32, subject_of(Some(sp)))),
                _ => None,
            })
            .collect();
        speakers.sort_by(|a, b| a.0.total_cmp(&b.0));
        let cast = heights.len();
        let partner_of = |subject: usize, t: f32| -> Option<usize> {
            let before = speakers.iter().rev().filter(|(s, _)| *s < t).find(|(_, w)| *w != subject).map(|(_, w)| *w);
            let after = speakers.iter().filter(|(s, _)| *s > t).find(|(_, w)| *w != subject).map(|(_, w)| *w);
            before.or(after).or_else(|| (0..cast).find(|i| *i != subject))
        };
        for e in beats {
            let EventKind::Motion { motion: mk, character } = &e.kind else { continue };
            let scene_end=tl.events.iter().filter(|event|event.start==e.start && event.source.line==e.source.line && !matches!(event.kind,EventKind::Background{..})).map(|event|event.end()).max().unwrap_or(e.end());
            let (start, end) = (e.start.seconds() as f32, scene_end.seconds() as f32);
            let hint = tl.events.iter().find_map(|c| match c.kind {
                EventKind::Camera { hint } if c.start == e.start => Some(hint),
                _ => None,
            });
            let speaker = tl.events.iter().find_map(|d| match &d.kind {
                EventKind::Dialogue { speaker, .. } if d.start == e.start => Some(speaker.clone()),
                _ => None,
            });
            let subject = subject_of(character.as_ref().or(speaker.as_ref().and_then(|s| s.as_ref())));
            let partner = partner_of(subject, start);
            let mut push = |kind: ShotKind, s: f32, t: f32, tracking: bool| shots.push(Shot { start: s, end: t, kind, subject, partner, angle: 0.0, tracking });
            match hint {
                Some(CameraHint::Wide) => push(ShotKind::Wide, start, end, mk.is_locomotion()),
                Some(CameraHint::Medium) => push(ShotKind::Medium, start, end, mk.is_locomotion()),
                Some(CameraHint::CloseUp) => push(ShotKind::CloseUp, start, end, mk.is_locomotion()),
                Some(CameraHint::Insert) => push(ShotKind::Insert, start, end, false),
                Some(CameraHint::TwoShot) => push(ShotKind::TwoShot, start, end, false),
                Some(CameraHint::OverShoulder) => push(ShotKind::OverShoulder, start, end, false),
                Some(CameraHint::LowAngle) => push(ShotKind::LowAngle, start, end, mk.is_locomotion()),
                Some(CameraHint::HighAngle) => push(ShotKind::HighAngle, start, end, mk.is_locomotion()),
                None => match mk {
                    MotionKind::Walk(_) | MotionKind::Run(_) => push(ShotKind::Wide, start, end, true),
                    MotionKind::Sit | MotionKind::Stand | MotionKind::Jump | MotionKind::Crouch | MotionKind::Wave => push(ShotKind::Full, start, end, false),
                    MotionKind::Nod => push(ShotKind::CloseUp, start, end, false),
                    MotionKind::PhoneTap => {
                        if end - start >= 1.6 {
                            let split = start + (end - start) * 0.35;
                            push(ShotKind::Medium, start, split, false);
                            push(ShotKind::Insert, split, end, false);
                        } else {
                            push(ShotKind::Insert, start, end, false);
                        }
                    }
                    MotionKind::Wait => {
                        dialogue_run += 1;
                        // Keskustelu: puolilähi → lähikuva → kaksikko (kun kumppani on), toistuen.
                        let kind = match (speaker.is_some(), dialogue_run % 3, partner.is_some()) {
                            (true, 2, _) => ShotKind::CloseUp,
                            (true, 0, true) => ShotKind::TwoShot,
                            _ => ShotKind::Medium,
                        };
                        push(kind, start, end, false);
                    }
                },
            }
            if !matches!(mk, MotionKind::Wait) {
                dialogue_run = 0;
            }
        }
        // Authored cuts (including repeated kinds and subsecond shots) are
        // editorial boundaries. Never absorb them or the shot preceding them.
        let authored: Vec<f32> = tl.events.iter().filter_map(|event| match event.kind {
            EventKind::Camera { .. } => Some(event.start.seconds() as f32), _ => None,
        }).collect();
        let mut merged: Vec<Shot> = Vec::new();
        for s in shots {
            if let Some(last) = merged.last_mut() {
                let same = last.kind == s.kind && last.subject == s.subject && last.tracking == s.tracking && last.partner == s.partner;
                let explicit = authored.contains(&s.start) || authored.contains(&last.start);
                if same && !explicit && (last.end - s.start).abs() < 1e-4 {
                    last.end = s.end;
                    last.tracking |= s.tracking;
                    continue;
                }
            }
            merged.push(s);
        }
        // 30 asteen sääntö: vaihtele kulmaa otoksesta toiseen.
        for (i, s) in merged.iter_mut().enumerate() {
            s.angle = match s.kind {
                ShotKind::Insert | ShotKind::TwoShot | ShotKind::OverShoulder => 0.0,
                _ => [0.0f32, 0.32, -0.3][i % 3],
            };
        }
        let backgrounds = tl
            .events
            .iter()
            .filter_map(|e| match &e.kind {
                EventKind::Background { id } => Some((e.start.seconds() as f32, id.clone())),
                _ => None,
            })
            .collect();
        CameraTrack { shots: merged, motion, heights, head_heights, backgrounds, timeline: tl.clone(), fov_y: 38.0 }
    }

    pub fn shot_at(&self, t: f32) -> Option<&Shot> {
        self.shots.iter().find(|s| t >= s.start && t < s.end).or(self.shots.last())
    }

    pub fn background_at(&self, t: f32) -> &str {
        self.backgrounds.iter().filter(|(s, _)| *s <= t).max_by(|a, b| a.0.total_cmp(&b.0)).map_or("studio-v1", |(_, id)| id.as_str())
    }

    /// Pehmennetty juuren paikka (painotettu keskiarvo ±0,4 s) seurantaa varten.
    fn smooth_root(&self, subject: usize, t: f32) -> Vec3 {
        match self.motion.get(subject) {
            Some(m) => self.smooth_root_of(m, t),
            None => Vec3::ZERO,
        }
    }

    fn smooth_root_of(&self, m: &PreparedMotion, t: f32) -> Vec3 {
        let mut acc = Vec3::ZERO;
        let mut wsum = 0.0;
        for k in -8..=8 {
            let dt = k as f32 * 0.05;
            let w = (-(dt * dt) / (2.0 * 0.18 * 0.18)).exp();
            let (mut p, _) = m.root_at(t + dt);
            if let Some(chair) = m.chair_at(t + dt) { p += (chair.position - chair.standing_position) * chair.seated_weight; }
            acc += Vec3::new(p.x, 0.0, p.z) * w;
            wsum += w;
        }
        acc / wsum
    }

    pub fn camera_at(&self, t: f32, aspect: f32) -> (Camera, Lights, ShotKind) {
        let Some(shot) = self.shot_at(t) else {
            return (Camera { eye: Vec3::new(0.0, 1.0, 4.0), target: Vec3::new(0.0, 0.7, 0.0), fov_y: self.fov_y }, Lights::default(), ShotKind::Wide);
        };
        let s = shot.subject.min(self.heights.len().saturating_sub(1));
        let visible_height = |index: usize, fallback: f32| {
            let height = self.heights.get(index).copied().unwrap_or(fallback);
            self.motion.get(index).filter(|m| m.chair_at(t).is_some_and(|c| c.seated_weight > 0.0)).map_or(height, |m| {
                let humanoid = &m.motion.humanoid;
                let pose = m.evaluate(&self.timeline, t).pose;
                let world = humanoid.skeleton.world(&pose);
                height + world[humanoid.head].pos.y - humanoid.skeleton.bind_positions()[humanoid.head].y
            })
        };
        let h = visible_height(s, 1.2);
        let head = self.head_heights.get(s).copied().unwrap_or(0.2);
        let anchor = if shot.tracking { self.smooth_root(s, t) } else { self.smooth_root(s, shot.start + 0.4) };
        let jump = self.motion.get(s).map_or(0.0, |m| m.root_at(t).0.y);
        let (_, yaw) = self.motion.get(s).map_or((Vec3::ZERO, 0.0), |m| m.root_at(t));
        // Rajattava korkeus F, kohdepisteen korkeus ja kameran korotus.
        let tallest = self.heights.iter().cloned().fold(h, f32::max);
        let (frame_h, target_y, elevation): (f32, f32, f32) = match shot.kind {
            ShotKind::Wide => {
                // Koko joukko kuvaan: kehyksen leveys kattaa kaikkien hahmojen paikat.
                let xs: Vec<f32> = self.motion.iter().map(|m| self.smooth_root_of(m, if shot.tracking { t } else { shot.start + 0.4 }).x).collect();
                let spread = xs.iter().cloned().fold(f32::MIN, f32::max) - xs.iter().cloned().fold(f32::MAX, f32::min);
                ((tallest * 1.45).max((spread.max(0.0) + tallest * 1.1) / aspect.max(0.3)), tallest * 0.5, 0.14)
            }
            ShotKind::TwoShot => {
                let other = shot.partner.and_then(|p| self.motion.get(p)).map_or(anchor, |m| self.smooth_root_of(m, shot.start + 0.4));
                let spread = (other.x - anchor.x).abs();
                let h2 = visible_height(shot.partner.unwrap_or(s), h).max(h);
                ((h2 * 0.8).max((spread + h2 * 0.9) / aspect.max(0.3)), h2 * 0.62, 0.06)
            }
            ShotKind::LowAngle => (h * 0.95, h * 0.62 + jump * 0.5, -0.32),
            ShotKind::HighAngle => (h * 1.0, h * 0.45 + jump * 0.5, 0.62),
            ShotKind::OverShoulder => (head * 3.4, h - head * 0.55, 0.04),
            ShotKind::Full => (h / 0.72, h * 0.52 + jump * 0.5, 0.08),
            ShotKind::Medium => (h * 0.62, h * 0.70, 0.05),
            ShotKind::CloseUp => (head * 2.6, h - head * 0.5, 0.02),
            ShotKind::Insert => (0.42, h * 0.56, 0.62),
        };
        let group_x = match shot.kind {
            ShotKind::Wide => {
                let sample = if shot.tracking { t } else { shot.start + 0.4 };
                let xs: Vec<f32> = self.motion.iter().map(|m| self.smooth_root_of(m, sample).x).collect();
                (xs.iter().cloned().fold(f32::MIN, f32::max) + xs.iter().cloned().fold(f32::MAX, f32::min)) * 0.5
            }
            ShotKind::TwoShot => {
                let other = shot.partner.and_then(|p| self.motion.get(p)).map_or(anchor, |m| self.smooth_root_of(m, shot.start + 0.4));
                (anchor.x + other.x) * 0.5
            }
            _ => anchor.x,
        };
        let mut target = Vec3::new(group_x, target_y, anchor.z);
        if shot.kind == ShotKind::OverShoulder {
            if let Some(p) = shot.partner.filter(|p| *p != s) {
                // Kamera kumppanin olan takana ja vähän sivussa, katse puhujan kasvoihin.
                let other = self.motion.get(p).map_or(anchor, |m| self.smooth_root_of(m, shot.start + 0.4));
                let ph = visible_height(p, h);
                let side = (other.x - anchor.x).signum();
                let shoulder = Vec3::new(other.x, ph * 0.8, other.z);
                // Kumppanin pää ja olka jäävät etualalle kuvan reunaan, puhuja kolmen neljäsosan kulmasta.
                let eye = shoulder + Vec3::new(side * 0.42, ph * 0.08 + 0.05, 0.62);
                let progress = ((t - shot.start) / (shot.end - shot.start).max(1e-3)).clamp(0.0, 1.0);
                let target = target.lerp(shoulder, 0.2) + Vec3::Y * 0.01 * smoothstep(progress);
                let camera = Camera { eye, target, fov_y: self.fov_y * 0.85 };
                let az = (eye.x - target.x).atan2(eye.z - target.z);
                return (camera, self.lights(az, self.background_at(t)), shot.kind);
            }
        }
        if shot.kind == ShotKind::Insert {
            // Insertti olan yli puhelimen ruutuun (leikkauskuva; 180 asteen sääntö ei koske sitä).
            let sample = shot.start + (shot.end - shot.start) * 0.3;
            if let Some(phone) = self.motion.get(s).and_then(|m| m.evaluate(&self.timeline, sample).props.phone) {
                let normal = phone.transform.rot * Vec3::Z;
                let progress = ((t - shot.start) / (shot.end - shot.start).max(1e-3)).clamp(0.0, 1.0);
                let dist = 0.36 * (1.0 - 0.1 * smoothstep(progress));
                let eye = phone.transform.pos + (Quat::from_rotation_y(-0.65) * normal) * dist + Vec3::Y * 0.05;
                let camera = Camera { eye, target: phone.transform.pos, fov_y: self.fov_y };
                return (camera, self.lights(yaw + std::f32::consts::PI, self.background_at(t)), shot.kind);
            }
            target += Quat::from_rotation_y(yaw) * Vec3::new(0.0, 0.0, h * 0.2);
        }
        let fov = self.fov_y.to_radians();
        let mut distance = frame_h / (2.0 * (fov * 0.5).tan());
        let progress = ((t - shot.start) / (shot.end - shot.start).max(1e-3)).clamp(0.0, 1.0);
        if !shot.tracking {
            distance *= 1.0 - 0.07 * smoothstep(progress); // hidas sisäänajo
        }
        // 180 asteen sääntö: kamera aina +Z-puolella.
        let azimuth = shot.angle.clamp(-1.2, 1.2);
        let dir = Vec3::new(azimuth.sin() * elevation.cos(), elevation.sin(), azimuth.cos() * elevation.cos()).normalize();
        let eye = target + dir * distance;
        let camera = Camera { eye, target, fov_y: self.fov_y };
        (camera, self.lights(azimuth, self.background_at(t)), shot.kind)
    }

    /// Kolmipistevalaistus kameran suunnan mukaan; sävy ympäristön mukaan.
    pub fn lights(&self, camera_azimuth: f32, env: &str) -> Lights {
        let from = |az: f32, el: f32| -> Vec3 {
            let a = camera_azimuth + az;
            -Vec3::new(a.sin() * el.cos(), el.sin(), a.cos() * el.cos()).normalize()
        };
        let (key, fill, rim, ambient) = match env {
            "city-evening-v1" => (Vec3::new(0.85, 0.62, 0.45), Vec3::new(0.16, 0.18, 0.32), Vec3::new(0.45, 0.55, 1.0), Vec3::new(0.26, 0.24, 0.36)),
            "park-day-v1" | "street-day-v1" => (Vec3::new(0.85, 0.82, 0.74), Vec3::new(0.3, 0.34, 0.42), Vec3::new(0.6, 0.6, 0.55), Vec3::splat(0.36)),
            "apartment-v1" | "studio-premium-v1" | "kitchen-v1" | "classroom-v1" => (Vec3::new(0.78, 0.7, 0.6), Vec3::new(0.26, 0.26, 0.3), Vec3::new(0.55, 0.5, 0.45), Vec3::splat(0.34)),
            id if id.starts_with("car") => (Vec3::new(0.75, 0.75, 0.78), Vec3::new(0.3, 0.32, 0.36), Vec3::new(0.6, 0.65, 0.7), Vec3::splat(0.33)),
            _ => (Vec3::splat(0.75), Vec3::splat(0.25), Vec3::splat(0.5), Vec3::splat(0.32)),
        };
        Lights {
            key: Light { dir: from(0.78, 0.7), color: key },
            fill: Light { dir: from(-0.9, 0.25), color: fill },
            rim: Light { dir: from(std::f32::consts::PI + 0.35, 0.6), color: rim },
            ambient,
        }
    }
}

#[derive(Default)]
pub struct CinematographyAgent;

impl StudioAgent for CinematographyAgent {
    fn id(&self) -> &'static str {
        "cinematography"
    }
    fn name(&self) -> &'static str {
        "Kamera ja valot"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Motion]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::Camera]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        // Derived camera state from an older revision must not survive a
        // failed authored shot validation.
        p.camera = None;
        let tl = p.timeline.as_ref().ok_or(AgentError::Missing { agent: "cinematography", slot: Slot::Timeline })?;
        let names: Vec<String> = p.cast.iter().map(|c| c.character.params.name.clone()).collect();
        let heights = p.cast.iter().map(|c| c.character.humanoid.proportions.height).collect();
        let heads = p.cast.iter().map(|c| c.character.humanoid.head_height).collect();
        let track = CameraTrack::plan(tl, p.motion.clone(), heights, heads, &names);
        for shot in &track.shots {
            let reject = |reason: &str| AgentError::Failed { agent: "cinematography",
                message: format!("{} {:.3}–{:.3}s, {}: {}", shot.kind.finnish(), shot.start, shot.end,
                    names.get(shot.subject).map_or("missing subject", String::as_str), reason) };
            if matches!(shot.kind, ShotKind::TwoShot | ShotKind::OverShoulder)
                && shot.partner.is_none_or(|partner| partner == shot.subject || partner >= p.cast.len()) {
                return Err(reject("shot requires a distinct available partner; the authored shot was not replaced"));
            }
            if shot.kind == ShotKind::Insert {
                let sample = shot.start + (shot.end - shot.start) * 0.3;
                if p.motion.get(shot.subject).and_then(|motion| motion.evaluate(tl, sample).props.phone).is_none() {
                    return Err(reject("insert requires a visible supported phone prop; the authored shot was not replaced"));
                }
            }
        }
        let summary = format!(
            "{} otosta: {}",
            track.shots.len(),
            track.shots.iter().map(|s| format!("{:.3}–{:.3}s {} / {}{}", s.start, s.end, s.kind.finnish(),
                names.get(s.subject).map_or("?", String::as_str), s.partner.map_or(String::new(),
                    |partner| format!(" + {}", names.get(partner).map_or("?", String::as_str)))))
                .collect::<Vec<_>>().join(" · ")
        );
        p.camera = Some(Arc::new(track));
        Ok(AgentReport::new(summary))
    }
}
