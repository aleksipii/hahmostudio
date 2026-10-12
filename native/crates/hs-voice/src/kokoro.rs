//! Kokoro-82M puhtaalla Rustilla.
//!
//! * Teksti → foneemit: `loqui-g2p` (misakin sanastot ja pieni neuroverkko
//!   tuntemattomille sanoille; ei eSpeakia eikä GPL-koodia).
//! * Foneemit → ääni: `omp-voice-kokoro` (candle; macOS:llä Metal, muualla CPU).
//!
//! Painot luetaan alkuperäisestä `kokoro-v1_0.pth`-tiedostosta ja äänet
//! `voices/<id>.bin`-tiedostoista (510×256 f32). Mitään ei ladata verkosta
//! tässä moduulissa: [`crate::store::ModelStore`] hoitaa tiedostot.

use crate::engine::{Speech, SpeechEngine, SpeechRequest};
use crate::spoken::{is_voice, MODEL_VERSION};
use crate::wav::Audio;
use crate::VoiceError;
use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use loqui_g2p::{Dialect, G2p, OovFallback};
use omp_voice_kokoro::{KModel, ModelConfig, SynthesisMode};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

const SAMPLE_RATE: u32 = 24000;
/// Mallin konteksti on 512 merkkiä BOS/EOS mukaan lukien; jaetaan lauseisiin varmuusvaralla.
const MAX_CHUNK: usize = 400;
const STYLE_ROWS: usize = 510;
const STYLE_DIM: usize = 256;

pub struct KokoroEngine {
    model: KModel,
    vocab: HashMap<char, i64>,
    device: Device,
    dir: PathBuf,
    voices: Mutex<HashMap<String, Vec<f32>>>,
    american: OnceLock<Result<G2p, String>>,
    british: OnceLock<Result<G2p, String>>,
}

fn model_err(e: impl std::fmt::Display) -> VoiceError {
    VoiceError::Model(format!("Kokoro-mallin avaus epäonnistui: {e}"))
}

/// PyTorchin uudempi weight_norm-nimeäminen vanhaksi (`weight_g`/`weight_v`), jota malli odottaa.
fn normalize_name(name: &str) -> String {
    let n = name.strip_prefix("module.").unwrap_or(name);
    n.replace("parametrizations.weight.original0", "weight_g").replace("parametrizations.weight.original1", "weight_v")
}

impl KokoroEngine {
    /// Avaa mallin kansiosta (ks. [`crate::store::model_files`]).
    pub fn load(dir: &Path) -> Result<Self, VoiceError> {
        let config: ModelConfig =
            serde_json::from_slice(&std::fs::read(dir.join("config.json"))?).map_err(model_err)?;
        let device = Self::device();
        let pth = dir.join("kokoro-v1_0.pth");
        let mut tensors: HashMap<String, Tensor> = HashMap::new();
        for key in ["bert", "bert_encoder", "predictor", "text_encoder", "decoder"] {
            let file = candle_core::pickle::PthTensors::new(&pth, Some(key)).map_err(model_err)?;
            for name in file.tensor_infos().keys() {
                let t = file.get(name).map_err(model_err)?.ok_or_else(|| model_err(name))?;
                let t = t.to_dtype(DType::F32).map_err(model_err)?.to_device(&device).map_err(model_err)?;
                tensors.insert(format!("{key}.{}", normalize_name(name)), t);
            }
        }
        if tensors.is_empty() {
            return Err(model_err("painotiedosto on tyhjä"));
        }
        let vb = VarBuilder::from_tensors(tensors, DType::F32, &device);
        let model = KModel::load(&config, vb).map_err(model_err)?;
        let vocab = config.vocab.iter().filter_map(|(k, v)| Some((k.chars().next()?, *v))).collect();
        Ok(KokoroEngine {
            model,
            vocab,
            device,
            dir: dir.to_path_buf(),
            voices: Mutex::new(HashMap::new()),
            american: OnceLock::new(),
            british: OnceLock::new(),
        })
    }

    fn device() -> Device {
        #[cfg(target_os = "macos")]
        if let Ok(d) = Device::new_metal(0) {
            return d;
        }
        Device::Cpu
    }

    fn g2p(&self, voice: &str) -> Result<&G2p, VoiceError> {
        let dialect = Dialect::for_kokoro_voice(voice).unwrap_or(Dialect::American);
        let cell = if dialect == Dialect::British { &self.british } else { &self.american };
        cell.get_or_init(|| G2p::new(dialect, OovFallback::Neural).map_err(|e| e.to_string()))
            .as_ref()
            .map_err(|e| VoiceError::Model(format!("Ääntämissanasto ei avautunut: {e}")))
    }

    fn style(&self, voice: &str) -> Result<Vec<f32>, VoiceError> {
        if let Some(v) = self.voices.lock().unwrap().get(voice) {
            return Ok(v.clone());
        }
        let bytes = std::fs::read(self.dir.join(format!("voices/{voice}.bin")))
            .map_err(|_| VoiceError::Model(format!("Ääni {voice} puuttuu mallikansiosta.")))?;
        if bytes.len() != STYLE_ROWS * STYLE_DIM * 4 {
            return Err(VoiceError::Model(format!("Äänitiedosto {voice} on väärän kokoinen.")));
        }
        let v: Vec<f32> = bytes.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
        self.voices.lock().unwrap().insert(voice.to_string(), v.clone());
        Ok(v)
    }

    /// Foneemit malliin sopiviksi paloiksi lauseiden rajoilta.
    fn chunks(phonemes: &str) -> Vec<String> {
        let mut out = Vec::new();
        let mut cur = String::new();
        for sentence in phonemes.split_inclusive(['.', '!', '?', ';', ':', ',']) {
            if cur.chars().count() + sentence.chars().count() > MAX_CHUNK && !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            if sentence.chars().count() > MAX_CHUNK {
                // Poikkeuksellisen pitkä lause: jaa välilyönneistä.
                for word in sentence.split_inclusive(' ') {
                    if cur.chars().count() + word.chars().count() > MAX_CHUNK && !cur.is_empty() {
                        out.push(std::mem::take(&mut cur));
                    }
                    cur.push_str(word);
                }
            } else {
                cur.push_str(sentence);
            }
        }
        if !cur.trim().is_empty() {
            out.push(cur);
        }
        out
    }
}

impl SpeechEngine for KokoroEngine {
    fn id(&self) -> &str {
        "kokoro"
    }
    fn model_version(&self) -> &str {
        MODEL_VERSION
    }
    fn synthesize(&self, r: &SpeechRequest, cancel: &AtomicBool) -> Result<Speech, VoiceError> {
        // Vain studion äänilista: äänen nimestä tulee tiedostopolku ja murre.
        if !is_voice(&r.voice) {
            return Err(VoiceError::Model(format!("Tuntematon Kokoro-ääni {}.", r.voice)));
        }
        if !r.speed.is_finite() || !(0.5..=2.0).contains(&r.speed) {
            return Err(VoiceError::Engine(format!("Puhenopeus {} ei kelpaa.", r.speed)));
        }
        let phonemes = self.g2p(&r.voice)?.phonemize(&r.text);
        let style = self.style(&r.voice)?;
        let mut samples = Vec::new();
        for chunk in Self::chunks(&phonemes) {
            if cancel.load(Ordering::Relaxed) {
                return Err(VoiceError::Cancelled);
            }
            let ids: Vec<i64> = chunk.chars().filter_map(|c| self.vocab.get(&c).copied()).collect();
            if ids.is_empty() {
                continue;
            }
            let row = ids.len().min(STYLE_ROWS) - 1;
            let ref_s = Tensor::from_slice(&style[row * STYLE_DIM..(row + 1) * STYLE_DIM], (1, STYLE_DIM), &self.device)
                .map_err(model_err)?;
            let audio = self
                .model
                .forward_with_mode(&ids, &ref_s, r.speed, &self.device, SynthesisMode::Stochastic)
                .and_then(|t| t.to_device(&Device::Cpu)?.to_vec1::<f32>())
                .map_err(|e| VoiceError::Engine(format!("Puhesynteesi epäonnistui: {e}")))?;
            samples.extend(audio);
        }
        if samples.is_empty() {
            return Err(VoiceError::Engine("Rivistä ei saatu lausuttavia äänteitä.".into()));
        }
        Ok(Speech { audio: Audio { samples, sample_rate: SAMPLE_RATE }, phonemes: Some(phonemes) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn g2p_and_chunking_work_without_model() {
        let g = G2p::new(Dialect::American, OovFallback::Neural).unwrap();
        let p = g.phonemize("Hello world. Mama made pancakes!");
        assert!(p.contains('m') && p.contains('.'), "{p}");
        let long = "ab ".repeat(300) + ". " + &"cd ".repeat(10);
        let chunks = KokoroEngine::chunks(&long);
        assert!(chunks.len() >= 2);
        assert!(chunks.iter().all(|c| c.chars().count() <= MAX_CHUNK));
        assert_eq!(chunks.concat(), long);
        assert_eq!(normalize_name("module.generator.conv_post.parametrizations.weight.original0"), "generator.conv_post.weight_g");
    }

    #[test]
    fn every_studio_voice_has_an_english_dialect() {
        for (v, _) in crate::spoken::VOICES {
            let d = Dialect::for_kokoro_voice(v).unwrap_or_else(|| panic!("{v}: ei murretta"));
            assert_eq!(d == Dialect::British, v.starts_with('b'), "{v}");
        }
        // Britti- ja amerikkalainen sanasto antavat eri ääntämyksen samalle sanalle.
        let us = G2p::new(Dialect::American, OovFallback::Neural).unwrap().phonemize("Tomato, water.");
        let uk = G2p::new(Dialect::British, OovFallback::Neural).unwrap().phonemize("Tomato, water.");
        assert_ne!(us, uk);
    }

    /// Oikea Kokoro-synteesi kahdella hahmolla. Ei kuulu tavalliseen ajoon (`ignored`),
    /// jotta ohitus ei näytä läpäisyltä: aja
    /// `HAHMOSTUDIO_KOKORO_DIR=<asennettu malli> cargo test -p hs-voice --release -- --ignored`.
    /// `HAHMOSTUDIO_KOKORO_OUT=<kansio>` tallentaa WAVit kuuntelua varten.
    #[test]
    #[ignore = "vaatii käyttäjän luvalla asennetun Kokoro-mallin (HAHMOSTUDIO_KOKORO_DIR)"]
    fn real_model_speaks_two_characters() {
        let dir = std::env::var_os("HAHMOSTUDIO_KOKORO_DIR").expect("HAHMOSTUDIO_KOKORO_DIR puuttuu: oikeaa synteesiä ei ajettu");
        let engine = KokoroEngine::load(Path::new(&dir)).unwrap();
        let never = AtomicBool::new(false);
        let out = std::env::var_os("HAHMOSTUDIO_KOKORO_OUT").map(PathBuf::from);
        let mut takes = Vec::new();
        for (name, voice, text) in [("pipsa", "af_heart", "Hello there! Are you ready?"), ("ville", "am_adam", "Hello there! Are you ready?")] {
            let s = engine.synthesize(&SpeechRequest { text: text.into(), voice: voice.into(), speed: 1.0 }, &never).unwrap();
            let d = s.audio.duration();
            assert_eq!(s.audio.sample_rate, SAMPLE_RATE);
            assert!((0.8..6.0).contains(&d), "{name}: kesto {d}");
            let peak = s.audio.samples.iter().fold(0.0f32, |m, x| m.max(x.abs()));
            let rms = (s.audio.samples.iter().map(|x| x * x).sum::<f32>() / s.audio.samples.len() as f32).sqrt();
            assert!(peak > 0.02 && peak <= 1.5 && rms > 0.005, "{name}: huippu {peak}, rms {rms}");
            eprintln!("{name} ({voice}): {d:.3} s, huippu {peak:.3}, rms {rms:.4}, foneemit {:?}", s.phonemes);
            if let Some(o) = &out {
                std::fs::create_dir_all(o).unwrap();
                std::fs::write(o.join(format!("kokoro-{name}-{voice}.wav")), crate::wav::encode(&s.audio)).unwrap();
            }
            takes.push(s);
        }
        // Eri äänet: sama repliikki ei saa olla sama ääni.
        assert_ne!(takes[0].audio.samples, takes[1].audio.samples);
        let long = engine
            .synthesize(&SpeechRequest { text: "I'm fine (slowly)".into(), voice: "bf_emma".into(), speed: 0.85 }, &never)
            .unwrap();
        assert!(long.audio.duration() > 0.5);
        let bad = SpeechRequest { text: "Hi".into(), voice: "../af_heart".into(), speed: 1.0 };
        assert!(matches!(engine.synthesize(&bad, &never), Err(VoiceError::Model(_))));
    }
}
