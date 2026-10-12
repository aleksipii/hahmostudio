//! Äänen toisto ja mikrofoni (cpal: macOS CoreAudio, Linux ALSA, Windows WASAPI).
//!
//! * [`Player`] soittaa jakson miksauksen ja kertoo toistokohdan, jota
//!   esikatselu seuraa (kuva ja ääni pysyvät tahdissa).
//! * [`Recorder`] äänittää mikrofonista monona ja näyttää tason.
//! * [`LiveMouth`] laskee mikrofonin äänestä suun muodon reaaliajassa
//!   (esitystila, Adobe Characterin tapaan).
//!
//! Laitteen näytetaajuus ja -muoto mukautetaan: toisto uudelleennäytteistää
//! lennossa ja äänitys muunnetaan 48 kHz:iin.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, SizedSample, StreamConfig};
use hs_lipsync::{Audio, MouthShape, Viseme};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

pub const RATE: u32 = 48_000;
/// Äänityksen enimmäiskesto.
pub const MAX_RECORD_SECONDS: f32 = 120.0;

fn f32_from<T: cpal::Sample>(s: T) -> f32
where
    f32: cpal::FromSample<T>,
{
    <f32 as cpal::FromSample<T>>::from_sample_(s)
}

struct PlayShared {
    audio: Mutex<Option<Arc<Audio>>>,
    /// Toistokohta sekunteina (f64-bitit).
    position: AtomicU64,
    playing: AtomicBool,
    volume: AtomicU32,
}

impl PlayShared {
    fn pos(&self) -> f64 {
        f64::from_bits(self.position.load(Ordering::Relaxed))
    }
    fn set_pos(&self, t: f64) {
        self.position.store(t.to_bits(), Ordering::Relaxed);
    }
}

pub struct Player {
    _stream: cpal::Stream,
    shared: Arc<PlayShared>,
    pub device_name: String,
    pub sample_rate: u32,
}

impl Player {
    pub fn new() -> Result<Player, String> {
        let host = cpal::default_host();
        let device = host.default_output_device().ok_or("Äänilaitetta ei löytynyt.")?;
        let supported = device.default_output_config().map_err(|e| format!("Äänilaite: {e}"))?;
        let config = supported.config();
        let shared = Arc::new(PlayShared {
            audio: Mutex::new(None),
            position: AtomicU64::new(0f64.to_bits()),
            playing: AtomicBool::new(false),
            volume: AtomicU32::new(1f32.to_bits()),
        });
        let stream = match supported.sample_format() {
            SampleFormat::F32 => build_output::<f32>(&device, config, shared.clone()),
            SampleFormat::I16 => build_output::<i16>(&device, config, shared.clone()),
            SampleFormat::U16 => build_output::<u16>(&device, config, shared.clone()),
            SampleFormat::I32 => build_output::<i32>(&device, config, shared.clone()),
            other => return Err(format!("Äänimuotoa {other} ei tueta.")),
        }?;
        stream.play().map_err(|e| format!("Äänilaite: {e}"))?;
        let device_name = device.description().map(|d| d.to_string()).unwrap_or_else(|_| "oletus".into());
        Ok(Player { _stream: stream, shared, device_name, sample_rate: config.sample_rate })
    }

    /// Vaihtaa soitettavan äänen (esim. kun käsikirjoitus muuttuu). Toistokohta säilyy.
    pub fn set_audio(&self, audio: Option<Arc<Audio>>) {
        *self.shared.audio.lock().unwrap() = audio;
    }

    pub fn play_from(&self, t: f32) {
        self.shared.set_pos(t.max(0.0) as f64);
        self.shared.playing.store(true, Ordering::Relaxed);
    }

    pub fn pause(&self) {
        self.shared.playing.store(false, Ordering::Relaxed);
    }

    pub fn is_playing(&self) -> bool {
        self.shared.playing.load(Ordering::Relaxed)
    }

    pub fn position(&self) -> f32 {
        self.shared.pos() as f32
    }

    pub fn set_volume(&self, v: f32) {
        self.shared.volume.store(v.clamp(0.0, 2.0).to_bits(), Ordering::Relaxed);
    }
}

fn build_output<T>(device: &cpal::Device, config: StreamConfig, shared: Arc<PlayShared>) -> Result<cpal::Stream, String>
where
    T: SizedSample + cpal::FromSample<f32>,
{
    let channels = config.channels.max(1) as usize;
    let step = 1.0 / config.sample_rate.max(1) as f64;
    device
        .build_output_stream::<T, _, _>(
            config,
            move |data: &mut [T], _| {
                let playing = shared.playing.load(Ordering::Relaxed);
                let volume = f32::from_bits(shared.volume.load(Ordering::Relaxed));
                // Älä odota lukkoa äänisäikeessä: jos ääntä vaihdetaan juuri nyt, soita hiljaisuutta.
                let guard = shared.audio.try_lock().ok();
                let audio = guard.as_ref().and_then(|g| g.as_ref());
                let mut t = shared.pos();
                for frame in data.chunks_mut(channels) {
                    let s = match (playing, audio) {
                        (true, Some(a)) => sample_at(a, t) * volume,
                        _ => 0.0,
                    };
                    if playing {
                        t += step;
                    }
                    let v = T::from_sample(s.clamp(-1.0, 1.0));
                    frame.iter_mut().for_each(|x| *x = v);
                }
                if playing {
                    shared.set_pos(t);
                }
            },
            |e| eprintln!("äänilaite: {e}"),
            None,
        )
        .map_err(|e| format!("Äänilaite: {e}"))
}

/// Lineaarisesti interpoloitu näyte hetkellä `t` (sekunteina).
pub fn sample_at(a: &Audio, t: f64) -> f32 {
    let x = t * a.sample_rate as f64;
    if x < 0.0 {
        return 0.0;
    }
    let i = x as usize;
    let f = (x - i as f64) as f32;
    match (a.samples.get(i), a.samples.get(i + 1)) {
        (Some(s0), Some(s1)) => s0 * (1.0 - f) + s1 * f,
        (Some(s0), None) => *s0,
        _ => 0.0,
    }
}

struct RecShared {
    samples: Mutex<Vec<f32>>,
    level: AtomicU32,
    max: usize,
}

/// Mikrofoniäänitys. Pudotus (drop) lopettaa äänityksen.
pub struct Recorder {
    _stream: cpal::Stream,
    shared: Arc<RecShared>,
    rate: u32,
    pub device_name: String,
}

impl Recorder {
    pub fn start() -> Result<Recorder, String> {
        let host = cpal::default_host();
        let device = host.default_input_device().ok_or("Mikrofonia ei löytynyt.")?;
        let supported = device.default_input_config().map_err(|e| format!("Mikrofoni: {e}"))?;
        let config = supported.config();
        let rate = config.sample_rate;
        let shared = Arc::new(RecShared {
            samples: Mutex::new(Vec::with_capacity(rate as usize * 10)),
            level: AtomicU32::new(0),
            max: (rate as f32 * MAX_RECORD_SECONDS) as usize,
        });
        let stream = match supported.sample_format() {
            SampleFormat::F32 => build_input::<f32>(&device, config, shared.clone()),
            SampleFormat::I16 => build_input::<i16>(&device, config, shared.clone()),
            SampleFormat::U16 => build_input::<u16>(&device, config, shared.clone()),
            SampleFormat::I32 => build_input::<i32>(&device, config, shared.clone()),
            other => return Err(format!("Mikrofonin muotoa {other} ei tueta.")),
        }?;
        stream.play().map_err(|e| format!("Mikrofoni: {e} (salli mikrofoni Järjestelmäasetuksissa)"))?;
        let device_name = device.description().map(|d| d.to_string()).unwrap_or_else(|_| "oletus".into());
        Ok(Recorder { _stream: stream, shared, rate, device_name })
    }

    /// Viimeisimmän puskurin taso 0..1 (RMS).
    pub fn level(&self) -> f32 {
        f32::from_bits(self.shared.level.load(Ordering::Relaxed))
    }

    pub fn seconds(&self) -> f32 {
        self.shared.samples.lock().unwrap().len() as f32 / self.rate as f32
    }

    /// Viimeiset `seconds` sekuntia (reaaliaikaiseen huulisynkkaan).
    pub fn tail(&self, seconds: f32) -> Audio {
        let s = self.shared.samples.lock().unwrap();
        let n = ((seconds * self.rate as f32) as usize).min(s.len());
        Audio { samples: s[s.len() - n..].to_vec(), sample_rate: self.rate }
    }

    /// Lopettaa ja palauttaa äänityksen 48 kHz:nä.
    pub fn finish(self) -> Audio {
        let samples = std::mem::take(&mut *self.shared.samples.lock().unwrap());
        Audio { samples, sample_rate: self.rate }.resampled(RATE)
    }
}

fn build_input<T>(device: &cpal::Device, config: StreamConfig, shared: Arc<RecShared>) -> Result<cpal::Stream, String>
where
    T: SizedSample,
    f32: cpal::FromSample<T>,
{
    let channels = config.channels.max(1) as usize;
    device
        .build_input_stream::<T, _, _>(
            config,
            move |data: &[T], _| {
                let mut sum = 0.0;
                let mono: Vec<f32> = data
                    .chunks(channels)
                    .map(|f| {
                        let v = f.iter().map(|x| f32_from(*x)).sum::<f32>() / channels as f32;
                        sum += v * v;
                        v
                    })
                    .collect();
                if !mono.is_empty() {
                    shared.level.store(((sum / mono.len() as f32).sqrt()).to_bits(), Ordering::Relaxed);
                }
                if let Ok(mut s) = shared.samples.try_lock() {
                    let room = shared.max.saturating_sub(s.len());
                    s.extend_from_slice(&mono[..mono.len().min(room)]);
                }
            },
            |e| eprintln!("mikrofoni: {e}"),
            None,
        )
        .map_err(|e| format!("Mikrofoni: {e}"))
}

/// Reaaliaikainen suu mikrofonista: lyhyt ikkuna analysoidaan joka ruudulla.
pub struct LiveMouth {
    /// Hiljaisuusraja (RMS); tätä hiljaisempi ääni = suu kiinni.
    pub gate: f32,
    smoothed: MouthShape,
}

impl Default for LiveMouth {
    fn default() -> Self {
        LiveMouth { gate: 0.012, smoothed: Viseme::Rest.shape() }
    }
}

impl LiveMouth {
    /// `window` on viimeiset ~0,4 s ääntä. `dt` on ruudun kesto (pehmennys).
    pub fn update(&mut self, window: &Audio, dt: f32) -> MouthShape {
        let rate = window.sample_rate.max(1) as usize;
        let last = &window.samples[window.samples.len().saturating_sub(rate / 25)..];
        let rms = (last.iter().map(|x| x * x).sum::<f32>() / last.len().max(1) as f32).sqrt();
        let target = if rms < self.gate || window.duration() < 0.1 {
            Viseme::Rest.shape()
        } else {
            let track = hs_lipsync::from_audio(window);
            let mut shape = track.viseme_at(window.duration() - 0.02).shape();
            // Voimakkuus avaa suuta kuten esitallennetussa synkassa.
            if shape.open > 0.0 {
                shape.open *= (0.5 + rms * 6.0).min(1.0);
            }
            shape
        };
        let k = 1.0 - (-dt * 25.0).exp();
        self.smoothed = self.smoothed.lerp(target, k);
        self.smoothed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpolates_and_bounds() {
        let a = Audio { samples: vec![0.0, 1.0, 0.0], sample_rate: 2 };
        assert_eq!(sample_at(&a, 0.25), 0.5);
        assert_eq!(sample_at(&a, -1.0), 0.0);
        assert_eq!(sample_at(&a, 10.0), 0.0);
    }

    #[test]
    fn live_mouth_opens_on_speech_and_closes_on_silence() {
        let mut live = LiveMouth::default();
        let speech = Audio::synthetic_speech("Aaa aaa aaa", 0.6, 160.0);
        // Ikkuna, joka päättyy keskelle sanaa.
        let mid = (0.35 * speech.sample_rate as f32) as usize;
        let window = Audio { samples: speech.samples[..mid].to_vec(), sample_rate: speech.sample_rate };
        let mut open = 0.0f32;
        for _ in 0..10 {
            open = live.update(&window, 1.0 / 30.0).open;
        }
        assert!(open > 0.2, "{open}");
        let silence = Audio { samples: vec![0.0; 9600], sample_rate: 24000 };
        for _ in 0..10 {
            open = live.update(&silence, 1.0 / 30.0).open;
        }
        assert!(open < 0.02, "{open}");
    }

    /// Pilvessä ei ole äänilaitteita; laitetesti ajetaan vain, jos laite löytyy.
    #[test]
    fn devices_when_available() {
        match Player::new() {
            Ok(p) => {
                p.set_audio(Some(Arc::new(Audio { samples: vec![0.0; 4800], sample_rate: 48000 })));
                p.play_from(0.0);
                std::thread::sleep(std::time::Duration::from_millis(50));
                assert!(p.is_playing());
                p.pause();
            }
            Err(e) => eprintln!("ohitettu: {e}"),
        }
    }
}
