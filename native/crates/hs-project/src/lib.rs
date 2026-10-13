//! Native `.koeta` series archives, independent of UI and legacy formats.
//! [`encode`]/[`decode`] preserve exact finite f32 mono samples, phonemes and
//! speech provenance. [`save_atomic`] verifies a complete temporary archive
//! before replacing its target. This is not a power-loss durability guarantee.
pub mod recovery;

use hs_character::CharacterParams;
use hs_subtitle::{CaptionCue, CaptionSettings};
use hs_voice::{Audio, Speech};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::{Cursor, Read, Write},
    path::Path,
};

pub const MAX_BYTES: usize = 128 * 1024 * 1024;
pub const MAX_ENTRIES: usize = 4096;
const MAX_MANIFEST: usize = 8 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    #[error("invalid Koeta project: {0}")]
    Invalid(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Zip(#[from] zip::result::ZipError),
}
fn invalid(message: impl Into<String>) -> ProjectError {
    ProjectError::Invalid(message.into())
}

#[derive(Clone, Debug)]
pub struct Series {
    pub id: String,
    pub name: String,
    pub episodes: Vec<Episode>,
}
#[derive(Clone, Debug)]
pub struct Episode {
    pub id: String,
    pub number: u32,
    pub name: String,
    pub script: String,
    pub cast: Vec<CharacterParams>,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub accepted_notices: BTreeSet<String>,
    pub audio: Vec<AudioBinding>,
    pub captions: Vec<CaptionCue>,
    pub caption_settings: CaptionSettings,
    pub assets: Vec<ProjectAsset>,
}
/// Opaque, checksummed episode resources. Consumers validate content before use.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProjectAsset {
    pub id: String,
    pub kind: String,
    pub bytes: Vec<u8>,
}
#[derive(Clone, Debug)]
pub struct AudioBinding {
    pub line_key: String,
    pub speech: Speech,
    pub source: AudioSource,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum AudioSource {
    Own,
    Synthesized {
        engine: String,
        voice: String,
        speed: f32,
        model_version: String,
        cache_key: String,
    },
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    format: String,
    version: u32,
    id: String,
    name: String,
    episodes: Vec<StoredEpisode>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredEpisode {
    id: String,
    number: u32,
    name: String,
    script: String,
    cast: Vec<CharacterParams>,
    fps: u32,
    width: u32,
    height: u32,
    accepted_notices: BTreeSet<String>,
    audio: Vec<StoredAudio>,
    #[serde(default)]
    captions: Vec<CaptionCue>,
    #[serde(default)]
    caption_settings: CaptionSettings,
    #[serde(default)]
    assets: Vec<StoredAsset>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredAsset {
    id: String,
    kind: String,
    path: String,
    sha256: String,
    bytes: usize,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredAudio {
    line_key: String,
    source: AudioSource,
    phonemes: Option<String>,
    path: String,
    sha256: String,
    sample_rate: u32,
    samples: usize,
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn id_valid(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn audio_valid(audio: &Audio) -> bool {
    (8000..=192000).contains(&audio.sample_rate)
        && audio.samples.len() <= audio.sample_rate as usize * 600
        && audio.samples.iter().all(|s| s.is_finite())
}
fn validate(series: &Series) -> Result<(), ProjectError> {
    if !id_valid(&series.id)
        || series.name.len() > 4096
        || series.episodes.is_empty()
        || series.episodes.len() > 1000
    {
        return Err(invalid("series ID or episode count"));
    }
    let mut ids = BTreeSet::new();
    let mut numbers = BTreeSet::new();
    let mut metadata_bytes = series.id.len().saturating_add(series.name.len());
    let bindings = series
        .episodes
        .iter()
        .try_fold(0usize, |n, e| {
            n.checked_add(e.audio.len())?.checked_add(e.assets.len())
        })
        .ok_or_else(|| invalid("entry count overflow"))?;
    if bindings + 1 > MAX_ENTRIES {
        return Err(invalid("entry count limit"));
    }
    for e in &series.episodes {
        if e.script.len() > MAX_MANIFEST || e.name.len() > 4096 || e.accepted_notices.len() > 10000
        {
            return Err(invalid("episode metadata bounds"));
        }
        if !id_valid(&e.id)
            || !ids.insert(&e.id)
            || e.number == 0
            || !numbers.insert(e.number)
            || !(1..=60).contains(&e.fps)
            || e.width == 0
            || e.height == 0
            || e.width > 4096
            || e.height > 4096
            || e.cast.len() > 100
        {
            return Err(invalid("episode ID, numbering, dimensions or cast count"));
        }
        metadata_bytes = metadata_bytes
            .saturating_add(e.id.len())
            .saturating_add(e.name.len())
            .saturating_add(e.script.len());
        for notice in &e.accepted_notices {
            metadata_bytes = metadata_bytes.saturating_add(notice.len());
        }
        for c in &e.cast {
            metadata_bytes = metadata_bytes
                .saturating_add(c.name.len())
                .saturating_add(c.voice.as_ref().map_or(0, |v| v.len()));
            if ![
                c.height,
                c.build,
                c.head_scale,
                c.leg_ratio,
                c.sleeve,
                c.trouser,
                c.face.eye_size,
                c.face.eye_spacing,
                c.face.mouth_width,
                c.face.nose_size,
                c.face.brow_thickness,
                c.extras.belly,
            ]
            .iter()
            .all(|v| v.is_finite())
            {
                return Err(invalid("non-finite character parameter"));
            }
        }
        hs_subtitle::validate_cues(&e.captions).map_err(|err| invalid(err.to_string()))?;
        let style = &e.caption_settings.style;
        if !style.font_height.is_finite()
            || !(0.02..=0.08).contains(&style.font_height)
            || !style.bottom_margin.is_finite()
            || !(0.02..=0.20).contains(&style.bottom_margin)
        {
            return Err(invalid("caption style bounds"));
        }
        for cue in &e.captions {
            metadata_bytes = metadata_bytes
                .saturating_add(cue.id.len())
                .saturating_add(cue.text.len())
                .saturating_add(cue.speaker.as_ref().map_or(0, |speaker| speaker.len()));
        }
        let mut asset_ids = BTreeSet::new();
        let mut asset_kinds = BTreeSet::new();
        for asset in &e.assets {
            if !id_valid(&asset.id)
                || !asset_ids.insert(&asset.id)
                || !matches!(asset.kind.as_str(), "image" | "editing" | "recordings")
                || !asset_kinds.insert(&asset.kind)
                || asset.bytes.len() > MAX_BYTES
            {
                return Err(invalid("asset ID, kind or size bounds"));
            }
            metadata_bytes = metadata_bytes
                .saturating_add(asset.id.len())
                .saturating_add(asset.kind.len());
        }
        let mut keys = BTreeSet::new();
        for a in &e.audio {
            metadata_bytes = metadata_bytes
                .saturating_add(a.line_key.len())
                .saturating_add(a.speech.phonemes.as_ref().map_or(0, |p| p.len()));
            if a.line_key.is_empty()
                || a.line_key.len() > 512
                || !keys.insert((&a.line_key, matches!(a.source, AudioSource::Own)))
                || !audio_valid(&a.speech.audio)
            {
                return Err(invalid("audio binding or sample bounds"));
            }
            if let AudioSource::Synthesized {
                engine,
                voice,
                speed,
                model_version,
                cache_key,
            } = &a.source
            {
                metadata_bytes = metadata_bytes
                    .saturating_add(engine.len())
                    .saturating_add(voice.len())
                    .saturating_add(model_version.len())
                    .saturating_add(cache_key.len());
                if engine.is_empty()
                    || voice.is_empty()
                    || model_version.is_empty()
                    || cache_key.is_empty()
                    || !speed.is_finite()
                    || !(0.1..=4.0).contains(speed)
                {
                    return Err(invalid("synthetic speech metadata"));
                }
            }
        }
    }
    if metadata_bytes > MAX_MANIFEST {
        return Err(invalid("manifest metadata limit"));
    }
    Ok(())
}

/// Serializes all episodes and bindings, including audio orphaned by script edits.
pub fn encode(series: &Series) -> Result<Vec<u8>, ProjectError> {
    validate(series)?;
    let mut resources = Vec::new();
    let mut total = 0usize;
    let mut episodes = Vec::new();
    for e in &series.episodes {
        let mut audio = Vec::new();
        for a in &e.audio {
            let path = format!("audio/{}.f32", resources.len());
            let len = a
                .speech
                .audio
                .samples
                .len()
                .checked_mul(4)
                .ok_or_else(|| invalid("sample overflow"))?;
            total = total
                .checked_add(len)
                .filter(|n| *n <= MAX_BYTES)
                .ok_or_else(|| invalid("archive size limit"))?;
            let mut bytes = Vec::with_capacity(len);
            for sample in &a.speech.audio.samples {
                bytes.extend_from_slice(&sample.to_le_bytes());
            }
            audio.push(StoredAudio {
                line_key: a.line_key.clone(),
                source: a.source.clone(),
                phonemes: a.speech.phonemes.clone(),
                path: path.clone(),
                sha256: hash(&bytes),
                sample_rate: a.speech.audio.sample_rate,
                samples: a.speech.audio.samples.len(),
            });
            resources.push((path, bytes));
        }
        let mut assets = Vec::new();
        for asset in &e.assets {
            total = total
                .checked_add(asset.bytes.len())
                .filter(|n| *n <= MAX_BYTES)
                .ok_or_else(|| invalid("archive size limit"))?;
            let path = format!("assets/{}.bin", resources.len());
            assets.push(StoredAsset {
                id: asset.id.clone(),
                kind: asset.kind.clone(),
                path: path.clone(),
                sha256: hash(&asset.bytes),
                bytes: asset.bytes.len(),
            });
            resources.push((path, asset.bytes.clone()));
        }
        episodes.push(StoredEpisode {
            id: e.id.clone(),
            number: e.number,
            name: e.name.clone(),
            script: e.script.clone(),
            cast: e.cast.clone(),
            fps: e.fps,
            width: e.width,
            height: e.height,
            accepted_notices: e.accepted_notices.clone(),
            audio,
            captions: e.captions.clone(),
            caption_settings: e.caption_settings.clone(),
            assets,
        });
    }
    if resources.len() + 1 > MAX_ENTRIES {
        return Err(invalid("entry count limit"));
    }
    let manifest = serde_json::to_vec(&Manifest {
        format: "koeta-series".into(),
        version: 2,
        id: series.id.clone(),
        name: series.name.clone(),
        episodes,
    })?;
    if manifest.len() > MAX_MANIFEST || total + manifest.len() > MAX_BYTES {
        return Err(invalid("manifest or archive size limit"));
    }
    let mut archive = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    archive.start_file("manifest.json", options)?;
    archive.write_all(&manifest)?;
    for (path, bytes) in resources {
        archive.start_file(path, options)?;
        archive.write_all(&bytes)?;
    }
    let bytes = archive.finish()?.into_inner();
    if bytes.len() > MAX_BYTES {
        return Err(invalid("archive size limit"));
    }
    Ok(bytes)
}

pub fn decode(bytes: &[u8]) -> Result<Series, ProjectError> {
    if bytes.len() > MAX_BYTES {
        return Err(invalid("archive size limit"));
    }
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes))?;
    if zip.len() > MAX_ENTRIES {
        return Err(invalid("entry count limit"));
    }
    let mut entries = BTreeMap::new();
    let mut total = 0u64;
    for index in 0..zip.len() {
        let mut file = zip.by_index(index)?;
        let name = file.name().to_owned();
        let valid = name == "manifest.json"
            || name
                .strip_prefix("audio/")
                .and_then(|s| s.strip_suffix(".f32"))
                .is_some_and(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()))
            || name
                .strip_prefix("assets/")
                .and_then(|s| s.strip_suffix(".bin"))
                .is_some_and(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()));
        if !valid || entries.contains_key(&name) || file.is_dir() {
            return Err(invalid("unsafe, duplicate or unexpected entry"));
        }
        total = total
            .checked_add(file.size())
            .filter(|n| *n <= MAX_BYTES as u64)
            .ok_or_else(|| invalid("expanded archive size limit"))?;
        if name == "manifest.json" && file.size() > MAX_MANIFEST as u64 {
            return Err(invalid("manifest size limit"));
        }
        let mut data = Vec::new();
        let size = file.size();
        file.by_ref().take(size + 1).read_to_end(&mut data)?;
        if data.len() as u64 != file.size() {
            return Err(invalid("entry size mismatch"));
        }
        entries.insert(name, data);
    }
    let manifest: Manifest = serde_json::from_slice(
        &entries
            .remove("manifest.json")
            .ok_or_else(|| invalid("missing manifest"))?,
    )?;
    if manifest.format != "koeta-series" || !(1..=2).contains(&manifest.version) {
        return Err(invalid("unsupported project version"));
    }
    let mut episodes = Vec::new();
    for e in manifest.episodes {
        if manifest.version == 1
            && (!e.captions.is_empty()
                || !e.assets.is_empty()
                || e.caption_settings != CaptionSettings::default())
        {
            return Err(invalid("version 1 project contains version 2 data"));
        }
        let mut audio = Vec::new();
        for a in e.audio {
            if !a.path.starts_with("audio/") {
                return Err(invalid("invalid audio resource path"));
            }
            let data = entries
                .remove(&a.path)
                .ok_or_else(|| invalid("missing or multiply bound audio"))?;
            if a.samples.checked_mul(4) != Some(data.len()) || hash(&data) != a.sha256 {
                return Err(invalid("audio length or checksum mismatch"));
            }
            if !(8000..=192000).contains(&a.sample_rate) || a.samples > a.sample_rate as usize * 600
            {
                return Err(invalid("audio sample bounds"));
            }
            // chunks_exact works with the workspace MSRV; as_chunks requires newer Rust.
            #[allow(clippy::chunks_exact_to_as_chunks)]
            let samples = data
                .chunks_exact(4)
                .map(|s| f32::from_le_bytes(s.try_into().unwrap()))
                .collect();
            audio.push(AudioBinding {
                line_key: a.line_key,
                source: a.source,
                speech: Speech {
                    audio: Audio {
                        samples,
                        sample_rate: a.sample_rate,
                    },
                    phonemes: a.phonemes,
                },
            });
        }
        let mut assets = Vec::new();
        for asset in e.assets {
            if !asset.path.starts_with("assets/") {
                return Err(invalid("invalid asset resource path"));
            }
            let data = entries
                .remove(&asset.path)
                .ok_or_else(|| invalid("missing or multiply bound asset"))?;
            if asset.bytes != data.len() || hash(&data) != asset.sha256 {
                return Err(invalid("asset length or checksum mismatch"));
            }
            assets.push(ProjectAsset {
                id: asset.id,
                kind: asset.kind,
                bytes: data,
            });
        }
        episodes.push(Episode {
            id: e.id,
            number: e.number,
            name: e.name,
            script: e.script,
            cast: e.cast,
            fps: e.fps,
            width: e.width,
            height: e.height,
            accepted_notices: e.accepted_notices,
            audio,
            captions: e.captions,
            caption_settings: e.caption_settings,
            assets,
        });
    }
    if !entries.is_empty() {
        return Err(invalid("unreferenced resources"));
    }
    let series = Series {
        id: manifest.id,
        name: manifest.name,
        episodes,
    };
    validate(&series)?;
    Ok(series)
}

pub fn load(path: &Path) -> Result<Series, ProjectError> {
    let file = fs::File::open(path)?;
    if file.metadata()?.len() > MAX_BYTES as u64 {
        return Err(invalid("archive size limit"));
    }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES as u64 + 1).read_to_end(&mut bytes)?;
    decode(&bytes)
}

/// A failed validation or write leaves the existing target intact.
pub fn save_atomic(path: &Path, series: &Series) -> Result<(), ProjectError> {
    let bytes = encode(series)?;
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temp = tempfile::NamedTempFile::new_in(parent)?;
    temp.write_all(&bytes)?;
    temp.as_file().sync_all()?;
    load(temp.path())?;
    temp.persist(path).map_err(|e| ProjectError::Io(e.error))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn series() -> Series {
        Series {
            id: "family".into(),
            name: "My series".into(),
            episodes: vec![Episode {
                id: "episode-1".into(),
                number: 1,
                name: "Hello".into(),
                script: "KALLE: Hello!".into(),
                cast: vec![CharacterParams::kalle()],
                fps: 30,
                width: 1920,
                height: 1080,
                accepted_notices: BTreeSet::from(["notice-1".into()]),
                captions: Vec::new(),
                caption_settings: CaptionSettings::default(),
                assets: Vec::new(),
                audio: vec![
                    AudioBinding {
                        line_key: "orphan-own-line".into(),
                        source: AudioSource::Own,
                        speech: Speech {
                            audio: Audio {
                                sample_rate: 24000,
                                samples: vec![0.12345678, -0.0000001, 0.0, -0.0, 1.2],
                            },
                            phonemes: None,
                        },
                    },
                    AudioBinding {
                        line_key: "hello-key".into(),
                        source: AudioSource::Synthesized {
                            engine: "kokoro".into(),
                            voice: "af_heart".into(),
                            speed: 1.0,
                            model_version: "82M".into(),
                            cache_key: "key".into(),
                        },
                        speech: Speech {
                            audio: Audio {
                                sample_rate: 24000,
                                samples: vec![-0.32123456, 0.5],
                            },
                            phonemes: Some("həˈləʊ".into()),
                        },
                    },
                ],
            }],
        }
    }
    fn rewrite(bytes: &[u8], change: impl Fn(&str, &mut Vec<u8>)) -> Vec<u8> {
        let mut input = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut output = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for i in 0..input.len() {
            let mut entry = input.by_index(i).unwrap();
            let name = entry.name().to_string();
            let mut data = Vec::new();
            entry.read_to_end(&mut data).unwrap();
            change(&name, &mut data);
            output
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            output.write_all(&data).unwrap();
        }
        output.finish().unwrap().into_inner()
    }
    #[test]
    fn roundtrip_preserves_exact_audio_orphans_provenance_and_domain() {
        let original = series();
        let loaded = decode(&encode(&original).unwrap()).unwrap();
        assert_eq!(loaded.id, original.id);
        assert_eq!(loaded.name, original.name);
        let e = &loaded.episodes[0];
        let source = &original.episodes[0];
        assert_eq!(e.id, source.id);
        assert_eq!(e.number, source.number);
        assert_eq!(e.name, source.name);
        assert_eq!(e.script, source.script);
        assert_eq!(e.cast, source.cast);
        assert_eq!(
            (e.fps, e.width, e.height),
            (source.fps, source.width, source.height)
        );
        assert_eq!(e.accepted_notices, source.accepted_notices);
        for (a, b) in e.audio.iter().zip(&source.audio) {
            assert_eq!(a.line_key, b.line_key);
            assert_eq!(a.source, b.source);
            assert_eq!(a.speech.phonemes, b.speech.phonemes);
            assert_eq!(a.speech.audio.sample_rate, b.speech.audio.sample_rate);
            assert_eq!(
                a.speech
                    .audio
                    .samples
                    .iter()
                    .map(|s| s.to_bits())
                    .collect::<Vec<_>>(),
                b.speech
                    .audio
                    .samples
                    .iter()
                    .map(|s| s.to_bits())
                    .collect::<Vec<_>>()
            );
        }
    }
    #[test]
    fn corrupted_audio_rejected_even_with_valid_zip_crc() {
        let bytes = encode(&series()).unwrap();
        let changed = rewrite(&bytes, |name, data| {
            if name == "audio/0.f32" {
                data[0] ^= 1;
            }
        });
        assert!(decode(&changed)
            .unwrap_err()
            .to_string()
            .contains("checksum"));
    }
    #[test]
    fn unknown_version_and_missing_resources_rejected() {
        let bytes = encode(&series()).unwrap();
        for (from, to) in [
            ("\"version\":2", "\"version\":3"),
            ("audio/0.f32", "audio/999.f32"),
        ] {
            let changed = rewrite(&bytes, |name, data| {
                if name == "manifest.json" {
                    *data = String::from_utf8(data.clone())
                        .unwrap()
                        .replace(from, to)
                        .into_bytes();
                }
            });
            assert!(decode(&changed).is_err());
        }
    }
    #[test]
    fn unexpected_and_unsafe_paths_rejected() {
        for name in [
            "../audio/0.f32",
            "audio/../0.f32",
            "/manifest.json",
            "audio/0.f32/",
            "extra.txt",
        ] {
            let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
            zip.start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            zip.write_all(b"x").unwrap();
            assert!(decode(&zip.finish().unwrap().into_inner()).is_err());
        }
    }
    #[test]
    fn invalid_values_cannot_replace_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("episode.koeta");
        let original = series();
        save_atomic(&path, &original).unwrap();
        let before = fs::read(&path).unwrap();
        for invalid_sample in [f32::NAN, f32::INFINITY] {
            let mut bad = original.clone();
            bad.episodes[0].audio[0].speech.audio.samples[0] = invalid_sample;
            assert!(save_atomic(&path, &bad).is_err());
            assert_eq!(fs::read(&path).unwrap(), before);
        }
        assert_eq!(load(&path).unwrap().episodes[0].audio.len(), 2);
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn invalid_ids_and_duplicate_bindings_rejected() {
        let mut s = series();
        s.episodes.push(s.episodes[0].clone());
        assert!(encode(&s).is_err());
        let mut empty = series();
        empty.episodes.clear();
        assert!(encode(&empty).is_err());
        let mut s = series();
        s.id = "../series".into();
        assert!(encode(&s).is_err());
        let mut s = series();
        let duplicate = s.episodes[0].audio[0].clone();
        s.episodes[0].audio.push(duplicate);
        assert!(encode(&s).is_err());
    }
    #[test]
    fn truncated_duplicate_and_oversize_entries_rejected() {
        let bytes = encode(&series()).unwrap();
        for cut in [0, bytes.len() / 2, bytes.len() - 1] {
            assert!(decode(&bytes[..cut]).is_err());
        }
        let mut duplicate = bytes.clone();
        let needle = b"audio/1.f32";
        let replacement = b"audio/0.f32";
        for i in 0..duplicate.len() - needle.len() {
            if &duplicate[i..i + needle.len()] == needle {
                duplicate[i..i + needle.len()].copy_from_slice(replacement);
            }
        }
        assert!(decode(&duplicate).is_err());
        let mut oversize = bytes;
        let central = oversize
            .windows(4)
            .position(|w| w == b"PK\x01\x02")
            .unwrap();
        oversize[central + 24..central + 28].copy_from_slice(&(MAX_BYTES as u32 + 1).to_le_bytes());
        assert!(decode(&oversize).is_err());
    }
    #[test]
    fn nonfinite_character_and_failed_replacement_preserve_destination() {
        let mut s = series();
        s.episodes[0].cast[0].height = f32::NAN;
        assert!(encode(&s).is_err());
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("directory.koeta");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("keep"), b"user work").unwrap();
        assert!(save_atomic(&target, &series()).is_err());
        assert_eq!(fs::read(target.join("keep")).unwrap(), b"user work");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn original_synthetic_voice_survives_own_override_on_same_line() {
        let mut s = series();
        s.episodes[0].audio[0].line_key = "hello-key".into();
        let loaded = decode(&encode(&s).unwrap()).unwrap();
        let bindings = &loaded.episodes[0].audio;
        assert_eq!(bindings.len(), 2);
        assert_eq!(bindings[0].line_key, bindings[1].line_key);
        assert_eq!(bindings[0].source, AudioSource::Own);
        assert!(matches!(
            bindings[1].source,
            AudioSource::Synthesized { .. }
        ));
        let duplicate = s.episodes[0].audio[1].clone();
        s.episodes[0].audio.push(duplicate);
        assert!(encode(&s).is_err());
    }
    fn caption() -> CaptionCue {
        serde_json::from_value(serde_json::json!({
            "id":"hello-caption", "start":0, "end":705600000,
            "text":"Hello, café!", "speaker":"Kalle"
        }))
        .unwrap()
    }
    fn with_assets() -> Series {
        let mut s = series();
        let e = &mut s.episodes[0];
        e.captions = vec![caption()];
        e.caption_settings.enabled = false;
        e.caption_settings.style.bottom_margin = 0.15;
        e.assets = vec![
            ProjectAsset {
                id: "image-document".into(),
                kind: "image".into(),
                bytes: b"opaque image domain".to_vec(),
            },
            ProjectAsset {
                id: "editing-document".into(),
                kind: "editing".into(),
                bytes: b"opaque editing domain".to_vec(),
            },
            ProjectAsset {
                id: "recording-metadata".into(),
                kind: "recordings".into(),
                bytes: br#"{"version":1,"records":{}}"#.to_vec(),
            },
        ];
        s
    }
    #[test]
    fn version_two_captions_and_assets_preserve_audio() {
        let original = with_assets();
        let loaded = decode(&encode(&original).unwrap()).unwrap();
        let a = &original.episodes[0];
        let b = &loaded.episodes[0];
        assert_eq!(a.assets, b.assets);
        assert_eq!(a.captions, b.captions);
        assert_eq!(a.caption_settings, b.caption_settings);
        assert_eq!(a.audio.len(), b.audio.len());
        for (a, b) in a.audio.iter().zip(&b.audio) {
            assert_eq!(a.source, b.source);
            assert_eq!(a.speech.phonemes, b.speech.phonemes);
            assert_eq!(
                a.speech
                    .audio
                    .samples
                    .iter()
                    .map(|s| s.to_bits())
                    .collect::<Vec<_>>(),
                b.speech
                    .audio
                    .samples
                    .iter()
                    .map(|s| s.to_bits())
                    .collect::<Vec<_>>()
            );
        }
    }
    #[test]
    fn version_one_migrates_with_default_captions_and_assets() {
        let original = series();
        let v1 = rewrite(&encode(&original).unwrap(), |name, data| {
            if name == "manifest.json" {
                let mut manifest: serde_json::Value = serde_json::from_slice(data).unwrap();
                manifest["version"] = 1.into();
                for episode in manifest["episodes"].as_array_mut().unwrap() {
                    for field in ["captions", "caption_settings", "assets"] {
                        episode.as_object_mut().unwrap().remove(field);
                    }
                }
                *data = serde_json::to_vec(&manifest).unwrap();
            }
        });
        let migrated = decode(&v1).unwrap();
        let e = &migrated.episodes[0];
        assert!(e.assets.is_empty());
        assert!(e.captions.is_empty());
        assert_eq!(e.caption_settings, CaptionSettings::default());
        assert_eq!(
            e.audio[0].speech.audio,
            original.episodes[0].audio[0].speech.audio
        );
        let saved = encode(&migrated).unwrap();
        let mut archive = zip::ZipArchive::new(Cursor::new(saved)).unwrap();
        let mut manifest = String::new();
        archive
            .by_name("manifest.json")
            .unwrap()
            .read_to_string(&mut manifest)
            .unwrap();
        let manifest: serde_json::Value = serde_json::from_str(&manifest).unwrap();
        assert_eq!(manifest["version"], 2);
        assert_eq!(manifest["format"], "koeta-series");
    }
    #[test]
    fn corrupted_missing_and_cross_type_assets_are_rejected() {
        let bytes = encode(&with_assets()).unwrap();
        let corrupted = rewrite(&bytes, |name, data| {
            if name.starts_with("assets/") {
                data[0] ^= 1;
            }
        });
        assert!(decode(&corrupted)
            .unwrap_err()
            .to_string()
            .contains("checksum"));
        for field in ["path", "bytes"] {
            let changed = rewrite(&bytes, |name, data| {
                if name == "manifest.json" {
                    let mut manifest: serde_json::Value = serde_json::from_slice(data).unwrap();
                    let asset = &mut manifest["episodes"][0]["assets"][0];
                    asset[field] = if field == "path" {
                        "audio/0.f32".into()
                    } else {
                        999.into()
                    };
                    *data = serde_json::to_vec(&manifest).unwrap();
                }
            });
            assert!(decode(&changed).is_err());
        }
    }
    #[test]
    fn invalid_assets_captions_and_style_do_not_replace_project() {
        let original = with_assets();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("episode.koeta");
        save_atomic(&path, &original).unwrap();
        let before = fs::read(&path).unwrap();
        for case in 0..6 {
            let mut bad = original.clone();
            let e = &mut bad.episodes[0];
            match case {
                0 => {
                    let clone = e.assets[0].clone();
                    e.assets.push(clone);
                }
                1 => e.assets[0].id = "../unsafe".into(),
                2 => e.assets[0].kind = "unknown".into(),
                3 => e.caption_settings.style.font_height = f32::NAN,
                4 => e.caption_settings.style.bottom_margin = 0.9,
                _ => e.captions[0].end = e.captions[0].start,
            }
            assert!(save_atomic(&path, &bad).is_err());
            assert_eq!(fs::read(&path).unwrap(), before);
        }
    }
}
