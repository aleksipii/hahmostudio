//! Reviewed edits for the bounded command language. Suggestions never mutate source.
use crate::{parse, Diagnostic, MAX_SCRIPT_CHARS};
use hs_core::Severity;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EditProposal {
    pub line: usize,
    pub before: String,
    pub after: String,
    pub reason: String,
    pub command: Option<String>,
    source: String,
}
#[derive(Clone, Debug)]
pub struct LineCheck {
    pub line: usize,
    pub source: String,
    pub dialogue: bool,
    pub diagnostics: Vec<Diagnostic>,
    pub interpretation: Option<EditProposal>,
    pub interpretation_error: Option<String>,
}

fn checked_source(script: &str) -> Result<(), String> {
    if script.chars().count() > MAX_SCRIPT_CHARS {
        return Err("Käsikirjoituksen enimmäispituus on 12 000 merkkiä.".into());
    }
    Ok(())
}
fn line_range(script: &str, line: usize) -> Option<(usize, usize)> {
    if line == 0 {
        return None;
    }
    let mut offset = 0;
    for (index, part) in script.split_inclusive('\n').enumerate() {
        let body = part.strip_suffix('\n').unwrap_or(part);
        let body = body.strip_suffix('\r').unwrap_or(body);
        if index + 1 == line {
            return Some((offset, offset + body.len()));
        }
        offset += part.len();
    }
    if (script.is_empty() && line == 1)
        || (script.ends_with('\n') && line == script.bytes().filter(|b| *b == b'\n').count() + 1)
    {
        return Some((script.len(), script.len()));
    }
    None
}
fn proposal(
    script: &str,
    line: usize,
    after: String,
    reason: &str,
) -> Result<EditProposal, String> {
    checked_source(script)?;
    let (start, end) = line_range(script, line).ok_or("Rivi ei enää ole käsikirjoituksessa.")?;
    if after.contains(['\n', '\r']) {
        return Err("Ehdotus saa muuttaa vain yhtä riviä.".into());
    }
    let next_chars =
        script.chars().count() - script[start..end].chars().count() + after.chars().count();
    if next_chars > MAX_SCRIPT_CHARS {
        return Err("Ehdotus ylittää käsikirjoituksen kokorajan.".into());
    }
    Ok(EditProposal {
        line,
        before: script[start..end].into(),
        after,
        reason: reason.into(),
        command: None,
        source: script.into(),
    })
}
/// Explicit acceptance is required. Any source change makes an old proposal stale.
pub fn apply(script: &str, edit: &EditProposal) -> Result<String, String> {
    checked_source(script)?;
    if edit.after.contains(['\n', '\r']) {
        return Err("Ehdotus saa muuttaa vain yhtä riviä.".into());
    }
    if script != edit.source {
        return Err("Käsikirjoitus muuttui. Tarkista uusi ehdotus ennen hyväksymistä.".into());
    }
    let (start, end) = line_range(script, edit.line).ok_or("Rivi puuttuu.")?;
    if script[start..end] != edit.before {
        return Err("Ehdotuksen lähderivi muuttui.".into());
    }
    let mut result = String::with_capacity(script.len() + edit.after.len());
    result.push_str(&script[..start]);
    result.push_str(&edit.after);
    result.push_str(&script[end..]);
    checked_source(&result)?;
    Ok(result)
}

/// Only known, standalone imperative commands are offered for interpretation.
/// Dialogue, unknown actions and compound prose receive no fabricated actions.
pub fn inspect(script: &str) -> Result<Vec<LineCheck>, String> {
    checked_source(script)?;
    let plan = parse(script);
    let mut diagnostics = std::collections::BTreeMap::<usize, Vec<Diagnostic>>::new();
    for diagnostic in plan.diagnostics {
        diagnostics
            .entry(diagnostic.line.max(1))
            .or_default()
            .push(diagnostic);
    }
    let mut result = Vec::new();
    for (index, source) in script.split('\n').enumerate() {
        let line = index + 1;
        let source = source.strip_suffix('\r').unwrap_or(source);
        let trimmed = source.trim();
        let dialogue = crate::split_speaker(trimmed).0.is_some();
        let mut interpretation = None;
        let mut interpretation_error = None;
        if !trimmed.is_empty() && !dialogue && !trimmed.contains(['[', ']']) {
            match crate::english::normalize_tag(trimmed) {
                Ok(Some(_)) => {
                    let leading = source.len() - source.trim_start().len();
                    let trailing = source.len() - source.trim_end().len();
                    let after = format!(
                        "{}[{}]{}",
                        &source[..leading],
                        trimmed,
                        &source[source.len() - trailing..]
                    );
                    match proposal(script,line,after,"Tämä teksti vastaa tunnettua ohjetta. Hyväksy muutos vain, jos tarkoitit toimintaa puheen sijaan.") {
                        Ok(edit)=>interpretation=Some(edit),
                        Err(error)=>interpretation_error=Some(error),
                    }
                }
                Err(error) => interpretation_error = Some(error),
                Ok(None) => {}
            }
        }
        result.push(LineCheck {
            line,
            source: source.into(),
            dialogue,
            diagnostics: diagnostics.remove(&line).unwrap_or_default(),
            interpretation,
            interpretation_error,
        });
    }
    Ok(result)
}

/// Complete an unfinished/unknown bracketed tag, otherwise append a catalog tag.
/// Existing supported tags and spoken text are preserved.
pub fn completions(script: &str, line: usize, query: &str) -> Result<Vec<EditProposal>, String> {
    checked_source(script)?;
    let (start, end) = line_range(script, line).ok_or("Valitse käsikirjoituksen rivi.")?;
    let source = &script[start..end];
    let candidate = source.match_indices('[').rev().find_map(|(open, _)| {
        let close = source[open..].find(']').map(|i| open + i);
        let end = close.map(|i| i + 1).unwrap_or(source.len());
        let body = &source[open + 1..close.unwrap_or(source.len())];
        (close.is_none() || crate::classify(body).is_err()).then_some((open, end, body))
    });
    let query = if query.trim().is_empty() {
        candidate.map(|(_, _, body)| body).unwrap_or("")
    } else {
        query
    };
    let query = query.trim().to_lowercase();
    if query.chars().count() > 256 {
        return Err("Hakuteksti on liian pitkä.".into());
    }
    let mut existing_errors = std::collections::BTreeMap::new();
    for diagnostic in parse(script)
        .diagnostics
        .into_iter()
        .filter(|d| d.severity == Severity::Error)
    {
        *existing_errors
            .entry((diagnostic.line, diagnostic.message))
            .or_insert(0usize) += 1;
    }
    let mut out = Vec::new();
    for command in crate::english::COMMANDS {
        if !query.is_empty() && !command.example.to_lowercase().contains(&query) {
            continue;
        }
        let kind = crate::classify(command.example)?;
        let replacement =
            candidate.or_else(|| {
                source.match_indices('[').rev().find_map(|(open, _)| {
                    let close = source[open..].find(']').map(|i| open + i)?;
                    let body = &source[open + 1..close];
                    let existing = crate::classify(body).ok()?;
                    (std::mem::discriminant(&existing) == std::mem::discriminant(&kind))
                        .then_some((open, close + 1, body))
                })
            });
        let tag = format!("[{}]", command.example);
        let after = match replacement {
            Some((open, end, _)) => format!("{}{}{}", &source[..open], tag, &source[end..]),
            None if source.trim().is_empty() => tag.clone(),
            None => format!("{} {}", source, tag),
        };
        let mut edit = proposal(script, line, after, command.description)?;
        edit.command = Some(tag);
        let next = apply(script, &edit)?;
        let mut remaining = existing_errors.clone();
        let new_error = parse(&next)
            .diagnostics
            .into_iter()
            .filter(|d| d.severity == Severity::Error)
            .any(|d| match remaining.get_mut(&(d.line, d.message)) {
                Some(count) if *count > 0 => {
                    *count -= 1;
                    false
                }
                _ => true,
            });
        if new_error {
            continue;
        }
        out.push(edit);
        if out.len() == 8 {
            break;
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn proposals_preserve_dialogue_until_explicit_acceptance() {
        let source="Walk to the left for 2 seconds\r\nKALLE: Walk to the left for 2 seconds\r\nMAIJA: I love to walk.";
        let checks = inspect(source).unwrap();
        assert!(checks[0].interpretation.is_some());
        assert!(checks[1].interpretation.is_none());
        assert!(checks[2].interpretation.is_none());
        assert_eq!(checks[0].source, "Walk to the left for 2 seconds");
        let accepted = apply(source, checks[0].interpretation.as_ref().unwrap()).unwrap();
        assert!(accepted.starts_with("[Walk to the left for 2 seconds]\r\nKALLE:"));
        assert_eq!(
            accepted.split_once("\r\n").unwrap().1,
            source.split_once("\r\n").unwrap().1
        );
    }
    #[test]
    fn unfinished_valid_tag_is_completed_instead_of_appending_nested_tag() {
        for source in [
            "KALLE: Hello! [wave",
            "KALLE: Hello! [wait",
            "KALLE: Hello! [camera close up",
        ] {
            let edits = completions(source, 1, "").unwrap();
            assert!(!edits.is_empty(), "{source}");
            let accepted = apply(source, &edits[0]).unwrap();
            assert_eq!(accepted.matches('[').count(), 1);
            assert_eq!(accepted.matches(']').count(), 1);
            assert!(parse(&accepted).is_assemblable(), "{accepted}");
        }
    }
    #[test]
    fn maximum_source_retains_all_checks_when_proposal_cannot_fit() {
        let source = format!("wait\n{}", "x".repeat(MAX_SCRIPT_CHARS - 5));
        assert_eq!(source.chars().count(), MAX_SCRIPT_CHARS);
        let checks = inspect(&source).unwrap();
        assert_eq!(checks.len(), 2);
        assert!(checks[0].interpretation.is_none());
        assert!(checks[0].interpretation_error.is_some());
        assert_eq!(checks[1].source.len(), MAX_SCRIPT_CHARS - 5);
    }
    #[test]
    fn changed_source_rejects_preview_instead_of_overwriting_work() {
        let source = "KALLE: Hello! [wa";
        let edits = completions(source, 1, "").unwrap();
        assert!(!edits.is_empty());
        assert!(apply(&format!("{source}\nMAIJA: Hello!"), &edits[0]).is_err());
        assert_eq!(source, "KALLE: Hello! [wa");
        let changed = apply(source, &edits[0]).unwrap();
        assert!(changed.starts_with("KALLE: Hello! ["));
        assert!(parse(&changed).is_assemblable());
        let mut multiline = edits[0].clone();
        multiline.after.push_str("\nMAIJA: Unexpected added line.");
        assert!(apply(source, &multiline).is_err());
    }
    #[test]
    fn unicode_and_crlf_remain_exact_outside_selected_tag() {
        let source = "KALLE: Café, café! [wa]\r\nMAIJA: Hello!\r\n";
        let edits = completions(source, 1, "wave").unwrap();
        let accepted = apply(source, &edits[0]).unwrap();
        assert!(accepted.starts_with("KALLE: Café, café! [wave"));
        assert!(accepted.ends_with("\r\nMAIJA: Hello!\r\n"));
        assert!(parse(&accepted).is_assemblable());
    }
    #[test]
    fn bounds_invalid_lines_and_unsupported_prose_are_explicit() {
        assert!(inspect(&"x".repeat(MAX_SCRIPT_CHARS + 1)).is_err());
        assert!(completions("Hello", 0, "").is_err());
        assert!(completions("Hello", 2, "").is_err());
        assert!(completions("Hello", 1, &"x".repeat(257)).is_err());
        for source in [
            "Kalle walks into the kitchen and opens a door",
            "Don't walk left",
            "Walk to the moon",
            "Sit on the sofa",
        ] {
            assert!(
                inspect(source).unwrap()[0].interpretation.is_none(),
                "{source}"
            );
        }
    }
    #[test]
    fn catalog_entries_are_real_commands_and_supported_tags_are_not_replaced() {
        for command in crate::english::COMMANDS {
            assert!(
                crate::classify(command.example).is_ok(),
                "{}",
                command.example
            );
        }
        let source = "KALLE: Hello! [wave 2s]";
        let edits = completions(source, 1, "look").unwrap();
        assert!(!edits.is_empty());
        assert!(edits[0].after.starts_with(source));
    }
}

#[cfg(test)]
mod safe_completion_tests {
    use super::*;
    #[test]
    fn existing_motion_is_replaced_instead_of_adding_a_conflicting_second_action() {
        let source = "KALLE: Hello! [wave 2s]";
        let edits = completions(source, 1, "walk").unwrap();
        assert!(!edits.is_empty());
        for edit in edits {
            let next = apply(source, &edit).unwrap();
            assert!(!next.contains("[wave 2s]"));
            assert!(parse(&next).is_assemblable(), "{next}");
        }
    }
    #[test]
    fn pending_scene_conflicts_are_never_offered_as_acceptable_edits() {
        let source = "[background living room]\nKALLE: Hello! [wait 1s]";
        assert!(completions(source, 2, "background").unwrap().is_empty());
        let already_invalid = "KALLE: Hello! [wave 1s] [nod 1s] [unknown]";
        assert!(completions(already_invalid, 1, "walk").unwrap().is_empty());
        for edit in completions(source, 2, "").unwrap() {
            assert!(parse(&apply(source, &edit).unwrap()).is_assemblable());
        }
    }
}
