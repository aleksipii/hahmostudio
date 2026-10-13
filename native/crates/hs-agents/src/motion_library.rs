//! Reproducible motion assets: 20 recipes × 4 rigs × 25 authored durations.
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Preset {
    pub id: String,
    pub family: String,
    pub name: String,
    pub profile: String,
    /// Duration of each authored step; sequences have two steps.
    pub seconds: f64,
    pub script: String,
}
pub const RECIPES: &[(&str, &str, &[&str])] = &[
    ("idle", "Puhe / tauko", &["wait"]),
    ("walk-left", "Kävely vasemmalle", &["walk left"]),
    ("walk-right", "Kävely oikealle", &["walk right"]),
    ("walk-front", "Kävely eteen", &["walk forward"]),
    ("run-left", "Juoksu vasemmalle", &["run left"]),
    ("run-right", "Juoksu oikealle", &["run right"]),
    ("run-front", "Juoksu eteen", &["run forward"]),
    ("wave", "Vilkutus", &["wave hello"]),
    ("jump", "Hyppy", &["jump"]),
    ("crouch", "Kyykistys", &["crouch"]),
    ("nod", "Nyökkäys", &["nod"]),
    ("walk-backward", "Kävely taakse", &["walk backward"]),
    ("turn-left", "Kääntyminen vasemmalle", &["turn left"]),
    ("turn-right", "Kääntyminen oikealle", &["turn right"]),
    ("point", "Osoittaminen eteen", &["point forward"]),
    ("shrug", "Olankohautus", &["shrug shoulders"]),
    ("shake-head", "Pään pudistus", &["shake head"]),
    ("clap", "Taputus", &["clap hands"]),
    ("turn-point", "Käänny ja osoita", &["turn left", "point forward"]),
    ("shrug-shake", "Kohauta ja pudista päätä", &["shrug shoulders", "shake head"]),
];

pub fn catalog() -> Vec<Preset> {
    let mut items = Vec::with_capacity(2000);
    for (family, label, steps) in RECIPES {
        for profile in ["Kalle", "Maija", "Eetu", "Ronja"] {
            for index in 0..25 {
                let millis = 1000 + index * 100;
                let seconds = f64::from(millis) / 1000.0;
                items.push(Preset {
                    id: format!("{family}-{}-{millis}ms", profile.to_lowercase()),
                    family: (*family).into(),
                    name: format!("{label} · {profile} · {seconds:.1} s / vaihe"),
                    profile: profile.into(), seconds,
                    script: steps.iter().map(|step| format!("{}: [{} {:.1}s]",profile.to_uppercase(),step,seconds)).collect::<Vec<_>>().join("\n"),
                });
            }
        }
    }
    items
}

/// Append only a known asset recipe. Existing text and line endings are preserved.
pub fn append_checked(source: &str, preset: &Preset) -> Result<String, String> {
    if !catalog().iter().any(|known| known == preset) {
        return Err("Liikeaineisto ei kuulu tarkistettuun kirjastoon.".into());
    }
    if !source.is_empty() && !hs_script::parse(source).is_assemblable() {
        return Err("Korjaa nykyisen käsikirjoituksen virheet ennen liikkeen lisäämistä.".into());
    }
    let ending = if source.contains("\r\n") { "\r\n" } else { "\n" };
    let separator = if source.is_empty() || source.ends_with('\n') { "" } else { ending };
    let next = format!("{source}{separator}{}",preset.script.replace('\n',ending));
    if next.chars().count() > hs_script::MAX_SCRIPT_CHARS {
        return Err("Käsikirjoituksen kokoraja ylittyisi.".into());
    }
    let plan = hs_script::parse(&next);
    if !plan.is_assemblable() {
        return Err(plan.diagnostics.iter().filter(|d|d.severity==hs_core::Severity::Error).map(|d|d.message.as_str()).collect::<Vec<_>>().join(" "));
    }
    Ok(next)
}
