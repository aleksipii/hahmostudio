//! Koeta-sarja: siirrettävä sarjaprojekti kansiona.
//!
//! ```text
//! <Sarja>.koeta/
//!   sarja.json                      nimi, hahmot (ulkonäkö ja Kokoro-ääni), jaksoluettelo
//!   jaksot/<id>/jakso.json          käsikirjoitus, hyväksytyt huomautukset, äänet
//!   jaksot/<id>/aanet/<rivi>-<sha>.wav   käyttäjän omat äänitykset
//!   jaksot/<id>/puhe/<avain>.wav    tuotettu (synteettinen) puhe
//! ```
//!
//! Kaikki polut ovat suhteellisia, joten kansion voi siirtää. Äänitiedostot
//! nimetään sisällön tiivisteellä eikä olemassa olevaa tiedostoa koskaan
//! korvata toisella sisällöllä; tallennus ei myöskään poista vanhoja
//! äänitiedostoja. JSON kirjoitetaan väliaikaistiedostoon ja vaihdetaan
//! paikalleen. Avattaessa jokaisen äänen SHA-256 tarkistetaan; virheellinen
//! tai puuttuva ääni ohitetaan ja siitä kerrotaan, sitä ei hiljaa hyväksytä.

use hs_character::CharacterParams;
use hs_voice::{Audio, Speech};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

pub const SERIES_FORMAT: &str = "koeta-sarja";
pub const EPISODE_FORMAT: &str = "koeta-jakso";
pub const VERSION: u32 = 1;
pub const EXTENSION: &str = "koeta";
/// JSON-tiedostojen enimmäiskoko luettaessa.
pub const MAX_JSON_BYTES: u64 = 16 * 1024 * 1024;
/// Yksittäisen äänitiedoston enimmäiskoko.
pub const MAX_AUDIO_BYTES: u64 = 128 * 1024 * 1024;
pub const MAX_EPISODES: usize = 1000;
pub const MAX_AUDIO_ENTRIES: usize = 10_000;

#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("Sarjatiedosto ei kelpaa: {0}")]
    Invalid(String),
    #[error("Sarjan muoto on uudempi (versio {0}) kuin tämä Koeta osaa avata.")]
    TooNew(u32),
}

fn invalid(m: impl Into<String>) -> ProjectError {
    ProjectError::Invalid(m.into())
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EpisodeEntry {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SeriesManifest {
    pub format: String,
    pub version: u32,
    pub name: String,
    /// Sarjan hahmot ja niiden pysyvät Kokoro-äänet.
    #[serde(default)]
    pub cast: Vec<CharacterParams>,
    #[serde(default)]
    pub episodes: Vec<EpisodeEntry>,
}

/// Käyttäjän oma ääni rivin pysyvällä avaimella ([`hs_voice::spoken::line_key`]).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RecordingRef {
    pub line: String,
    pub file: String,
    pub sha256: String,
}

/// Tuotettu puhe välimuistiavaimella ([`hs_voice::spoken::cache_key`]): sama
/// teksti, ääni, nopeus ja malliversio löytää sen uudelleen ilman synteesiä.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SpeechRef {
    pub key: String,
    pub file: String,
    pub sha256: String,
    pub engine: String,
    pub voice: String,
    pub speed: f32,
    pub model_version: String,
    #[serde(default)]
    pub phonemes: Option<String>,
    /// Aina tosi: tuotettu puhe merkitään synteettiseksi.
    pub synthetic: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EpisodeManifest {
    pub format: String,
    pub version: u32,
    pub title: String,
    pub script: String,
    #[serde(default)]
    pub accepted_notices: BTreeSet<String>,
    #[serde(default)]
    pub recordings: Vec<RecordingRef>,
    #[serde(default)]
    pub speech: Vec<SpeechRef>,
}

/// Tallennettavan puheen alkuperä (välimuistiavain ja synteesiasetukset).
#[derive(Clone, Debug)]
pub struct GeneratedSpeech {
    pub key: String,
    pub engine: String,
    pub voice: String,
    pub speed: f32,
    pub model_version: String,
    pub speech: Arc<Speech>,
}

/// Jakson sisältö muistissa.
#[derive(Clone, Debug, Default)]
pub struct Episode {
    pub title: String,
    pub script: String,
    pub accepted_notices: BTreeSet<String>,
    /// Omat äänet rivin avaimen mukaan. Ne voittavat aina synteettisen puheen.
    pub own_audio: HashMap<String, Arc<Audio>>,
    pub speech: Vec<GeneratedSpeech>,
}

/// Avattu jakso ja avauksessa ohitetut tai korjattavat kohdat.
#[derive(Debug)]
pub struct LoadedEpisode {
    pub episode: Episode,
    /// Välimuistiin palautettava puhe (avain → puhe).
    pub speech_cache: HashMap<String, Arc<Speech>>,
    pub warnings: Vec<String>,
}

/// Avattu sarja levyllä.
#[derive(Clone, Debug)]
pub struct SeriesProject {
    pub root: PathBuf,
    pub manifest: SeriesManifest,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// Jakson tunniste kelpaa kansionimeksi: vain a–z, 0–9 ja `-`.
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Manifestin polku pysyy jakson kansion sisällä.
fn safe_relative(file: &str) -> Option<PathBuf> {
    let p = Path::new(file);
    if file.is_empty() || p.is_absolute() || file.contains('\\') {
        return None;
    }
    p.components().all(|c| matches!(c, Component::Normal(_))).then(|| p.to_path_buf())
}

fn read_limited(path: &Path, max: u64) -> Result<Vec<u8>, ProjectError> {
    use std::io::Read;
    let mut prefix=PathBuf::new();
    for component in path.components() {
        prefix.push(component.as_os_str());
        if std::fs::symlink_metadata(&prefix)?.file_type().is_symlink() {return Err(invalid("symlink in project path"));}
    }
    let metadata=std::fs::metadata(path)?;
    if !metadata.is_file() {return Err(invalid("project resource is not a regular file"));}
    let len = metadata.len();
    if len > max {
        return Err(invalid(format!("{} on liian suuri ({len} tavua).", path.display())));
    }
    let mut bytes=Vec::new();
    std::fs::File::open(path)?.take(max+1).read_to_end(&mut bytes)?;
    if bytes.len() as u64>max {return Err(invalid("project resource grew beyond bounds"));}
    Ok(bytes)
}

/// Kirjoittaa väliaikaistiedostoon ja vaihtaa sen paikalleen.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), ProjectError> {
    let dir = path.parent().ok_or_else(|| invalid("polulla ei ole kansiota"))?;
    std::fs::create_dir_all(dir)?;
    let tmp = dir.join(format!(".{}.tmp", path.file_name().and_then(|n| n.to_str()).unwrap_or("tiedosto")));
    {
        use std::io::Write;
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}

/// Kirjoittaa sisältöosoitteisen tiedoston. Olemassa oleva sama sisältö
/// kelpaa sellaisenaan; eri sisältöä ei koskaan kirjoiteta sen päälle.
fn write_content(path: &Path, bytes: &[u8], sha: &str) -> Result<(), ProjectError> {
    if path.exists() {
        let existing = read_limited(path, MAX_AUDIO_BYTES)?;
        if sha256_hex(&existing) == sha {
            return Ok(());
        }
        return Err(invalid(format!("{} on jo olemassa eri sisällöllä; sitä ei korvata.", path.display())));
    }
    write_atomic(path, bytes)
}

impl SeriesProject {
    /// Luo uuden sarjan tyhjään (tai olemattomaan) kansioon.
    pub fn create(root: impl Into<PathBuf>, name: &str, cast: Vec<CharacterParams>) -> Result<Self, ProjectError> {
        let root = root.into();
        if root.join("sarja.json").exists() {
            return Err(invalid(format!("{} sisältää jo sarjan; avaa se.", root.display())));
        }
        std::fs::create_dir_all(&root)?;
        let name = name.trim();
        let project = SeriesProject {
            root,
            manifest: SeriesManifest {
                format: SERIES_FORMAT.into(),
                version: VERSION,
                name: if name.is_empty() { "Nimetön sarja".into() } else { name.into() },
                cast,
                episodes: Vec::new(),
            },
        };
        project.write_manifest()?;
        Ok(project)
    }

    pub fn open(root: impl Into<PathBuf>) -> Result<Self, ProjectError> {
        let root = root.into();
        let bytes = read_limited(&root.join("sarja.json"), MAX_JSON_BYTES)?;
        let manifest: SeriesManifest = serde_json::from_slice(&bytes).map_err(|e| invalid(e.to_string()))?;
        if manifest.format != SERIES_FORMAT {
            return Err(invalid(format!("tuntematon muoto {}", manifest.format)));
        }
        if manifest.version > VERSION {
            return Err(ProjectError::TooNew(manifest.version));
        }
        if manifest.episodes.len() > MAX_EPISODES {
            return Err(invalid("liikaa jaksoja"));
        }
        let mut seen = BTreeSet::new();
        for e in &manifest.episodes {
            if !valid_id(&e.id) || !seen.insert(e.id.clone()) {
                return Err(invalid(format!("jakson tunniste {:?} ei kelpaa", e.id)));
            }
        }
        Ok(SeriesProject { root, manifest })
    }

    pub fn name(&self) -> &str {
        &self.manifest.name
    }

    fn write_manifest(&self) -> Result<(), ProjectError> {
        let json = serde_json::to_vec_pretty(&self.manifest).map_err(|e| invalid(e.to_string()))?;
        write_atomic(&self.root.join("sarja.json"), &json)
    }

    /// Tallentaa sarjan hahmot ja niiden äänivalinnat.
    pub fn save_cast(&mut self, cast: &[CharacterParams]) -> Result<(), ProjectError> {
        self.manifest.cast = cast.to_vec();
        self.write_manifest()
    }

    fn episode_dir(&self, id: &str) -> PathBuf {
        self.root.join("jaksot").join(id)
    }

    /// Lisää uuden jakson ja tallentaa sen. Palauttaa jakson tunnisteen.
    pub fn add_episode(&mut self, episode: &Episode) -> Result<String, ProjectError> {
        if self.manifest.episodes.len() >= MAX_EPISODES {
            return Err(invalid("liikaa jaksoja"));
        }
        let mut n = self.manifest.episodes.len() + 1;
        let id = loop {
            let id = format!("jakso-{n:03}");
            if !self.manifest.episodes.iter().any(|e| e.id == id) && !self.episode_dir(&id).exists() {
                break id;
            }
            n += 1;
        };
        self.manifest.episodes.push(EpisodeEntry { id: id.clone(), title: episode.title.clone() });
        self.save_episode(&id, episode)?;
        // Jakso kirjataan sarjaan vasta, kun sen tiedostot ovat levyllä.
        self.write_manifest()?;
        Ok(id)
    }

    /// Tallentaa jakson. Äänet kirjoitetaan ennen manifestia, joten keskeytynyt
    /// tallennus jättää edellisen jakson ehjäksi.
    pub fn save_episode(&mut self, id: &str, episode: &Episode) -> Result<(), ProjectError> {
        let entry_index = self.manifest.episodes.iter().position(|e| e.id == id).ok_or_else(|| invalid(format!("jaksoa {id} ei ole sarjassa")))?;
        let dir = self.episode_dir(id);
        let mut recordings = Vec::new();
        let mut keys: Vec<_> = episode.own_audio.keys().collect();
        keys.sort();
        for line in keys {
            if !valid_id(line) {
                return Err(invalid(format!("rivin avain {line:?} ei kelpaa")));
            }
            let bytes = hs_voice::wav::encode(&episode.own_audio[line]);
            let sha = sha256_hex(&bytes);
            let file = format!("aanet/{line}-{}.wav", &sha[..12]);
            write_content(&dir.join(&file), &bytes, &sha)?;
            recordings.push(RecordingRef { line: line.clone(), file, sha256: sha });
        }
        let mut speech = Vec::new();
        let mut seen = BTreeSet::new();
        for g in &episode.speech {
            if !valid_id(&g.key) || !seen.insert(g.key.clone()) {
                continue;
            }
            let bytes = hs_voice::wav::encode(&g.speech.audio);
            let sha = sha256_hex(&bytes);
            let file = format!("puhe/{}-{}.wav", g.key, &sha[..12]);
            write_content(&dir.join(&file), &bytes, &sha)?;
            speech.push(SpeechRef {
                key: g.key.clone(),
                file,
                sha256: sha,
                engine: g.engine.clone(),
                voice: g.voice.clone(),
                speed: g.speed,
                model_version: g.model_version.clone(),
                phonemes: g.speech.phonemes.clone(),
                synthetic: true,
            });
        }
        let manifest = EpisodeManifest {
            format: EPISODE_FORMAT.into(),
            version: VERSION,
            title: episode.title.clone(),
            script: episode.script.clone(),
            accepted_notices: episode.accepted_notices.clone(),
            recordings,
            speech,
        };
        let json = serde_json::to_vec_pretty(&manifest).map_err(|e| invalid(e.to_string()))?;
        write_atomic(&dir.join("jakso.json"), &json)?;
        if self.manifest.episodes[entry_index].title != episode.title {
            self.manifest.episodes[entry_index].title = episode.title.clone();
            self.write_manifest()?;
        }
        Ok(())
    }

    /// Avaa jakson. Käsikirjoitus ja asetukset ovat pakollisia; yksittäinen
    /// rikkinäinen tai puuttuva ääni ohitetaan varoituksella.
    pub fn load_episode(&self, id: &str) -> Result<LoadedEpisode, ProjectError> {
        if !self.manifest.episodes.iter().any(|e| e.id == id) {
            return Err(invalid(format!("jaksoa {id} ei ole sarjassa")));
        }
        let dir = self.episode_dir(id);
        let bytes = read_limited(&dir.join("jakso.json"), MAX_JSON_BYTES)?;
        let m: EpisodeManifest = serde_json::from_slice(&bytes).map_err(|e| invalid(e.to_string()))?;
        if m.format != EPISODE_FORMAT {
            return Err(invalid(format!("tuntematon jaksomuoto {}", m.format)));
        }
        if m.version > VERSION {
            return Err(ProjectError::TooNew(m.version));
        }
        if m.recordings.len() + m.speech.len() > MAX_AUDIO_ENTRIES {
            return Err(invalid("liikaa äänitiedostoja"));
        }
        // Preflight aggregate compressed PCM bytes before allocating decoded audio.
        let mut total_audio_bytes=0u64;
        for file in m.recordings.iter().map(|r|r.file.as_str()).chain(m.speech.iter().map(|s|s.file.as_str())) {
            if let Some(rel)=safe_relative(file) {
                if let Ok(metadata)=std::fs::metadata(dir.join(rel)) {
                    total_audio_bytes=total_audio_bytes.saturating_add(metadata.len());
                    if total_audio_bytes>32*1024*1024 {return Err(invalid("directory episode audio exceeds import budget"));}
                }
            }
        }
        let mut warnings = Vec::new();
        let read_audio = |file: &str, sha: &str, warnings: &mut Vec<String>| -> Option<Audio> {
            let Some(rel) = safe_relative(file) else {
                warnings.push(format!("Äänen polku {file:?} ei kelpaa; ääni ohitettiin."));
                return None;
            };
            let bytes = match read_limited(&dir.join(rel), MAX_AUDIO_BYTES) {
                Ok(b) => b,
                Err(e) => {
                    warnings.push(format!("Ääntä {file} ei voitu lukea: {e}"));
                    return None;
                }
            };
            if sha256_hex(&bytes) != sha {
                warnings.push(format!("Äänen {file} tarkistussumma ei täsmää; ääni ohitettiin."));
                return None;
            }
            match hs_voice::wav::decode(&bytes) {
                Ok(a) => Some(a),
                Err(e) => {
                    warnings.push(format!("Ääni {file} ei kelpaa: {e}"));
                    None
                }
            }
        };
        let mut own_audio = HashMap::new();
        for r in &m.recordings {
            if !valid_id(&r.line) {
                warnings.push(format!("Rivin avain {:?} ei kelpaa; äänitys ohitettiin.", r.line));
                continue;
            }
            if let Some(a) = read_audio(&r.file, &r.sha256, &mut warnings) {
                own_audio.insert(r.line.clone(), Arc::new(a));
            }
        }
        let mut speech = Vec::new();
        let mut speech_cache = HashMap::new();
        for s in &m.speech {
            if !valid_id(&s.key) {
                warnings.push(format!("Puheen avain {:?} ei kelpaa; puhe ohitettiin.", s.key));
                continue;
            }
            if let Some(a) = read_audio(&s.file, &s.sha256, &mut warnings) {
                let sp = Arc::new(Speech { audio: a, phonemes: s.phonemes.clone() });
                speech_cache.insert(s.key.clone(), sp.clone());
                speech.push(GeneratedSpeech {
                    key: s.key.clone(),
                    engine: s.engine.clone(),
                    voice: s.voice.clone(),
                    speed: s.speed,
                    model_version: s.model_version.clone(),
                    speech: sp,
                });
            }
        }
        Ok(LoadedEpisode {
            episode: Episode { title: m.title, script: m.script, accepted_notices: m.accepted_notices, own_audio, speech },
            speech_cache,
            warnings,
        })
    }
}

/// Tuotetut puheet, joita jakson rivit käyttävät, tallennusta varten.
pub fn speech_in_use(lines: &[crate::VoiceLine]) -> Vec<GeneratedSpeech> {
    let mut out: BTreeMap<String, GeneratedSpeech> = BTreeMap::new();
    for line in lines {
        let (Some(p), Some(speech)) = (&line.provenance, &line.speech) else { continue };
        if line.status == hs_voice::LineStatus::KeptOwnAudio {
            continue;
        }
        out.entry(p.key.clone()).or_insert_with(|| GeneratedSpeech {
            key: p.key.clone(),
            engine: p.engine.clone(),
            voice: p.voice.clone(),
            speed: p.speed,
            model_version: p.model_version.clone(),
            speech: speech.clone(),
        });
    }
    out.into_values().collect()
}

#[cfg(test)]
mod tests;
