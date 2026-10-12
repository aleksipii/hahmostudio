//! Headless-vienti: PNG-kuvat ja -sarjat sekä MP4 FFmpegin kautta.
//!
//! Rajat ovat samat kuin nykyisessä sovelluksessa: 30 fps, enintään 60 s,
//! enintään 128 MiB tulostetta ja PNG-sarja enintään 300 ruutua.

use crate::scene::Image;
use crate::RenderError;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

pub const MAX_EXPORT_BYTES: u64 = 128 * 1024 * 1024;
pub const MAX_PNG_SEQUENCE: u32 = 300;
pub const MAX_SECONDS: f32 = 60.0;

pub fn encode_png(img: &Image) -> Result<Vec<u8>, RenderError> {
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, img.width, img.height);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        enc.set_source_srgb(png::SrgbRenderingIntent::Perceptual);
        let mut w = enc.write_header().map_err(|e| RenderError::Export(e.to_string()))?;
        w.write_image_data(&img.rgba).map_err(|e| RenderError::Export(e.to_string()))?;
    }
    Ok(out)
}

pub fn write_png(img: &Image, path: &Path) -> Result<(), RenderError> {
    let bytes = encode_png(img)?;
    std::fs::write(path, bytes).map_err(|e| RenderError::Export(format!("{}: {e}", path.display())))
}

/// Etsii FFmpegin: ympäristömuuttuja `HAHMOSTUDIO_FFMPEG` tai PATH.
pub fn find_ffmpeg() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("HAHMOSTUDIO_FFMPEG") {
        let p = PathBuf::from(p);
        if p.is_file() {
            return Some(p);
        }
    }
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path).map(|d| d.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" })).find(|p| p.is_file())
}

/// Syöttää RGBA-ruudut FFmpegille, joka koodaa H.264-MP4:n (yuv420p, faststart).
pub struct Mp4Writer {
    child: Child,
    path: PathBuf,
    frames: u32,
    max_frames: u32,
    width: u32,
    height: u32,
}

impl Mp4Writer {
    pub fn create(path: &Path, width: u32, height: u32, fps: u32) -> Result<Mp4Writer, RenderError> {
        if width % 2 != 0 || height % 2 != 0 {
            return Err(RenderError::Export("MP4-koon pitää olla parillinen".into()));
        }
        let ffmpeg = find_ffmpeg().ok_or_else(|| RenderError::Export("FFmpegiä ei löytynyt. Asenna se tai aseta HAHMOSTUDIO_FFMPEG.".into()))?;
        let child = Command::new(ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s"])
            .arg(format!("{width}x{height}"))
            .args(["-r", &fps.to_string(), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart"])
            .arg(path)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| RenderError::Export(format!("FFmpegin käynnistys: {e}")))?;
        Ok(Mp4Writer { child, path: path.to_path_buf(), frames: 0, max_frames: (MAX_SECONDS * fps as f32) as u32, width, height })
    }

    pub fn push(&mut self, img: &Image) -> Result<(), RenderError> {
        if (img.width, img.height) != (self.width, self.height) {
            return Err(RenderError::Export("ruudun koko vaihtui kesken viennin".into()));
        }
        if self.frames >= self.max_frames {
            return Err(RenderError::Export("Vienti on enintään 60 sekuntia.".into()));
        }
        self.child.stdin.as_mut().expect("stdin").write_all(&img.rgba).map_err(|e| RenderError::Export(e.to_string()))?;
        self.frames += 1;
        Ok(())
    }

    /// Sulkee virran, odottaa FFmpegiä ja tarkistaa koon. Palauttaa tiedoston koon.
    pub fn finish(mut self) -> Result<u64, RenderError> {
        drop(self.child.stdin.take());
        let out = self.child.wait_with_output().map_err(|e| RenderError::Export(e.to_string()))?;
        if !out.status.success() {
            return Err(RenderError::Export(String::from_utf8_lossy(&out.stderr).trim().to_string()));
        }
        let size = std::fs::metadata(&self.path).map_err(|e| RenderError::Export(e.to_string()))?.len();
        if size > MAX_EXPORT_BYTES {
            let _ = std::fs::remove_file(&self.path);
            return Err(RenderError::Export("Video on yli 128 MiB; lyhennä tai pienennä.".into()));
        }
        Ok(size)
    }

    /// Peruu viennin: lopettaa FFmpegin ja poistaa keskeneräisen tiedoston.
    pub fn cancel(mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_file(&self.path);
    }
}
