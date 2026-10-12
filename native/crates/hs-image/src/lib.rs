//! Local, portable raster layer document. No UI or rendering dependencies.
use serde::{Deserialize, Serialize};
mod psd;
use std::io::Cursor;
pub const MAX_BYTES: usize = 128 * 1024 * 1024;
pub const MAX_PIXELS: usize = 16_000_000;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Layer {
    pub id: u64,
    pub name: String,
    pub visible: bool,
    pub opacity: u8,
    pub rgba: Vec<u8>,
    pub mask: Option<Vec<u8>>,
    #[serde(default)]
    pub parent_id: Option<u64>,
    #[serde(default)]
    pub source_offset: [i32; 2],
    #[serde(default)]
    pub source_psd_id: Option<u32>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Group {
    pub id: u64,
    pub name: String,
    pub parent_id: Option<u64>,
    pub visible: bool,
    pub source_psd_id: Option<u32>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Document {
    version: u32,
    pub width: u32,
    pub height: u32,
    pub layers: Vec<Layer>,
    next_id: u64,
    #[serde(default)]
    pub groups: Vec<Group>,
    #[serde(default)]
    pub source_psd: Option<Vec<u8>>,
}
pub type Result<T> = std::result::Result<T, String>;
fn pixels(w: u32, h: u32) -> Result<usize> {
    let n = (w as usize)
        .checked_mul(h as usize)
        .ok_or("Kuvan koko ylittyy")?;
    if w == 0 || h == 0 || n > MAX_PIXELS {
        return Err("Kuvan koko: enintään 16 MP".into());
    }
    Ok(n)
}
impl Document {
    pub fn new(width: u32, height: u32) -> Result<Self> {
        pixels(width, height)?;
        let mut d = Self {
            version: 1,
            width,
            height,
            layers: vec![],
            next_id: 1,
            groups: vec![],
            source_psd: None,
        };
        d.add_layer("Taso 1".into())?;
        Ok(d)
    }
    pub fn validate(&self) -> Result<()> {
        let n = pixels(self.width, self.height)?;
        if self.version != 1 || self.layers.is_empty() || self.layers.len() > 1000 {
            return Err("Virheellinen dokumentti tai tasomäärä".into());
        }
        let mut ids = std::collections::HashSet::new();
        if self.groups.len() + self.layers.len() > 1000 {
            return Err("Liikaa tasoja ja ryhmiä".into());
        }
        let mut total = self.source_psd.as_ref().map_or(0, Vec::len);
        if total > 100 * 1024 * 1024 {
            return Err("Alkuperäinen PSD ylittää 100 MiB".into());
        }
        for g in &self.groups {
            if g.id == 0 || g.id >= self.next_id || !ids.insert(g.id) || g.name.len() > 4096 {
                return Err("Virheellinen ryhmä".into());
            }
        }
        for l in &self.layers {
            if l.id == 0
                || l.id >= self.next_id
                || !ids.insert(l.id)
                || l.name.len() > 4096
                || l.rgba.len() != n * 4
                || l.mask.as_ref().is_some_and(|m| m.len() != n)
            {
                return Err("Virheellinen taso".into());
            }
            total = total
                .checked_add(l.rgba.len() + l.mask.as_ref().map_or(0, Vec::len))
                .ok_or("Kokoraja")?;
        }
        for parent in self
            .layers
            .iter()
            .map(|l| l.parent_id)
            .chain(self.groups.iter().map(|g| g.parent_id))
        {
            let mut id = parent;
            let mut seen = std::collections::HashSet::new();
            while let Some(p) = id {
                if !seen.insert(p) {
                    return Err("Ryhmähierarkian sykli".into());
                }
                id = self
                    .groups
                    .iter()
                    .find(|g| g.id == p)
                    .ok_or("Puuttuva ryhmä")?
                    .parent_id;
            }
        }
        if total > MAX_BYTES {
            return Err("Dokumentin resurssit ylittävät 128 MiB".into());
        }
        Ok(())
    }
    pub fn add_layer(&mut self, name: String) -> Result<u64> {
        let n = pixels(self.width, self.height)?;
        let used: usize = self
            .layers
            .iter()
            .map(|l| l.rgba.len() + l.mask.as_ref().map_or(0, Vec::len))
            .sum::<usize>()
            + self.source_psd.as_ref().map_or(0, Vec::len);
        if self.layers.len() + self.groups.len() >= 1000
            || used + n * 4 > MAX_BYTES
            || name.len() > 4096
            || self.next_id == u64::MAX
        {
            return Err("Tasojen kokoraja".into());
        }
        let id = self.next_id;
        self.next_id += 1;
        self.layers.push(Layer {
            id,
            name,
            visible: true,
            opacity: 255,
            rgba: vec![0; n * 4],
            mask: None,
            parent_id: None,
            source_offset: [0, 0],
            source_psd_id: None,
        });
        Ok(id)
    }
    pub fn paint(
        &mut self,
        index: usize,
        x: i32,
        y: i32,
        radius: u32,
        color: [u8; 4],
        erase: bool,
    ) {
        let Some(l) = self.layers.get_mut(index) else {
            return;
        };
        let r = radius.min(512) as i32;
        for py in (y - r).max(0)..=(y + r).min(self.height as i32 - 1) {
            for px in (x - r).max(0)..=(x + r).min(self.width as i32 - 1) {
                if (px - x).pow(2) + (py - y).pow(2) <= r * r {
                    let i = ((py as u32 * self.width + px as u32) * 4) as usize;
                    l.rgba[i..i + 4].copy_from_slice(if erase { &[0, 0, 0, 0] } else { &color });
                }
            }
        }
    }
    pub fn add_white_mask(&mut self, index: usize) -> Result<()> {
        let n = pixels(self.width, self.height)?;
        let used: usize = self
            .layers
            .iter()
            .map(|l| l.rgba.len() + l.mask.as_ref().map_or(0, Vec::len))
            .sum();
        let used = used + self.source_psd.as_ref().map_or(0, Vec::len);
        let l = self.layers.get_mut(index).ok_or("Taso puuttuu")?;
        if l.mask.is_none() && used + n > MAX_BYTES {
            return Err("Maski ylittää dokumentin 128 MiB resurssirajan".into());
        }
        l.mask = Some(vec![255; n]);
        Ok(())
    }
    pub fn paint_mask(
        &mut self,
        index: usize,
        x: i32,
        y: i32,
        radius: u32,
        value: u8,
    ) -> Result<()> {
        let l = self.layers.get_mut(index).ok_or("Taso puuttuu")?;
        let mask = l.mask.as_mut().ok_or("Lisää ensin maski")?;
        let r = radius.min(512) as i32;
        for py in (y - r).max(0)..=(y + r).min(self.height as i32 - 1) {
            for px in (x - r).max(0)..=(x + r).min(self.width as i32 - 1) {
                if (px - x).pow(2) + (py - y).pow(2) <= r * r {
                    mask[(py as u32 * self.width + px as u32) as usize] = value;
                }
            }
        }
        Ok(())
    }
    /// Destructive raster translation; callers checkpoint first. Pixels outside canvas are clipped.
    pub fn translate(&mut self, index: usize, dx: i32, dy: i32) {
        let Some(l) = self.layers.get_mut(index) else {
            return;
        };
        let old = l.rgba.clone();
        let old_mask = l.mask.clone();
        l.rgba.fill(0);
        if let Some(m) = &mut l.mask {
            m.fill(0);
        }
        for y in 0..self.height as i32 {
            for x in 0..self.width as i32 {
                let sx = x as i64 - dx as i64;
                let sy = y as i64 - dy as i64;
                if sx >= 0 && sy >= 0 && sx < self.width as i64 && sy < self.height as i64 {
                    let src = sy as usize * self.width as usize + sx as usize;
                    let dst = y as usize * self.width as usize + x as usize;
                    l.rgba[dst * 4..dst * 4 + 4].copy_from_slice(&old[src * 4..src * 4 + 4]);
                    if let (Some(m), Some(o)) = (&mut l.mask, &old_mask) {
                        m[dst] = o[src];
                    }
                }
            }
        }
    }
    pub fn fill(&mut self, index: usize, color: [u8; 4]) {
        if let Some(l) = self.layers.get_mut(index) {
            for p in l.rgba.chunks_exact_mut(4) {
                p.copy_from_slice(&color);
            }
        }
    }
    fn group_visible(&self, mut parent: Option<u64>) -> bool {
        for _ in 0..=self.groups.len() {
            match parent {
                None => return true,
                Some(id) => match self.groups.iter().find(|g| g.id == id) {
                    Some(g) if g.visible => parent = g.parent_id,
                    _ => return false,
                },
            }
        }
        false
    }
    pub fn import_psd(bytes: &[u8]) -> Result<Self> {
        psd::import(bytes)
    }
    pub fn composite(&self) -> Vec<u8> {
        let mut out = vec![0u8; self.width as usize * self.height as usize * 4];
        for l in self
            .layers
            .iter()
            .filter(|l| l.visible && self.group_visible(l.parent_id))
        {
            for (n, (src, dst)) in l
                .rgba
                .chunks_exact(4)
                .zip(out.chunks_exact_mut(4))
                .enumerate()
            {
                let a = src[3] as f32 / 255.0 * l.opacity as f32 / 255.0
                    * l.mask.as_ref().map_or(1.0, |m| m[n] as f32 / 255.0);
                let da = dst[3] as f32 / 255.0;
                let oa = a + da * (1.0 - a);
                if oa > 0.0 {
                    for c in 0..3 {
                        dst[c] = ((src[c] as f32 * a + dst[c] as f32 * da * (1.0 - a)) / oa).round()
                            as u8;
                    }
                }
                dst[3] = (oa * 255.0).round() as u8;
            }
        }
        out
    }
    pub fn encode(&self) -> Result<Vec<u8>> {
        self.validate()?;
        // Length-prefixed binary rasters avoid JSON expansion; manifest contains metadata.
        let mut meta = self.clone();
        let mut blobs = vec![];
        for l in &mut meta.layers {
            blobs.push(std::mem::take(&mut l.rgba));
            if let Some(m) = l.mask.take() {
                blobs.push(m);
                l.mask = Some(vec![]);
            }
        }
        let source = meta.source_psd.take();
        if source.is_some() {
            meta.source_psd = Some(vec![]);
        }
        let json = serde_json::to_vec(&meta).map_err(|e| e.to_string())?;
        let mut out = b"KOETAIMG1".to_vec();
        out.extend_from_slice(&(json.len() as u32).to_le_bytes());
        out.extend(json);
        for b in blobs {
            out.extend_from_slice(&(b.len() as u32).to_le_bytes());
            out.extend(b);
        }
        if let Some(source) = source {
            out.extend_from_slice(&(source.len() as u32).to_le_bytes());
            out.extend(source);
        }
        if out.len() > MAX_BYTES {
            return Err("Tallennus ylittää 128 MiB".into());
        }
        Ok(out)
    }
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        if bytes.len() > MAX_BYTES || bytes.get(..9) != Some(b"KOETAIMG1") {
            return Err("Virheellinen kuvadokumentti".into());
        }
        let mut c = 9usize;
        fn take<'a>(b: &'a [u8], c: &mut usize, n: usize) -> Result<&'a [u8]> {
            let end = c.checked_add(n).ok_or("Kokoraja")?;
            let s = b.get(*c..end).ok_or("Katkennut dokumentti")?;
            *c = end;
            Ok(s)
        }
        fn len(b: &[u8], c: &mut usize) -> Result<usize> {
            Ok(u32::from_le_bytes(take(b, c, 4)?.try_into().unwrap()) as usize)
        }
        let n = len(bytes, &mut c)?;
        if n > 4 * 1024 * 1024 {
            return Err("Liian suuri manifesti".into());
        }
        let mut d: Self =
            serde_json::from_slice(take(bytes, &mut c, n)?).map_err(|e| e.to_string())?;
        pixels(d.width, d.height)?;
        if d.layers.len() > 1000 {
            return Err("Liikaa tasoja".into());
        }
        for l in &mut d.layers {
            let n = len(bytes, &mut c)?;
            l.rgba = take(bytes, &mut c, n)?.to_vec();
            if l.mask.is_some() {
                let n = len(bytes, &mut c)?;
                l.mask = Some(take(bytes, &mut c, n)?.to_vec());
            }
        }
        if d.source_psd.is_some() {
            let n = len(bytes, &mut c)?;
            if n > 100 * 1024 * 1024 {
                return Err("PSD kokoraja".into());
            }
            d.source_psd = Some(take(bytes, &mut c, n)?.to_vec());
        }
        if c != bytes.len() {
            return Err("Ylimääräistä dataa".into());
        }
        d.validate()?;
        Ok(d)
    }
    pub fn import_png(bytes: &[u8]) -> Result<Self> {
        if bytes.len() > MAX_BYTES {
            return Err("PNG ylittää 128 MiB".into());
        }
        let mut dec = png::Decoder::new(Cursor::new(bytes));
        dec.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
        dec.set_limits(png::Limits { bytes: MAX_BYTES });
        let mut reader = dec.read_info().map_err(|e| e.to_string())?;
        let info = reader.info();
        let mut d = Self::new(info.width, info.height)?;
        let mut buf = vec![0; reader.output_buffer_size()];
        let info = reader.next_frame(&mut buf).map_err(|e| e.to_string())?;
        for (src, dst) in buf[..info.buffer_size()]
            .chunks_exact(info.color_type.samples())
            .zip(d.layers[0].rgba.chunks_exact_mut(4))
        {
            match info.color_type {
                png::ColorType::Rgba => dst.copy_from_slice(src),
                png::ColorType::Rgb => dst.copy_from_slice(&[src[0], src[1], src[2], 255]),
                png::ColorType::Grayscale => dst.copy_from_slice(&[src[0], src[0], src[0], 255]),
                png::ColorType::GrayscaleAlpha => {
                    dst.copy_from_slice(&[src[0], src[0], src[0], src[1]])
                }
                _ => return Err("PNG-värimalli ei tuettu".into()),
            }
        }
        Ok(d)
    }
    pub fn export_png(&self) -> Result<Vec<u8>> {
        self.validate()?;
        let mut out = vec![];
        {
            let mut encoder = png::Encoder::new(&mut out, self.width, self.height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut w = encoder.write_header().map_err(|e| e.to_string())?;
            w.write_image_data(&self.composite())
                .map_err(|e| e.to_string())?;
        }
        if out.len() > MAX_BYTES {
            return Err("PNG ylittää kokorajan".into());
        }
        Ok(out)
    }
}
fn document_footprint(d: &Document) -> usize {
    std::mem::size_of::<Document>()
        + d.layers.len() * std::mem::size_of::<Layer>()
        + d.groups.len() * std::mem::size_of::<Group>()
        + d.source_psd.as_ref().map_or(0, Vec::len)
        + d.layers
            .iter()
            .map(|l| l.rgba.len() + l.mask.as_ref().map_or(0, Vec::len) + l.name.len())
            .sum::<usize>()
        + d.groups.iter().map(|g| g.name.len()).sum::<usize>()
}
#[derive(Default)]
pub struct History {
    undo: Vec<Document>,
    redo: Vec<Document>,
}
impl History {
    pub fn checkpoint(&mut self, d: &Document) -> Result<()> {
        d.validate()?;
        let n = document_footprint(d);
        let total: usize = self.undo.iter().map(document_footprint).sum();
        if self.undo.len() >= 16 || total + n > MAX_BYTES {
            return Err("Kumoushistoria täynnä (16 tilaa / 128 MiB). Työtä ei poistettu; tyhjennä historia tietoisesti.".into());
        }
        self.undo.push(d.clone());
        self.redo.clear();
        Ok(())
    }
    pub fn undo(&mut self, d: &mut Document) -> Result<()> {
        if let Some(old) = self.undo.last() {
            let used = self
                .undo
                .iter()
                .chain(self.redo.iter())
                .map(document_footprint)
                .sum::<usize>()
                - document_footprint(old)
                + document_footprint(d);
            if used > MAX_BYTES {
                return Err("Kumous ylittäisi 128 MiB historian; kuvaa ei muutettu".into());
            }
        }
        if let Some(old) = self.undo.pop() {
            self.redo.push(std::mem::replace(d, old));
        }
        Ok(())
    }
    pub fn redo(&mut self, d: &mut Document) -> Result<()> {
        if let Some(next) = self.redo.last() {
            let used = self
                .undo
                .iter()
                .chain(self.redo.iter())
                .map(document_footprint)
                .sum::<usize>()
                - document_footprint(next)
                + document_footprint(d);
            if used > MAX_BYTES {
                return Err("Uudelleenteko ylittäisi 128 MiB historian; kuvaa ei muutettu".into());
            }
        }
        if let Some(next) = self.redo.pop() {
            self.undo.push(std::mem::replace(d, next));
        }
        Ok(())
    }
    pub fn clear(&mut self) {
        self.undo.clear();
        self.redo.clear();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn brush_history_roundtrip() {
        let mut d = Document::new(8, 8).unwrap();
        let mut h = History::default();
        h.checkpoint(&d).unwrap();
        d.paint(0, 2, 2, 1, [255, 0, 0, 255], false);
        assert_eq!(d.composite()[(2 * 8 + 2) * 4], 255);
        let saved = d.encode().unwrap();
        assert_eq!(Document::decode(&saved).unwrap(), d);
        h.undo(&mut d).unwrap();
        assert!(d.composite().iter().all(|x| *x == 0));
        h.redo(&mut d).unwrap();
        assert_eq!(d.encode().unwrap(), saved);
    }
    #[test]
    fn masks_and_png() {
        let mut d = Document::new(2, 2).unwrap();
        d.fill(0, [0, 255, 0, 255]);
        d.layers[0].mask = Some(vec![0, 255, 255, 255]);
        assert_eq!(d.composite()[3], 0);
        let png = d.export_png().unwrap();
        assert_eq!(
            Document::import_png(&png).unwrap().composite(),
            d.composite()
        );
    }
    #[test]
    fn mask_brush_translation_stable_ids() {
        let mut d = Document::new(4, 4).unwrap();
        let id = d.layers[0].id;
        d.paint(0, 1, 1, 0, [50, 60, 70, 255], false);
        d.layers[0].mask = Some(vec![255; 16]);
        d.paint_mask(0, 1, 1, 0, 0).unwrap();
        assert_eq!(d.composite()[(4 + 1) * 4 + 3], 0);
        d.paint_mask(0, 1, 1, 0, 255).unwrap();
        d.translate(0, 1, 0);
        assert_eq!(
            &d.composite()[(4 + 2) * 4..(4 + 2) * 4 + 4],
            &[50, 60, 70, 255]
        );
        assert_eq!(d.layers[0].id, id);
        let second = d.add_layer("top".into()).unwrap();
        d.layers.swap(0, 1);
        assert_eq!(d.layers[0].id, second);
        assert_eq!(Document::decode(&d.encode().unwrap()).unwrap(), d);
    }
    #[test]
    fn older_v1_document_migrates_without_new_metadata() {
        let d = Document::new(1, 1).unwrap();
        let metadata=br#"{"version":1,"width":1,"height":1,"layers":[{"id":1,"name":"old","visible":true,"opacity":255,"rgba":[],"mask":null}],"next_id":2}"#;
        let mut b = b"KOETAIMG1".to_vec();
        b.extend((metadata.len() as u32).to_le_bytes());
        b.extend(metadata);
        b.extend(4u32.to_le_bytes());
        b.extend([0; 4]);
        let restored = Document::decode(&b).unwrap();
        assert!(restored.groups.is_empty());
        assert!(restored.source_psd.is_none());
        assert_eq!(restored.layers[0].parent_id, None);
        assert_eq!(restored.width, d.width);
    }
    #[test]
    fn malformed_bounds() {
        assert!(Document::new(100_000, 100_000).is_err());
        assert!(Document::decode(b"KOETAIMG1").is_err());
        let mut d = Document::new(2, 2).unwrap();
        d.layers[0].rgba.pop();
        assert!(d.encode().is_err());
    }
    #[test]
    fn history_never_silently_trims() {
        let d = Document::new(1, 1).unwrap();
        let mut h = History::default();
        for _ in 0..16 {
            h.checkpoint(&d).unwrap();
        }
        assert!(h.checkpoint(&d).is_err());
    }
}
