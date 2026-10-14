//! Bounded PSD v1 RGB/8-bit writer. `psd` 0.3 is read-only: its decoder
//! validates every encoded layer before atomic publication. RAW planar channels
//! keep this export path entirely Rust. Depth and normals are hidden utility layers.
use crate::{raytrace::RenderBuffers, RenderError};
use std::io::Write;
use std::path::Path;
const NAMES: [&str; 6] = [
    "Background",
    "Diffuse / Base Color",
    "Ambient Occlusion",
    "Specular",
    "Depth Map",
    "Normal Map",
];
fn u16be(out: &mut Vec<u8>, v: u16) {
    out.extend_from_slice(&v.to_be_bytes());
}
fn u32be(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_be_bytes());
}
fn block(out: &mut Vec<u8>, data: &[u8]) {
    u32be(out, data.len() as u32);
    out.extend_from_slice(data);
}
fn fail(v: impl ToString) -> RenderError {
    RenderError::Export(v.to_string())
}

pub fn encode(buffers: &RenderBuffers) -> Result<Vec<u8>, RenderError> {
    buffers.validate()?;
    let pixels = buffers.width as usize * buffers.height as usize;
    let channels = buffers.layers();
    let mut layer_info = Vec::new();
    u16be(&mut layer_info, 6);
    // PSD stores the topmost layer first, unlike the public buffer ordering.
    for i in (0..6).rev() {
        u32be(&mut layer_info, 0);
        u32be(&mut layer_info, 0);
        u32be(&mut layer_info, buffers.height);
        u32be(&mut layer_info, buffers.width);
        u16be(&mut layer_info, 4);
        for channel in [0u16, 1, 2, 0xffff] {
            u16be(&mut layer_info, channel);
            u32be(&mut layer_info, (pixels + 2) as u32);
        }
        layer_info.extend_from_slice(b"8BIM");
        layer_info.extend_from_slice(match i {
            2 => b"mul ",
            3 => b"scrn",
            _ => b"norm",
        });
        layer_info.extend_from_slice(&[255, 0, if i >= 4 { 2 } else { 0 }, 0]);
        let mut extra = Vec::new();
        u32be(&mut extra, 0);
        u32be(&mut extra, 0);
        let name = NAMES[i].as_bytes();
        extra.push(name.len() as u8);
        extra.extend_from_slice(name);
        while extra.len() % 4 != 0 {
            extra.push(0);
        }
        block(&mut layer_info, &extra);
    }
    for i in (0..6).rev() {
        for channel in 0..4 {
            u16be(&mut layer_info, 0);
            layer_info.extend(channels[i].chunks_exact(4).map(|p| p[channel]));
        }
    }
    if layer_info.len() % 2 != 0 {
        layer_info.push(0);
    }
    let mut masks = Vec::new();
    block(&mut masks, &layer_info);
    u32be(&mut masks, 0);
    let mut out = Vec::new();
    out.extend_from_slice(b"8BPS");
    u16be(&mut out, 1);
    out.extend_from_slice(&[0; 6]);
    u16be(&mut out, 3);
    u32be(&mut out, buffers.height);
    u32be(&mut out, buffers.width);
    u16be(&mut out, 8);
    u16be(&mut out, 3);
    u32be(&mut out, 0);
    u32be(&mut out, 0);
    block(&mut out, &masks);
    u16be(&mut out, 0);
    for channel in 0..3 {
        for index in 0..pixels {
            let p = index * 4;
            let bg = buffers.background[p + channel] as f32 / 255.0;
            let base = buffers.diffuse[p + channel] as f32 / 255.0;
            let alpha = buffers.diffuse[p + 3] as f32 / 255.0;
            let ao = buffers.ambient_occlusion[p + channel] as f32 / 255.0;
            let spec = buffers.specular[p + channel] as f32 / 255.0;
            let rgb = 1.0 - (1.0 - base * ao) * (1.0 - spec);
            out.push(
                ((bg * (1.0 - alpha) + rgb * alpha) * 255.0)
                    .round()
                    .clamp(0.0, 255.0) as u8,
            );
        }
    }
    if out.len() > 128 * 1024 * 1024 {
        return Err(fail("PSD exceeds 128 MiB export limit"));
    }
    let decoded = psd::Psd::from_bytes(&out).map_err(fail)?;
    if decoded.width() != buffers.width
        || decoded.height() != buffers.height
        || decoded.layers().len() != 6
    {
        return Err(fail("PSD validation dimensions/layers disagree"));
    }
    for (i, name) in NAMES.iter().enumerate() {
        let layer = decoded
            .layer_by_name(name)
            .ok_or_else(|| fail("PSD layer missing"))?;
        if layer.rgba() != channels[i] {
            return Err(fail("PSD layer pixel verification failed"));
        }
    }
    Ok(out)
}
pub fn save_atomic(buffers: &RenderBuffers, path: &Path) -> Result<(), RenderError> {
    let bytes = encode(buffers)?;
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(fail)?;
    temporary.write_all(&bytes).map_err(fail)?;
    temporary.as_file().sync_all().map_err(fail)?;
    temporary.persist(path).map_err(fail)?;
    Ok(())
}
