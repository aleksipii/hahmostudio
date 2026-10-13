//! Checked source-line edits. Compiled timing is never the edit authority.
pub const MAX_HISTORY: usize = 16;
pub const MAX_HISTORY_BYTES: usize = 128 * 1024 * 1024;
#[derive(Clone, Debug)]
pub enum LineEdit {
    Up,
    Down,
    Duplicate,
    Delete,
    Replace(String),
    PauseAfter,
    MoveTo(usize),
    MoveSceneTo(usize),
    PauseBefore(f32),
}
fn split(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}
fn body(line: &str) -> &str {
    line.strip_suffix("\r\n")
        .or_else(|| line.strip_suffix('\n'))
        .unwrap_or(line)
}
pub fn line_texts(text: &str) -> Vec<&str> {
    split(text).into_iter().map(body).collect()
}
pub fn rewrite(text: &str, index: usize, expected: &str, edit: LineEdit) -> Result<String, String> {
    let mut lines: Vec<String> = split(text).into_iter().map(str::to_owned).collect();
    let line = lines.get(index).ok_or("Riviä ei enää ole")?;
    if body(line) != expected {
        return Err("Käsikirjoitus muuttui: valitse rivi uudelleen".into());
    }
    let ending = if line.ends_with("\r\n") { "\r\n" } else { "\n" };
    match edit {
        LineEdit::MoveSceneTo(target) => {
            if target >= lines.len() { return Err("Kohderiviä ei enää ole".into()); }
            let start_of = |index: usize| {
                let mut start = index;
                while start > 0 {
                    let tag = body(&lines[start - 1]).trim().to_lowercase();
                    if ["[camera ", "[shot ", "[kuva "].iter().any(|prefix| tag.starts_with(prefix)) {
                        start -= 1;
                    } else { break; }
                }
                start
            };
            let start = start_of(index);
            let destination = if target > index { target + 1 } else { start_of(target) };
            if destination < start || destination > index + 1 {
                let count = index + 1 - start;
                let moved: Vec<_> = lines.drain(start..=index).collect();
                let destination = if destination > start { destination - count } else { destination };
                lines.splice(destination..destination, moved);
            }
        }
        LineEdit::MoveTo(target) => {
            if target >= lines.len() { return Err("Kohderiviä ei enää ole".into()); }
            let moved = lines.remove(index);
            lines.insert(target, moved);
        }
        LineEdit::PauseBefore(seconds) => {
            if body(&lines[index]).to_lowercase().contains("[at ") {return Err("Rivillä on tarkka alkuaika: muuta [at]-aikaa odotuslohkon sijaan".into());}
            if !seconds.is_finite() || !(0.05..=60.0).contains(&seconds) {
                return Err("Tauon keston on oltava 0.05–60 sekuntia".into());
            }
            let mut start = index;
            while start > 0 {
                let tag = body(&lines[start - 1]).trim().to_lowercase();
                if ["[camera ", "[shot ", "[kuva "].iter().any(|prefix| tag.starts_with(prefix)) { start -= 1; }
                else { break; }
            }
            lines.insert(start, format!("[wait {seconds:.3}s]{ending}"));
        }
        LineEdit::Up => {
            if index == 0 {
                return Err("Rivi on jo ensimmäinen".into());
            }
            lines.swap(index, index - 1);
        }
        LineEdit::Down => {
            if index + 1 >= lines.len() {
                return Err("Rivi on jo viimeinen".into());
            }
            lines.swap(index, index + 1);
        }
        LineEdit::Delete => {
            lines.remove(index);
        }
        LineEdit::Replace(new) => {
            if new.contains(['\n', '\r']) {
                return Err("Muokkaa vain yhtä riviä".into());
            }
            let end = if lines[index].ends_with("\r\n") {
                "\r\n"
            } else if lines[index].ends_with('\n') {
                "\n"
            } else {
                ""
            };
            lines[index] = format!("{new}{end}");
        }
        LineEdit::Duplicate | LineEdit::PauseAfter => {
            let new = if matches!(edit, LineEdit::Duplicate) {
                body(&lines[index]).to_string()
            } else {
                "[wait 1s]".into()
            };
            if !lines[index].ends_with('\n') {
                lines[index].push_str(ending);
                lines.insert(index + 1, new);
            } else {
                lines.insert(index + 1, format!("{new}{ending}"));
            }
        }
    }
    // A moved final unterminated line must not concatenate with its new neighbour.
    for i in 0..lines.len().saturating_sub(1) {
        if !lines[i].ends_with('\n') {
            lines[i].push_str(ending);
        }
    }
    let mut out = lines.concat();
    if !text.ends_with('\n') && out.ends_with('\n') {
        out.pop();
        if out.ends_with('\r') {
            out.pop();
        }
    }
    if out.chars().count() > 12000 {
        return Err("Käsikirjoitus ylittää 12 000 merkkiä".into());
    }
    Ok(out)
}
#[derive(Default)]
pub struct SourceHistory {
    current: Option<String>,
    undo: Vec<String>,
    redo: Vec<String>,
}
impl SourceHistory {
    pub fn observe(&mut self, text: &str) -> bool {
        if self.current.as_deref() == Some(text) {
            return false;
        }
        let external = self.current.is_some();
        self.current = Some(text.into());
        self.undo.clear();
        self.redo.clear();
        external
    }
    pub fn clear(&mut self) {
        self.undo.clear();
        self.redo.clear();
    }
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
    pub fn apply(&mut self, current: &str, next: String) -> Result<String, String> {
        if self.current.as_deref() != Some(current) {
            return Err("Ulkoiset muutokset: päivitä historia ensin".into());
        }
        if next.chars().count() > 12000 {
            return Err("Käsikirjoitus ylittää 12 000 merkkiä".into());
        }
        if next == current {
            return Ok(next);
        }
        let bytes = self.undo.iter().map(String::len).sum::<usize>() + current.len() + next.len();
        if self.undo.len() >= MAX_HISTORY || bytes > MAX_HISTORY_BYTES {
            return Err("Historia täynnä. Tyhjennä historia jatkaaksesi; teksti säilyy.".into());
        }
        self.undo.push(current.into());
        self.redo.clear();
        self.current = Some(next.clone());
        Ok(next)
    }
    pub fn undo(&mut self) -> Option<String> {
        let previous = self.undo.pop()?;
        self.redo.push(self.current.replace(previous.clone())?);
        Some(previous)
    }
    pub fn redo(&mut self) -> Option<String> {
        let next = self.redo.pop()?;
        self.undo.push(self.current.replace(next.clone())?);
        Some(next)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn order_and_exact_text() {
        let s = "A: hello\r\n[tag]\r\nB: bye\r\n";
        assert_eq!(
            rewrite(s, 1, "[tag]", LineEdit::Up).unwrap(),
            "[tag]\r\nA: hello\r\nB: bye\r\n"
        );
        assert_eq!(
            rewrite(s, 1, "[tag]", LineEdit::Replace("[wait 1s]".into())).unwrap(),
            "A: hello\r\n[wait 1s]\r\nB: bye\r\n"
        );
    }
    #[test]
    fn stale() {
        assert!(rewrite("new\n", 0, "old", LineEdit::Delete).is_err());
    }
    #[test]
    fn ending() {
        assert_eq!(rewrite("a\nb", 1, "b", LineEdit::Up).unwrap(), "b\na");
        assert_eq!(rewrite("a", 0, "a", LineEdit::Duplicate).unwrap(), "a\na");
    }
    #[test]
    fn history() {
        let mut h = SourceHistory::default();
        h.observe("a");
        h.apply("a", "b".into()).unwrap();
        assert_eq!(h.undo(), Some("a".into()));
        assert_eq!(h.redo(), Some("b".into()));
        assert!(h.observe("external"));
        assert!(!h.can_undo());
    }
    #[test]
    fn bounded_history() {
        let mut h = SourceHistory::default();
        h.observe("0");
        let mut current = "0".to_string();
        for n in 1..=16 {
            current = h.apply(&current, n.to_string()).unwrap();
        }
        assert!(h.apply(&current, "17".into()).is_err());
        assert_eq!(h.undo(), Some("15".into()));
    }
}

#[cfg(test)]
mod visual_edit_tests {
    use super::*;
    #[test]
    fn drag_reorder_preserves_crlf_and_unterminated_lines() {
        let source = "KALLE: First.\r\nMAIJA: Second.\r\nKALLE: Last.";
        let next = rewrite(source, 2, "KALLE: Last.", LineEdit::MoveTo(0)).unwrap();
        assert_eq!(line_texts(&next), vec!["KALLE: Last.", "KALLE: First.", "MAIJA: Second."]);
        assert!(next.contains("\r\n"));
        assert!(rewrite(source, 2, "Changed", LineEdit::MoveTo(0)).is_err());
        assert!(rewrite(source, 0, "KALLE: First.", LineEdit::MoveTo(9)).is_err());
    }
    #[test]
    fn authored_delay_preserves_dialogue_and_rejects_invalid_time() {
        let source = "KALLE: Hello. [nod 1s]";
        assert_eq!(rewrite(source, 0, source, LineEdit::PauseBefore(1.5)).unwrap(), format!("[wait 1.500s]\n{source}"));
        for seconds in [f32::NAN, f32::INFINITY, -1.0, 0.0, 61.0] {
            assert!(rewrite(source, 0, source, LineEdit::PauseBefore(seconds)).is_err());
        }
    }
}
