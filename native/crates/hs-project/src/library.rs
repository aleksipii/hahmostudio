//! Bounded portable series presets, independent of UI.
use serde::{Deserialize, Serialize};
#[derive(Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SeriesLibrary {
    pub cast: Vec<hs_character::CharacterParams>,
    pub worlds: Vec<WorldPreset>,
}
#[derive(Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorldPreset { pub name: String, pub source: String }
impl SeriesLibrary {
    pub fn decode(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() > 1024 * 1024 { return Err("Sarjakirjasto ylittää 1 MiB".into()); }
        let library: Self = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        if library.cast.len() > 64 || library.worlds.len() > 64 { return Err("Sarjakirjastossa on liikaa pohjia".into()); }
        let mut names = std::collections::HashSet::new();
        for c in &library.cast {
            if c.name.trim().is_empty() || c.name.len() > 256 { return Err("Hahmon nimi ei kelpaa".into()); }
            if !names.insert(c.name.to_lowercase()) { return Err("Sarjakirjaston hahmon nimi toistuu".into()); }
        }
        names.clear();
        for w in &library.worlds {
            if w.name.trim().is_empty() || w.name.len() > 256 || w.source.len() > 4096 || !names.insert(w.name.to_lowercase())
                {
                return Err("Maailmapohjan nimi tai ohjeet eivät kelpaa".into());
            }
        }
        Ok(library)
    }
    pub fn encode(&self) -> Result<Vec<u8>, String> {
        let bytes = serde_json::to_vec(self).map_err(|e| e.to_string())?;
        Self::decode(&bytes)?; Ok(bytes)
    }
}
