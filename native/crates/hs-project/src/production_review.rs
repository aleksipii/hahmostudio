//! Local editorial review. An approval records a user's decision, never a render-quality certificate.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

const MAX_ITEMS: usize = 2048;
const MAX_TEXT: usize = 8192;
const MAX_JSON: usize = 4 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceAnchor {
    /// One-based line at creation; do not silently reattach a comment to different text.
    pub line: usize,
    pub excerpt: String,
}
impl SourceAnchor {
    pub fn from_line(source: &str, line: usize) -> Result<Self, String> {
        let excerpt = source
            .lines()
            .nth(line.checked_sub(1).ok_or("Rivinumero alkaa yhdestä")?)
            .ok_or("Lähderiviä ei ole")?;
        if excerpt.len() > MAX_TEXT {
            return Err("Lähderivi on liian pitkä".into());
        }
        Ok(Self {
            line,
            excerpt: excerpt.into(),
        })
    }
    pub fn is_current(&self, source: &str) -> bool {
        self.line > 0 && source.lines().nth(self.line - 1) == Some(self.excerpt.as_str())
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewComment {
    pub id: u64,
    pub text: String,
    pub anchor: Option<SourceAnchor>,
    pub resolved: bool,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewTask {
    pub id: u64,
    pub text: String,
    pub done: bool,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Approval {
    pub content_hash: String,
    pub reviewer: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ReviewState {
    pub comments: Vec<ReviewComment>,
    pub tasks: Vec<ReviewTask>,
    pub approval: Option<Approval>,
    pub locked: bool,
    pub content_hash: String,
    pub next_id: u64,
}
impl Default for ReviewState {
    fn default() -> Self {
        Self {
            comments: vec![],
            tasks: vec![],
            approval: None,
            locked: false,
            content_hash: String::new(),
            next_id: 1,
        }
    }
}
/// Hash exact canonical episode bytes supplied by the integration layer. Include all artistic content,
/// audio resource IDs/checksums and export settings; exclude ReviewState itself and derived caches.
pub fn fingerprint(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
/// Exact artistic episode fingerprint, independent of resource ordering and review metadata.
/// PCM is hashed by its original f32 bits; no compression, resampling or giant archive allocation.
pub fn episode_fingerprint(episode: &crate::Episode) -> Result<String, String> {
    fn part(hash: &mut Sha256, bytes: &[u8]) {
        hash.update((bytes.len() as u64).to_le_bytes());
        hash.update(bytes);
    }
    let mut hash = Sha256::new();
    part(&mut hash, b"koeta-editorial-content-v1");
    let metadata = serde_json::to_vec(&(
        &episode.id,
        episode.number,
        &episode.name,
        &episode.script,
        &episode.cast,
        episode.fps,
        episode.width,
        episode.height,
        &episode.accepted_notices,
        &episode.captions,
        &episode.caption_settings,
    ))
    .map_err(|e| e.to_string())?;
    part(&mut hash, &metadata);
    let mut audio: Vec<_> = episode
        .audio
        .iter()
        .map(|a| {
            let key = serde_json::to_vec(&(&a.line_key, &a.source)).map_err(|e| e.to_string())?;
            Ok((key, a))
        })
        .collect::<Result<_, String>>()?;
    audio.sort_by(|a, b| a.0.cmp(&b.0));
    part(&mut hash, b"audio");
    hash.update((audio.len() as u64).to_le_bytes());
    for (key, binding) in audio {
        part(&mut hash, &key);
        part(
            &mut hash,
            &serde_json::to_vec(&(binding.speech.audio.sample_rate, &binding.speech.phonemes))
                .map_err(|e| e.to_string())?,
        );
        hash.update((binding.speech.audio.samples.len() as u64).to_le_bytes());
        for sample in &binding.speech.audio.samples {
            if !sample.is_finite() {
                return Err("Virheellinen ääninäyte hyväksyntätunnisteessa".into());
            }
            hash.update(sample.to_le_bytes());
        }
    }
    let mut assets: Vec<_> = episode
        .assets
        .iter()
        .filter(|a| a.kind != "review")
        .collect();
    assets.sort_by(|a, b| (&a.kind, &a.id).cmp(&(&b.kind, &b.id)));
    part(&mut hash, b"assets");
    hash.update((assets.len() as u64).to_le_bytes());
    for asset in assets {
        part(&mut hash, asset.kind.as_bytes());
        part(&mut hash, asset.id.as_bytes());
        part(&mut hash, &asset.bytes);
    }
    Ok(format!("{:x}", hash.finalize()))
}
fn valid_hash(hash: &str) -> bool {
    hash.len() == 64
        && hash
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn text(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > MAX_TEXT || value.contains('\0') {
        Err("Teksti on tyhjä, liian pitkä tai sisältää nollamerkin".into())
    } else {
        Ok(())
    }
}
impl ReviewState {
    pub fn validate(&self) -> Result<(), String> {
        if self.comments.len() + self.tasks.len() > MAX_ITEMS || self.next_id == 0 {
            return Err("Liikaa tarkistusmerkintöjä tai virheellinen tunniste".into());
        }
        if !self.content_hash.is_empty() && !valid_hash(&self.content_hash) {
            return Err("Virheellinen sisältötunniste".into());
        }
        let mut ids = BTreeSet::new();
        for c in &self.comments {
            text(&c.text)?;
            if let Some(a) = &c.anchor {
                if a.line == 0 || a.excerpt.len() > MAX_TEXT || a.excerpt.contains('\0') {
                    return Err("Virheellinen kommentin lähdeviite".into());
                }
            }
            if c.id == 0 || c.id >= self.next_id || !ids.insert(c.id) {
                return Err("Virheellinen kommenttitunniste".into());
            }
        }
        for t in &self.tasks {
            text(&t.text)?;
            if t.id == 0 || t.id >= self.next_id || !ids.insert(t.id) {
                return Err("Virheellinen tehtävätunniste".into());
            }
        }
        if let Some(a) = &self.approval {
            text(&a.reviewer)?;
            if !valid_hash(&a.content_hash)
                || a.content_hash != self.content_hash
                || self.has_open_items()
            {
                return Err(
                    "Hyväksyntä ei vastaa nykyistä sisältöä tai tarkistus on kesken".into(),
                );
            }
        }
        Ok(())
    }
    pub fn synchronize(&mut self, hash: &str) -> Result<bool, String> {
        if !valid_hash(hash) {
            return Err("Virheellinen sisältötunniste".into());
        }
        if self.content_hash == hash {
            return Ok(false);
        }
        self.content_hash = hash.into();
        self.approval = None;
        // Keep an existing lock explicit: changed external content requires manual unlocking.
        Ok(true)
    }
    pub fn has_open_items(&self) -> bool {
        self.comments.iter().any(|c| !c.resolved) || self.tasks.iter().any(|t| !t.done)
    }
    pub fn approved(&self) -> bool {
        self.validate().is_ok()
            && self
                .approval
                .as_ref()
                .is_some_and(|a| a.content_hash == self.content_hash)
    }
    pub fn ensure_editable(&self) -> Result<(), String> {
        self.validate()?;
        if self.locked {
            Err("Jakso on lukittu. Avaa lukitus ennen muokkaamista.".into())
        } else {
            Ok(())
        }
    }
    pub fn ensure_exportable(&self, hash: &str) -> Result<(), String> {
        self.validate()?;
        if !valid_hash(hash) || self.content_hash != hash {
            return Err("Jakson tarkistustila on vanhentunut".into());
        }
        if self.locked && !self.approved() {
            return Err(
                "Lukitun jakson hyväksyntä on vanhentunut. Avaa lukitus ja tarkista sisältö."
                    .into(),
            );
        }
        Ok(())
    }
    fn allocate(&mut self) -> Result<u64, String> {
        self.ensure_editable()?;
        if self.comments.len() + self.tasks.len() >= MAX_ITEMS {
            return Err("Liikaa tarkistusmerkintöjä".into());
        }
        let id = self.next_id;
        self.next_id = id.checked_add(1).ok_or("Tunnisteet loppuivat")?;
        self.approval = None;
        Ok(id)
    }
    pub fn add_comment(
        &mut self,
        value: &str,
        anchor: Option<SourceAnchor>,
    ) -> Result<u64, String> {
        text(value)?;
        if let Some(a) = &anchor {
            if a.line == 0 || a.excerpt.len() > MAX_TEXT || a.excerpt.contains('\0') {
                return Err("Virheellinen lähdeviite".into());
            }
        }
        let id = self.allocate()?;
        self.comments.push(ReviewComment {
            id,
            text: value.into(),
            anchor,
            resolved: false,
        });
        Ok(id)
    }
    pub fn add_task(&mut self, value: &str) -> Result<u64, String> {
        text(value)?;
        let id = self.allocate()?;
        self.tasks.push(ReviewTask {
            id,
            text: value.into(),
            done: false,
        });
        Ok(id)
    }
    pub fn resolve_comment(&mut self, id: u64, resolved: bool) -> Result<(), String> {
        self.ensure_editable()?;
        let c = self
            .comments
            .iter_mut()
            .find(|c| c.id == id)
            .ok_or("Kommenttia ei löydy")?;
        if c.resolved != resolved {
            c.resolved = resolved;
            self.approval = None;
        }
        Ok(())
    }
    pub fn complete_task(&mut self, id: u64, done: bool) -> Result<(), String> {
        self.ensure_editable()?;
        let t = self
            .tasks
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or("Tehtävää ei löydy")?;
        if t.done != done {
            t.done = done;
            self.approval = None;
        }
        Ok(())
    }
    pub fn approve(&mut self, reviewer: &str, hash: &str) -> Result<(), String> {
        self.ensure_editable()?;
        text(reviewer)?;
        if !valid_hash(hash) || self.content_hash != hash {
            return Err("Sisältö muuttui. Tarkista nykyinen versio.".into());
        }
        if self.has_open_items() {
            return Err("Ratkaise avoimet kommentit ja tehtävät ennen hyväksyntää.".into());
        }
        self.approval = Some(Approval {
            content_hash: hash.into(),
            reviewer: reviewer.into(),
        });
        Ok(())
    }
    pub fn set_locked(&mut self, locked: bool) -> Result<(), String> {
        self.validate()?;
        if locked && !self.approved() {
            return Err("Hyväksy nykyinen sisältö ennen lukitusta.".into());
        }
        self.locked = locked;
        Ok(())
    }
    pub fn encode(&self) -> Result<Vec<u8>, String> {
        self.validate()?;
        let bytes = serde_json::to_vec(self).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_JSON {
            return Err("Tarkistustiedosto on liian suuri".into());
        }
        Ok(bytes)
    }
    pub fn decode(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() > MAX_JSON {
            return Err("Tarkistustiedosto on liian suuri".into());
        }
        let state: Self = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        state.validate()?;
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn review_reopen_and_stale_lock() {
        let hash = fingerprint(b"exact episode with audio");
        let mut r = ReviewState::default();
        r.synchronize(&hash).unwrap();
        let c = r
            .add_comment(
                "Check hand contact",
                Some(SourceAnchor::from_line("KALLE: hello", 1).unwrap()),
            )
            .unwrap();
        let t = r.add_task("Listen to dialogue").unwrap();
        assert!(r.approve("Owner", &hash).is_err());
        r.resolve_comment(c, true).unwrap();
        r.complete_task(t, true).unwrap();
        r.approve("Owner", &hash).unwrap();
        r.set_locked(true).unwrap();
        let mut restored = ReviewState::decode(&r.encode().unwrap()).unwrap();
        assert_eq!(restored, r);
        assert!(restored.ensure_editable().is_err());
        assert!(restored.ensure_exportable(&hash).is_ok());
        assert!(restored.add_task("Sneak an edit").is_err());
        let changed = fingerprint(b"changed resource");
        restored.synchronize(&changed).unwrap();
        assert!(!restored.approved());
        assert!(restored.locked);
        assert!(restored.ensure_exportable(&changed).is_err());
        restored.set_locked(false).unwrap();
        restored.ensure_editable().unwrap();
        assert!(restored.ensure_exportable(&changed).is_ok());
    }
    #[test]
    fn invalid_review_never_accepts_approval() {
        let mut r = ReviewState::default();
        let h = fingerprint(b"episode");
        r.synchronize(&h).unwrap();
        assert!(r.synchronize("wrong").is_err());
        assert!(r.add_task(" ").is_err());
        assert!(r.set_locked(true).is_err());
        assert!(r.approve("Owner", &fingerprint(b"other")).is_err());
        let id = r.add_task("Task").unwrap();
        r.complete_task(id, true).unwrap();
        r.approve("Owner", &h).unwrap();
        r.complete_task(id, false).unwrap();
        assert!(!r.approved());
        r.tasks.push(r.tasks[0].clone());
        assert!(r.validate().is_err());
        assert!(r.encode().is_err());
        assert!(ReviewState::decode(br#"{"next_id":0}"#).is_err());
    }
    #[test]
    fn fingerprint_tracks_artistic_resources_but_not_review() {
        let mut e = crate::Episode {
            id: "episode".into(),
            number: 1,
            name: "Pilot".into(),
            script: "KALLE: Hello".into(),
            cast: vec![],
            fps: 30,
            width: 160,
            height: 90,
            accepted_notices: Default::default(),
            audio: vec![crate::AudioBinding {
                line_key: "line".into(),
                source: crate::AudioSource::Own,
                speech: hs_voice::Speech {
                    phonemes: None,
                    audio: hs_voice::Audio {
                        sample_rate: 24000,
                        samples: vec![0.1, 0.2],
                    },
                },
            }],
            captions: vec![],
            caption_settings: Default::default(),
            assets: vec![
                crate::ProjectAsset {
                    id: "pose".into(),
                    kind: "pose".into(),
                    bytes: vec![1, 2],
                },
                crate::ProjectAsset {
                    id: "image".into(),
                    kind: "image".into(),
                    bytes: vec![3, 4],
                },
            ],
        };
        let initial = episode_fingerprint(&e).unwrap();
        e.assets.reverse();
        assert_eq!(initial, episode_fingerprint(&e).unwrap());
        e.assets.push(crate::ProjectAsset {
            id: "production-review".into(),
            kind: "review".into(),
            bytes: vec![9],
        });
        assert_eq!(initial, episode_fingerprint(&e).unwrap());
        e.audio[0].speech.audio.samples[0] = 0.3;
        assert_ne!(initial, episode_fingerprint(&e).unwrap());
        let audio_hash = episode_fingerprint(&e).unwrap();
        e.assets[0].bytes[0] = 8;
        assert_ne!(audio_hash, episode_fingerprint(&e).unwrap());
        e.audio[0].speech.audio.samples[0] = f32::NAN;
        assert!(episode_fingerprint(&e).is_err());
    }
    #[test]
    fn source_binding_is_not_silently_reassigned() {
        let a = SourceAnchor::from_line("KALLE: Hello\nMAIJA: Hi", 2).unwrap();
        assert!(a.is_current("KALLE: Hello\nMAIJA: Hi"));
        assert!(!a.is_current("KALLE: Hello\nMAIJA: Goodbye"));
        assert!(SourceAnchor::from_line("hello", 0).is_err());
    }
}
