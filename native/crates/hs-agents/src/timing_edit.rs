//! Source-backed retiming preflight. Never calls speech synthesis or mutates the live project.
use crate::{Pipeline, Production};

/// Return the new source only after rebuilding timing, camera and contacts with retained audio.
pub fn checked_retime(
    p: &Production,
    expected: &str,
    line: usize,
    seconds: f64,
) -> Result<String, String> {
    if p.script != expected {
        return Err("Käsikirjoitus muuttui: raahaa rivi uudelleen.".into());
    }
    let plan = p
        .plan
        .as_ref()
        .ok_or("Tarkistettu käsikirjoitus puuttuu.")?;
    if !plan.beats.iter().any(|beat| beat.line == line) {
        return Err("Valittu kohta ei ole ajoitettava toimintorivi.".into());
    }
    let original = hs_edit::script::line_texts(expected)
        .get(line.checked_sub(1).ok_or("Rivi puuttuu")?)
        .copied()
        .ok_or("Rivi puuttuu")?;
    let next = hs_edit::script::rewrite(
        expected,
        line - 1,
        original,
        hs_edit::script::LineEdit::StartAt(seconds),
    )?;
    let mut episode =
        crate::project::capture(p, "timing-preview".into(), 1, "Ajoitusluonnos".into());
    episode.script = next.clone();
    let mut candidate = crate::project::restore(&episode);
    // No engine attached: existing speech/recordings are reused and missing speech is not invented.
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
