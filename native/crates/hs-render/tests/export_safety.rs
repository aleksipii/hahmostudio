use hs_render::export::{find_ffmpeg, Mp4Writer};
use hs_render::scene::Image;
use std::path::Path;

fn have_tools() -> bool {
    let available = find_ffmpeg().is_some()
        && std::process::Command::new("ffprobe")
            .arg("-version")
            .output()
            .is_ok();
    if !available {
        eprintln!("SKIP actual FFmpeg export: ffmpeg/ffprobe unavailable");
    }
    available
}

fn fixture() -> Image {
    Image {
        width: 16,
        height: 16,
        rgba: vec![180; 16 * 16 * 4],
    }
}

fn assert_no_temporary(directory: &Path) {
    assert!(!std::fs::read_dir(directory).unwrap().any(|entry| entry
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".koeta-export-")));
}

#[test]
fn invalid_parameters_never_touch_existing_export() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("old.mp4");
    std::fs::write(&target, b"old export").unwrap();
    for (width, height, fps) in [
        (16, 16, 0),
        (16, 16, 24),
        (0, 16, 30),
        (4098, 16, 30),
        (15, 16, 30),
    ] {
        assert!(Mp4Writer::create(&target, width, height, fps).is_err());
        assert_eq!(std::fs::read(&target).unwrap(), b"old export");
    }
    assert_no_temporary(dir.path());
}

#[test]
fn cancelled_and_dropped_encoder_preserve_old_export() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("old.mp4");
    std::fs::write(&target, b"old export").unwrap();
    let mut writer = Mp4Writer::create(&target, 16, 16, 30).unwrap();
    writer.push(&fixture()).unwrap();
    writer.cancel();
    assert_eq!(std::fs::read(&target).unwrap(), b"old export");
    assert_no_temporary(dir.path());
    let writer = Mp4Writer::create(&target, 16, 16, 30).unwrap();
    drop(writer);
    assert_eq!(std::fs::read(&target).unwrap(), b"old export");
    assert_no_temporary(dir.path());
}

#[test]
fn invalid_frame_poisoned_export_cannot_publish_partial_video() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("old.mp4");
    std::fs::write(&target, b"old export").unwrap();
    let mut writer = Mp4Writer::create(&target, 16, 16, 30).unwrap();
    writer.push(&fixture()).unwrap();
    let mut invalid = fixture();
    invalid.rgba.pop();
    assert!(writer.push(&invalid).is_err());
    assert!(writer.finish().is_err());
    assert_eq!(std::fs::read(&target).unwrap(), b"old export");
    assert_no_temporary(dir.path());
}

#[test]
fn successful_export_validates_actual_video_and_atomically_replaces_target() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("old.mp4");
    std::fs::write(&target, b"old export").unwrap();
    let mut writer = Mp4Writer::create(&target, 16, 16, 30).unwrap();
    for _ in 0..30 {
        writer.push(&fixture()).unwrap();
    }
    let bytes = writer.finish().unwrap();
    assert!(bytes > 0);
    assert_eq!(std::fs::metadata(&target).unwrap().len(), bytes);
    assert_ne!(std::fs::read(&target).unwrap(), b"old export");
    assert_no_temporary(dir.path());
}

#[test]
fn short_audio_is_padded_instead_of_truncating_video() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let audio = dir.path().join("short.wav");
    let status = std::process::Command::new("ffmpeg")
        .args([
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=16000:duration=0.2",
            "-c:a",
            "pcm_s16le",
        ])
        .arg(&audio)
        .status()
        .unwrap();
    assert!(status.success());
    let target = dir.path().join("audio.mp4");
    let mut writer = Mp4Writer::create_with_audio(&target, 16, 16, 30, Some(&audio)).unwrap();
    for _ in 0..30 {
        writer.push(&fixture()).unwrap();
    }
    assert!(writer.finish().unwrap() > 0);
    assert_no_temporary(dir.path());
}

#[test]
fn encoder_failure_preserves_existing_export() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("old.mp4");
    std::fs::write(&target, b"old export").unwrap();
    let invalid_audio = dir.path().join("invalid.wav");
    std::fs::write(&invalid_audio, b"not a wave file").unwrap();
    let mut writer =
        Mp4Writer::create_with_audio(&target, 16, 16, 30, Some(&invalid_audio)).unwrap();
    let _ = writer.push(&fixture());
    assert!(writer.finish().is_err());
    assert_eq!(std::fs::read(&target).unwrap(), b"old export");
    assert_no_temporary(dir.path());
}

#[test]
fn panic_unwind_drops_encoder_and_temporary_file() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("old.mp4");
    std::fs::write(&target, b"old export").unwrap();
    let result = std::panic::catch_unwind(|| {
        let mut writer = Mp4Writer::create(&target, 16, 16, 30).unwrap();
        writer.push(&fixture()).unwrap();
        panic!("simulated caller panic");
    });
    assert!(result.is_err());
    assert_eq!(std::fs::read(&target).unwrap(), b"old export");
    assert_no_temporary(dir.path());
}

#[test]
fn english_subtitle_mux_preserves_full_audio_and_video() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let audio = dir.path().join("short.wav");
    let status = std::process::Command::new("ffmpeg")
        .args([
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=16000:duration=0.2",
            "-c:a",
            "pcm_s16le",
        ])
        .arg(&audio)
        .status()
        .unwrap();
    assert!(status.success());
    let subtitle = dir.path().join("english.srt");
    std::fs::write(
        &subtitle,
        "1\n00:00:00,000 --> 00:00:00,100\nHello, Koeta!\n\n",
    )
    .unwrap();
    for with_audio in [false, true] {
        let target = dir.path().join(format!("english-{with_audio}.mp4"));
        let mut writer = Mp4Writer::create_full(
            &target,
            16,
            16,
            30,
            with_audio.then_some(audio.as_path()),
            Some(&subtitle),
        )
        .unwrap();
        for _ in 0..30 {
            writer.push(&fixture()).unwrap();
        }
        assert!(writer.finish().unwrap() > 0);
        let probe = std::process::Command::new("ffprobe")
            .args([
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
            ])
            .arg(&target)
            .output()
            .unwrap();
        assert!(probe.status.success());
        let metadata: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
        let streams = metadata["streams"].as_array().unwrap();
        let subtitles: Vec<_> = streams
            .iter()
            .filter(|stream| stream["codec_type"] == "subtitle")
            .collect();
        assert_eq!(subtitles.len(), 1);
        assert_eq!(subtitles[0]["codec_name"], "mov_text");
        assert_eq!(subtitles[0]["tags"]["language"], "eng");
        let video = streams
            .iter()
            .find(|stream| stream["codec_type"] == "video")
            .unwrap();
        assert_eq!(video["nb_frames"], "30");
        assert_eq!(
            streams
                .iter()
                .filter(|stream| stream["codec_type"] == "audio")
                .count(),
            usize::from(with_audio)
        );
        let duration = metadata["format"]["duration"]
            .as_str()
            .unwrap()
            .parse::<f64>()
            .unwrap();
        assert!((duration - 1.0).abs() < 0.1);
    }
    assert_no_temporary(dir.path());
}

#[test]
fn invalid_subtitle_mux_preserves_previous_export() {
    if !have_tools() {
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    let subtitle = dir.path().join("invalid.srt");
    std::fs::write(&subtitle, "not a subtitle").unwrap();
    let target = dir.path().join("old.mp4");
    std::fs::write(&target, b"old export").unwrap();
    let mut writer = Mp4Writer::create_full(&target, 16, 16, 30, None, Some(&subtitle)).unwrap();
    for _ in 0..30 {
        writer.push(&fixture()).unwrap();
    }
    assert!(writer.finish().is_err());
    assert_eq!(std::fs::read(target).unwrap(), b"old export");
    assert_no_temporary(dir.path());
}
