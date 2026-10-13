//! Tekstityksen piirto kuvaan (poltettu tekstitys).
//!
//! Fontti on egui:n mukana tuleva Ubuntu Light (Ubuntu Font Licence 1.0),
//! joten sovellus ei tarvitse järjestelmäfonttia ja tulos on sama joka koneella.
//! Teksti rivitetään pikseleiden mukaan kuvan leveydelle, piirretään valkoisena
//! tummalla ääriviivalla ja puoliläpinäkyvällä taustalla kuvan alareunaan
//! turva-alueen sisään.

use crate::Image;
use ab_glyph::{Font, FontRef, PxScale, ScaleFont};

fn font() -> FontRef<'static> {
    FontRef::try_from_slice(epaint_default_fonts::UBUNTU_LIGHT).expect("sisäänrakennettu fontti")
}

/// Tekstin korkeus pikseleinä kuvan korkeudesta (1080×1920: noin 61 px).
pub fn font_px(height: u32) -> f32 {
    (height as f32 * 0.032).max(14.0)
}

fn text_width<F: Font, SF: ScaleFont<F>>(f: &SF, s: &str) -> f32 {
    let mut w = 0.0;
    let mut prev = None;
    for c in s.chars() {
        let id = f.glyph_id(c);
        if let Some(p) = prev {
            w += f.kern(p, id);
        }
        w += f.h_advance(id);
        prev = Some(id);
    }
    w
}

/// Rivittää sanoittain enintään `max_width` pikselin levyisiksi riveiksi (kovat rivinvaihdot ohitetaan).
pub fn layout(text: &str, px: f32, max_width: f32) -> Vec<String> {
    let font = font();
    let scaled = font.as_scaled(PxScale::from(px));
    let mut lines: Vec<String> = Vec::new();
    let mut cur = String::new();
    for word in text.split_whitespace() {
        let candidate = if cur.is_empty() { word.to_string() } else { format!("{cur} {word}") };
        if cur.is_empty() || text_width(&scaled, &candidate) <= max_width {
            cur = candidate;
        } else {
            lines.push(std::mem::take(&mut cur));
            cur = word.to_string();
        }
    }
    if !cur.is_empty() {
        lines.push(cur);
    }
    lines
}

fn blend(img: &mut Image, x: i32, y: i32, rgb: [u8; 3], alpha: f32) {
    if x < 0 || y < 0 || x >= img.width as i32 || y >= img.height as i32 || alpha <= 0.0 {
        return;
    }
    let i = ((y as u32 * img.width + x as u32) * 4) as usize;
    let a = alpha.clamp(0.0, 1.0);
    for (dst, src) in img.rgba[i..i + 3].iter_mut().zip(rgb) {
        *dst = (*dst as f32 * (1.0 - a) + src as f32 * a).round() as u8;
    }
}

/// Piirtää tekstityksen kuvan alareunaan. Tyhjä teksti ei muuta kuvaa.
pub fn draw(img: &mut Image, text: &str) {
    if text.trim().is_empty() || img.width < 64 || img.height < 64 {
        return;
    }
    let px = font_px(img.height);
    let margin_x = img.width as f32 * 0.06;
    let lines = layout(text, px, img.width as f32 - 2.0 * margin_x);
    if lines.is_empty() {
        return;
    }
    let font = font();
    let scaled = font.as_scaled(PxScale::from(px));
    let line_h = px * 1.25;
    let pad = px * 0.35;
    let block_h = line_h * lines.len() as f32;
    // Alareunan turva-alue: 8 % korkeudesta.
    let bottom = img.height as f32 * 0.92;
    let top = bottom - block_h;
    let widest = lines.iter().map(|l| text_width(&scaled, l)).fold(0.0, f32::max);
    let (bx0, bx1) = (((img.width as f32 - widest) / 2.0 - pad).floor() as i32, ((img.width as f32 + widest) / 2.0 + pad).ceil() as i32);
    for y in ((top - pad * 0.5).floor() as i32)..((bottom + pad * 0.5).ceil() as i32) {
        for x in bx0..bx1 {
            blend(img, x, y, [0, 0, 0], 0.55);
        }
    }
    let outline = (px * 0.06).max(1.0);
    let r = outline.ceil() as i32;
    // Ensin koko tekstin tumma reunus, sitten valkoinen täyttö päälle, ettei seuraavan kirjaimen reunus peitä edellistä.
    for pass in 0..2 {
        for (n, line) in lines.iter().enumerate() {
            let w = text_width(&scaled, line);
            let mut x = (img.width as f32 - w) / 2.0;
            let baseline = top + line_h * n as f32 + (line_h - px) / 2.0 + scaled.ascent();
            let mut prev = None;
            for c in line.chars() {
                let id = scaled.glyph_id(c);
                if let Some(p) = prev {
                    x += scaled.kern(p, id);
                }
                let glyph = id.with_scale_and_position(PxScale::from(px), ab_glyph::point(x, baseline));
                if let Some(outlined) = font.outline_glyph(glyph) {
                    let b = outlined.px_bounds();
                    outlined.draw(|gx, gy, cov| {
                        let (ix, iy) = (b.min.x as i32 + gx as i32, b.min.y as i32 + gy as i32);
                        if pass == 0 {
                            for dy in -r..=r {
                                for dx in -r..=r {
                                    if (dx * dx + dy * dy) as f32 <= outline * outline + 0.5 {
                                        blend(img, ix + dx, iy + dy, [0, 0, 0], (cov * 2.0).min(1.0) * 0.85);
                                    }
                                }
                            }
                        } else {
                            // Ohut fontti: vahvistetaan peittoa, jotta täyttö on selvästi valkoinen.
                            blend(img, ix, iy, [255, 255, 255], (cov * 1.6).min(1.0));
                        }
                    });
                }
                x += scaled.h_advance(id);
                prev = Some(id);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gray(w: u32, h: u32) -> Image {
        let mut img = Image::new(w, h);
        for p in img.rgba.chunks_mut(4) {
            p.copy_from_slice(&[90, 120, 150, 255]);
        }
        img
    }

    #[test]
    fn wraps_to_pixel_width_and_draws_only_in_the_bottom_band() {
        let mut img = gray(270, 480);
        let before = img.clone();
        draw(&mut img, "Good morning, Pipsa. Let us make a show!");
        let changed: Vec<u32> = (0..480u32).filter(|&y| (0..270u32).any(|x| img.pixel(x, y) != before.pixel(x, y))).collect();
        assert!(!changed.is_empty());
        assert!(*changed.first().unwrap() > 480 / 2, "tekstitys vain alaosassa: {changed:?}");
        assert!(*changed.last().unwrap() < (480.0 * 0.95) as u32, "turva-alueen sisällä");
        // Valkoista tekstiä löytyy, ja yläosa on koskematon.
        assert!((0..480u32).any(|y| (0..270u32).any(|x| img.pixel(x, y)[..3].iter().all(|c| *c > 235))));
        let lines = layout("Good morning, Pipsa. Let us make a show!", font_px(480), 270.0 * 0.88);
        assert!(lines.len() >= 2 && lines.iter().all(|l| !l.is_empty()), "{lines:?}");
    }

    #[test]
    fn scandinavian_letters_have_glyphs_and_empty_text_is_a_noop() {
        let mut img = gray(540, 960);
        let before = img.clone();
        draw(&mut img, "   ");
        assert_eq!(img, before);
        draw(&mut img, "Äiti, öljy & åkerö");
        assert_ne!(img, before);
        let f = font();
        assert!(['Ä', 'ö', 'å'].iter().all(|c| f.glyph_id(*c).0 != 0));
    }
}
