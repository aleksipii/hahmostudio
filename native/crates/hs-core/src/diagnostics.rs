use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    /// Tieto käyttäjälle, ei estä mitään.
    Info,
    /// Tulkinta tehtiin, mutta käyttäjän kannattaa tarkistaa se.
    Warning,
    /// Riviä ei voitu tulkita; se ei päädy aikajanalle. Lopullinen kokoaminen estyy.
    Error,
}

/// Rivikohtainen huomautus. Jäsennin ei koskaan arvaa: tuntematon ohje
/// raportoidaan tällä eikä sitä muuteta joksikin muuksi.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub severity: Severity,
    /// 1-pohjainen rivinumero käsikirjoituksessa (0 = koko teksti).
    pub line: usize,
    pub message: String,
}

impl Diagnostic {
    pub fn error(line: usize, message: impl Into<String>) -> Self {
        Self { severity: Severity::Error, line, message: message.into() }
    }
    pub fn warning(line: usize, message: impl Into<String>) -> Self {
        Self { severity: Severity::Warning, line, message: message.into() }
    }
    pub fn info(line: usize, message: impl Into<String>) -> Self {
        Self { severity: Severity::Info, line, message: message.into() }
    }
}
