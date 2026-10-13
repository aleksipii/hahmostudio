//! Local, UI-independent captions. Hack font bytes ship through epaint_default_fonts;
//! redistribution notices are retained in FONT-LICENSE.txt. Cue ends are exclusive.
use ab_glyph::{point, Font, FontRef, PxScale, ScaleFont};
use hs_core::{Tick, TICKS_PER_SECOND};
use hs_render::Image;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CaptionCue {
    pub id: String,
    pub start: Tick,
    pub end: Tick,
    pub text: String,
    pub speaker: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct CaptionSettings {
    pub enabled: bool,
    pub burn_in: bool,
    pub style: CaptionStyle,
}
impl Default for CaptionSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            burn_in: true,
            style: CaptionStyle::default(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct CaptionStyle {
    /// Font height relative to output height, clamped to 2..8 percent.
    pub font_height: f32,
    /// Bottom safe margin as fraction of output height, clamped to 2..20 percent.
    pub bottom_margin: f32,
    pub foreground: [u8; 4],
    pub background: [u8; 4],
}
impl Default for CaptionStyle {
    fn default() -> Self {
        Self {
            font_height: 0.045,
            bottom_margin: 0.08,
            foreground: [255; 4],
            background: [0, 0, 0, 210],
        }
    }
}
#[derive(Debug, thiserror::Error)]
pub enum SubtitleError {
    #[error("Invalid caption: {0}")]
    InvalidCue(String),
    #[error("Caption text will not fit the output safe area; shorten the text or split the cue")]
    Layout,
    #[error("Invalid output image or caption style")]
    InvalidImage,
}
pub fn validate_cues(cues: &[CaptionCue]) -> Result<(), SubtitleError> {
    if cues.len() > 4096 {
        return Err(SubtitleError::InvalidCue("too many cues".into()));
    }
    let mut ids = HashSet::new();
    for cue in cues {
        if cue.id.is_empty()
            || cue.id.len() > 256
            || !ids.insert(&cue.id)
            || cue.start.0 < 0
            || cue.end <= cue.start
            || cue.end.0 > 60 * TICKS_PER_SECOND
            || cue.text.trim().is_empty()
            || cue.text.len() > 4096
            || cue.text.chars().any(|c| c.is_control() && c != '\n')
            || cue
                .speaker
                .as_ref()
                .is_some_and(|s| s.len() > 256 || s.chars().any(char::is_control))
        {
            return Err(SubtitleError::InvalidCue(cue.id.clone()));
        }
    }
    Ok(())
}
fn timestamp(t: Tick, separator: char) -> String {
    let ms =
        ((t.0 as i128 * 1000 + TICKS_PER_SECOND as i128 / 2) / TICKS_PER_SECOND as i128) as i64;
    format!(
        "{:02}:{:02}:{:02}{separator}{:03}",
        ms / 3_600_000,
        (ms / 60_000) % 60,
        (ms / 1000) % 60,
        ms % 1000
    )
}
fn sorted(cues: &[CaptionCue]) -> Vec<&CaptionCue> {
    let mut items: Vec<_> = cues.iter().collect();
    items.sort_by_key(|c| (c.start, c.end, &c.id));
    items
}
fn plain_text(text: &str) -> String {
    // Escape markup and timing-arrow syntax; cue text is always literal user text.
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .lines()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}
pub fn to_srt(cues: &[CaptionCue]) -> Result<String, SubtitleError> {
    let cues=single_track_cues(cues)?;
    let mut out = String::new();
    for (i, cue) in sorted(&cues).iter().enumerate() {
        out.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            i + 1,
            timestamp(cue.start, ','),
            timestamp(cue.end, ','),
            plain_text(&cue.text)
        ));
    }
    Ok(out)
}
pub fn to_vtt(cues: &[CaptionCue]) -> Result<String, SubtitleError> {
    validate_cues(cues)?;
    let mut out = String::from("WEBVTT\n\n");
    for cue in sorted(cues) {
        out.push_str(&format!(
            "{} --> {}\n{}\n\n",
            timestamp(cue.start, '.'),
            timestamp(cue.end, '.'),
            plain_text(&cue.text)
        ));
    }
    Ok(out)
}
fn blend(image: &mut Image, x: i32, y: i32, color: [u8; 4], coverage: f32) {
    if x < 0 || y < 0 || x >= image.width as i32 || y >= image.height as i32 {
        return;
    }
    let i = ((y as usize * image.width as usize) + x as usize) * 4;
    let a = (coverage * color[3] as f32 / 255.).clamp(0., 1.);
    let da = image.rgba[i + 3] as f32 / 255.;
    let oa = a + da * (1. - a);
    for (channel, source) in color[..3].iter().enumerate() {
        image.rgba[i + channel] = if oa > 0. {
            ((*source as f32 * a + image.rgba[i + channel] as f32 * da * (1. - a)) / oa).round()
                as u8
        } else {
            0
        };
    }
    image.rgba[i + 3] = (oa * 255.).round() as u8;
}
/// Burn all active cues into a bottom-safe-area block. No device/system fonts are read.
/// Rejects overflow instead of silently clipping or dropping caption text.
pub fn burn_captions(
    image: &mut Image,
    time: Tick,
    cues: &[CaptionCue],
    settings: &CaptionSettings,
) -> Result<(), SubtitleError> {
    validate_cues(cues)?;
    if !settings.enabled || !settings.burn_in {
        return Ok(());
    }
    if image.width == 0
        || image.height == 0
        || image.width > 8192
        || image.height > 8192
        || image.rgba.len() != image.width as usize * image.height as usize * 4
        || !settings.style.font_height.is_finite()
        || !settings.style.bottom_margin.is_finite()
    {
        return Err(SubtitleError::InvalidImage);
    }
    let active: Vec<_> = sorted(cues)
        .into_iter()
        .filter(|c| c.start <= time && time < c.end)
        .collect();
    if active.is_empty() {
        return Ok(());
    }
    let font =
        FontRef::try_from_slice(epaint_default_fonts::HACK_REGULAR).expect("bundled verified font");
    let scale =
        PxScale::from((image.height as f32 * settings.style.font_height.clamp(0.02, 0.08)).max(8.));
    let scaled = font.as_scaled(scale);
    let max_width = image.width as f32 * 0.84;
    let mut lines: Vec<(String, f32)> = Vec::new();
    let overlap=active.len()>1;
    for cue in active {
        let display=if overlap {cue.speaker.as_ref().map_or_else(||cue.text.clone(),|name|format!("{name}: {}",cue.text))}else{cue.text.clone()};
        for paragraph in display.lines() {
            let mut line = String::new();
            let mut width = 0.;
            for word in paragraph.split_whitespace() {
                let word_width: f32 = word
                    .chars()
                    .map(|ch| scaled.h_advance(scaled.glyph_id(ch)))
                    .sum();
                let gap = if line.is_empty() {
                    0.
                } else {
                    scaled.h_advance(scaled.glyph_id(' '))
                };
                if !line.is_empty() && width + gap + word_width > max_width {
                    lines.push((std::mem::take(&mut line), width));
                    width = 0.;
                }
                if !line.is_empty() {
                    line.push(' ');
                    width += gap;
                }
                // Break oversized words at Unicode scalar boundaries.
                for ch in word.chars() {
                    let advance = scaled.h_advance(scaled.glyph_id(ch));
                    if width + advance > max_width && !line.is_empty() {
                        lines.push((std::mem::take(&mut line), width));
                        width = 0.;
                    }
                    if advance > max_width {
                        return Err(SubtitleError::Layout);
                    }
                    line.push(ch);
                    width += advance;
                }
            }
            if !line.is_empty() {
                lines.push((line, width));
            }
        }
    }
    let line_height = scaled.height() * 1.22;
    let padding = scale.y * 0.3;
    let block_height = lines.len() as f32 * line_height + padding * 2.;
    let bottom = image.height as f32 * (1. - settings.style.bottom_margin.clamp(0.02, 0.2));
    let top = bottom - block_height;
    if top < image.height as f32 * 0.1 {
        return Err(SubtitleError::Layout);
    }
    let block_width = lines.iter().map(|(_, w)| *w).fold(0., f32::max) + padding * 2.;
    let left = (image.width as f32 - block_width) / 2.;
    for y in top.floor() as i32..bottom.ceil() as i32 {
        for x in left.floor() as i32..(left + block_width).ceil() as i32 {
            blend(image, x, y, settings.style.background, 1.);
        }
    }
    for (index, (line, width)) in lines.iter().enumerate() {
        let mut x = (image.width as f32 - width) / 2.;
        let y = top + padding + scaled.ascent() + index as f32 * line_height;
        for ch in line.chars() {
            let mut glyph = scaled.scaled_glyph(ch);
            glyph.position = point(x, y);
            x += scaled.h_advance(glyph.id);
            if let Some(outline) = font.outline_glyph(glyph) {
                let bounds = outline.px_bounds();
                outline.draw(|gx, gy, coverage| {
                    blend(
                        image,
                        bounds.min.x as i32 + gx as i32,
                        bounds.min.y as i32 + gy as i32,
                        settings.style.foreground,
                        coverage,
                    )
                });
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn cue() -> CaptionCue {
        CaptionCue {
            id: "line-1".into(),
            start: Tick::from_seconds(1.25),
            end: Tick::from_seconds(2.5),
            text: "Hello, café!".into(),
            speaker: Some("Kalle".into()),
        }
    }
    #[test]
    fn output_timing_and_literal_text() {
        let mut c = cue();
        c.text = "<script>\n\nHello --> there".into();
        let srt = to_srt(&[c.clone()]).unwrap();
        assert!(srt.contains("00:00:01,250 --> 00:00:02,500"));
        assert!(srt.contains("&lt;script&gt;\nHello --&gt; there"));
        assert!(!srt.contains("<script>"));
        assert!(to_vtt(&[c]).unwrap().starts_with("WEBVTT\n\n00:00:01.250"));
    }
    #[test]
    fn rejects_bad_cues() {
        let c = cue();
        assert!(validate_cues(&[c.clone(), c.clone()]).is_err());
        for (start, end) in [(-1, 100), (100, 100), (0, 61 * TICKS_PER_SECOND)] {
            let mut bad = c.clone();
            bad.start = Tick(start);
            bad.end = Tick(end);
            assert!(validate_cues(&[bad]).is_err());
        }
    }
    #[test]
    fn unicode_pixels_timing_and_safe_area() {
        let c = cue();
        let settings = CaptionSettings::default();
        let mut image = Image::new(640, 360);
        image.rgba.fill(255);
        let initial = image.clone();
        burn_captions(&mut image, c.start, &[c.clone()], &settings).unwrap();
        assert!(image.rgba != initial.rgba);
        assert_eq!(&image.rgba[..640 * 4 * 250], &initial.rgba[..640 * 4 * 250]);
        assert_eq!(&image.rgba[640 * 4 * 340..], &initial.rgba[640 * 4 * 340..]);
        let mut ended = initial.clone();
        burn_captions(&mut ended, c.end, &[c], &settings).unwrap();
        assert_eq!(ended.rgba, initial.rgba);
    }
    #[test]
    fn refuses_silent_truncation_and_invalid_image() {
        let mut c = cue();
        c.text = "Long caption ".repeat(200);
        let mut image = Image::new(100, 60);
        assert!(matches!(
            burn_captions(
                &mut image,
                c.start,
                &[c.clone()],
                &CaptionSettings::default()
            ),
            Err(SubtitleError::Layout)
        ));
        image.rgba.clear();
        assert!(matches!(
            burn_captions(&mut image, c.start, &[c], &CaptionSettings::default()),
            Err(SubtitleError::InvalidImage)
        ));
    }
}

/// Flatten simultaneous speakers into one subtitle packet without losing text.
/// Original project cues and their identifiers remain unchanged.
pub fn single_track_cues(cues: &[CaptionCue]) -> Result<Vec<CaptionCue>, SubtitleError> {
    validate_cues(cues)?;
    let mut points: Vec<_>=cues.iter().flat_map(|c|[c.start,c.end]).collect();
    points.sort();points.dedup();
    let ordered=sorted(cues);let mut result=Vec::new();
    for span in points.windows(2) {
        let active: Vec<_>=ordered.iter().filter(|c|c.start<span[1]&&span[0]<c.end).collect();
        if active.is_empty(){continue;}
        let text=if active.len()==1 {active[0].text.clone()}else {active.iter().map(|c|match &c.speaker {Some(name)=>format!("{name}: {}",c.text),None=>c.text.clone()}).collect::<Vec<_>>().join("\n")};
        result.push(CaptionCue{id:format!("mux-{}",result.len()),start:span[0],end:span[1],text,speaker:None});
    }
    validate_cues(&result)?;Ok(result)
}
#[cfg(test)]
mod parallel_caption_tests {
    use super::*;
    #[test]
    fn one_track_retains_both_speakers_at_overlap() {
        let cue=|id:&str,name:&str,start:f64,end:f64,text:&str|CaptionCue{id:id.into(),speaker:Some(name.into()),start:Tick::from_seconds(start),end:Tick::from_seconds(end),text:text.into()};
        let original=vec![cue("a","Kalle",0.0,2.0,"Hello."),cue("b","Maija",1.0,3.0,"Yes.")];
        let combined=single_track_cues(&original).unwrap();
        assert_eq!(combined.len(),3);assert_eq!(combined[1].text,"Kalle: Hello.\nMaija: Yes.");
        assert_eq!(combined[1].start,Tick::from_seconds(1.0));
        assert!(combined.windows(2).all(|p|p[0].end<=p[1].start));
        assert_eq!(original[0].text,"Hello.");assert!(to_srt(&original).unwrap().contains("Maija: Yes."));
    }
}
