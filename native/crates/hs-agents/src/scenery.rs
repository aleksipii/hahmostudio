//! Authored doors/stairs with bounded geometry, preflight and per-frame IK checks.
use crate::Production;
use glam::{Mat4, Quat, Vec3};
use hs_core::scenery::{SceneryAction, ScenerySpec};
use hs_core::{EventKind, Timeline};
use hs_motion::{
    procedural::{CharacterFrame, PreparedMotion},
    Side,
};
use std::sync::Arc;
struct Object {
    spec: ScenerySpec,
    start: f32,
    mesh: Arc<hs_character::CharacterMesh>,
    frame: Option<Arc<hs_character::CharacterMesh>>,
}
struct Action {
    object: usize,
    actor: usize,
    start: f32,
    duration: f32,
    kind: SceneryAction,
    from: f32,
    to: f32,
    line: usize,
}
pub struct SceneryPlan {
    timeline: Timeline,
    characters: Vec<Arc<hs_character::Character>>,
    motion: Vec<Arc<PreparedMotion>>,
    objects: Vec<Object>,
    actions: Vec<Action>,
}
fn smooth(x: f32) -> f32 {
    let x = x.clamp(0., 1.);
    x * x * (3. - 2. * x)
}
impl SceneryPlan {
    pub fn matches(&self, p: &Production) -> bool {
        self.timeline.fps == p.fps
            && p.timeline.as_ref() == Some(&self.timeline)
            && self.characters.len() == p.cast.len()
            && self.motion.len() == p.motion.len()
            && self
                .characters
                .iter()
                .zip(&p.cast)
                .all(|(a, b)| Arc::ptr_eq(a, &b.character))
            && self
                .motion
                .iter()
                .zip(&p.motion)
                .all(|(a, b)| Arc::ptr_eq(a, b))
    }
    pub fn uses_actor(&self, actor: usize) -> bool {
        self.actions.iter().any(|a| a.actor == actor)
    }
    pub fn summary(&self, line: usize) -> Option<String> {
        let action = self.actions.iter().find(|a| a.line == line)?;
        Some(match &action.kind {
            SceneryAction::OpenDoor { id, angle_degrees } => {
                format!("Avaa ovi {id} ({angle_degrees:.0}°), oikea käsi")
            }
            SceneryAction::CloseDoor { id } => format!("Sulje ovi {id}, oikea käsi"),
            SceneryAction::ClimbStairs { id, descending } => format!(
                "{} portaat {id}",
                if *descending { "Laskeudu" } else { "Nouse" }
            ),
        })
    }
    pub fn reserved_hand(&self, actor: usize, start: f32, end: f32) -> bool {
        self.actions
            .iter()
            .any(|a| a.actor == actor && a.start < end && a.start + a.duration > start)
    }
    pub fn build(p: &Production) -> Result<Option<Arc<Self>>, String> {
        let Some(timeline) = &p.timeline else {
            return Ok(None);
        };
        if !timeline.events.iter().any(|e| {
            matches!(
                e.kind,
                EventKind::SceneryObject { .. } | EventKind::Scenery { .. }
            )
        }) {
            return Ok(None);
        }
        if p.motion.len() != p.cast.len() {
            return Err("Scenery requires prepared cast motions".into());
        }
        let mut plan = Self {
            timeline: timeline.clone(),
            characters: p.cast.iter().map(|c| c.character.clone()).collect(),
            motion: p.motion.clone(),
            objects: Vec::new(),
            actions: Vec::new(),
        };
        let mut events: Vec<_> = timeline.events.iter().collect();
        events.sort_by_key(|e| e.start);
        for event in &events {
            if let EventKind::SceneryObject { object } = &event.kind {
                object
                    .validate()
                    .map_err(|e| format!("Rivi {}: {e}", event.source.line))?;
                if plan.objects.len() >= 16
                    || plan.objects.iter().any(|o| o.spec.id() == object.id())
                {
                    return Err(format!(
                        "Rivi {}: duplicate scenery or scenery limit",
                        event.source.line
                    ));
                }
                let (mesh, frame) =
                    if let Some((panel, frame)) = hs_render::scenery::door_parts(object) {
                        (Arc::new(panel), Some(Arc::new(frame)))
                    } else {
                        (Arc::new(hs_render::scenery::mesh(object, 0.)), None)
                    };
                plan.objects.push(Object {
                    spec: object.clone(),
                    start: event.start.seconds() as f32,
                    mesh,
                    frame,
                });
            }
        }
        for event in &events {
            let EventKind::Scenery { character, action } = &event.kind else {
                continue;
            };
            let line = event.source.line;
            let fail = |s: &str| format!("Rivi {line}: {s}");
            let name = character
                .as_ref()
                .ok_or_else(|| fail("Scenery action requires a named character"))?;
            let actor = p
                .cast
                .iter()
                .position(|c| c.character.params.name.eq_ignore_ascii_case(name))
                .ok_or_else(|| fail("Unknown scenery actor"))?;
            let object = plan
                .objects
                .iter()
                .position(|o| o.spec.id() == action.id())
                .ok_or_else(|| fail("Unknown scenery object"))?;
            let start = event.start.seconds() as f32;
            let duration = event.duration.seconds() as f32;
            if duration < 1. || duration > 20. || start < plan.objects[object].start {
                return Err(fail("Scenery action duration or creation time invalid"));
            }
            if plan.actions.iter().any(|a| {
                (a.actor == actor || a.object == object)
                    && a.start < start + duration
                    && a.start + a.duration > start
            }) {
                return Err(fail("Overlapping scenery ownership"));
            }
            let from = plan
                .actions
                .iter()
                .rev()
                .find(|a| a.object == object)
                .map_or(0., |a| a.to);
            let to = match (&plan.objects[object].spec, action) {
                (ScenerySpec::Door { .. }, SceneryAction::OpenDoor { angle_degrees, .. })
                    if angle_degrees.is_finite() && (15. ..=110.).contains(angle_degrees) =>
                {
                    *angle_degrees
                }
                (ScenerySpec::Door { .. }, SceneryAction::CloseDoor { .. }) => 0.,
                (ScenerySpec::Stairs { .. }, SceneryAction::ClimbStairs { .. }) => 0.,
                _ => return Err(fail("Scenery action does not match object or angle limits")),
            };
            // Scenery owns its actor's root/limbs; avoid silently overriding authored motions.
            for e in &events {
                if e.start.seconds() as f32 >= start + duration || e.end().seconds() as f32 <= start
                {
                    continue;
                }
                match &e.kind {
                    EventKind::Motion {
                        character, motion, ..
                    } if character
                        .as_ref()
                        .is_some_and(|n| n.eq_ignore_ascii_case(name))
                        && !matches!(motion, hs_core::MotionKind::Wait) =>
                    {
                        return Err(fail(
                            "Scenery action requires a stationary wait, no layered body motion",
                        ))
                    }
                    EventKind::ObjectContact { character, .. }
                        if character
                            .as_ref()
                            .is_some_and(|n| n.eq_ignore_ascii_case(name)) =>
                    {
                        return Err(fail("Object contact overlaps scenery action"))
                    }
                    _ => {}
                }
            }
            // Legacy props remain hand occupants until explicitly cleared.
            let occupied = events
                .iter()
                .filter(|e| e.start.seconds() as f32 <= start)
                .filter_map(|e| match &e.kind {
                    EventKind::Prop { character, item }
                        if character
                            .as_ref()
                            .is_some_and(|n| n.eq_ignore_ascii_case(name)) =>
                    {
                        Some(item.is_some())
                    }
                    _ => None,
                })
                .next_back()
                .unwrap_or(false);
            if occupied {
                return Err(fail("Clear the legacy held prop before scenery action"));
            }
            plan.actions.push(Action {
                object,
                actor,
                start,
                duration,
                kind: action.clone(),
                from,
                to,
                line,
            });
        }
        let plan = Arc::new(plan);
        for action in &plan.actions {
            for n in 0..=80 {
                let time = action.start + action.duration * n as f32 / 80.;
                let mut frames = p
                    .motion
                    .iter()
                    .map(|m| m.evaluate(timeline, time))
                    .collect::<Vec<_>>();
                if let Some(contacts) = &p.contacts {
                    let objects = contacts.evaluate(p, time, &mut frames)?;
                    if objects.iter().any(|o| {
                        o.owner == Some(action.actor)
                            || o.grips
                                .iter()
                                .any(|g| g.actor == action.actor && g.weight > 0.01)
                    }) {
                        return Err(format!(
                            "Rivi {}: release world object before scenery action",
                            action.line
                        ));
                    }
                }
                plan.apply_roots(p, &mut frames, time)
                    .and_then(|_| plan.apply_contacts(p, &mut frames, time))
                    .map_err(|e| format!("Rivi {}: {e}", action.line))?;
            }
        }
        Ok(Some(plan))
    }
    fn angle(&self, object: usize, time: f32) -> f32 {
        let mut angle = 0.;
        for a in &self.actions {
            if a.object == object && a.start <= time {
                let p = (time - a.start) / a.duration;
                angle = a.from + (a.to - a.from) * smooth((p - 0.25) / 0.6);
            }
        }
        angle
    }
    pub fn meshes(&self, time: f32) -> Vec<(Arc<hs_character::CharacterMesh>, Mat4)> {
        let mut out = Vec::new();
        for (i, o) in self.objects.iter().enumerate() {
            if time < o.start {
                continue;
            }
            if let ScenerySpec::Door {
                hinge, yaw_degrees, ..
            } = &o.spec
            {
                out.push((
                    o.mesh.clone(),
                    Mat4::from_rotation_translation(
                        Quat::from_rotation_y((yaw_degrees + self.angle(i, time)).to_radians()),
                        Vec3::from_array(*hinge),
                    ),
                ));
                if let Some(frame) = &o.frame {
                    out.push((frame.clone(), Mat4::IDENTITY));
                }
            } else {
                out.push((o.mesh.clone(), Mat4::IDENTITY));
            }
        }
        out
    }
    pub fn apply_roots(
        &self,
        p: &Production,
        frames: &mut [CharacterFrame],
        time: f32,
    ) -> Result<(), String> {
        if !self.matches(p) || frames.len() != p.cast.len() {
            return Err("Stale scenery resources".into());
        }
        for (actor, frame) in frames.iter_mut().enumerate() {
            let Some(a) = self.actions.iter().rev().find(|a| {
                a.actor == actor
                    && a.start <= time
                    && matches!(a.kind, SceneryAction::ClimbStairs { .. })
            }) else {
                continue;
            };
            let SceneryAction::ClimbStairs { descending, .. } = a.kind else {
                continue;
            };
            let h = &p.cast[actor].character.humanoid;
            let progress = ((time - a.start) / a.duration).clamp(0., 1.);
            let sample = hs_motion::scenery::stair_sample(
                &self.objects[a.object].spec,
                descending,
                progress,
                h.proportions.hip_width,
                h.leg(Side::Left).ankle_height,
            )?;
            let initial = hs_motion::scenery::stair_sample(
                &self.objects[a.object].spec,
                descending,
                0.,
                h.proportions.hip_width,
                h.leg(Side::Left).ankle_height,
            )?;
            let base = p.motion[actor].evaluate(&self.timeline, a.start);
            let mut entrance = base.pose.root_pos;
            if let Some(previous) = self.actions.iter().rev().find(|previous| {
                previous.actor == actor
                    && previous.start < a.start
                    && previous.start + previous.duration <= a.start
                    && matches!(previous.kind, SceneryAction::ClimbStairs { .. })
            }) {
                let SceneryAction::ClimbStairs {
                    descending: previous_descending,
                    ..
                } = previous.kind
                else {
                    unreachable!()
                };
                let endpoint = hs_motion::scenery::stair_sample(
                    &self.objects[previous.object].spec,
                    previous_descending,
                    1.,
                    h.proportions.hip_width,
                    h.leg(Side::Left).ankle_height,
                )?;
                let previous_base = p.motion[actor].evaluate(&self.timeline, previous.start);
                entrance = endpoint.root + base.pose.root_pos - previous_base.pose.root_pos;
            }
            if (entrance - initial.root).length() > 0.18 {
                return Err("Actor must already stand at the authored staircase entrance".into());
            }
            let delta = if progress >= 1. {
                frame.pose.root_pos - base.pose.root_pos
            } else {
                Vec3::ZERO
            };
            frame.pose.root_pos = sample.root + delta;
            frame.pose.root_rot = sample.yaw;
            frame.root = frame.pose.root_pos;
            frame.yaw = sample.yaw.to_euler(glam::EulerRot::YXZ).0;
        }
        Ok(())
    }
    pub fn apply_contacts(
        &self,
        p: &Production,
        frames: &mut [CharacterFrame],
        time: f32,
    ) -> Result<(), String> {
        if !self.matches(p) || frames.len() != p.cast.len() {
            return Err("Stale scenery resources".into());
        }
        for a in &self.actions {
            if time < a.start {
                continue;
            }
            let h = &p.cast[a.actor].character.humanoid;
            let frame = &mut frames[a.actor];
            if frame.pose.local.len() != h.skeleton.joints.len()
                || frame.pose.translate.len() != h.skeleton.joints.len()
            {
                return Err("Malformed scenery pose".into());
            }
            if let SceneryAction::ClimbStairs { descending, .. } = a.kind {
                if time > a.start + a.duration {
                    continue;
                }
                let sample = hs_motion::scenery::stair_sample(
                    &self.objects[a.object].spec,
                    descending,
                    (time - a.start) / a.duration,
                    h.proportions.hip_width,
                    h.leg(Side::Left).ankle_height,
                )?;
                hs_motion::scenery::apply_stair_feet(h, &mut frame.pose, &sample)?;
                for (other, f) in frames.iter().enumerate() {
                    if other != a.actor
                        && (Vec3::new(f.pose.root_pos.x, 0., f.pose.root_pos.z)
                            - Vec3::new(sample.root.x, 0., sample.root.z))
                        .length()
                            < h.proportions.shoulder_width * 0.6
                    {
                        return Err("Stair path intersects another character".into());
                    }
                }
                continue;
            }
            if time > a.start + a.duration {
                continue;
            }
            if frame.props.phone.is_some() {
                return Err("Door hand is occupied by a phone".into());
            }
            let progress = (time - a.start) / a.duration;
            let weight = smooth(progress / 0.25) * (1. - smooth((progress - 0.85) / 0.15));
            let target = hs_motion::scenery::door_handle(
                &self.objects[a.object].spec,
                self.angle(a.object, time),
            )?;
            let arm = h.arm(Side::Right);
            let old = frame.pose.local.clone();
            let w = h.skeleton.world(&frame.pose);
            let pole = w[arm.fore].pos + Vec3::Z * 0.2;
            let solved = hs_motion::ik::two_bone(
                &h.skeleton,
                &mut frame.pose,
                arm.upper,
                arm.fore,
                arm.hand,
                target,
                pole,
            );
            if weight > 0.999 && (solved.clamped || solved.error > 0.002) {
                return Err("Door handle is outside arm reach".into());
            }
            for joint in [arm.upper, arm.fore, arm.hand] {
                frame.pose.local[joint] = old[joint].slerp(frame.pose.local[joint], weight);
            }
            hs_motion::hands::curl_fingers(h, &mut frame.pose, Side::Right, 0.5 * weight);
            // A swinging solid panel may not pass through any character's body.
            if let ScenerySpec::Door {
                hinge,
                width,
                yaw_degrees,
                ..
            } = &self.objects[a.object].spec
            {
                let rot =
                    Quat::from_rotation_y((yaw_degrees + self.angle(a.object, time)).to_radians());
                let origin = Vec3::from_array(*hinge);
                for f in frames.iter() {
                    let local = rot.inverse() * (f.pose.root_pos - origin);
                    if local.x > -0.12 && local.x < width + 0.12 && local.z.abs() < 0.14 {
                        return Err(
                            "Door swing intersects a character; move actor outside the sweep"
                                .into(),
                        );
                    }
                }
            }
        }
        Ok(())
    }
}
