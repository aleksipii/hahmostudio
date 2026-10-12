//! Strict, local PSD v1 raster subset. Independent checked reader; no unsafe code.
//! Specification: Adobe Photoshop File Formats, Layer and Mask Information.
//! Only 8-bit RGB/grayscale RAW/PackBits, normal layers, pass-through groups.
use super::{pixels, Document, Group, Layer, Result, MAX_BYTES};
const PSD_LIMIT: usize = 100 * 1024 * 1024;
struct Reader<'a> {
    b: &'a [u8],
    p: usize,
}
impl<'a> Reader<'a> {
    fn new(b: &'a [u8]) -> Self {
        Self { b, p: 0 }
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        let end = self.p.checked_add(n).ok_or("PSD kokoraja")?;
        let b = self.b.get(self.p..end).ok_or("Katkennut PSD")?;
        self.p = end;
        Ok(b)
    }
    fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> Result<u16> {
        Ok(u16::from_be_bytes(self.take(2)?.try_into().unwrap()))
    }
    fn i16(&mut self) -> Result<i16> {
        Ok(i16::from_be_bytes(self.take(2)?.try_into().unwrap()))
    }
    fn u32(&mut self) -> Result<u32> {
        Ok(u32::from_be_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i32(&mut self) -> Result<i32> {
        Ok(i32::from_be_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn section(&mut self) -> Result<Reader<'a>> {
        let n = self.u32()? as usize;
        Ok(Self::new(self.take(n)?))
    }
    fn remaining(&self) -> usize {
        self.b.len() - self.p
    }
}
struct Record<'a> {
    id: u64,
    psd_id: Option<u32>,
    name: String,
    top: i32,
    left: i32,
    width: usize,
    height: usize,
    channels: Vec<(i16, usize)>,
    data: Vec<(i16, &'a [u8])>,
    visible: bool,
    opacity: u8,
    section: u32,
    parent: Option<u64>,
}
fn unsupported(what: &str) -> String {
    format!("PSD-tuonti ei tue: {what}. Alkuperäistä projektia ei muutettu.")
}
pub(super) fn import(bytes: &[u8]) -> Result<Document> {
    if bytes.len() > PSD_LIMIT {
        return Err("PSD ylittää 100 MiB".into());
    }
    let mut r = Reader::new(bytes);
    if r.take(4)? != b"8BPS" || r.u16()? != 1 {
        return Err(unsupported("PSB tai virheellinen PSD-tunniste"));
    }
    if r.take(6)? != [0; 6] {
        return Err("Virheellinen PSD-otsake".into());
    }
    let channels = r.u16()?;
    let height = r.u32()?;
    let width = r.u32()?;
    let n = pixels(width, height)?;
    if width > 30_000 || height > 30_000 {
        return Err("PSD sivu ylittää 30000 pikseliä".into());
    }
    if r.u16()? != 8 {
        return Err(unsupported("vain 8-bittinen kuva"));
    }
    let mode = r.u16()?;
    if !matches!(mode, 1 | 3) || !matches!((mode, channels), (1, 1..=2) | (3, 3..=4)) {
        return Err(unsupported("vain RGB/harmaasävy, ei lisäkanavia"));
    }
    let color = r.section()?;
    if color.remaining() != 0 {
        return Err(unsupported("värimoodin lisädata"));
    }
    let _resources = r.section()?; // Preserved verbatim in original source. RGB values, no color-profile conversion.
    let mut lm = r.section()?;
    if lm.remaining() < 4 {
        return Err(unsupported("PSD ilman rasteritasoja"));
    }
    let mut info = lm.section()?;
    let count = info.i16()?.unsigned_abs() as usize;
    if count == 0 || count > 1000 {
        return Err("PSD tasomäärä: 1–1000".into());
    }
    let mut records = Vec::with_capacity(count);
    let mut unique = std::collections::HashSet::new();
    let mut decoded = 0usize;
    for index in 0..count {
        let top = info.i32()?;
        let left = info.i32()?;
        let bottom = info.i32()?;
        let right = info.i32()?;
        let w = right as i64 - left as i64;
        let h = bottom as i64 - top as i64;
        if !(0..=30_000).contains(&w) || !(0..=30_000).contains(&h) {
            return Err("PSD virheellinen tasoraja".into());
        }
        let width = w as usize;
        let height = h as usize;
        let size = width.checked_mul(height).ok_or("PSD kokoraja")?;
        decoded = decoded.checked_add(size).ok_or("PSD kokoraja")?;
        if decoded > 48_000_000 {
            return Err("PSD purettujen tasojen raja 48 MP".into());
        }
        let cc = info.u16()? as usize;
        if cc > 4 {
            return Err(unsupported("lisäkanavat tai tasomaskit"));
        }
        let mut ch = Vec::with_capacity(cc);
        let mut channel_ids = std::collections::HashSet::new();
        for _ in 0..cc {
            let id = info.i16()?;
            let len = info.u32()? as usize;
            if !matches!(id, -1 | 0..=2) || !channel_ids.insert(id) || len < 2 {
                return Err(unsupported("tasomaskit tai virheellinen kanava"));
            }
            ch.push((id, len));
        }
        if info.take(4)? != b"8BIM" {
            return Err("Virheellinen PSD-sekoitustunniste".into());
        }
        let blend = info.take(4)?.to_vec();
        let opacity = info.u8()?;
        if info.u8()? != 0 {
            return Err(unsupported("clipping mask"));
        }
        let flags = info.u8()?;
        if flags & 16 != 0 {
            return Err(unsupported("rasterista riippumaton tasoulkoasu"));
        }
        info.u8()?;
        let mut extra = info.section()?;
        if extra.section()?.remaining() != 0 {
            return Err(unsupported("tasomaskit"));
        }
        let ranges = extra.section()?;
        if ranges
            .b
            .chunks(8)
            .any(|b| b != [0, 0, 255, 255, 0, 0, 255, 255])
        {
            return Err(unsupported("Blend If -rajat"));
        }
        let namelen = extra.u8()? as usize;
        let mut name = String::from_utf8_lossy(extra.take(namelen)?).into_owned();
        extra.take((4 - (namelen + 1) % 4) % 4)?;
        let mut psd_id = None;
        let mut section = 0;
        while extra.remaining() > 0 {
            if extra.remaining() < 12 {
                if extra.take(extra.remaining())?.iter().all(|x| *x == 0) {
                    break;
                }
                return Err("Virheellinen PSD-lisätieto".into());
            }
            if extra.take(4)? != b"8BIM" {
                return Err(unsupported("8B64-lisätieto"));
            }
            let key = extra.take(4)?;
            let len = extra.u32()? as usize;
            let b = extra.take(len)?;
            if len % 2 == 1 {
                extra.take(1)?;
            }
            let mut e = Reader::new(b);
            match key {
                b"lyid" => {
                    if len != 4 {
                        return Err("Virheellinen PSD-taso-ID".into());
                    }
                    psd_id = Some(e.u32()?);
                }
                b"luni" => {
                    let count = e.u32()? as usize;
                    if count > 2048 {
                        return Err("PSD tason nimi liian pitkä".into());
                    }
                    let raw = e.take(count.checked_mul(2).ok_or("Nimiraja")?)?;
                    let utf: Vec<u16> = raw
                        .chunks_exact(2)
                        .map(|p| u16::from_be_bytes([p[0], p[1]]))
                        .collect();
                    name = String::from_utf16(&utf).map_err(|_| "Virheellinen PSD Unicode")?;
                }
                b"lsct" => {
                    if !matches!(len, 4 | 12 | 16) {
                        return Err("Virheellinen PSD ryhmätieto".into());
                    }
                    section = e.u32()?;
                    if section > 3 {
                        return Err("Virheellinen PSD ryhmätyyppi".into());
                    }
                    if len >= 12 && (e.take(4)? != b"8BIM" || e.take(4)? != b"pass") {
                        return Err(unsupported("eristetyn ryhmän sekoitus"));
                    }
                }
                b"lspf" | b"lclr" | b"fxrp" => {} // Protection, UI colour label, reference point; no raster appearance change.
                _ => {
                    return Err(unsupported(&format!(
                        "lisätietolohko {}",
                        String::from_utf8_lossy(key)
                    )))
                }
            }
        }
        if section == 0 && blend != b"norm" {
            return Err(unsupported(&format!(
                "sekoitustila {}",
                String::from_utf8_lossy(&blend)
            )));
        }
        if section != 0 && !(blend == b"pass" || blend == b"norm") {
            return Err(unsupported("ryhmän sekoitustila"));
        }
        if section != 0 && opacity != 255 {
            return Err(unsupported("ryhmän peittävyys alle 100 %"));
        }
        if section == 0 && size > 0 {
            let expected = if mode == 3 { 3 } else { 1 };
            if ch.iter().filter(|(id, _)| *id >= 0).count() != expected {
                return Err("PSD värikanavat puuttuvat".into());
            }
            if mode == 1 && ch.iter().any(|(id, _)| *id > 0) {
                return Err("Virheellinen harmaasävykanava".into());
            }
        }
        let id = psd_id
            .filter(|id| *id != 0)
            .map_or((1u64 << 32) + index as u64 + 1, u64::from);
        if !unique.insert(id) {
            return Err("PSD toistuva taso-ID".into());
        }
        records.push(Record {
            id,
            psd_id,
            name,
            top,
            left,
            width,
            height,
            channels: ch,
            data: vec![],
            visible: flags & 2 == 0,
            opacity,
            section,
            parent: None,
        });
    }
    for record in &mut records {
        for &(id, len) in &record.channels {
            record.data.push((id, info.take(len)?));
        }
    }
    if info.remaining() > 1 || info.take(info.remaining())?.iter().any(|b| *b != 0) {
        return Err("PSD tasodatan ylimääräiset tavut".into());
    }
    if lm.section()?.remaining() != 0 {
        return Err(unsupported("yleinen tasomaski"));
    }
    if lm.remaining() > 0 && lm.take(lm.remaining())?.iter().any(|b| *b != 0) {
        return Err(unsupported("yleiset tason lisätiedot"));
    }
    // Validate merged image too: do not persist a truncated original PSD as a successful import.
    let compression = r.u16()?;
    match compression {
        0 => {
            r.take(n.checked_mul(channels as usize).ok_or("PSD kokoraja")?)?;
        }
        1 => {
            let mut lengths = Vec::with_capacity(height as usize * channels as usize);
            for _ in 0..height as usize * channels as usize {
                lengths.push(r.u16()? as usize);
            }
            for plane in lengths.chunks_exact(height as usize) {
                let bytes = plane
                    .iter()
                    .try_fold(0usize, |a, b| a.checked_add(*b))
                    .ok_or("PSD riviraja")?;
                let data = r.take(bytes)?;
                let mut encoded = vec![0, 1];
                for len in plane {
                    encoded.extend((*len as u16).to_be_bytes());
                }
                encoded.extend(data);
                decode_channel(&encoded, width as usize, height as usize)?;
            }
        }
        _ => return Err(unsupported("yhdistelmäkuvan ZIP-pakkaus")),
    }
    if r.remaining() != 0 {
        return Err("PSD ylimääräiset kuvatavut".into());
    }
    // Adobe's records are in bottom-to-top draw order; section dividers bound groups.
    // Process top-to-bottom for folder hierarchy, then reverse raster layers for compositing.
    let mut stack = vec![];
    let mut groups = vec![];
    for rec in records.iter_mut().rev() {
        match rec.section {
            1 | 2 => {
                rec.parent = stack.last().copied();
                groups.push(Group {
                    id: rec.id,
                    name: rec.name.clone(),
                    parent_id: rec.parent,
                    visible: rec.visible,
                    source_psd_id: rec.psd_id,
                });
                stack.push(rec.id);
            }
            3 => {
                if stack.pop().is_none() {
                    return Err("Virheellinen PSD ryhmähierarkia".into());
                }
            }
            _ => rec.parent = stack.last().copied(),
        }
    }
    if !stack.is_empty() {
        return Err("Katkennut PSD ryhmähierarkia".into());
    }
    let raster_count = records.iter().filter(|r| r.section == 0).count();
    if raster_count == 0 || n.checked_mul(raster_count).map_or(true, |p| p > 48_000_000) {
        return Err("PSD dokumenttitason rasteriraja 48 MP".into());
    }
    if n.checked_mul(raster_count)
        .and_then(|p| p.checked_mul(4))
        .and_then(|b| b.checked_add(bytes.len()))
        .map_or(true, |b| b > MAX_BYTES - 4 * 1024 * 1024)
    {
        return Err("PSD ja rasteritasot ylittävät siirrettävän dokumentin kokorajan".into());
    }
    let next_id = records.iter().map(|r| r.id).max().unwrap() + 1;
    let mut layers = vec![];
    for rec in records.iter().filter(|r| r.section == 0) {
        let size = rec.width * rec.height;
        let mut rgba = vec![0; n * 4];
        for p in rgba.chunks_exact_mut(4) {
            p[3] = 0;
        }
        let mut local = vec![0; size * 4];
        for p in local.chunks_exact_mut(4) {
            p[3] = 255;
        }
        for (id, b) in &rec.data {
            let plane = decode_channel(b, rec.width, rec.height)?;
            let c = if *id == -1 { 3 } else { *id as usize };
            for (p, v) in local.chunks_exact_mut(4).zip(plane) {
                if mode == 1 && c == 0 {
                    p[0] = v;
                    p[1] = v;
                    p[2] = v;
                } else {
                    p[c] = v;
                }
            }
        }
        for y in 0..rec.height {
            let dy = y as i64 + rec.top as i64;
            if dy < 0 || dy >= height as i64 {
                continue;
            }
            for x in 0..rec.width {
                let dx = x as i64 + rec.left as i64;
                if dx < 0 || dx >= width as i64 {
                    continue;
                }
                let src = (y * rec.width + x) * 4;
                let dst = (dy as usize * width as usize + dx as usize) * 4;
                rgba[dst..dst + 4].copy_from_slice(&local[src..src + 4]);
            }
        }
        layers.push(Layer {
            id: rec.id,
            name: rec.name.clone(),
            visible: rec.visible,
            opacity: rec.opacity,
            rgba,
            mask: None,
            parent_id: rec.parent,
            source_offset: [rec.left, rec.top],
            source_psd_id: rec.psd_id,
        });
    }
    let d = Document {
        version: 1,
        width,
        height,
        layers,
        next_id,
        groups,
        source_psd: Some(bytes.to_vec()),
    };
    d.validate()?;
    Ok(d)
}
fn decode_channel(b: &[u8], width: usize, height: usize) -> Result<Vec<u8>> {
    let mut r = Reader::new(b);
    let compression = r.u16()?;
    let n = width.checked_mul(height).ok_or("PSD kanavakoko")?;
    match compression {
        0 => {
            let raw = r.take(n)?;
            if r.remaining() != 0 {
                return Err("PSD RAW kanavan koko ei vastaa tasoa".into());
            }
            Ok(raw.to_vec())
        }
        1 => {
            let mut lengths = Vec::with_capacity(height);
            for _ in 0..height {
                lengths.push(r.u16()? as usize);
            }
            let mut out = Vec::with_capacity(n);
            for len in lengths {
                let row = r.take(len)?;
                let mut line = Reader::new(row);
                let start = out.len();
                while line.remaining() > 0 {
                    let h = line.u8()? as i8;
                    match h {
                        0..=127 => {
                            let count = h as usize + 1;
                            if out.len() - start + count > width {
                                return Err("PSD RLE riviraja".into());
                            }
                            out.extend_from_slice(line.take(count)?);
                        }
                        -127..=-1 => {
                            let count = (1i16 - h as i16) as usize;
                            if out.len() - start + count > width {
                                return Err("PSD RLE riviraja".into());
                            }
                            let v = line.u8()?;
                            out.resize(out.len() + count, v);
                        }
                        _ => {}
                    }
                }
                if out.len() - start != width {
                    return Err("PSD RLE rivin koko".into());
                }
            }
            if r.remaining() != 0 {
                return Err("PSD RLE ylimääräisiä tavuja".into());
            }
            Ok(out)
        }
        _ => Err(unsupported("ZIP-kanavapakkaus")),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn u16b(out: &mut Vec<u8>, v: u16) {
        out.extend(v.to_be_bytes());
    }
    fn u32b(out: &mut Vec<u8>, v: u32) {
        out.extend(v.to_be_bytes());
    }
    fn block(out: &mut Vec<u8>, key: &[u8; 4], data: &[u8]) {
        out.extend(b"8BIM");
        out.extend(key);
        u32b(out, data.len() as u32);
        out.extend(data);
        if data.len() % 2 == 1 {
            out.push(0);
        }
    }
    // Original constructed PSD bytes: no external artwork or licensed fixture.
    fn fixture(group: bool, hidden: bool, clipping: bool, unknown: bool) -> Vec<u8> {
        fn record(
            id: u32,
            section: u32,
            hidden: bool,
            clipping: bool,
            unknown: bool,
        ) -> (Vec<u8>, Vec<u8>) {
            let mut rec = vec![];
            for v in [
                0u32,
                if id == 78 { 2 } else { 1 },
                1,
                if id == 78 { 3 } else { 2 },
            ] {
                u32b(&mut rec, if section == 0 { v } else { 0 });
            }
            u16b(&mut rec, if section == 0 { 4 } else { 0 });
            let mut channels = vec![];
            if section == 0 {
                for (id, v) in [(0i16, 240u8), (1, 20), (2, 30), (-1, 255)] {
                    rec.extend(id.to_be_bytes());
                    u32b(&mut rec, 3);
                    u16b(&mut channels, 0);
                    channels.push(v);
                }
            }
            rec.extend(b"8BIM");
            rec.extend(if section == 0 { b"norm" } else { b"pass" });
            rec.extend([
                255,
                if clipping { 1 } else { 0 },
                if hidden { 2 } else { 0 },
                0,
            ]);
            let mut extra = vec![];
            u32b(&mut extra, 0);
            u32b(&mut extra, 0);
            extra.extend([1, b'L', 0, 0]);
            block(&mut extra, b"lyid", &id.to_be_bytes());
            if section > 0 {
                block(&mut extra, b"lsct", &section.to_be_bytes());
            }
            if unknown {
                block(&mut extra, b"lfx2", &[0; 4]);
            }
            u32b(&mut rec, extra.len() as u32);
            rec.extend(extra);
            (rec, channels)
        }
        let mut pairs = vec![];
        if group {
            pairs.push(record(12, 3, false, false, false));
        }
        pairs.push(record(77, 0, hidden, clipping, unknown));
        pairs.push(record(78, 0, hidden, false, false));
        if group {
            pairs.push(record(11, 1, false, false, false));
        }
        let mut info = vec![];
        u16b(&mut info, pairs.len() as u16);
        for (r, _) in &pairs {
            info.extend(r);
        }
        for (_, c) in &pairs {
            info.extend(c);
        }
        let mut lm = vec![];
        u32b(&mut lm, info.len() as u32);
        lm.extend(info);
        u32b(&mut lm, 0);
        let mut out = b"8BPS".to_vec();
        u16b(&mut out, 1);
        out.extend([0; 6]);
        u16b(&mut out, 3);
        u32b(&mut out, 2);
        u32b(&mut out, 3);
        u16b(&mut out, 8);
        u16b(&mut out, 3);
        u32b(&mut out, 0);
        u32b(&mut out, 0);
        u32b(&mut out, lm.len() as u32);
        out.extend(lm);
        u16b(&mut out, 0);
        out.extend([0; 18]);
        out
    }
    #[test]
    fn psd_ids_offsets_visibility_roundtrip() {
        let b = fixture(false, false, false, false);
        let d = import(&b).unwrap();
        assert_eq!(d.layers.len(), 2);
        assert_eq!(d.layers[0].id, 77);
        assert_eq!(d.layers[0].source_psd_id, Some(77));
        assert_eq!(d.layers[0].source_offset, [1, 0]);
        assert_eq!(&d.composite()[4..8], &[240, 20, 30, 255]);
        assert_eq!(d.source_psd.as_deref(), Some(b.as_slice()));
        assert_eq!(Document::decode(&d.encode().unwrap()).unwrap(), d);
        let hidden = import(&fixture(false, true, false, false)).unwrap();
        assert!(!hidden.layers[0].visible);
        assert!(hidden.composite().iter().all(|p| *p == 0));
    }
    #[test]
    fn psd_group_hierarchy() {
        let mut d = import(&fixture(true, false, false, false)).unwrap();
        assert_eq!(d.layers[0].parent_id, Some(11));
        assert_eq!(d.groups[0].id, 11);
        d.groups[0].visible = false;
        assert!(d.composite().iter().all(|p| *p == 0));
        assert_eq!(Document::decode(&d.encode().unwrap()).unwrap(), d);
    }
    #[test]
    fn psd_rejects_unsupported_and_truncated() {
        assert!(import(&fixture(false, false, true, false))
            .unwrap_err()
            .contains("clipping"));
        assert!(import(&fixture(false, false, false, true))
            .unwrap_err()
            .contains("lfx2"));
        let b = fixture(false, false, false, false);
        for n in 0..b.len() {
            assert!(import(&b[..n]).is_err(), "accepted truncation {n}");
        }
    }
    #[test]
    fn grayscale_raw_and_rle_import() {
        for rle in [false, true] {
            let channel = if rle {
                vec![0, 1, 0, 3, 1, 8, 44]
            } else {
                vec![0, 0, 8, 44]
            };
            let mut rec = vec![];
            for v in [0, 0, 1, 2] {
                u32b(&mut rec, v);
            }
            u16b(&mut rec, 1);
            rec.extend(0i16.to_be_bytes());
            u32b(&mut rec, channel.len() as u32);
            rec.extend(b"8BIMnorm");
            rec.extend([255, 0, 0, 0]);
            let extra = [0, 0, 0, 0, 0, 0, 0, 0, 1, b'G', 0, 0];
            u32b(&mut rec, extra.len() as u32);
            rec.extend(extra);
            let mut info = vec![];
            u16b(&mut info, 1);
            info.extend(rec);
            info.extend(&channel);
            let mut lm = vec![];
            u32b(&mut lm, info.len() as u32);
            lm.extend(info);
            u32b(&mut lm, 0);
            let mut b = b"8BPS".to_vec();
            u16b(&mut b, 1);
            b.extend([0; 6]);
            u16b(&mut b, 1);
            u32b(&mut b, 1);
            u32b(&mut b, 2);
            u16b(&mut b, 8);
            u16b(&mut b, 1);
            u32b(&mut b, 0);
            u32b(&mut b, 0);
            u32b(&mut b, lm.len() as u32);
            b.extend(lm);
            b.extend(channel);
            let d = import(&b).unwrap();
            assert_eq!(d.composite(), vec![8, 8, 8, 255, 44, 44, 44, 255]);
        }
    }
    #[test]
    fn checked_packbits() {
        assert_eq!(
            decode_channel(&[0, 1, 0, 2, 254, 9], 3, 1).unwrap(),
            vec![9; 3]
        );
        assert!(decode_channel(&[0, 1, 0, 2, 253, 9], 3, 1).is_err());
        assert!(decode_channel(&[0, 1, 0, 2, 1, 9], 3, 1).is_err());
    }
}
