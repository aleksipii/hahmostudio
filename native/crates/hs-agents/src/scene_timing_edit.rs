//! Atomic source-backed edits for global scene cues and selected source rows.
//! No speech engine is attached to the preflight; retained audio stays authoritative.
use crate::{Pipeline, Production};
use std::collections::BTreeSet;

fn source_guard(p: &Production, expected: &str) -> Result<(), String> {
    if p.script != expected {
        return Err("Käsikirjoitus muuttui: valitse ja raahaa uudelleen.".into());
    }
    if p.plan.is_none() || p.timeline.is_none() {
        return Err("Tarkistettu käsikirjoitus ja ajoitus puuttuvat.".into());
    }
    Ok(())
}
fn rewrite_start(source: &str, line: usize, start: f64) -> Result<String, String> {
    let row = hs_edit::script::line_texts(source)
        .get(line.checked_sub(1).ok_or("Rivi puuttuu")?)
        .copied()
        .ok_or("Rivi puuttuu")?;
    hs_edit::script::rewrite(
        source,
        line - 1,
        row,
        hs_edit::script::LineEdit::StartAt(start),
    )
}
fn validate_candidate(p: &Production, next: String) -> Result<String, String> {
    let mut episode =
        crate::project::capture(p, "scene-timing-preview".into(), 1, "Ajoitusluonnos".into());
    episode.script = next.clone();
    let mut candidate = crate::project::restore(&episode);
    Pipeline::default()
        .run(&mut candidate)
        .map_err(|e| e.to_string())?;
    let proof = crate::audit::inspect(&candidate);
    if !proof.allowed() {
        return Err(proof
            .diagnostics
            .iter()
            .filter(|d| d.severity == hs_core::Severity::Error)
            .map(|d| format!("Rivi {}: {}", d.line, d.message))
            .collect::<Vec<_>>()
            .join("\n"));
    }
    Ok(next)
}
/// Move one standalone global camera/background row. Its neighbours retain their authored clocks.
/// Inline cues travel with their action row; they must first become an explicit standalone cue.
pub fn checked_scene_retime(
    p: &Production,
    expected: &str,
    line: usize,
    seconds: f64,
) -> Result<String, String> {
    source_guard(p, expected)?;
    let plan = p.plan.as_ref().unwrap();
    if !plan.scene_events.iter().any(|event| event.line == line) {
        return Err(format!(
            "Rivi {line}: valitse erillinen [at Ns] kamera- tai taustarivi."
        ));
    }
    validate_candidate(p, rewrite_start(expected, line, seconds)?)
}
/// Shift a set of action/scene rows as one transaction. Speech and motion move by the same delta.
/// Every action row is pinned to its actual current clocks before editing so unselected implicit
/// rows do not drift. Source text, clip keys, recordings and durations remain unchanged.
pub fn checked_shift_lines(
    p: &Production,
    expected: &str,
    lines: &[usize],
    delta: f64,
) -> Result<String, String> {
    source_guard(p, expected)?;
    if !delta.is_finite() || delta.abs() >= 60.0 {
        return Err("Ryhmän siirron on oltava äärellinen ja alle 60 s.".into());
    }
    let selected: BTreeSet<_> = lines.iter().copied().collect();
    if selected.is_empty() || selected.len() > 1000 {
        return Err("Valitse 1–1000 lähderiviä.".into());
    }
    let plan = p.plan.as_ref().unwrap();
    for &line in &selected {
        if !plan.beats.iter().any(|beat| beat.line == line)
            && !plan.scene_events.iter().any(|event| event.line == line)
        {
            return Err(format!("Rivi {line}: rivillä ei ole ajoitettavaa toimintoa tai erillistä kuva-/taustaohjetta."));
        }
    }
    if delta == 0.0 {
        return validate_candidate(p, expected.to_owned());
    }
    let mut next = expected.to_owned();
    for (index, beat) in plan.beats.iter().enumerate() {
        let speech_start = p
            .beat_times
            .get(index)
            .ok_or("Todellinen repliikkiajoitus puuttuu")?
            .0 as f64;
        let motion_start = beat.motion_at.unwrap_or(speech_start);
        let shift = if selected.contains(&beat.line) {
            delta
        } else {
            0.0
        };
        next = rewrite_start(&next, beat.line, speech_start + shift)
            .map_err(|error| format!("Rivi {}: {error}", beat.line))?;
        let row = hs_edit::script::line_texts(&next)
            .get(beat.line - 1)
            .copied()
            .ok_or("Rivi puuttuu")?;
        let replacement = hs_script::with_motion_timing(
            row,
            motion_start + shift,
            beat.motion_seconds.unwrap_or(beat.seconds),
        )
        .map_err(|error| format!("Rivi {}: {error}", beat.line))?;
        next = hs_edit::script::rewrite(
            &next,
            beat.line - 1,
            row,
            hs_edit::script::LineEdit::Replace(replacement),
        )?;
    }
    for event in &plan.scene_events {
        if selected.contains(&event.line) {
            next = rewrite_start(&next, event.line, event.at + delta)
                .map_err(|error| format!("Rivi {}: {error}", event.line))?;
        }
    }
    validate_candidate(p, next)
}
