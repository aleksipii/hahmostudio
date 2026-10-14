//! Bound ZIP indexing and prevent fallback into archives embedded in assets.
use crate::{invalid, ProjectError, MAX_ENTRIES};
use std::{
    cell::Cell,
    io::{self, Cursor, Read, Seek, SeekFrom},
    rc::Rc,
};

fn u16_at(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap())
}
fn u32_at(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}
fn u64_at(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap())
}

fn end_record(bytes: &[u8]) -> Result<usize, ProjectError> {
    let mut scan_budget = bytes.len();
    // Native archives must contain manifest.json, so an empty ZIP is never a
    // candidate. Trailing garbage and ordinary comments remain supported.
    for offset in (0..bytes.len().saturating_sub(21)).rev() {
        let header = &bytes[offset..offset + 22];
        if &header[..4] != b"PK\x05\x06"
            || offset
                .checked_add(22 + usize::from(u16_at(header, 20)))
                .map_or(true, |end| end > bytes.len())
        {
            continue;
        }
        let count = u16_at(header, 10);
        let disk_count = u16_at(header, 8);
        let directory_offset = u32_at(header, 16);
        let zip64 = count == u16::MAX
            || disk_count == u16::MAX
            || directory_offset == u32::MAX
            || u32_at(header, 12) == u32::MAX;
        if zip64 {
            let Some(locator_offset) = offset.checked_sub(20) else {
                continue;
            };
            let locator = &bytes[locator_offset..offset];
            if &locator[..4] != b"PK\x06\x07" {
                continue;
            }
            let record_offset = usize::try_from(u64_at(locator, 8))
                .map_err(|_| invalid("ZIP64 directory offset overflow"))?;
            let Some(record) = bytes.get(record_offset..).filter(|rest| rest.len() >= 56) else {
                return Err(invalid("truncated ZIP64 directory"));
            };
            if &record[..4] != b"PK\x06\x06" {
                return Err(invalid("unsupported relative ZIP64 directory"));
            }
            if u32_at(locator, 4) != 0
                || u32_at(locator, 16) != 1
                || u32_at(record, 16) != 0
                || u32_at(record, 20) != 0
            {
                return Err(invalid("multi-disk project archive"));
            }
            let count = u64_at(record, 32);
            if count > MAX_ENTRIES as u64 || u64_at(record, 24) > MAX_ENTRIES as u64 {
                return Err(invalid("entry count limit before ZIP indexing"));
            }
            let size = u64_at(record, 4);
            if count == 0 || size < 44 || size > bytes.len() as u64 {
                return Err(invalid("ZIP64 directory metadata size limit"));
            }
            return Ok(offset);
        }
        if count == 0 {
            continue;
        }
        let start = directory_offset as usize;
        if start >= offset {
            continue;
        }
        // Match upstream's offset detection (including prepended classic ZIPs).
        scan_budget = scan_budget
            .checked_sub(offset - start)
            .ok_or_else(|| invalid("ZIP directory search complexity limit"))?;
        if !bytes[start..offset]
            .windows(4)
            .any(|part| part == b"PK\x01\x02")
        {
            continue;
        }
        if count as usize > MAX_ENTRIES || disk_count as usize > MAX_ENTRIES {
            return Err(invalid("entry count limit before ZIP indexing"));
        }
        if u16_at(header, 4) != 0 || u16_at(header, 6) != 0 || disk_count != count {
            return Err(invalid("multi-disk project archive"));
        }
        return Ok(offset);
    }
    Err(invalid("missing nonempty ZIP directory"))
}

pub(crate) struct Reader<'a> {
    cursor: Cursor<&'a [u8]>,
    indexing: Rc<Cell<bool>>,
    end_offset: usize,
}
impl Read for Reader<'_> {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        let start = self.cursor.position() as usize;
        // zip 2 reads the fixed EOCD block in one 22-byte read. Reject attempts
        // to parse another end record while indexing, without changing bytes
        // in central/local headers, comments, or user payloads.
        if self.indexing.get()
            && output.len() == 22
            && start != self.end_offset
            && self
                .cursor
                .get_ref()
                .get(start..)
                .is_some_and(|tail| tail.starts_with(b"PK\x05\x06"))
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "project ZIP cannot fall back to another end record",
            ));
        }
        self.cursor.read(output)
    }
}
impl Seek for Reader<'_> {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        self.cursor.seek(position)
    }
}
pub(crate) fn open(bytes: &[u8]) -> Result<zip::ZipArchive<Reader<'_>>, ProjectError> {
    let end_offset = end_record(bytes)?;
    let indexing = Rc::new(Cell::new(true));
    let reader = Reader {
        cursor: Cursor::new(bytes),
        indexing: indexing.clone(),
        end_offset,
    };
    // The ZIP implementation can retry previous end records after malformed
    // metadata. During indexing only, refuse to parse those records so it cannot
    // allocate an embedded index. Reads always return original bytes unchanged.
    let archive = zip::ZipArchive::new(reader)?;
    indexing.set(false);
    Ok(archive)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};
    fn archive() -> Vec<u8> {
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        writer
            .start_file("manifest.json", zip::write::SimpleFileOptions::default())
            .unwrap();
        writer.write_all(b"{}").unwrap();
        writer.finish().unwrap().into_inner()
    }
    fn eocd(bytes: &[u8]) -> usize {
        bytes
            .windows(4)
            .rposition(|part| part == b"PK\x05\x06")
            .unwrap()
    }
    #[test]
    fn oversized_declared_index_rejected_even_with_incorrect_directory_size() {
        let mut bytes = archive();
        let offset = eocd(&bytes);
        for at in [8, 10] {
            bytes[offset + at..offset + at + 2].copy_from_slice(&50000u16.to_le_bytes());
        }
        // The upstream reader ignores this size when locating central headers.
        bytes[offset + 12..offset + 16].copy_from_slice(&0u32.to_le_bytes());
        assert!(crate::decode(&bytes)
            .unwrap_err()
            .to_string()
            .contains("before ZIP indexing"));
    }
    #[test]
    fn oversized_prepended_directory_cannot_bypass_count_bound() {
        let original = archive();
        let mut bytes = b"prepended container".to_vec();
        bytes.extend_from_slice(&original);
        let offset = eocd(&bytes);
        for at in [8, 10] {
            bytes[offset + at..offset + at + 2].copy_from_slice(&50000u16.to_le_bytes());
        }
        bytes[offset + 12..offset + 16].copy_from_slice(&0u32.to_le_bytes());
        assert!(crate::decode(&bytes)
            .unwrap_err()
            .to_string()
            .contains("before ZIP indexing"));
    }
    fn zip64(count: u64) -> Vec<u8> {
        let mut bytes = archive();
        let offset = eocd(&bytes);
        let end = bytes.split_off(offset);
        let mut record = [0u8; 56];
        record[..4].copy_from_slice(b"PK\x06\x06");
        record[4..12].copy_from_slice(&44u64.to_le_bytes());
        record[12..14].copy_from_slice(&45u16.to_le_bytes());
        record[14..16].copy_from_slice(&45u16.to_le_bytes());
        record[24..32].copy_from_slice(&count.to_le_bytes());
        record[32..40].copy_from_slice(&count.to_le_bytes());
        record[40..48].copy_from_slice(&(u32_at(&end, 12) as u64).to_le_bytes());
        record[48..56].copy_from_slice(&(u32_at(&end, 16) as u64).to_le_bytes());
        bytes.extend_from_slice(&record);
        let mut locator = [0u8; 20];
        locator[..4].copy_from_slice(b"PK\x06\x07");
        locator[8..16].copy_from_slice(&(offset as u64).to_le_bytes());
        locator[16..20].copy_from_slice(&1u32.to_le_bytes());
        bytes.extend_from_slice(&locator);
        let mut end = end;
        end[8..12].fill(255);
        end[12..20].fill(255);
        bytes.extend_from_slice(&end);
        bytes
    }
    #[test]
    fn zip64_small_directory_stays_readable_but_large_count_rejected() {
        let small = zip64(1);
        open(&small).unwrap();
        assert_eq!(zip::ZipArchive::new(Cursor::new(small)).unwrap().len(), 1);
        let large = zip64(1_000_000);
        assert!(crate::decode(&large)
            .unwrap_err()
            .to_string()
            .contains("before ZIP indexing"));
    }
    fn native_with_asset(payload: Vec<u8>) -> Vec<u8> {
        crate::encode(&crate::Series {
            id: "series".into(),
            name: "Embedded bytes".into(),
            episodes: vec![crate::Episode {
                id: "episode".into(),
                number: 1,
                name: "One".into(),
                script: "KALLE: Hello".into(),
                cast: vec![],
                fps: 30,
                width: 16,
                height: 16,
                accepted_notices: Default::default(),
                audio: vec![],
                captions: vec![],
                caption_settings: Default::default(),
                assets: vec![crate::ProjectAsset {
                    id: "image".into(),
                    kind: "image".into(),
                    bytes: payload,
                }],
            }],
        })
        .unwrap()
    }
    #[test]
    fn opaque_assets_with_oversized_embedded_directories_are_preserved() {
        let mut classic = archive();
        let end = eocd(&classic);
        for at in [8, 10] {
            classic[end + at..end + at + 2].copy_from_slice(&50000u16.to_le_bytes());
        }
        for payload in [classic, zip64(1_000_000)] {
            let encoded = native_with_asset(payload.clone());
            let loaded = crate::decode(&encoded).unwrap();
            assert_eq!(loaded.episodes[0].assets[0].bytes, payload);
        }
    }
    #[test]
    fn malformed_outer_index_cannot_fall_back_into_embedded_archive() {
        let mut payload = archive();
        let end = eocd(&payload);
        for at in [8, 10] {
            payload[end + at..end + at + 2].copy_from_slice(&50000u16.to_le_bytes());
        }
        let mut encoded = native_with_asset(payload);
        let end = eocd(&encoded);
        let central = u32_at(&encoded[end..], 16) as usize;
        // Invalid local-header offset forces metadata failure after the bounded
        // outer index was selected. The upstream reader normally retries EOCDs.
        encoded[central + 42..central + 46].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(crate::decode(&encoded).is_err());
    }
    #[test]
    fn normal_archive_with_comment_and_trailing_bytes_is_allowed() {
        let mut bytes = archive();
        let offset = eocd(&bytes);
        bytes[offset + 20..offset + 22].copy_from_slice(&3u16.to_le_bytes());
        bytes.extend_from_slice(b"abc trailing bytes");
        open(&bytes).unwrap();
        assert_eq!(zip::ZipArchive::new(Cursor::new(bytes)).unwrap().len(), 1);
    }
}
