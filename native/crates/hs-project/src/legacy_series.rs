//! Checked, lossless reader for the removed studio's `.sarja` container.
//! This module does not invent native scripts, avatars or synthesized voices.
use crate::{invalid, ProjectError, MAX_BYTES};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::{Cursor, Read},
};

pub const MAX_EPISODES: usize = 5;
const MAX_MANIFEST: u64 = 10_000;

#[derive(Clone, Debug)]
pub struct LegacySeries {
    /// Stable content-derived ID; repeated imports of identical bytes agree.
    pub id: String,
    /// Original container, including metadata and ZIP encoding, unmodified.
    pub source: Vec<u8>,
    /// Manifest order, independent of physical ZIP entry order.
    pub episodes: Vec<LegacyEpisode>,
}
#[derive(Clone, Debug)]
pub struct LegacyEpisode {
    pub id: String,
    pub number: u32,
    pub name: String,
    /// Original `.hahmo`, never rewritten or interpreted as a Rust script.
    pub bytes: Vec<u8>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    format: String,
    version: u32,
    episodes: Vec<Metadata>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Metadata {
    name: String,
}

/// Read a legacy container. ZIP CRCs are checked while reading every entry.
/// `.hahmo` content must additionally be validated by the legacy project reader
/// before converting or presenting its contents; this is container validation.
pub fn decode(bytes: &[u8]) -> Result<LegacySeries, ProjectError> {
    if bytes.len() > MAX_BYTES {
        return Err(invalid("legacy series archive size limit"));
    }
    // zip::ZipArchive indexes entries by name, so duplicate central-directory
    // names can disappear from len()/by_index(). Compare the original ZIP32
    // count as well. The legacy writer emits single-disk ZIP32, never ZIP64.
    let end = bytes
        .windows(4)
        .rposition(|v| v == b"PK\x05\x06")
        .ok_or_else(|| invalid("legacy series ZIP end record missing"))?;
    if bytes.len().saturating_sub(end) < 22 {
        return Err(invalid("truncated legacy series ZIP end record"));
    }
    let u16_at = |offset: usize| u16::from_le_bytes([bytes[end + offset], bytes[end + offset + 1]]);
    let count = u16_at(10) as usize;
    if u16_at(4) != 0
        || u16_at(6) != 0
        || u16_at(8) as usize != count
        || count == 0
        || count > MAX_EPISODES + 1
        || end + 22 + u16_at(20) as usize != bytes.len()
    {
        return Err(invalid("legacy series ZIP disk, count or trailing bytes"));
    }
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))?;
    if archive.len() != count {
        return Err(invalid("duplicate legacy series central-directory entry"));
    }
    if archive.is_empty() || archive.len() > MAX_EPISODES + 1 {
        return Err(invalid("legacy series entry count"));
    }
    let mut entries = BTreeMap::new();
    let mut total = 0u64;
    for index in 0..archive.len() {
        let mut file = archive.by_index(index)?;
        let name = file.name().to_owned();
        let episode = (0..MAX_EPISODES).any(|n| name == format!("episodes/{n}.hahmo"));
        if !(name == "series.json" || episode)
            || file.is_dir()
            || file
                .unix_mode()
                .is_some_and(|mode| mode & 0o170000 == 0o120000)
            || entries.contains_key(&name)
        {
            return Err(invalid(
                "unsafe, duplicate or unexpected legacy series entry",
            ));
        }
        let size = file.size();
        total = total
            .checked_add(size)
            .filter(|v| *v <= MAX_BYTES as u64)
            .ok_or_else(|| invalid("expanded legacy series size limit"))?;
        if name == "series.json" && size > MAX_MANIFEST {
            return Err(invalid("legacy series manifest size limit"));
        }
        let mut content = Vec::new();
        file.by_ref().take(size + 1).read_to_end(&mut content)?;
        if content.len() as u64 != size {
            return Err(invalid("legacy series entry size mismatch"));
        }
        entries.insert(name, content);
    }
    let manifest_bytes = entries
        .remove("series.json")
        .ok_or_else(|| invalid("legacy series manifest missing"))?;
    let manifest: Manifest = serde_json::from_slice(&manifest_bytes)?;
    if manifest.format != "hahmostudio-series"
        || manifest.version != 1
        || manifest.episodes.is_empty()
        || manifest.episodes.len() > MAX_EPISODES
    {
        return Err(invalid("legacy series format, version or episode count"));
    }
    let digest = format!("{:x}", Sha256::digest(bytes));
    let id = format!("legacy-{digest}");
    let mut episodes = Vec::new();
    for (index, metadata) in manifest.episodes.into_iter().enumerate() {
        // Old writer truncated to 256 UTF-16 code units. Accept Unicode scalars
        // conservatively up to 256 (and bound bytes) without changing names.
        if metadata.name.chars().count() > 256 || metadata.name.len() > 1024 {
            return Err(invalid("legacy episode name length"));
        }
        let bytes = entries
            .remove(&format!("episodes/{index}.hahmo"))
            .ok_or_else(|| invalid("legacy series episode missing"))?;
        if bytes.is_empty() {
            return Err(invalid("empty legacy episode"));
        }
        episodes.push(LegacyEpisode {
            id: format!("{id}-{index}"),
            number: index as u32 + 1,
            name: metadata.name,
            bytes,
        });
    }
    if !entries.is_empty() {
        return Err(invalid("unreferenced legacy series episode"));
    }
    Ok(LegacySeries {
        id,
        source: bytes.to_vec(),
        episodes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    fn archive(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name, bytes) in files {
            zip.start_file(
                *name,
                zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored),
            )
            .unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }
    const TWO: &[u8] = br#"{"format":"hahmostudio-series","version":1,"episodes":[{"name":"Pilot"},{"name":"Second"}]}"#;
    const ONE: &[u8] =
        br#"{"format":"hahmostudio-series","version":1,"episodes":[{"name":"Pilot"}]}"#;
    #[test]
    fn imports_preserved_five_episode_sample() {
        let bytes = include_bytes!("../../../../Esimerkki-viisi-jaksoa.sarja");
        let series = decode(bytes).unwrap();
        assert_eq!(series.episodes.len(), 5);
        assert_eq!(series.source.as_slice(), bytes.as_slice());
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        for (index, episode) in series.episodes.iter().enumerate() {
            let mut original = Vec::new();
            archive
                .by_name(&format!("episodes/{index}.hahmo"))
                .unwrap()
                .read_to_end(&mut original)
                .unwrap();
            assert_eq!(episode.bytes, original);
            assert_eq!(episode.number, index as u32 + 1);
        }
    }
    #[test]
    fn exact_bytes_order_names_and_ids_survive_repeated_import() {
        let bytes = archive(&[
            ("episodes/1.hahmo", b"second"),
            ("series.json", TWO),
            ("episodes/0.hahmo", b"first"),
        ]);
        let a = decode(&bytes).unwrap();
        let b = decode(&bytes).unwrap();
        assert_eq!(a.source, bytes);
        assert_eq!(a.id, b.id);
        assert_eq!(a.episodes[0].bytes, b"first");
        assert_eq!(a.episodes[1].bytes, b"second");
        assert_eq!(a.episodes[0].name, "Pilot");
        assert_eq!(a.episodes[1].number, 2);
        assert_ne!(a.episodes[0].id, a.episodes[1].id);
    }
    #[test]
    fn rejects_missing_extra_traversal_duplicate_and_empty_episodes() {
        for files in [
            vec![("series.json", ONE)],
            vec![
                ("series.json", ONE),
                ("episodes/0.hahmo", b"x"),
                ("episodes/1.hahmo", b"x"),
            ],
            vec![("series.json", ONE), ("../episodes/0.hahmo", b"x")],
            vec![("series.json", ONE), ("episodes/0.hahmo", b"")],
        ] {
            assert!(decode(&archive(&files)).is_err());
        }
        // The ZIP writer disallows duplicate names; forge a second distinct
        // same-length entry name in central/local headers to exercise reader.
        let mut duplicate = archive(&[
            ("series.json", ONE),
            ("episodes/0.hahmo", b"x"),
            ("episodes/1.hahmo", b"y"),
        ]);
        let from = b"episodes/1.hahmo";
        let to = b"episodes/0.hahmo";
        for index in 0..duplicate.len() - from.len() {
            if &duplicate[index..index + from.len()] == from {
                duplicate[index..index + from.len()].copy_from_slice(to);
            }
        }
        assert!(decode(&duplicate).is_err());
    }
    #[test]
    fn rejects_bad_manifest_versions_and_corrupted_crc() {
        for manifest in [
            br#"{"format":"other","version":1,"episodes":[{"name":"Pilot"}]}"#.as_slice(),
            br#"{"format":"hahmostudio-series","version":2,"episodes":[{"name":"Pilot"}]}"#,
            br#"{"format":"hahmostudio-series","version":1,"episodes":[]}"#,
        ] {
            assert!(decode(&archive(&[
                ("series.json", manifest),
                ("episodes/0.hahmo", b"x")
            ]))
            .is_err());
        }
        let mut bytes = archive(&[
            ("series.json", ONE),
            ("episodes/0.hahmo", b"unique payload"),
        ]);
        let position = bytes
            .windows(14)
            .position(|window| window == b"unique payload")
            .unwrap();
        bytes[position] ^= 1;
        assert!(decode(&bytes).is_err());
    }
}
