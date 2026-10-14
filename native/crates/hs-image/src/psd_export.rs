//! Original bounded PSD v1 writer for the editor's supported raster model.
//! Exports current pixels (never the preserved source PSD), with editable layers.
use crate::{BlendMode, Document, Group, Layer, Result};
use std::{
    collections::{HashMap, HashSet},
    io::Write,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
};
const MAX_PSD: usize = 100 * 1024 * 1024;
fn u16b(b: &mut Vec<u8>, v: u16) {
    b.extend(v.to_be_bytes());
}
fn u32b(b: &mut Vec<u8>, v: u32) {
    b.extend(v.to_be_bytes());
}
fn section(b: &mut Vec<u8>, content: &[u8]) -> Result<()> {
    let len = u32::try_from(content.len()).map_err(|_| "PSD-osan kokoraja")?;
    if b.len().saturating_add(content.len()).saturating_add(4) > MAX_PSD {
        return Err("PSD-vienti ylittää 100 MiB".into());
    }
    u32b(b, len);
    b.extend(content);
    Ok(())
}
fn block(b: &mut Vec<u8>, key: &[u8; 4], data: &[u8]) -> Result<()> {
    b.extend(b"8BIM");
    b.extend(key);
    section(b, data)?;
    if data.len() % 2 == 1 {
        b.push(0);
    }
    Ok(())
}
fn key(mode: BlendMode) -> &'static [u8; 4] {
    match mode {
        BlendMode::Normal => b"norm",
        BlendMode::Multiply => b"mul ",
        BlendMode::Screen => b"scrn",
        BlendMode::Overlay => b"over",
        BlendMode::Darken => b"dark",
        BlendMode::Lighten => b"lite",
        BlendMode::Difference => b"diff",
        BlendMode::Exclusion => b"smud",
    }
}
/// Canonical PackBits. Each scanline is independently encoded and bounded.
fn packbits(row: &[u8]) -> Vec<u8> {
    let mut out = vec![];
    let mut i = 0;
    while i < row.len() {
        let mut run = 1;
        while i + run < row.len() && run < 128 && row[i + run] == row[i] {
            run += 1;
        }
        if run >= 3 {
            out.push((1i16 - run as i16) as i8 as u8);
            out.push(row[i]);
            i += run;
            continue;
        }
        let start = i;
        i += run;
        while i < row.len() && i - start < 128 {
            let mut run = 1;
            while i + run < row.len() && run < 3 && row[i + run] == row[i] {
                run += 1;
            }
            if run >= 3 {
                break;
            }
            i += (128 - (i - start)).min(run);
        }
        out.push((i - start - 1) as u8);
        out.extend(&row[start..i]);
    }
    out
}
fn plane(
    width: usize,
    height: usize,
    bytes: &[u8],
    stride: usize,
    channel: usize,
) -> Result<Vec<u8>> {
    let mut rows = vec![];
    let mut lengths = vec![];
    let mut row = vec![0; width];
    for y in 0..height {
        for (x, v) in row.iter_mut().enumerate() {
            *v = bytes[(y * width + x) * stride + channel];
        }
        let packed = packbits(&row);
        lengths.push(u16::try_from(packed.len()).map_err(|_| "PSD-pakatun rivin kokoraja")?);
        if rows.len().saturating_add(packed.len()) > MAX_PSD {
            return Err("PSD kanavan kokoraja".into());
        }
        rows.extend(packed);
    }
    let mut out = vec![];
    u16b(&mut out, 1);
    for len in lengths {
        u16b(&mut out, len);
    }
    out.extend(rows);
    Ok(out)
}
struct Record {
    metadata: Vec<u8>,
    channels: Vec<Vec<u8>>,
}
fn record(
    d: &Document,
    id: u32,
    name: &str,
    visible: bool,
    opacity: u8,
    blend: &[u8; 4],
    section_kind: u32,
    pixels: Option<&[u8]>,
    mask: Option<&[u8]>,
) -> Result<Record> {
    let mut channels = vec![];
    let mut channel_ids = vec![];
    if let Some(pixels) = pixels {
        for c in 0..4 {
            channels.push(plane(d.width as usize, d.height as usize, pixels, 4, c)?);
            channel_ids.push(if c == 3 { -1i16 } else { c as i16 });
        }
    }
    if let Some(mask) = mask {
        channels.push(plane(d.width as usize, d.height as usize, mask, 1, 0)?);
        channel_ids.push(-2);
    }
    let mut b = vec![];
    // Layer pixels and masks are normalized into document space. Crop offsets
    // from source are provenance; preserving them would discard later painting.
    let raster = pixels.is_some();
    for v in [
        0u32,
        0,
        if raster { d.height } else { 0 },
        if raster { d.width } else { 0 },
    ] {
        u32b(&mut b, v);
    }
    u16b(&mut b, channels.len() as u16);
    for (&id, ch) in channel_ids.iter().zip(&channels) {
        b.extend(id.to_be_bytes());
        u32b(
            &mut b,
            u32::try_from(ch.len()).map_err(|_| "PSD kanavan kokoraja")?,
        );
    }
    b.extend(b"8BIM");
    b.extend(blend);
    b.extend([opacity, 0, if visible { 0 } else { 2 }, 0]);
    let mut extra = vec![];
    let mut mask_info = vec![];
    if mask.is_some() {
        for v in [0u32, 0, d.height, d.width] {
            u32b(&mut mask_info, v);
        }
        mask_info.extend([0, 0, 0, 0]);
    }
    section(&mut extra, &mask_info)?;
    section(&mut extra, &[])?;
    // A safe ASCII Pascal fallback plus the complete Unicode name block.
    let fallback: Vec<u8> = name
        .chars()
        .take(255)
        .map(|c| if c.is_ascii() { c as u8 } else { b'?' })
        .collect();
    extra.push(fallback.len() as u8);
    extra.extend(&fallback);
    while extra.len() % 4 != 0 {
        extra.push(0);
    }
    let utf: Vec<u16> = name.encode_utf16().collect();
    if utf.len() > 2048 {
        return Err("PSD tason nimi ylittää 2048 UTF-16 yksikköä".into());
    }
    let mut unicode = vec![];
    u32b(&mut unicode, utf.len() as u32);
    for c in utf {
        u16b(&mut unicode, c);
    }
    block(&mut extra, b"luni", &unicode)?;
    block(&mut extra, b"lyid", &id.to_be_bytes())?;
    if section_kind != 0 {
        let mut info = vec![];
        u32b(&mut info, section_kind);
        info.extend(b"8BIM");
        info.extend(blend);
        block(&mut extra, b"lsct", &info)?;
    }
    section(&mut b, &extra)?;
    Ok(Record {
        metadata: b,
        channels,
    })
}
/// Returns a layered PSD of edited content. Unsupported or oversized states fail
/// before replacing an existing file. Original opaque Photoshop metadata remains
/// in `.koetaimg`/`.koeta`; the new PSD contains only supported editor semantics.
/// Raster offsets normalize to zero; missing native PSD IDs acquire deterministic
/// 32-bit identities. Existing actual Photoshop IDs remain unchanged.
pub(super) fn export(d: &Document) -> Result<Vec<u8>> {
    d.validate()?;
    if d.width > 30_000 || d.height > 30_000 {
        return Err("PSD sivun raja on 30000 pikseliä".into());
    }
    if d.layers.len() + d.groups.len() * 2 > 1000 {
        return Err("PSD rasterit ja ryhmärajat ylittävät 1000 tasoa".into());
    }
    let n = d.width as usize * d.height as usize;
    let decoded = d.layers.len()
        + d.layers.iter().filter(|l| l.mask.is_some()).count()
        + d.groups.iter().filter(|g| g.mask.is_some()).count();
    if n.checked_mul(decoded).map_or(true, |p| p > 48_000_000) {
        return Err("PSD tasojen ja maskien purettu koko ylittää 48 MP".into());
    }
    // The importer retains both the PSD and decoded editable pixels. Reserve its
    // documented resource/manifest headroom rather than produce unopenable files.
    let decoded_bytes = n
        .checked_mul(
            d.layers.len() * 4
                + d.layers.iter().filter(|l| l.mask.is_some()).count()
                + d.groups.iter().filter(|g| g.mask.is_some()).count(),
        )
        .ok_or("PSD resurssiraja")?;
    let mut used = HashSet::new();
    let mut ids = HashMap::new();
    let identities: Vec<u64> = d
        .layers
        .iter()
        .map(|l| l.id)
        .chain(d.groups.iter().map(|g| g.id))
        .collect();
    // Preserve every identity already representable as Photoshop lyid.
    for &id in &identities {
        if let Ok(value) = u32::try_from(id) {
            used.insert(value);
            ids.insert(id, value);
        }
    }
    // Source PSDs without lyid acquire our 64-bit fallback namespace. Assign
    // deterministic actual PSD IDs once; never truncate an existing source ID.
    let mut fallbacks: Vec<_> = identities
        .into_iter()
        .filter(|id| !ids.contains_key(id))
        .collect();
    fallbacks.sort_unstable();
    let mut candidate = 1u32;
    for id in fallbacks {
        let preferred = id as u32;
        let value = if preferred > 0 && !used.contains(&preferred) {
            preferred
        } else {
            while used.contains(&candidate) {
                candidate = candidate.checked_add(1).ok_or("PSD tunnisteet loppu")?;
            }
            candidate
        };
        used.insert(value);
        ids.insert(id, value);
    }
    let mut boundary_ids = vec![];
    for _ in &d.groups {
        while used.contains(&candidate) {
            candidate = candidate.checked_add(1).ok_or("PSD tunnisteet loppu")?;
        }
        boundary_ids.push(candidate);
        used.insert(candidate);
    }
    let mut records = vec![];
    fn subtree(
        d: &Document,
        parent: Option<u64>,
        bounds: &[u32],
        ids: &HashMap<u64, u32>,
        records: &mut Vec<Record>,
    ) -> Result<()> {
        // Stable order derives from the current ordered raster stack. Group
        // spans are validated contiguous by Document::validate.
        enum Child<'a> {
            Layer(&'a Layer),
            Group(usize, &'a Group),
        }
        let mut children: Vec<(usize, usize, Child<'_>)> = d
            .layers
            .iter()
            .enumerate()
            .filter(|(_, l)| l.parent_id == parent)
            .map(|(i, l)| (i, 0, Child::Layer(l)))
            .collect();
        for (gi, g) in d
            .groups
            .iter()
            .enumerate()
            .filter(|(_, g)| g.parent_id == parent)
        {
            let first = d
                .layers
                .iter()
                .position(|l| d.is_descendant(l.parent_id, g.id))
                .unwrap_or(d.layers.len());
            children.push((first, gi + 1, Child::Group(gi, g)));
        }
        children.sort_by_key(|(first, tie, _)| (*first, *tie));
        for (_, _, child) in children {
            match child {
                Child::Layer(l) => records.push(record(
                    d,
                    ids[&l.id],
                    &l.name,
                    l.visible,
                    l.opacity,
                    key(l.blend_mode),
                    0,
                    Some(&l.rgba),
                    l.mask.as_deref(),
                )?),
                Child::Group(gi, g) => {
                    records.push(record(
                        d,
                        bounds[gi],
                        "</Layer group>",
                        true,
                        255,
                        b"pass",
                        3,
                        None,
                        None,
                    )?);
                    subtree(d, Some(g.id), bounds, ids, records)?;
                    let blend = if g.isolated {
                        key(g.blend_mode)
                    } else {
                        b"pass"
                    };
                    records.push(record(
                        d,
                        ids[&g.id],
                        &g.name,
                        g.visible,
                        g.opacity,
                        blend,
                        1,
                        None,
                        g.mask.as_deref(),
                    )?);
                }
            }
        }
        Ok(())
    }
    subtree(d, None, &boundary_ids, &ids, &mut records)?;
    let mut info = vec![];
    // Negative count declares merged transparency; alpha is also present on each layer.
    info.extend((-(records.len() as i16)).to_be_bytes());
    for rec in &records {
        if info.len().saturating_add(rec.metadata.len()) > MAX_PSD {
            return Err("PSD metatiedon kokoraja".into());
        }
        info.extend(&rec.metadata);
    }
    for rec in records {
        for ch in rec.channels {
            if info.len().saturating_add(ch.len()) > MAX_PSD {
                return Err("PSD ylittää 100 MiB".into());
            }
            info.extend(ch);
        }
    }
    if info.len() % 2 != 0 {
        info.push(0);
    }
    let mut lm = vec![];
    section(&mut lm, &info)?;
    section(&mut lm, &[])?;
    let mut out = b"8BPS".to_vec();
    u16b(&mut out, 1);
    out.extend([0; 6]);
    u16b(&mut out, 4);
    u32b(&mut out, d.height);
    u32b(&mut out, d.width);
    u16b(&mut out, 8);
    u16b(&mut out, 3);
    section(&mut out, &[])?;
    section(&mut out, &[])?;
    section(&mut out, &lm)?;
    let merged = d.composite();
    let mut planes = vec![];
    for c in 0..4 {
        planes.push(plane(d.width as usize, d.height as usize, &merged, 4, c)?);
    }
    // Merged RLE has all channel scanline lengths before any channel payload.
    u16b(&mut out, 1);
    let header = 2 + d.height as usize * 2;
    for p in &planes {
        if out.len().saturating_add(header - 2) > MAX_PSD {
            return Err("PSD kokoraja".into());
        }
        out.extend(&p[2..header]);
    }
    for p in planes {
        if out.len().saturating_add(p.len() - header) > MAX_PSD {
            return Err("PSD ylittää 100 MiB".into());
        }
        out.extend(&p[header..]);
    }
    if out.len().saturating_add(decoded_bytes) > crate::MAX_BYTES - 4 * 1024 * 1024 {
        return Err("PSD ja puretut rasterit ylittävät siirrettävän dokumentin kokorajan".into());
    }
    Ok(out)
}
pub(super) fn save(d: &Document, path: &Path) -> Result<()> {
    save_cancelable(d, path, &AtomicBool::new(false))
}
fn check_cancel(cancel: &AtomicBool) -> Result<()> {
    if cancel.load(Ordering::SeqCst) {
        Err("PSD-tallennus peruutettu; aiempaa tiedostoa ei korvattu".into())
    } else {
        Ok(())
    }
}
pub(super) fn save_cancelable(d: &Document, path: &Path, cancel: &AtomicBool) -> Result<()> {
    check_cancel(cancel)?;
    let bytes = export(d)?;
    check_cancel(cancel)?;
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    // Chunked writes allow cancellation during a large output without ever
    // changing the existing target. Dropping NamedTempFile removes only our file.
    for chunk in bytes.chunks(1024 * 1024) {
        check_cancel(cancel)?;
        temp.write_all(chunk).map_err(|e| e.to_string())?;
    }
    check_cancel(cancel)?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    check_cancel(cancel)?;
    // Commit point. Cancellation racing after this check can no longer undo
    // a successful atomic replacement; callers must report actual success.
    temp.persist(path).map_err(|e| e.to_string())?;
    // No claim of power-loss durability: directory synchronization is platform-specific.
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn edited_rasters_masks_blends_unicode_reopen_and_external_decoder_reads() {
        let mut d = Document::new(4, 3).unwrap();
        d.layers[0].name = "Diffuse – Väri 🎨".into();
        d.fill(0, [50, 100, 150, 230]);
        d.add_layer("影の層 / Shadow".into()).unwrap();
        d.fill(1, [80, 90, 100, 170]);
        d.layers[1].blend_mode = BlendMode::Multiply;
        d.layers[1].opacity = 117;
        d.add_white_mask(1).unwrap();
        d.paint_mask(1, 1, 1, 0, 93).unwrap();
        d.paint(1, 2, 2, 0, [11, 33, 55, 0], false);
        d.add_layer("hidden".into()).unwrap();
        d.fill(2, [255, 0, 0, 255]);
        d.layers[2].visible = false;
        d.layers.swap(0, 2);
        let bytes = d.export_psd().unwrap();
        let reopened = Document::import_psd(&bytes).unwrap();
        assert_eq!(reopened.composite(), d.composite());
        assert_eq!(reopened.layers.len(), 3);
        for (a, b) in d.layers.iter().zip(&reopened.layers) {
            assert_eq!(a.id, b.id);
            assert_eq!(a.name, b.name);
            assert_eq!(a.visible, b.visible);
            assert_eq!(a.opacity, b.opacity);
            assert_eq!(a.blend_mode, b.blend_mode);
            assert_eq!(a.rgba, b.rgba);
            assert_eq!(a.mask, b.mask);
        }
        let external = psd::Psd::from_bytes(&bytes).unwrap();
        assert_eq!(external.width(), 4);
        assert_eq!(external.height(), 3);
        assert_eq!(external.layers().len(), 3);
        assert!(external
            .layers()
            .iter()
            .any(|l| l.name() == "影の層 / Shadow"));
        assert_eq!(external.rgba(), d.composite());
    }
    #[test]
    fn isolated_nested_groups_reopen_without_flattening() {
        let mut d = Document::new(3, 2).unwrap();
        d.fill(0, [100, 50, 10, 255]);
        d.add_layer("inside".into()).unwrap();
        d.fill(1, [20, 100, 220, 180]);
        d.layers[1].parent_id = Some(10);
        d.next_id = 22;
        d.groups = vec![
            Group {
                id: 10,
                name: "inner".into(),
                parent_id: Some(20),
                visible: true,
                source_psd_id: Some(10),
                blend_mode: BlendMode::Screen,
                opacity: 129,
                isolated: true,
                mask: Some(vec![170; 6]),
            },
            Group {
                id: 20,
                name: "outer".into(),
                parent_id: None,
                visible: true,
                source_psd_id: Some(20),
                blend_mode: BlendMode::Normal,
                opacity: 255,
                isolated: false,
                mask: None,
            },
        ];
        let reopened = Document::import_psd(&d.export_psd().unwrap()).unwrap();
        assert_eq!(reopened.composite(), d.composite());
        assert_eq!(reopened.layers[1].parent_id, Some(10));
        assert_eq!(reopened.groups.len(), 2);
        let inner = reopened.groups.iter().find(|g| g.id == 10).unwrap();
        assert_eq!(inner.parent_id, Some(20));
        assert_eq!(inner.mask, d.groups[0].mask);
        assert_eq!(inner.opacity, 129);
        assert_eq!(inner.blend_mode, BlendMode::Screen);
    }
    #[test]
    fn fallback_ids_get_real_psd_identity_and_atomic_failure_preserves_previous_file() {
        let mut d = Document::new(2, 2).unwrap();
        d.layers[0].id = (1u64 << 32) + 7;
        d.next_id = d.layers[0].id + 1;
        d.fill(0, [17, 23, 39, 127]);
        let reopened = Document::import_psd(&d.export_psd().unwrap()).unwrap();
        assert_eq!(reopened.layers[0].id, 7);
        assert_eq!(reopened.layers[0].source_psd_id, Some(7));
        assert_eq!(reopened.layers[0].rgba, d.layers[0].rgba);
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("edited.psd");
        d.save_psd_atomic(&target).unwrap();
        let before = std::fs::read(&target).unwrap();
        d.layers[0].rgba.pop();
        assert!(d.save_psd_atomic(&target).is_err());
        assert_eq!(std::fs::read(&target).unwrap(), before);
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn canceled_save_preserves_existing_target_and_does_not_create_new_file() {
        let dir = tempfile::tempdir().unwrap();
        let existing = dir.path().join("existing.psd");
        std::fs::write(&existing, b"previous user work").unwrap();
        let cancel = AtomicBool::new(true);
        let d = Document::new(2, 2).unwrap();
        assert!(d
            .save_psd_atomic_cancelable(&existing, &cancel)
            .unwrap_err()
            .contains("peruutettu"));
        assert_eq!(std::fs::read(&existing).unwrap(), b"previous user work");
        let new = dir.path().join("new.psd");
        assert!(d.save_psd_atomic_cancelable(&new, &cancel).is_err());
        assert!(!new.exists());
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
        cancel.store(false, Ordering::SeqCst);
        d.save_psd_atomic_cancelable(&existing, &cancel).unwrap();
        assert!(Document::import_psd(&std::fs::read(existing).unwrap()).is_ok());
    }
    #[test]
    fn packbits_respects_literal_and_repeat_boundaries() {
        let mut d = Document::new(257, 2).unwrap();
        for (i, p) in d.layers[0].rgba.chunks_exact_mut(4).enumerate() {
            p.copy_from_slice(&[i as u8, (i / 128) as u8, 9, (i % 256) as u8]);
        }
        assert_eq!(
            Document::import_psd(&d.export_psd().unwrap())
                .unwrap()
                .layers[0]
                .rgba,
            d.layers[0].rgba
        );
    }
}
