//! Explicit object anchors, checked arm IK, continuous pickup and handoff.
//! This is kinematic contact, not rigid-body dynamics or finger-surface collision.
use crate::Production;
use glam::{Mat4, Quat, Vec3};
use hs_core::{EventKind, ObjectContact, Timeline};
use hs_motion::{
    procedural::{CharacterFrame, PreparedMotion},
    Side,
};
use std::sync::Arc;
#[derive(Clone)]
struct Object {
    id: String,
    model: String,
    point: Vec3,
    start: f32,
    mesh: Arc<hs_character::CharacterMesh>,
    stand: Option<Arc<hs_character::CharacterMesh>>,
}
#[derive(Clone, Copy)]
struct Hold {
    actor: usize,
    hand: Side,
    relative: Vec3,
    offset: Vec3,
}
#[derive(Clone)]
struct Action {
    object: usize,
    actor: usize,
    hand: Side,
    receiver: Option<(usize, Side)>,
    start: f32,
    duration: f32,
    from: Vec3,
    to: Vec3,
    hold: Hold,
    line: usize,
}
pub struct ContactPlan {
    timeline: Timeline,
    characters: Vec<Arc<hs_character::Character>>,
    motion: Vec<Arc<PreparedMotion>>,
    objects: Vec<Object>,
    actions: Vec<Action>,
}
#[derive(Debug)]
pub struct GripSample {
    pub actor: usize,
    pub hand: Side,
    pub expected: Vec3,
    pub actual: Vec3,
    pub weight: f32,
}
#[derive(Debug)]
pub struct ObjectFrame {
    pub id: String,
    pub model: String,
    pub point: Vec3,
    pub owner: Option<usize>,
    pub grips: Vec<GripSample>,
    pub mesh: Arc<hs_character::CharacterMesh>,
    pub stand: Option<Arc<hs_character::CharacterMesh>>,
}
fn ease(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}
fn root_point(frame: &CharacterFrame, relative: Vec3) -> Vec3 {
    frame.pose.root_pos + frame.pose.root_rot * relative
}
fn actor(p: &Production, name: &str) -> Result<usize, String> {
    p.cast
        .iter()
        .position(|c| c.character.params.name.eq_ignore_ascii_case(name))
        .ok_or_else(|| format!("Kontaktin hahmo {name} puuttuu näyttämöltä"))
}
fn pose_frames(p: &Production, time: f32) -> Vec<CharacterFrame> {
    p.motion
        .iter()
        .map(|m| m.evaluate(p.timeline.as_ref().unwrap(), time))
        .collect()
}
fn palm_offset(p: &Production, index: usize, hand: Side) -> Vec3 {
    let arm = p.cast[index].character.humanoid.arm(hand);
    Vec3::new(
        -hand.sign() * arm.hand_len * 0.02,
        -arm.hand_len * 0.26,
        0.0,
    )
}
fn hand_free(p: &Production, index: usize, hand: Side, time: f32, holds: &[Option<Hold>]) -> bool {
    if holds
        .iter()
        .flatten()
        .any(|h| h.actor == index && h.hand == hand)
    {
        return false;
    }
    !legacy_blocked(p, index, hand, time)
}
fn legacy_blocked(p: &Production, index: usize, hand: Side, time: f32) -> bool {
    let frames = pose_frames(p, time);
    if frames[index].props.phone.is_some() {
        return true;
    }
    let name = &p.cast[index].character.params.name;
    let legacy = p
        .timeline
        .as_ref()
        .unwrap()
        .events
        .iter()
        .filter(|e| e.start.seconds() as f32 <= time)
        .filter_map(|e| match &e.kind {
            EventKind::Prop { character, item }
                if character
                    .as_ref()
                    .map_or(index == 0, |n| n.eq_ignore_ascii_case(name)) =>
            {
                Some((e.start, item))
            }
            _ => None,
        })
        .max_by_key(|(t, _)| *t)
        .is_some_and(|(_, item)| item.is_some());
    legacy && hand == Side::Right
}
fn apply_hand(
    p: &Production,
    frames: &mut [CharacterFrame],
    index: usize,
    hand: Side,
    point: Vec3,
    weight: f32,
) -> GripSample {
    let humanoid = &p.cast[index].character.humanoid;
    let arm = humanoid.arm(hand);
    let sk = &humanoid.skeleton;
    let pose = &mut frames[index].pose;
    let offset = palm_offset(p, index, hand);
    if weight > 0.0 {
        let old = pose.local.clone();
        let world = sk.world(pose);
        let pole = world[arm.fore].pos + Vec3::Z * 0.2;
        hs_motion::ik::two_bone(
            sk,
            pose,
            arm.upper,
            arm.fore,
            arm.hand,
            point - offset,
            pole,
        );
        sk.set_world_rotation(pose, arm.hand, Quat::IDENTITY);
        for bone in [arm.upper, arm.fore, arm.hand] {
            pose.local[bone] = old[bone].slerp(pose.local[bone], weight);
        }
        hs_motion::hands::curl_fingers(humanoid, pose, hand, 0.22 + 0.43 * weight);
    }
    let world = sk.world(pose);
    let actual = world[arm.hand].pos + world[arm.hand].rot * offset;
    GripSample {
        actor: index,
        hand,
        expected: point,
        actual,
        weight,
    }
}
impl ContactPlan {
    pub fn matches(&self, p: &Production) -> bool {
        self.timeline.fps == p.fps
            && p.timeline.as_ref() == Some(&self.timeline)
            && self.characters.len() == p.cast.len()
            && self
                .characters
                .iter()
                .zip(&p.cast)
                .all(|(a, b)| Arc::ptr_eq(a, &b.character))
            && self.motion.len() == p.motion.len()
            && self
                .motion
                .iter()
                .zip(&p.motion)
                .all(|(a, b)| Arc::ptr_eq(a, b))
    }
    pub fn uses_actor(&self, index: usize) -> bool {
        self.actions
            .iter()
            .any(|a| a.actor == index || a.receiver.is_some_and(|(r, _)| r == index))
    }
    pub fn summary(&self, line: usize) -> Option<String> {
        let action = self.actions.iter().find(|a| a.line == line)?;
        let hand_name = |side| {
            if side == Side::Left {
                "vasen käsi"
            } else {
                "oikea käsi"
            }
        };
        Some(format!(
            "{} · {}{}",
            self.objects[action.object].id,
            hand_name(action.hand),
            action
                .receiver
                .map_or(" · nosto".into(), |(index, hand)| format!(
                    " → {} / {}",
                    self.characters[index].params.name,
                    hand_name(hand)
                ))
        ))
    }
    pub fn evaluate(
        &self,
        p: &Production,
        time: f32,
        frames: &mut [CharacterFrame],
    ) -> Result<Vec<ObjectFrame>, String> {
        if !self.matches(p) || frames.len() != p.cast.len() || !time.is_finite() {
            return Err("Kontaktisuunnitelma ei vastaa tuotannon resursseja".into());
        }
        for (frame, character) in frames.iter().zip(&p.cast) {
            let count = character.character.humanoid.skeleton.joints.len();
            if frame.pose.local.len() != count
                || frame.pose.translate.len() != count
                || !frame.pose.root_pos.is_finite()
                || !frame.pose.root_rot.is_finite()
                || frame.pose.local.iter().any(|q| !q.is_finite())
                || frame.pose.translate.iter().any(|v| !v.is_finite())
            {
                return Err("Virheellinen kontaktin hahmoasento".into());
            }
        }
        let mut result = Vec::new();
        for (index, object) in self
            .objects
            .iter()
            .enumerate()
            .filter(|(_, o)| o.start <= time)
        {
            let mut point = object.point;
            let mut hold = None;
            let mut active = None;
            for action in self
                .actions
                .iter()
                .filter(|a| a.object == index && a.start <= time)
            {
                if time >= action.start + action.duration {
                    hold = Some(action.hold);
                    point = root_point(&frames[action.hold.actor], action.hold.relative);
                } else {
                    active = Some(action);
                    break;
                }
            }
            let mut grips = Vec::new();
            let mut owner = hold.map(|h: Hold| h.actor);
            if let Some(action) = active {
                let u = ((time - action.start) / action.duration).clamp(0.0, 1.0);
                if let Some((receiver, hand)) = action.receiver {
                    point = if u < 0.5 {
                        action.from.lerp(action.to - Vec3::Y * 0.05, ease(u * 2.0))
                    } else {
                        (action.to - Vec3::Y * 0.05).lerp(action.to, ease((u - 0.5) * 2.0))
                    };
                    let giver_weight = if u <= 0.5 {
                        1.0
                    } else {
                        1.0 - ease((u - 0.5) * 2.0)
                    };
                    let receiver_weight = ease(u * 2.0);
                    grips.push(apply_hand(
                        p,
                        frames,
                        action.actor,
                        action.hand,
                        point + Vec3::X * (-action.hand.sign() * 0.04 * ease(u * 2.0)),
                        giver_weight,
                    ));
                    grips.push(apply_hand(
                        p,
                        frames,
                        receiver,
                        hand,
                        point + action.hold.offset,
                        receiver_weight,
                    ));
                    owner = Some(if u < 0.5 { action.actor } else { receiver });
                } else {
                    point = action.from.lerp(action.to, ease((u - 0.45) / 0.55));
                    let direction = (frames[action.actor].pose.root_pos.x - action.from.x).signum();
                    let direction = if direction.abs() < 0.5 {
                        action.hand.sign()
                    } else {
                        direction
                    };
                    let waypoint = action.from + Vec3::new(direction * 0.23, 0.15, 0.0);
                    let target = if u < 0.2 {
                        waypoint
                    } else if u < 0.45 {
                        waypoint.lerp(point, ease((u - 0.2) / 0.25))
                    } else {
                        point
                    };
                    let weight = if u < 0.2 { ease(u / 0.2) } else { 1.0 };
                    grips.push(apply_hand(
                        p,
                        frames,
                        action.actor,
                        action.hand,
                        target,
                        weight,
                    ));
                    hs_motion::hands::curl_fingers(
                        &p.cast[action.actor].character.humanoid,
                        &mut frames[action.actor].pose,
                        action.hand,
                        0.22 + 0.43 * ease((u - 0.35) / 0.1),
                    );
                    owner = if u >= 0.45 { Some(action.actor) } else { None };
                }
            } else if let Some(h) = hold {
                grips.push(apply_hand(
                    p,
                    frames,
                    h.actor,
                    h.hand,
                    point + h.offset,
                    1.0,
                ));
            }
            result.push(ObjectFrame {
                id: object.id.clone(),
                model: object.model.clone(),
                point,
                owner,
                grips,
                mesh: object.mesh.clone(),
                stand: object.stand.clone(),
            });
        }
        for object in &result {
            if let Some(owner) = object.owner {
                if let Some(held) = object.grips.iter().find(|g| g.actor == owner) {
                    let conflict = match frames[owner].motion {
                        Some(hs_core::MotionKind::Wave | hs_core::MotionKind::PointForward) => {
                            held.hand == Side::Right
                        }
                        Some(
                            hs_core::MotionKind::Clap
                            | hs_core::MotionKind::PhoneTap
                            | hs_core::MotionKind::Shrug,
                        ) => true,
                        _ => false,
                    };
                    if conflict {
                        return Err(format!(
                            "Esine {}: kirjoitettu liike tarvitsee esineen varaaman käden",
                            object.id
                        ));
                    }
                }
            }
            for grip in &object.grips {
                if grip.weight >= 0.999
                    && (!grip.actual.is_finite() || grip.actual.distance(grip.expected) > 0.002)
                {
                    return Err(format!(
                        "Esine {}: käden tarttumispiste ei toteudu 2 mm tarkkuudella",
                        object.id
                    ));
                }
            }
        }
        Ok(result)
    }
    pub fn build(p: &Production) -> Result<Option<Arc<Self>>, String> {
        let tl = p.timeline.as_ref().ok_or("Kontaktien aikajana puuttuu")?;
        if !tl.events.iter().any(|e| {
            matches!(
                e.kind,
                EventKind::WorldObject { .. } | EventKind::ObjectContact { .. }
            )
        }) {
            return Ok(None);
        }
        let mut plan = Self {
            timeline: tl.clone(),
            characters: p.cast.iter().map(|c| c.character.clone()).collect(),
            motion: p.motion.clone(),
            objects: Vec::new(),
            actions: Vec::new(),
        };
        for event in &tl.events {
            if let EventKind::WorldObject { object } = &event.kind {
                if plan.objects.len() >= 16
                    || plan.objects.iter().any(|o| o.id == object.id)
                    || !hs_render::props::HELD.contains(&object.model.as_str())
                    || object.id.is_empty()
                    || object.id.len() > 32
                    || object.grip[1] < 0.1
                    || object.grip.iter().any(|v| !v.is_finite() || v.abs() > 5.0)
                {
                    return Err(format!(
                        "Rivi {}: virheellinen tai toistuva maailmanesine",
                        event.source.line
                    ));
                }
                let mesh = Arc::new(
                    hs_render::props::held(&object.model, Vec3::ZERO, 1.0)
                        .ok_or("Tuntematon esinemalli")?,
                );
                let point = Vec3::from_array(object.grip);
                let stand = if object.stand {
                    let bottom = point.y
                        + mesh
                            .vertices
                            .iter()
                            .map(|v| v.position[1])
                            .fold(f32::INFINITY, f32::min);
                    if bottom < 0.05 {
                        return Err("Esineen alusta ei mahdu lattian yläpuolelle".into());
                    }
                    let mut shape = hs_character::MeshBuilder::new();
                    shape.cuboid(
                        Vec3::new(point.x, bottom - 0.01, point.z + 0.05),
                        Vec3::new(0.13, 0.01, 0.13),
                        Quat::IDENTITY,
                        [0x98, 0x78, 0x52],
                        1.0,
                    );
                    shape.cuboid(
                        Vec3::new(point.x, (bottom - 0.02) * 0.5, point.z + 0.05),
                        Vec3::new(0.055, (bottom - 0.02) * 0.5, 0.055),
                        Quat::IDENTITY,
                        [0x76, 0x60, 0x48],
                        1.0,
                    );
                    Some(Arc::new(shape.finish()))
                } else {
                    None
                };
                plan.objects.push(Object {
                    id: object.id.clone(),
                    model: object.model.clone(),
                    point,
                    start: event.start.seconds() as f32,
                    mesh,
                    stand,
                });
            }
        }
        let mut holds = vec![None; plan.objects.len()];
        let mut ends = vec![0.0f32; plan.objects.len()];
        for event in &tl.events {
            let EventKind::ObjectContact { character, contact } = &event.kind else {
                continue;
            };
            let line = event.source.line;
            let giver = actor(
                p,
                character
                    .as_deref()
                    .ok_or_else(|| format!("Rivi {line}: kontaktilla täytyy olla nimetty hahmo"))?,
            )?;
            let id = match contact {
                ObjectContact::PickUp { object } | ObjectContact::Give { object, .. } => object,
            };
            let index = plan
                .objects
                .iter()
                .position(|o| o.id == *id)
                .ok_or_else(|| format!("Rivi {line}: esine {id} ei ole määritelty"))?;
            let start = event.start.seconds() as f32;
            let duration = event.duration.seconds() as f32;
            if start < plan.objects[index].start || start < ends[index] || duration < 1.0 {
                return Err(format!(
                    "Rivi {line}: esineen kontaktit menevät päällekkäin tai esine puuttuu vielä"
                ));
            }
            let initial = pose_frames(p, start);
            let final_frames = pose_frames(p, start + duration);
            let candidate = match contact {
                ObjectContact::PickUp { .. } => {
                    if holds[index].is_some() {
                        return Err(format!("Rivi {line}: esine on jo hahmon kädessä"));
                    }
                    let point = plan.objects[index].point;
                    let hand = Side::BOTH
                        .into_iter()
                        .filter(|h| hand_free(p, giver, *h, start, &holds))
                        .min_by(|a, b| {
                            let sk = &p.cast[giver].character.humanoid;
                            let world = sk.skeleton.world(&initial[giver].pose);
                            world[sk.arm(*a).upper]
                                .pos
                                .distance_squared(point)
                                .total_cmp(&world[sk.arm(*b).upper].pos.distance_squared(point))
                        })
                        .ok_or_else(|| format!("Rivi {line}: hahmolla ei ole vapaata kättä"))?;
                    let to = point + Vec3::Y * 0.12;
                    let relative = final_frames[giver].pose.root_rot.inverse()
                        * (to - final_frames[giver].pose.root_pos);
                    Action {
                        object: index,
                        actor: giver,
                        hand,
                        receiver: None,
                        start,
                        duration,
                        from: point,
                        to,
                        hold: Hold {
                            actor: giver,
                            hand,
                            relative,
                            offset: Vec3::ZERO,
                        },
                        line,
                    }
                }
                ObjectContact::Give { recipient, .. } => {
                    let previous = holds[index]
                        .ok_or_else(|| format!("Rivi {line}: esine täytyy ensin ottaa käteen"))?;
                    if previous.actor != giver {
                        return Err(format!("Rivi {line}: esine ei kuulu luovuttajalle"));
                    }
                    let receiver = actor(p, recipient)?;
                    if receiver == giver {
                        return Err(format!("Rivi {line}: esinettä ei voi luovuttaa itselle"));
                    }
                    let giver_h = &p.cast[giver].character.humanoid;
                    let giver_shoulder = giver_h.skeleton.world(&initial[giver].pose)
                        [giver_h.arm(previous.hand).upper]
                        .pos;
                    let receiver_h = &p.cast[receiver].character.humanoid;
                    let receiver_world = receiver_h.skeleton.world(&initial[receiver].pose);
                    let hand = Side::BOTH
                        .into_iter()
                        .filter(|h| hand_free(p, receiver, *h, start, &holds))
                        .min_by(|a, b| {
                            receiver_world[receiver_h.arm(*a).upper]
                                .pos
                                .distance_squared(giver_shoulder)
                                .total_cmp(
                                    &receiver_world[receiver_h.arm(*b).upper]
                                        .pos
                                        .distance_squared(giver_shoulder),
                                )
                        })
                        .ok_or_else(|| {
                            format!("Rivi {line}: vastaanottajalla ei ole vapaata kättä")
                        })?;
                    let meeting = (giver_shoulder + receiver_world[receiver_h.arm(hand).upper].pos)
                        * 0.5
                        + Vec3::Z * 0.12;
                    let to = meeting + Vec3::Y * 0.05;
                    let relative = final_frames[receiver].pose.root_rot.inverse()
                        * (to - final_frames[receiver].pose.root_pos);
                    Action {
                        object: index,
                        actor: giver,
                        hand: previous.hand,
                        receiver: Some((receiver, hand)),
                        start,
                        duration,
                        from: root_point(&initial[giver], previous.relative),
                        to,
                        hold: Hold {
                            actor: receiver,
                            hand,
                            relative,
                            offset: Vec3::X * (-hand.sign() * 0.04),
                        },
                        line,
                    }
                }
            };
            for who in [Some(giver), candidate.receiver.map(|(r, _)| r)]
                .into_iter()
                .flatten()
            {
                let name = &p.cast[who].character.params.name;
                if tl.events.iter().any(|e| {
                    e.start.seconds() < (start + duration) as f64
                        && e.end().seconds() > start as f64
                        && match &e.kind {
                            EventKind::Motion { character, motion } => {
                                character
                                    .as_ref()
                                    .map_or(who == 0, |s| s.eq_ignore_ascii_case(name))
                                    && !matches!(
                                        motion,
                                        hs_core::MotionKind::Wait
                                            | hs_core::MotionKind::Nod
                                            | hs_core::MotionKind::ShakeHead
                                    )
                            }
                            _ => false,
                        }
                }) {
                    return Err(format!(
                        "Rivi {line}: kontaktin hahmon muu liike estää turvallisen tarttumisen"
                    ));
                }
            }
            holds[index] = Some(candidate.hold);
            ends[index] = start + duration;
            plan.actions.push(candidate);
            for sample in 0..=20 {
                let time = start + duration * sample as f32 / 20.0;
                let mut frames = pose_frames(p, time);
                let objects = plan
                    .evaluate(p, time, &mut frames)
                    .map_err(|e| format!("Rivi {line}: {e}"))?;
                if objects.iter().flat_map(|o| &o.grips).any(|g| {
                    g.weight >= 0.999
                        && (!g.actual.is_finite() || g.actual.distance(g.expected) > 0.002)
                }) {
                    return Err(format!(
                        "Rivi {line}: esineen tarttumispiste ei ole hahmon käden ulottuvilla"
                    ));
                }
            }
        }
        // Verify hand ownership at every authored boundary and interval midpoint.
        let mut times = vec![0.0, tl.duration.seconds() as f32];
        for event in &tl.events {
            times.extend([event.start.seconds() as f32, event.end().seconds() as f32]);
        }
        times.sort_by(f32::total_cmp);
        times.dedup();
        let middle: Vec<_> = times.windows(2).map(|s| (s[0] + s[1]) * 0.5).collect();
        times.extend(middle);
        for time in times {
            let mut frames = pose_frames(p, time);
            for object in plan.evaluate(p, time, &mut frames)? {
                for grip in &object.grips {
                    if grip.weight > 0.0 && legacy_blocked(p, grip.actor, grip.hand, time) {
                        return Err(format!(
                            "Esine {}: käsi on varattu toiselle esineelle tai puhelimelle",
                            object.id
                        ));
                    }
                }
            }
        }
        Ok(Some(Arc::new(plan)))
    }
    pub fn transform(object: &ObjectFrame) -> Mat4 {
        Mat4::from_translation(object.point)
    }
}
