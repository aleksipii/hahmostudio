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
    check_candidate(p, next)
}

fn check_candidate(p: &Production, next: String) -> Result<String, String> {
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

/// Set authored duration while retaining real speech. Shortening below recorded speech is rejected.
pub fn checked_duration(
    p: &Production,
    expected: &str,
    line: usize,
    seconds: f64,
) -> Result<String, String> {
    if p.script != expected {
        return Err("Käsikirjoitus muuttui: raahaa uudelleen.".into());
    }
    let plan = p.plan.as_ref().ok_or("Tarkistettu suunnitelma puuttuu")?;
    let index = plan
        .beats
        .iter()
        .position(|beat| beat.line == line)
        .ok_or("Valitse toimintorivi")?;
    if let Some(speech) = p
        .voice_lines
        .iter()
        .find(|voice| voice.beat == index)
        .and_then(|voice| voice.speech.as_ref())
    {
        let minimum = speech.audio.duration() as f64 + crate::agents::voice::TAIL;
        if seconds + 0.000001 < minimum {
            return Err(format!("Rivi {line}: tallennettu puhe tarvitsee vähintään {minimum:.3} s hengähdyksen kanssa. Puhetta ei leikata tai nopeuteta."));
        }
    }
    let original = hs_edit::script::line_texts(expected)
        .get(line.checked_sub(1).ok_or("Rivi puuttuu")?)
        .copied()
        .ok_or("Rivi puuttuu")?;
    let replacement = hs_script::with_line_duration(original, seconds)?;
    let next = hs_edit::script::rewrite(
        expected,
        line - 1,
        original,
        hs_edit::script::LineEdit::Replace(replacement),
    )?;
    check_candidate(p, next)
}
