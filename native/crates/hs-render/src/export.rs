//! Headless-vienti: PNG-kuvat ja -sarjat sekä MP4 FFmpegin kautta.
//!
//! Rajat ovat samat kuin nykyisessä sovelluksessa: 30 fps, enintään 60 s,
//! enintään 128 MiB tulostetta ja PNG-sarja enintään 300 ruutua.

use crate::scene::Image;
use crate::RenderError;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread::JoinHandle;

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
        let mut w = enc
            .write_header()
            .map_err(|e| RenderError::Export(e.to_string()))?;
        w.write_image_data(&img.rgba)
            .map_err(|e| RenderError::Export(e.to_string()))?;
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
    std::env::split_paths(&path)
        .map(|d| {
            d.join(if cfg!(windows) {
                "ffmpeg.exe"
            } else {
                "ffmpeg"
            })
        })
        .find(|p| p.is_file())
}

/// Finds ffprobe next to the selected FFmpeg, or on PATH.
fn find_ffprobe(ffmpeg: &Path) -> Option<PathBuf> {
    let name = if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    };
    if let Some(path) = std::env::var_os("HAHMOSTUDIO_FFPROBE") {
        let path = PathBuf::from(path);
        return path.is_file().then_some(path);
    }
    if let Some(parent) = ffmpeg.parent() {
        let path = parent.join(name);
        if path.is_file() {
            return Some(path);
        }
    }
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|dir| dir.join(name))
        .find(|path| path.is_file())
}

fn export_error(error: impl std::fmt::Display) -> RenderError {
    RenderError::Export(error.to_string())
}

/// Streams to a same-directory temporary file. The target is published only
/// after encoder completion, media validation and a full decode check.
pub struct Mp4Writer {
    child: Option<Child>,
    stderr: Option<JoinHandle<Vec<u8>>>,
    temporary: Option<tempfile::NamedTempFile>,
    path: PathBuf,
    ffmpeg: PathBuf,
    ffprobe: PathBuf,
    frames: u32,
    width: u32,
    height: u32,
    has_audio: bool,
    subtitles: Option<PathBuf>,
    failed: bool,
}

impl Mp4Writer {
    pub fn create(
        path: &Path,
        width: u32,
        height: u32,
        fps: u32,
    ) -> Result<Mp4Writer, RenderError> {
        Self::create_with_audio(path, width, height, fps, None)
    }

    /// Audio must contain a decodable audio stream. Both tools are required
    /// before starting; an old target remains intact on every failure.
    pub fn create_with_audio(
        path: &Path,
        width: u32,
        height: u32,
        fps: u32,
        audio: Option<&Path>,
    ) -> Result<Mp4Writer, RenderError> {
        Self::create_full(path, width, height, fps, audio, None)
    }

    /// Adds an optional English SRT track. Subtitle muxing occurs after video
    /// encoding, so a short subtitle cannot terminate the video/audio streams.
    pub fn create_full(
        path: &Path,
        width: u32,
        height: u32,
        fps: u32,
        audio: Option<&Path>,
        subtitles: Option<&Path>,
    ) -> Result<Mp4Writer, RenderError> {
        if let Some(subtitles) = subtitles {
            let metadata = subtitles
                .metadata()
                .map_err(|_| export_error("Subtitle resource is missing."))?;
            if !metadata.is_file() || metadata.len() > 1024 * 1024 {
                return Err(export_error(
                    "Subtitle input must be a regular SRT file of at most 1 MiB.",
                ));
            }
        }
        if fps != 30 {
            return Err(export_error("MP4 export requires exactly 30 fps."));
        }
        if !(2..=4096).contains(&width)
            || !(2..=4096).contains(&height)
            || !width.is_multiple_of(2)
            || !height.is_multiple_of(2)
        {
            return Err(export_error(
                "MP4 dimensions must be even and between 2 and 4096.",
            ));
        }
        if let Some(audio) = audio {
            if !audio.is_file() {
                return Err(export_error("Audio resource is missing."));
            }
        }
        if path.is_dir() || path.is_symlink() {
            return Err(export_error(
                "Export target must not be a directory or symbolic link.",
            ));
        }
        let ffmpeg = find_ffmpeg().ok_or_else(|| {
            export_error("FFmpeg is missing; install it or set HAHMOSTUDIO_FFMPEG.")
        })?;
        let ffprobe = find_ffprobe(&ffmpeg).ok_or_else(|| {
            export_error("ffprobe is missing; install it or set HAHMOSTUDIO_FFPROBE.")
        })?;
        let parent = path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        let temporary = tempfile::Builder::new()
            .prefix(".koeta-export-")
            .suffix(".mp4")
            .tempfile_in(parent)
            .map_err(export_error)?;
        let mut command = Command::new(&ffmpeg);
        command
            .args([
                "-hide_banner",
                "-loglevel",
                "error",
                "-nostdin",
                "-y",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgba",
                "-s",
            ])
            .arg(format!("{width}x{height}"))
            .args(["-r", "30", "-i", "pipe:0"]);
        if let Some(audio) = audio {
            command.arg("-i").arg(audio).args([
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-c:a",
                "aac",
                "-b:a",
                "160k",
                "-af",
                "apad",
                "-shortest",
            ]);
        } else {
            command.arg("-an");
        }
        // The video duration remains authoritative; a short audio track must
        // not truncate the rendered episode.
        command
            .args([
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                "-t",
                "60",
                "-f",
                "mp4",
            ])
            .arg(temporary.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        let mut child = command.spawn().map_err(export_error)?;
        let stderr_pipe = match child.stderr.take() {
            Some(pipe) => pipe,
            None => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(export_error("FFmpeg stderr pipe is missing."));
            }
        };
        // Read all stderr to avoid a blocked encoder, but retain only a bounded
        // tail for diagnostics. No unbounded wait_with_output allocation.
        let stderr = std::thread::Builder::new()
            .name("koeta-encoder-errors".into())
            .spawn(move || {
                let mut pipe = stderr_pipe;
                let mut retained = Vec::new();
                let mut buffer = [0_u8; 4096];
                loop {
                    match pipe.read(&mut buffer) {
                        Ok(0) | Err(_) => break,
                        Ok(count) => {
                            retained.extend_from_slice(&buffer[..count]);
                            if retained.len() > 16 * 1024 {
                                retained.drain(..retained.len() - 16 * 1024);
                            }
                        }
                    }
                }
                retained
            });
        let stderr = match stderr {
            Ok(thread) => thread,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(export_error(error));
            }
        };
        Ok(Mp4Writer {
            child: Some(child),
            stderr: Some(stderr),
            temporary: Some(temporary),
            path: path.to_path_buf(),
            ffmpeg,
            ffprobe,
            frames: 0,
            width,
            height,
            has_audio: audio.is_some(),
            subtitles: subtitles.map(Path::to_path_buf),
            failed: false,
        })
    }

    pub fn push(&mut self, img: &Image) -> Result<(), RenderError> {
        let result = self.push_inner(img);
        if result.is_err() {
            self.failed = true;
        }
        result
    }

    fn push_inner(&mut self, img: &Image) -> Result<(), RenderError> {
        if self.failed {
            return Err(export_error("Export already failed."));
        }
        let expected = (self.width as usize)
            .checked_mul(self.height as usize)
            .and_then(|pixels| pixels.checked_mul(4))
            .ok_or_else(|| export_error("Invalid frame size."))?;
        if (img.width, img.height) != (self.width, self.height) || img.rgba.len() != expected {
            return Err(export_error(
                "Frame dimensions or RGBA byte count are invalid.",
            ));
        }
        if self.frames >= 1800 {
            return Err(export_error("Export is limited to 60 seconds."));
        }
        self.child
            .as_mut()
            .and_then(|child| child.stdin.as_mut())
            .ok_or_else(|| export_error("Encoder input is closed."))?
            .write_all(&img.rgba)
            .map_err(export_error)?;
        self.frames += 1;
        if self
            .temporary
            .as_ref()
            .ok_or_else(|| export_error("Temporary export is missing."))?
            .as_file()
            .metadata()
            .map_err(export_error)?
            .len()
            > MAX_EXPORT_BYTES
        {
            return Err(export_error("Video exceeds 128 MiB."));
        }
        Ok(())
    }

    /// Finish, validate the actual encoded file, and atomically replace target.
    pub fn finish(mut self) -> Result<u64, RenderError> {
        if self.failed || self.frames == 0 {
            return Err(export_error("Export has no valid completed frames."));
        }
        let child = self
            .child
            .as_mut()
            .ok_or_else(|| export_error("Encoder is missing."))?;
        drop(child.stdin.take());
        let status = child.wait().map_err(export_error)?;
        self.child.take();
        let stderr = self
            .stderr
            .take()
            .and_then(|thread| thread.join().ok())
            .unwrap_or_default();
        if !status.success() {
            return Err(export_error(format!(
                "FFmpeg failed: {}",
                String::from_utf8_lossy(&stderr).trim()
            )));
        }
        if self.subtitles.is_some() {
            self.mux_subtitles()?;
        }
        let temporary = self
            .temporary
            .as_ref()
            .ok_or_else(|| export_error("Temporary export is missing."))?;
        let size = temporary.as_file().metadata().map_err(export_error)?.len();
        if size == 0 || size > MAX_EXPORT_BYTES {
            return Err(export_error("Video is empty or exceeds 128 MiB."));
        }
        self.validate_media(temporary.path())?;
        temporary.as_file().sync_all().map_err(export_error)?;
        if self.path.is_dir() || self.path.is_symlink() {
            return Err(export_error(
                "Export target changed to a directory or symbolic link.",
            ));
        }
        self.temporary
            .take()
            .ok_or_else(|| export_error("Temporary export is missing."))?
            .persist(&self.path)
            .map_err(export_error)?;
        Ok(size)
    }

    fn mux_subtitles(&mut self) -> Result<(), RenderError> {
        let input = self
            .temporary
            .as_ref()
            .ok_or_else(|| export_error("Temporary export is missing."))?;
        let subtitles = self
            .subtitles
            .as_ref()
            .ok_or_else(|| export_error("Subtitle input is missing."))?;
        // FFmpeg accepts malformed SRT as an empty mov_text track. Require an
        // actual source subtitle packet rather than treating that as success.
        let checked = Command::new(&self.ffprobe)
            .args([
                "-v",
                "error",
                "-f",
                "srt",
                "-count_packets",
                "-show_entries",
                "stream=nb_read_packets",
                "-of",
                "json",
            ])
            .arg(subtitles)
            .output()
            .map_err(export_error)?;
        if !checked.status.success() {
            return Err(export_error("Subtitle input could not be decoded."));
        }
        let subtitle_metadata: serde_json::Value =
            serde_json::from_slice(&checked.stdout).map_err(export_error)?;
        let valid_packets = subtitle_metadata["streams"]
            .as_array()
            .is_some_and(|streams| {
                streams.iter().any(|stream| {
                    stream["nb_read_packets"]
                        .as_str()
                        .and_then(|value| value.parse::<u64>().ok())
                        .is_some_and(|count| count > 0)
                })
            });
        if !valid_packets {
            return Err(export_error("Subtitle input has no decodable cues."));
        }
        let parent = input
            .path()
            .parent()
            .ok_or_else(|| export_error("Temporary export directory is missing."))?;
        let muxed = tempfile::Builder::new()
            .prefix(".koeta-export-")
            .suffix(".mp4")
            .tempfile_in(parent)
            .map_err(export_error)?;
        let duration = format!("{:.9}", self.frames as f64 / 30.0);
        let status = Command::new(&self.ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i"])
            .arg(input.path())
            .args(["-f", "srt", "-i"])
            .arg(subtitles)
            .args([
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-map",
                "1:s:0",
                "-c:v",
                "copy",
                "-c:a",
                "copy",
                "-c:s",
                "mov_text",
                "-metadata:s:s:0",
                "language=eng",
                "-metadata:s:s:0",
                "title=English",
                "-t",
                &duration,
                "-movflags",
                "+faststart",
                "-f",
                "mp4",
            ])
            .arg(muxed.path())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(export_error)?;
        if !status.success() {
            return Err(export_error(
                "English subtitle mux failed; check the SRT input.",
            ));
        }
        self.temporary = Some(muxed);
        Ok(())
    }

    fn validate_media(&self, path: &Path) -> Result<(), RenderError> {
        let output = Command::new(&self.ffprobe)
            .args([
                "-v",
                "error",
                "-count_packets",
                "-show_entries",
                "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,nb_read_packets:stream_tags=language:format=duration",
                "-of",
                "json",
            ])
            .arg(path)
            .output()
            .map_err(export_error)?;
        if !output.status.success() {
            return Err(export_error("ffprobe could not validate exported video."));
        }
        if output.stdout.len() > 1024 * 1024 {
            return Err(export_error("ffprobe response is too large."));
        }
        let metadata: serde_json::Value =
            serde_json::from_slice(&output.stdout).map_err(export_error)?;
        let streams = metadata["streams"]
            .as_array()
            .ok_or_else(|| export_error("Export has no streams."))?;
        let videos: Vec<_> = streams
            .iter()
            .filter(|s| s["codec_type"] == "video")
            .collect();
        if videos.len() != 1 {
            return Err(export_error("Export must contain one video stream."));
        }
        let video = videos[0];
        if video["codec_name"] != "h264"
            || video["width"].as_u64() != Some(self.width as u64)
            || video["height"].as_u64() != Some(self.height as u64)
            || video["r_frame_rate"] != "30/1"
            || video["nb_frames"]
                .as_str()
                .and_then(|v| v.parse::<u32>().ok())
                != Some(self.frames)
        {
            return Err(export_error(
                "Video codec, resolution, fps or frame count failed validation.",
            ));
        }
        let audio: Vec<_> = streams
            .iter()
            .filter(|s| s["codec_type"] == "audio")
            .collect();
        if (self.has_audio && (audio.len() != 1 || audio[0]["codec_name"] != "aac"))
            || (!self.has_audio && !audio.is_empty())
        {
            return Err(export_error("Exported audio stream failed validation."));
        }
        let subtitles: Vec<_> = streams
            .iter()
            .filter(|s| s["codec_type"] == "subtitle")
            .collect();
        if (self.subtitles.is_some()
            && (subtitles.len() != 1
                || subtitles[0]["codec_name"] != "mov_text"
                || subtitles[0]["tags"]["language"] != "eng"))
            || (self.subtitles.is_none() && !subtitles.is_empty())
        {
            return Err(export_error("English subtitle stream failed validation."));
        }
        let duration = metadata["format"]["duration"]
            .as_str()
            .and_then(|value| value.parse::<f64>().ok())
            .ok_or_else(|| export_error("Export duration is missing."))?;
        let expected = self.frames as f64 / 30.0;
        if !duration.is_finite()
            || duration <= 0.0
            || duration > MAX_SECONDS as f64 + 0.001
            || (duration - expected).abs() > 0.1
        {
            return Err(export_error("Export duration failed validation."));
        }
        // Decode actual packets, not just metadata, before publishing.
        let decoded = Command::new(&self.ffmpeg)
            .args(["-v", "error", "-xerror", "-nostdin", "-i"])
            .arg(path)
            .args(["-f", "null", "-"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(export_error)?;
        if !decoded.success() {
            return Err(export_error(
                "Export failed full audio/video decode verification.",
            ));
        }
        Ok(())
    }

    /// Cancel removes only the temporary export; the old target remains intact.
    pub fn cancel(self) {
        drop(self);
    }
}

impl Drop for Mp4Writer {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            drop(child.stdin.take());
            let _ = child.kill();
            let _ = child.wait();
        }
        if let Some(thread) = self.stderr.take() {
            let _ = thread.join();
        }
        // NamedTempFile deletes the unpublished output automatically.
    }
}
