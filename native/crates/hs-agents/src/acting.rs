//! Original acting styles: only free upper-body poses are stepped. The scene,
//! root, feet, speech and contact clocks always retain the actual sample time.
use crate::Production;
use hs_core::{EventKind, Expression, Timeline};
use hs_motion::{
    acting_style::{apply_upper_body, ActingStyle},
    layers::{HEAD, LEFT_ARM, RIGHT_ARM},
    procedural::CharacterFrame,
};

pub fn frames(p: &Production, time: f32) -> Result<Vec<CharacterFrame>, String> {
    if !time.is_finite() || time < 0.0 || p.motion.len() != p.cast.len() {
        return Err("Invalid acting sample".into());
    }
    let timeline = p.timeline.as_ref().ok_or("Missing acting timeline")?;
    let mut frames: Vec<_> = p
        .motion
        .iter()
        .map(|m| m.evaluate(timeline, time))
        .collect();
    if p.acting_style == ActingStyle::Smooth {
        return Ok(frames);
    }
    if !time.is_finite() || time < 0.0 || frames.len() != p.cast.len() {
        return Err("Invalid acting sample".into());
    }
    let protected = p.contacts.is_some()
        || p.scenery.is_some()
        || timeline
            .events
            .iter()
            .any(|e| matches!(&e.kind, EventKind::Prop { .. } | EventKind::Phone { .. }));
    for ((frame, motion), member) in frames.iter_mut().zip(&p.motion).zip(&p.cast) {
        if p.pose_tracks.has_actor(&member.character.params.name) {
            continue;
        }
        let mut anchor = 0.0_f64;
        for event in &timeline.events {
            if let EventKind::Motion { character, .. } = &event.kind {
                if motion.motion.speaks(character) {
                    for boundary in [event.start.seconds(), event.end().seconds()] {
                        if boundary <= time as f64 {
                            anchor = anchor.max(boundary);
                        }
                    }
                }
            }
        }
        let sample = p.acting_style.sample_time(time as f64, anchor)? as f32;
        let held = motion.evaluate(timeline, sample);
        apply_upper_body(
            &member.character.humanoid,
            &mut frame.pose,
            &held.pose,
            if protected {
                HEAD
            } else {
                HEAD | LEFT_ARM | RIGHT_ARM
            },
        )?;
    }
    Ok(frames)
}

/// A 180 ms transition is sampled from absolute cue time, never accumulated.
pub fn expression(
    timeline: &Timeline,
    actor: &str,
    lead: bool,
    time: f32,
    style: ActingStyle,
) -> (Expression, Expression, f32) {
    let mut active = None;
    for event in &timeline.events {
        if let EventKind::Expression {
            character,
            expression,
        } = &event.kind
        {
            if character
                .as_ref()
                .map_or(lead, |name| name.eq_ignore_ascii_case(actor))
                && event.start.seconds() <= time as f64
                && (time as f64) < event.end().seconds()
            {
                if active.map_or(true, |(start, _)| event.start.seconds() >= start) {
                    active = Some((event.start.seconds(), *expression));
                }
            }
        }
    }
    let Some((start, to)) = active else {
        let ended = timeline
            .events
            .iter()
            .filter_map(|event| match &event.kind {
                EventKind::Expression {
                    character,
                    expression,
                } if character
                    .as_ref()
                    .map_or(lead, |name| name.eq_ignore_ascii_case(actor))
                    && event.end().seconds() <= time as f64 =>
                {
                    Some((event.end(), *expression))
                }
                _ => None,
            })
            .max_by_key(|(tick, _)| *tick);
        if let Some((end, from)) = ended {
            let sample = style
                .sample_time(time as f64, end.seconds())
                .unwrap_or(time as f64);
            return (
                from,
                Expression::Neutral,
                ((sample - end.seconds()) / 0.18).clamp(0.0, 1.0) as f32,
            );
        }
        return (Expression::Neutral, Expression::Neutral, 1.0);
    };
    let previous = timeline
        .events
        .iter()
        .filter_map(|event| match &event.kind {
            EventKind::Expression {
                character,
                expression,
            } if character
                .as_ref()
                .map_or(lead, |name| name.eq_ignore_ascii_case(actor))
                && event.start.seconds() < start
                && event.end().seconds() >= start =>
            {
                Some((event.start, *expression))
            }
            _ => None,
        })
        .max_by_key(|(tick, _)| *tick)
        .map_or(Expression::Neutral, |(_, expression)| expression);
    let sample = style.sample_time(time as f64, start).unwrap_or(time as f64);
    (
        previous,
        to,
        ((sample - start) / 0.18).clamp(0.0, 1.0) as f32,
    )
}
