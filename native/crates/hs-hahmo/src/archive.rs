//! Lossless legacy archives and portable undo history. No extracted files are written to disk.
use super::{HahmoError, Project, MAX_ARCHIVE_BYTES};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashSet},
    io::{Cursor, Read, Write},
    path::Path,
};
const MANIFEST: &str = "resource-manifest.json";
fn invalid(message: impl Into<String>) -> HahmoError {
    HahmoError::Invalid(message.into())
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn safe_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 2000
        && !path.contains(['\\', '\0', ':'])
        && !path.starts_with('/')
        && path
            .split('/')
            .all(|p| !p.is_empty() && p != "." && p != "..")
}
pub(super) fn unpack(bytes: &[u8]) -> Result<BTreeMap<String, Vec<u8>>, HahmoError> {
    if bytes.len() as u64 > MAX_ARCHIVE_BYTES {
        return Err(HahmoError::TooLarge("arkisto yli 128 MiB".into()));
    }
    let mut zip =
        zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| HahmoError::Archive(e.to_string()))?;
    // zip-rs indexes names and can collapse duplicates. Compare with the physical
    // ZIP32 central-directory count before interpreting any entry.
    let end = bytes.len().saturating_sub(22);
    let eocd = (bytes.len().saturating_sub(65557)..=end)
        .rev()
        .find(|&i| {
            bytes.get(i..i + 4) == Some(b"PK\x05\x06")
                && bytes.get(i + 20..i + 22).is_some_and(|b| {
                    i + 22 + u16::from_le_bytes(b.try_into().unwrap()) as usize == bytes.len()
                })
        })
        .ok_or_else(|| invalid("ZIP-hakemisto puuttuu"))?;
    let disk = u16::from_le_bytes(bytes[eocd + 4..eocd + 6].try_into().unwrap());
    let directory_disk = u16::from_le_bytes(bytes[eocd + 6..eocd + 8].try_into().unwrap());
    let count_disk = u16::from_le_bytes(bytes[eocd + 8..eocd + 10].try_into().unwrap());
    let count = u16::from_le_bytes(bytes[eocd + 10..eocd + 12].try_into().unwrap());
    if disk != 0 || directory_disk != 0 || count_disk != count || count as usize != zip.len() {
        return Err(invalid("toistuva tai jaettu ZIP-hakemisto"));
    }
    if zip.len() > 10000 {
        return Err(HahmoError::TooLarge("yli 10000 resurssia".into()));
    }
    let mut files = BTreeMap::new();
    let mut total = 0u64;
    for i in 0..zip.len() {
        let file = zip
            .by_index(i)
            .map_err(|e| HahmoError::Archive(e.to_string()))?;
        let name = file.name().to_owned();
        if !safe_path(&name)
            || file.is_dir()
            || file.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000)
            || files.contains_key(&name)
        {
            return Err(invalid(format!(
                "turvaton tai toistuva resurssipolku: {name}"
            )));
        }
        total = total
            .checked_add(file.size())
            .ok_or_else(|| invalid("resurssikoon ylivuoto"))?;
        if total > MAX_ARCHIVE_BYTES {
            return Err(HahmoError::TooLarge("purettu arkisto yli 128 MiB".into()));
        }
        let limit = if name == "project.json" {
            10 * 1024 * 1024
        } else if name == MANIFEST {
            3 * 1024 * 1024
        } else {
            MAX_ARCHIVE_BYTES
        };
        if file.size() > limit {
            return Err(HahmoError::TooLarge(name));
        }
        let mut data = Vec::new();
        file.take(limit + 1)
            .read_to_end(&mut data)
            .map_err(|e| HahmoError::Archive(e.to_string()))?;
        if data.len() as u64 > limit {
            return Err(HahmoError::TooLarge(name));
        }
        files.insert(name, data);
    }
    verify_manifest(&files)?;
    Ok(files)
}
fn verify_manifest(files: &BTreeMap<String, Vec<u8>>) -> Result<(), HahmoError> {
    let Some(bytes) = files.get(MANIFEST) else {
        return Ok(());
    };
    let value: Value = serde_json::from_slice(bytes).map_err(|e| invalid(e.to_string()))?;
    let assets = value["assets"]
        .as_array()
        .filter(|a| a.len() <= 10000)
        .ok_or_else(|| invalid("manifestin resurssiluettelo"))?;
    if value["schemaVersion"] != 1 {
        return Err(invalid("manifestin versio"));
    }
    let mut seen = HashSet::new();
    for asset in assets {
        let path = asset["path"]
            .as_str()
            .ok_or_else(|| invalid("manifestin polku"))?;
        if path == MANIFEST || !safe_path(path) || !seen.insert(path) {
            return Err(invalid("manifestin resurssiviite"));
        }
        let data = files
            .get(path)
            .ok_or_else(|| invalid(format!("resurssi puuttuu: {path}")))?;
        if asset["size"].as_u64() != Some(data.len() as u64)
            || asset["sha256"].as_str() != Some(hash(data).as_str())
        {
            return Err(invalid(format!("resurssin tarkistussumma: {path}")));
        }
    }
    if files
        .keys()
        .any(|p| p != MANIFEST && !seen.contains(p.as_str()))
    {
        return Err(invalid("manifestiin kuulumaton resurssi"));
    }
    Ok(())
}
fn encode_files(mut files: BTreeMap<String, Vec<u8>>) -> Result<Vec<u8>, HahmoError> {
    files.remove(MANIFEST);
    let assets: Vec<Value> = files
        .iter()
        .map(|(path, bytes)| json!({"path":path,"size":bytes.len(),"sha256":hash(bytes)}))
        .collect();
    files.insert(
        MANIFEST.into(),
        serde_json::to_vec(&json!({"schemaVersion":1,"assets":assets}))
            .map_err(|e| invalid(e.to_string()))?,
    );
    if files.len() > 10000
        || files.values().map(|v| v.len() as u64).sum::<u64>() > MAX_ARCHIVE_BYTES
    {
        return Err(HahmoError::TooLarge("resurssit yli 128 MiB".into()));
    }
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (path, bytes) in files {
        if !safe_path(&path) {
            return Err(invalid("resurssipolku"));
        }
        zip.start_file(path, options)
            .map_err(|e| HahmoError::Archive(e.to_string()))?;
        zip.write_all(&bytes)
            .map_err(|e| HahmoError::Archive(e.to_string()))?;
    }
    let bytes = zip
        .finish()
        .map_err(|e| HahmoError::Archive(e.to_string()))?
        .into_inner();
    if bytes.len() as u64 > MAX_ARCHIVE_BYTES {
        return Err(HahmoError::TooLarge("arkisto yli 128 MiB".into()));
    }
    Ok(bytes)
}
pub(super) fn validate_metadata(
    metadata: &Value,
    files: &BTreeMap<String, Vec<u8>>,
) -> Result<(), HahmoError> {
    let data: super::ProjectJson =
        serde_json::from_value(metadata.clone()).map_err(|e| invalid(e.to_string()))?;
    let dimension = |n: f64| n.is_finite() && n >= 1.0 && n.fract() == 0.0 && n <= 16000000.0;
    if !dimension(data.document.width)
        || !dimension(data.document.height)
        || data.document.width * data.document.height > 16000000.0
        || data.document.name.len() > 256
    {
        return Err(invalid("dokumentin mitat tai nimi"));
    }
    let mut keys = HashSet::new();
    let mut stack: Vec<_> = data.document.layers.iter().map(|l| (l, 0usize)).collect();
    while let Some((layer, depth)) = stack.pop() {
        if depth > 64 || keys.len() >= 1000 {
            return Err(invalid("tasorakenteen raja"));
        }
        if layer.key.is_empty()
            || layer.key.len() > 2000
            || !keys.insert(layer.key.as_str())
            || !["group", "layer"].contains(&layer.kind.as_str())
            || ![
                layer.left,
                layer.top,
                layer.width,
                layer.height,
                layer.opacity,
            ]
            .iter()
            .all(|v| v.is_finite())
            || layer.width < 0.0
            || layer.height < 0.0
            || layer.width.fract() != 0.0
            || layer.height.fract() != 0.0
            || layer.width * layer.height > 16000000.0
            || !(0.0..=1.0).contains(&layer.opacity)
            || layer.left.abs() > 100000.0
            || layer.top.abs() > 100000.0
        {
            return Err(invalid("virheellinen tai toistuva taso-ID"));
        }
        if let Some(path) = &layer.image {
            let b = files
                .get(path)
                .ok_or_else(|| invalid(format!("tasokuva puuttuu: {path}")))?;
            if b.len() < 24
                || &b[..8] != b"\x89PNG\r\n\x1a\n"
                || &b[12..16] != b"IHDR"
                || f64::from(u32::from_be_bytes(b[16..20].try_into().unwrap())) != layer.width
                || f64::from(u32::from_be_bytes(b[20..24].try_into().unwrap())) != layer.height
            {
                return Err(invalid(format!("PNG:n mitat eivät täsmää: {path}")));
            }
        }
        stack.extend(layer.children.iter().map(|l| (l, depth + 1)));
    }
    if let Some(animation) = &data.animation {
        if !animation.fps.is_finite()
            || !(1.0..=120.0).contains(&animation.fps)
            || !animation.duration.is_finite()
            || !(1.0..=36000.0).contains(&animation.duration)
            || animation.duration.fract() != 0.0
            || animation.rig.parts.len() > 1000
            || animation.tracks.len() > 1000
        {
            return Err(invalid("animaation aikarajat"));
        }
        let mut parts = HashSet::new();
        for part in &animation.rig.parts {
            if !keys.contains(part.key.as_str())
                || !parts.insert(part.key.as_str())
                || !part.pivot.x.is_finite()
                || !part.pivot.y.is_finite()
            {
                return Err(invalid("rigin taso-ID tai pivot"));
            }
        }
        for part in &animation.rig.parts {
            if part
                .parent_key
                .as_ref()
                .is_some_and(|p| !parts.contains(p.as_str()))
            {
                return Err(invalid("rigin vanhempi puuttuu"));
            }
        }
        super::animation_transforms(animation, 0.0)?;
        let mut tracks = HashSet::new();
        for track in &animation.tracks {
            if !parts.contains(track.key.as_str())
                || !tracks.insert(track.key.as_str())
                || track.frames.len() > 36000
            {
                return Err(invalid("animaation raita-ID"));
            }
            let mut previous = -1.0;
            for frame in &track.frames {
                if ![
                    frame.frame,
                    frame.x,
                    frame.y,
                    frame.rotation,
                    frame.scale,
                    frame.opacity,
                ]
                .iter()
                .all(|n| n.is_finite())
                    || frame.frame <= previous
                    || frame.frame < 0.0
                    || frame.frame > animation.duration
                    || frame.scale <= 0.0
                    || frame.scale > 100.0
                    || !(0.0..=1.0).contains(&frame.opacity)
                    || !["linear", "smooth", "hold"].contains(&frame.easing.as_str())
                {
                    return Err(invalid("virheellinen avainruutu"));
                }
                if frame.bezier_curve.as_ref().is_some_and(|b| {
                    ![b.cp1.x, b.cp1.y, b.cp2.x, b.cp2.y]
                        .iter()
                        .all(|n| n.is_finite())
                        || !(0.0..=1.0).contains(&b.cp1.x)
                        || !(0.0..=1.0).contains(&b.cp2.x)
                }) {
                    return Err(invalid("Bezier-ohjauspiste"));
                }
                previous = frame.frame;
            }
        }
    }
    if let Some(scene) = &data.scene {
        if !dimension(scene.width)
            || !dimension(scene.height)
            || scene.width * scene.height > 16000000.0
            || ![scene.x, scene.y, scene.scale]
                .iter()
                .all(|n| n.is_finite())
            || scene.scale <= 0.0
            || scene.scale > 100.0
        {
            return Err(invalid("kohtauksen mitat"));
        }
    }
    // References in retained legacy metadata must resolve even when native rendering does not use them.
    fn refs(value: &Value, files: &BTreeMap<String, Vec<u8>>) -> Result<(), HahmoError> {
        match value {
            Value::Object(map) => {
                for (key, value) in map {
                    if ["image", "composite", "sourcePsd"].contains(&key.as_str()) {
                        if let Some(path) = value.as_str() {
                            if !safe_path(path) || !files.contains_key(path) {
                                return Err(invalid(format!("resurssi puuttuu: {path}")));
                            }
                        }
                    }
                    refs(value, files)?;
                }
            }
            Value::Array(values) => {
                for value in values {
                    refs(value, files)?;
                }
            }
            _ => (),
        }
        Ok(())
    }
    if let Some(path) = metadata["audio"]["path"].as_str() {
        if path != "audio/sound" || !files.contains_key(path) {
            return Err(invalid("jaksoääni puuttuu"));
        }
    }
    for (field, prefix) in [
        ("presentationResources", "cast/"),
        ("presentationAudio", "voices/"),
        ("presentationImages", "presentation-images/"),
    ] {
        if let Some(entries) = metadata.get(field) {
            let entries = entries
                .as_object()
                .ok_or_else(|| invalid("esityksen resurssiluettelo"))?;
            for (id, entry) in entries {
                if id.is_empty()
                    || id.len() > 100
                    || !id
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
                    || ["__proto__", "constructor", "prototype"].contains(&id.as_str())
                {
                    return Err(invalid("esityksen resurssi-ID"));
                }
                let path = if field == "presentationResources" {
                    entry.as_str()
                } else {
                    entry["path"].as_str()
                }
                .ok_or_else(|| invalid("esityksen resurssipolku"))?;
                let expected = if field == "presentationResources" {
                    format!("{prefix}{id}.hahmo")
                } else {
                    format!("{prefix}{id}")
                };
                if path != expected || !files.contains_key(path) {
                    return Err(invalid(format!("esityksen resurssi puuttuu: {path}")));
                }
            }
        }
    }
    refs(metadata, files)?;
    Ok(())
}
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PortableHistory {
    pub past: Vec<Vec<u8>>,
    pub future: Vec<Vec<u8>>,
}
impl Project {
    pub fn metadata(&self) -> &Value {
        &self.metadata
    }
    pub fn resources(&self) -> &BTreeMap<String, Vec<u8>> {
        &self.resources
    }
    pub fn original_archive(&self) -> &[u8] {
        &self.original
    }
    pub fn encode(&self) -> Result<Vec<u8>, HahmoError> {
        // The legacy fields remain public for existing viewers. Refuse silently
        // ignoring direct mutations; transactional metadata edits are authoritative.
        let stored: super::ProjectJson =
            serde_json::from_value(self.metadata.clone()).map_err(|e| invalid(e.to_string()))?;
        if self.version != stored.version
            || serde_json::to_value(&self.document).ok()
                != serde_json::to_value(&stored.document).ok()
            || serde_json::to_value(&self.animation).ok()
                != serde_json::to_value(&stored.animation).ok()
            || serde_json::to_value(&self.scene).ok() != serde_json::to_value(&stored.scene).ok()
        {
            return Err(invalid(
                "muuta projektia replace_metadata-rajapinnalla ennen tallennusta",
            ));
        }
        if !self.dirty {
            return Ok(self.original.clone());
        }
        encode_files(self.resources.clone())
    }
    /// Transactional replacement. Callers merge edits into metadata to preserve extensions.
    pub fn replace_metadata(&mut self, metadata: Value) -> Result<(), HahmoError> {
        let mut resources = self.resources.clone();
        resources.insert(
            "project.json".into(),
            serde_json::to_vec(&metadata).map_err(|e| invalid(e.to_string()))?,
        );
        let mut candidate = Project::open(&encode_files(resources)?)?;
        candidate.original = self.original.clone();
        candidate.dirty = true;
        *self = candidate;
        Ok(())
    }
    /// Replace a binary resource without changing stable references. The whole
    /// project is validated before the existing project is changed.
    pub fn replace_resource(&mut self, path: &str, bytes: Vec<u8>) -> Result<(), HahmoError> {
        if !safe_path(path)
            || path == "project.json"
            || path == MANIFEST
            || path == "history.json"
            || path.starts_with("history/")
        {
            return Err(invalid("suojattu tai turvaton resurssipolku"));
        }
        let mut files = self.resources.clone();
        files.insert(path.to_owned(), bytes);
        let mut candidate = Project::open(&encode_files(files)?)?;
        candidate.original = self.original.clone();
        candidate.dirty = true;
        *self = candidate;
        Ok(())
    }
    pub fn save_atomic(&self, path: impl AsRef<Path>) -> Result<(), HahmoError> {
        let bytes = self.encode()?;
        let path = path.as_ref();
        let mut temp = tempfile::NamedTempFile::new_in(
            path.parent()
                .filter(|p| !p.as_os_str().is_empty())
                .unwrap_or_else(|| Path::new(".")),
        )
        .map_err(|e| HahmoError::Archive(e.to_string()))?;
        temp.write_all(&bytes)
            .and_then(|_| temp.as_file().sync_all())
            .map_err(|e| HahmoError::Archive(e.to_string()))?;
        temp.persist(path)
            .map_err(|e| HahmoError::Archive(e.to_string()))?;
        Ok(())
    }
    pub fn history(&self) -> Result<Option<PortableHistory>, HahmoError> {
        let Some(bytes) = self.resources.get("history.json") else {
            return Ok(None);
        };
        if bytes.len() > 4 * 1024 * 1024 {
            return Err(invalid("historian hakemiston koko"));
        }
        let h: Value = serde_json::from_slice(bytes).map_err(|e| invalid(e.to_string()))?;
        let entries = h["entries"]
            .as_array()
            .filter(|a| a.len() <= 16)
            .ok_or_else(|| invalid("historian vedosluettelo"))?;
        let past = h["past"]
            .as_u64()
            .filter(|n| *n <= entries.len() as u64)
            .ok_or_else(|| invalid("historian past-raja"))? as usize;
        let version = h["version"]
            .as_u64()
            .filter(|v| [1, 2].contains(v))
            .ok_or_else(|| invalid("historian versio"))?;
        let mut snapshots = Vec::new();
        let mut expanded = 0u64;
        for (i, e) in entries.iter().enumerate() {
            let bytes = if version == 1 {
                let expected = format!("history/{i}.hahmo");
                if e["path"].as_str() != Some(expected.as_str()) {
                    return Err(invalid("historian vedospolku"));
                }
                self.resources
                    .get(&expected)
                    .cloned()
                    .ok_or_else(|| invalid("historian vedos puuttuu"))?
            } else {
                let size = e["size"]
                    .as_u64()
                    .filter(|s| *s > 0 && *s <= MAX_ARCHIVE_BYTES)
                    .ok_or_else(|| invalid("historian vedoskoko"))?;
                let chunks = e["chunks"]
                    .as_array()
                    .filter(|c| c.len() <= 8192)
                    .ok_or_else(|| invalid("historian palat"))?;
                let mut bytes = Vec::new();
                for chunk in chunks {
                    let digest = chunk["hash"]
                        .as_str()
                        .filter(|h| {
                            h.len() == 64
                                && h.bytes()
                                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                        })
                        .ok_or_else(|| invalid("historian palahash"))?;
                    let part = self
                        .resources
                        .get(&format!("history/pool/{digest}"))
                        .ok_or_else(|| invalid("historian pala puuttuu"))?;
                    if chunk["size"].as_u64() != Some(part.len() as u64)
                        || part.is_empty()
                        || part.len() > 65536
                        || hash(part) != digest
                        || bytes.len() as u64 + part.len() as u64 > size
                    {
                        return Err(invalid("historian pala vioittunut"));
                    }
                    bytes.extend_from_slice(part);
                }
                if bytes.len() as u64 != size {
                    return Err(invalid("historian pituus"));
                }
                bytes
            };
            expanded += bytes.len() as u64;
            if expanded > 384 * 1024 * 1024 {
                return Err(HahmoError::TooLarge("historia yli 384 MiB".into()));
            }
            if e["hash"].as_str() != Some(hash(&bytes).as_str()) {
                return Err(invalid("historian vedoshash"));
            }
            let inner = unpack(&bytes)?;
            if inner.contains_key("history.json") {
                return Err(invalid("sisäkkäinen historia"));
            }
            Project::open(&bytes)?;
            snapshots.push(bytes);
        }
        let future = snapshots.split_off(past);
        Ok(Some(PortableHistory {
            past: snapshots,
            future,
        }))
    }
    pub fn replace_history(&mut self, history: &PortableHistory) -> Result<(), HahmoError> {
        if history.past.len() + history.future.len() > 16 {
            return Err(invalid("yli 16 historiavedosta"));
        }
        let mut files = self.resources.clone();
        files.retain(|p, _| p != "history.json" && !p.starts_with("history/"));
        let mut entries = Vec::new();
        let mut expanded = 0u64;
        for bytes in history.past.iter().chain(&history.future) {
            expanded += bytes.len() as u64;
            if expanded > 384 * 1024 * 1024 {
                return Err(HahmoError::TooLarge("historia yli 384 MiB".into()));
            }
            let inner = unpack(bytes)?;
            if inner.contains_key("history.json") {
                return Err(invalid("sisäkkäinen historia"));
            }
            Project::open(bytes)?;
            let mut chunks = Vec::new();
            for part in bytes.chunks(65536) {
                let digest = hash(part);
                files
                    .entry(format!("history/pool/{digest}"))
                    .or_insert_with(|| part.to_vec());
                chunks.push(json!({"hash":digest,"size":part.len()}));
            }
            entries.push(json!({"size":bytes.len(),"hash":hash(bytes),"chunks":chunks}));
        }
        files.insert(
            "history.json".into(),
            serde_json::to_vec(&json!({"version":2,"past":history.past.len(),"entries":entries}))
                .map_err(|e| invalid(e.to_string()))?,
        );
        let mut candidate = Project::open(&encode_files(files)?)?;
        candidate.history()?;
        candidate.original = self.original.clone();
        candidate.dirty = true;
        *self = candidate;
        Ok(())
    }
}
