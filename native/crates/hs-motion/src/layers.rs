//! Bounded disjoint channel composition for the built-in humanoid, not arbitrary retargeting.
use crate::{
    procedural::{CharacterFrame, PreparedMotion, ProceduralMotion},
    Humanoid, Side,
};
pub use hs_core::motion_channels::{
    channels, compatible, FULL, HEAD, LEFT_ARM, RIGHT_ARM, ROOT_LEGS_TORSO,
};
use hs_core::{EventKind, Timeline};
use std::collections::BTreeMap;
#[derive(Clone, Debug)]
pub struct PreparedLayers {
    base: PreparedMotion,
    overlays: Vec<(u8, PreparedMotion)>,
}
fn overlaps(a: &hs_core::TimelineEvent, b: &hs_core::TimelineEvent) -> bool {
    a.duration.seconds() > 0.0
        && b.duration.seconds() > 0.0
        && a.start < b.start + b.duration
        && b.start < a.start + a.duration
}
impl PreparedLayers {
    pub fn new(motion: ProceduralMotion, timeline: &Timeline) -> Result<Self, String> {
        if timeline.events.len() > 4096 || timeline.duration.seconds() > 60.0 {
            return Err("Motion layer bounds exceeded".into());
        }
        let relevant: Vec<_> = timeline
            .events
            .iter()
            .filter(|event| match &event.kind {
                EventKind::Motion { character, .. }
                | EventKind::ObjectContact { character, .. }
                | EventKind::Scenery { character, .. }
                | EventKind::Phone { character, .. } => motion.speaks(character),
                _ => false,
            })
            .collect();
        let reservation = |event: &hs_core::TimelineEvent| match &event.kind {
            EventKind::Motion { motion, .. } => channels(*motion),
            EventKind::Phone { view, .. } if *view == hs_core::PhoneView::Hidden => 0,
            _ => FULL,
        };
        for (index, a) in relevant.iter().enumerate() {
            for b in relevant.iter().skip(index + 1) {
                if a.source.line == b.source.line
                    && (matches!(a.kind, EventKind::Phone { .. })
                        || matches!(b.kind, EventKind::Phone { .. }))
                {
                    continue;
                }
                if overlaps(a, b) && reservation(a) & reservation(b) != 0 {
                    return Err(format!(
                        "Rivi {}: overlapping actions reserve the same body channel (row {})",
                        b.source.line, a.source.line
                    ));
                }
            }
        }
        let mut groups: BTreeMap<u8, Vec<hs_core::TimelineEvent>> = BTreeMap::new();
        for event in &relevant {
            if let EventKind::Motion { motion: kind, .. } = event.kind {
                let mask = channels(kind);
                if mask != 0 && mask != ROOT_LEGS_TORSO && mask != FULL {
                    groups.entry(mask).or_default().push((*event).clone());
                }
            }
        }
        let mut base_timeline = timeline.clone();
        base_timeline.events.retain(|event| !motion.applies(event)||!matches!(&event.kind,EventKind::Motion{motion:kind,..} if groups.contains_key(&channels(*kind))));
        let base = motion.clone().prepare(&base_timeline);
        let overlays = groups
            .into_iter()
            .map(|(mask, events)| {
                let mut stream = timeline.clone();
                stream.events.retain(|event| !motion.applies(event) || !matches!(event.kind, EventKind::Motion { .. }));
                stream.events.extend(events);
                (mask, motion.clone().prepare(&stream))
            })
            .collect();
        Ok(Self { base, overlays })
    }
    pub fn evaluate(&self, timeline: &Timeline, time: f32) -> CharacterFrame {
        let authored_overlay = self.overlays.iter().any(|(_, motion)| motion.events().iter().any(|event| matches!(event.kind, EventKind::Motion { .. }) && time as f64 >= event.start.seconds() && (time as f64) < event.end().seconds()));
        let mut frame = self.base.evaluate_base(timeline, time, authored_overlay);
        for (mask, motion) in &self.overlays {
            let active = motion.events().iter().any(|event| {
                matches!(event.kind, EventKind::Motion { .. })
                    && time as f64 >= event.start.seconds()
                    && (time as f64) < event.start.seconds() + event.duration.seconds()
            });
            if !active {
                continue;
            }
            let overlay = motion.evaluate(timeline, time);
            for joint in joint_mask(&motion.motion.humanoid, *mask) {
                frame.pose.local[joint] = overlay.pose.local[joint];
                frame.pose.translate[joint] = overlay.pose.translate[joint];
            }
            // Keep primary locomotion metadata; overlays still count as motion
            // when no root/body action is active.
            if frame.motion.is_none() {
                frame.motion = overlay.motion;
            }
        }
        frame
    }
}
/// Exact local-joint ownership; root, legs and torso remain in the primary solver.
pub fn joint_mask(h: &Humanoid, mask: u8) -> Vec<usize> {
    let mut joints = Vec::new();
    if mask & HEAD != 0 {
        joints.push(h.head);
    }
    for (side, bit) in [(Side::Left, LEFT_ARM), (Side::Right, RIGHT_ARM)] {
        if mask & bit != 0 {
            let arm = h.arm(side);
            joints.extend([arm.clavicle, arm.upper, arm.fore, arm.hand]);
            for finger in &arm.fingers {
                joints.extend(finger.joints);
            }
        }
    }
    joints
}
