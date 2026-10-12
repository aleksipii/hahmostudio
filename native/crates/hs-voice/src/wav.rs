//! PCM-WAV: 16-bit mono -kirjoitus ja luku (16/24/32-bit PCM, 32-bit float,
//! monikanavainen keskiarvoistetaan monoksi).

pub use hs_lipsync::Audio;
use crate::VoiceError;

pub fn encode(audio: &Audio) -> Vec<u8> {
    let data_len = audio.samples.len() * 2;
    let mut out = Vec::with_capacity(44 + data_len);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len as u32).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&audio.sample_rate.to_le_bytes());
    out.extend_from_slice(&(audio.sample_rate * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&(data_len as u32).to_le_bytes());
    for s in &audio.samples {
        out.extend_from_slice(&((s.clamp(-1.0, 1.0) * 32767.0).round() as i16).to_le_bytes());
    }
    out
}

/// Enimmäiskesto luettaessa (kymmenen minuuttia), ettei vahingossa ladata valtavaa tiedostoa muistiin.
pub const MAX_DECODE_SECONDS: u32 = 600;

pub fn decode(bytes: &[u8]) -> Result<Audio, VoiceError> {
    let bad = |m: &str| VoiceError::Audio(m.to_string());
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(bad("Tiedosto ei ole WAV-ääntä."));
    }
    let u16_at = |i: usize| u16::from_le_bytes([bytes[i], bytes[i + 1]]);
    let u32_at = |i: usize| u32::from_le_bytes([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]]);
    let mut pos = 12;
    let mut fmt: Option<(u16, u16, u32, u16)> = None;
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let len = u32_at(pos + 4) as usize;
        let body = pos + 8;
        let end = body.checked_add(len).filter(|e| *e <= bytes.len()).unwrap_or(bytes.len());
        if id == b"fmt " && len >= 16 && body + 16 <= bytes.len() {
            let mut format = u16_at(body);
            if format == 0xfffe && len >= 26 {
                format = u16_at(body + 24); // WAVE_FORMAT_EXTENSIBLE: alityyppi
            }
            fmt = Some((format, u16_at(body + 2), u32_at(body + 4), u16_at(body + 14)));
        } else if id == b"data" {
            let (format, channels, rate, bits) = fmt.ok_or_else(|| bad("WAV-tiedostosta puuttuu muoto."))?;
            if channels == 0 || channels > 8 || !(8000..=192_000).contains(&rate) {
                return Err(bad("WAV-tiedoston kanavat tai näytetaajuus eivät kelpaa."));
            }
            let data = &bytes[body..end];
            let width = (bits / 8) as usize;
            let frame = width * channels as usize;
            if frame == 0 {
                return Err(bad("WAV-tiedoston näytekoko ei kelpaa."));
            }
            let frames = data.len() / frame;
            if frames as u64 > rate as u64 * MAX_DECODE_SECONDS as u64 {
                return Err(bad("Ääni on liian pitkä."));
            }
            let read = |off: usize| -> Option<f32> {
                let b = &data[off..off + width];
                Some(match (format, bits) {
                    (1, 16) => i16::from_le_bytes([b[0], b[1]]) as f32 / 32768.0,
                    (1, 24) => (i32::from_le_bytes([0, b[0], b[1], b[2]]) >> 8) as f32 / 8_388_608.0,
                    (1, 32) => i32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f32 / 2_147_483_648.0,
                    (1, 8) => (b[0] as f32 - 128.0) / 128.0,
                    (3, 32) => f32::from_le_bytes([b[0], b[1], b[2], b[3]]),
                    _ => return None,
                })
            };
            let mut samples = Vec::with_capacity(frames);
            for f in 0..frames {
                let mut sum = 0.0;
                for c in 0..channels as usize {
                    sum += read(f * frame + c * width).ok_or_else(|| bad("WAV-muotoa ei tueta (vain PCM ja 32-bit float)."))?;
                }
                samples.push(sum / channels as f32);
            }
            return Ok(Audio { samples, sample_rate: rate });
        }
        pos = body + len + (len & 1);
    }
    Err(bad("WAV-tiedostosta puuttuu ääni."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_and_resamples() {
        let a = Audio { samples: (0..2400).map(|i| (i as f32 * 0.05).sin() * 0.5).collect(), sample_rate: 24000 };
        let b = decode(&encode(&a)).unwrap();
        assert_eq!(b.sample_rate, 24000);
        assert_eq!(b.samples.len(), 2400);
        assert!(a.samples.iter().zip(&b.samples).all(|(x, y)| (x - y).abs() < 1e-4));
        let r = a.resampled(48000);
        assert_eq!(r.samples.len(), 4800);
        assert!((r.duration() - a.duration()).abs() < 1e-6);
        assert!(decode(b"RIFF....WAVEjunk").is_err());
    }
}
