//! Local soundtrack editing. Dialogue stays on the common tick timebase.
pub mod script;
use hs_core::{Tick, TICKS_PER_SECOND};
use hs_lipsync::Audio;
use std::collections::HashSet;
pub const MAX_BYTES: usize = 128 * 1024 * 1024;
pub const MAX_TRACKS: usize = 64;
const MAX_TIME: i64 = 60 * TICKS_PER_SECOND;
#[derive(Clone, Debug, PartialEq)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub audio: Audio,
    pub start: Tick,
    pub gain: f32,
    pub fade_in: Tick,
    pub fade_out: Tick,
    pub loop_audio: bool,
    pub mute: bool,
    pub duck: bool,
}
impl Track {
    pub fn new(id: String, name: String, audio: Audio) -> Self {
        Self {
            id,
            name,
            audio,
            start: Tick::ZERO,
            gain: 0.5,
            fade_in: Tick::ZERO,
            fade_out: Tick::ZERO,
            loop_audio: false,
            mute: false,
            duck: true,
        }
    }
}
fn validate_audio(a: &Audio) -> Result<(), String> {
    if !(8000..=192000).contains(&a.sample_rate)
        || a.samples.len() as u64 > a.sample_rate as u64 * 60
        || a.samples.iter().any(|s| !s.is_finite() || s.abs() > 1.0)
    {
        return Err("Audio must be finite PCM, 8–192 kHz and at most 60 seconds".into());
    }
    Ok(())
}
pub fn validate_tracks(tracks: &[Track]) -> Result<(), String> {
    if tracks.len() > MAX_TRACKS {
        return Err("Too many soundtrack tracks".into());
    }
    let mut ids = HashSet::new();
    let mut bytes = 0usize;
    for t in tracks {
        validate_audio(&t.audio)?;
        if t.audio.samples.is_empty()
            || t.id.is_empty()
            || t.id.len() > 256
            || t.name.len() > 1024
            || !ids.insert(&t.id)
            || !(0..=MAX_TIME).contains(&t.start.0)
            || !(0..=MAX_TIME).contains(&t.fade_in.0)
            || !(0..=MAX_TIME).contains(&t.fade_out.0)
            || !t.gain.is_finite()
            || !(0.0..=4.0).contains(&t.gain)
        {
            return Err("Invalid soundtrack track".into());
        }
        bytes = bytes
            .checked_add(t.audio.samples.len() * 4 + t.id.len() + t.name.len() + 64)
            .ok_or("Soundtrack too large")?;
    }
    if bytes > MAX_BYTES {
        return Err("Soundtrack exceeds 128 MiB".into());
    }
    Ok(())
}
/// Mix exactly the requested episode duration, resampling only soundtrack clips.
/// No speech speed change. Attack/release ducking follows dialogue amplitude.
pub fn mix(dialogue: &Audio, tracks: &[Track], duration: Tick) -> Result<Audio, String> {
    validate_audio(dialogue)?;
    validate_tracks(tracks)?;
    if !(0..=MAX_TIME).contains(&duration.0) {
        return Err("Episode duration exceeds 60 seconds".into());
    }
    let rate = dialogue.sample_rate;
    let n = ((duration.0 as u128 * rate as u128) / TICKS_PER_SECOND as u128) as usize;
    let mut samples = vec![0.0; n];
    for (i, s) in samples.iter_mut().enumerate() {
        *s = dialogue.samples.get(i).copied().unwrap_or(0.0);
    }
    let mut envelope = vec![0.0; n];
    let mut level = 0.0f32;
    let attack = 1.0 - (-1.0 / (rate as f32 * 0.01)).exp();
    let release = 1.0 - (-1.0 / (rate as f32 * 0.15)).exp();
    for (i, e) in envelope.iter_mut().enumerate() {
        let target = dialogue.samples.get(i).copied().unwrap_or(0.0).abs();
        level += (target - level) * if target > level { attack } else { release };
        *e = if level > 0.015 { 0.25 } else { 1.0 };
    }
    for t in tracks.iter().filter(|t| !t.mute) {
        let a = t.audio.resampled(rate);
        if a.samples.is_empty() {
            continue;
        }
        let start = ((t.start.0 as u128 * rate as u128) / TICKS_PER_SECOND as u128) as usize;
        let end = if t.loop_audio {
            n
        } else {
            start.saturating_add(a.samples.len()).min(n)
        };
        let fi = t.fade_in.seconds() * rate as f64;
        let fo = t.fade_out.seconds() * rate as f64;
        for i in start..end {
            let j = i - start;
            let fade = if fi > 0.0 {
                (j as f64 / fi).min(1.0)
            } else {
                1.0
            } * if fo > 0.0 {
                ((end - i) as f64 / fo).min(1.0)
            } else {
                1.0
            };
            samples[i] += a.samples[j % a.samples.len()]
                * t.gain
                * fade as f32
                * if t.duck { envelope[i] } else { 1.0 };
        }
    }
    // Linear below 0.9: ordinary dialogue is bit-preserved; smooth limiting above.
    for s in &mut samples {
        if s.abs() > 0.9 {
            *s = s.signum() * (0.9 + 0.1 * ((s.abs() - 0.9) / 0.1).tanh());
        }
    }
    Ok(Audio {
        samples,
        sample_rate: rate,
    })
}
/// Versioned bounded binary workspace, lossless f32 PCM (no sample quantization).
pub fn encode_workspace(tracks: &[Track]) -> Result<Vec<u8>, String> {
    validate_tracks(tracks)?;
    let mut b = b"KOETAEDIT1".to_vec();
    b.extend_from_slice(&(tracks.len() as u32).to_le_bytes());
    for t in tracks {
        for s in [&t.id, &t.name] {
            b.extend_from_slice(&(s.len() as u32).to_le_bytes());
            b.extend_from_slice(s.as_bytes());
        }
        for tick in [t.start, t.fade_in, t.fade_out] {
            b.extend_from_slice(&tick.0.to_le_bytes());
        }
        b.extend_from_slice(&t.gain.to_le_bytes());
        b.push(t.loop_audio as u8);
        b.push(t.mute as u8);
        b.push(t.duck as u8);
        b.extend_from_slice(&t.audio.sample_rate.to_le_bytes());
        b.extend_from_slice(&(t.audio.samples.len() as u32).to_le_bytes());
        for s in &t.audio.samples {
            b.extend_from_slice(&s.to_le_bytes());
        }
    }
    if b.len() > MAX_BYTES {
        return Err("Workspace too large".into());
    }
    Ok(b)
}
pub fn decode_workspace(bytes: &[u8]) -> Result<Vec<Track>, String> {
    if bytes.len() > MAX_BYTES {
        return Err("Workspace too large".into());
    }
    let mut r = Reader(bytes);
    if r.take(10)? != b"KOETAEDIT1" {
        return Err("Unsupported editing workspace".into());
    }
    let count = r.u32()? as usize;
    if count > MAX_TRACKS {
        return Err("Too many tracks".into());
    }
    let mut tracks = Vec::new();
    for _ in 0..count {
        let id = r.string(256)?;
        let name = r.string(1024)?;
        let start = Tick(r.i64()?);
        let fade_in = Tick(r.i64()?);
        let fade_out = Tick(r.i64()?);
        let gain = r.float()?;
        let loop_audio = r.boolean()?;
        let mute = r.boolean()?;
        let duck = r.boolean()?;
        let sample_rate = r.u32()?;
        let n = r.u32()? as usize;
        if n > 192000 * 60 || n > r.0.len() / 4 {
            return Err("Invalid PCM size".into());
        }
        let mut samples = Vec::with_capacity(n);
        for _ in 0..n {
            samples.push(r.float()?);
        }
        tracks.push(Track {
            id,
            name,
            audio: Audio {
                samples,
                sample_rate,
            },
            start,
            fade_in,
            fade_out,
            gain,
            loop_audio,
            mute,
            duck,
        });
    }
    if !r.0.is_empty() {
        return Err("Trailing workspace data".into());
    }
    validate_tracks(&tracks)?;
    Ok(tracks)
}
struct Reader<'a>(&'a [u8]);
impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        if n > self.0.len() {
            return Err("Truncated workspace".into());
        }
        let (a, b) = self.0.split_at(n);
        self.0 = b;
        Ok(a)
    }
    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn i64(&mut self) -> Result<i64, String> {
        Ok(i64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
    fn float(&mut self) -> Result<f32, String> {
        Ok(f32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn boolean(&mut self) -> Result<bool, String> {
        match self.take(1)?[0] {
            0 => Ok(false),
            1 => Ok(true),
            _ => Err("Invalid flag".into()),
        }
    }
    fn string(&mut self, max: usize) -> Result<String, String> {
        let n = self.u32()? as usize;
        if n > max {
            return Err("Text too long".into());
        }
        String::from_utf8(self.take(n)?.to_vec()).map_err(|_| "Invalid UTF-8".into())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn audio(v: f32) -> Audio {
        Audio {
            samples: vec![v; 8000],
            sample_rate: 8000,
        }
    }
    #[test]
    fn codec() {
        let t = Track::new("a".into(), "music".into(), audio(0.2));
        let b = encode_workspace(&[t.clone()]).unwrap();
        assert_eq!(decode_workspace(&b).unwrap(), vec![t]);
        assert!(decode_workspace(&b[..b.len() - 1]).is_err());
    }
    #[test]
    fn preserves_dialogue() {
        let a = audio(0.3);
        assert_eq!(mix(&a, &[], Tick::from_seconds(1.0)).unwrap(), a);
    }
    #[test]
    fn offset_and_fades() {
        let mut t = Track::new("a".into(), "fx".into(), audio(0.4));
        t.start = Tick::from_seconds(0.5);
        t.fade_in = Tick::from_seconds(0.1);
        t.duck = false;
        let m = mix(&audio(0.0), &[t], Tick::from_seconds(1.0)).unwrap();
        assert_eq!(m.samples[3999], 0.0);
        assert_eq!(m.samples[4000], 0.0);
        assert!((m.samples[4800] - 0.2).abs() < 1e-6);
    }
    #[test]
    fn duck() {
        let t = Track::new("a".into(), "music".into(), audio(0.4));
        let m = mix(&audio(0.2), &[t], Tick::from_seconds(1.0)).unwrap();
        assert!((m.samples[4000] - 0.25).abs() < 1e-6);
    }
    #[test]
    fn rejects_nan() {
        let mut t = Track::new("a".into(), "x".into(), audio(0.0));
        t.audio.samples[0] = f32::NAN;
        assert!(validate_tracks(&[t]).is_err());
    }
    #[test]
    fn loop_mute_and_release() {
        let mut t = Track::new("a".into(), "fx".into(), audio(0.4));
        t.audio.samples.truncate(4000);
        t.loop_audio = true;
        t.duck = false;
        t.fade_out = Tick::from_seconds(0.1);
        let m = mix(&audio(0.0), &[t.clone()], Tick::from_seconds(1.0)).unwrap();
        assert!((m.samples[5000] - 0.2).abs() < 1e-6);
        assert!(m.samples[7999] < 0.001);
        t.mute = true;
        assert!(mix(&audio(0.0), &[t], Tick::from_seconds(1.0))
            .unwrap()
            .samples
            .iter()
            .all(|s| *s == 0.0));
    }
    #[test]
    fn rejects_limits_and_trailing_data() {
        assert!(mix(&audio(0.0), &[], Tick::from_seconds(61.0)).is_err());
        let mut t = Track::new("a".into(), "fx".into(), audio(0.4));
        t.start = Tick(-1);
        assert!(validate_tracks(&[t]).is_err());
        let mut bytes = encode_workspace(&[]).unwrap();
        bytes.push(0);
        assert!(decode_workspace(&bytes).is_err());
    }
}
