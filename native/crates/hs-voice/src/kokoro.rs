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
use crate::spoken::MODEL_VERSION;
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

    /// Ajetaan vain, jos malli on asennettu (HAHMOSTUDIO_KOKORO_DIR); pilvessä mallia ei ole.
    #[test]
    fn real_model_speaks_when_installed() {
        let Some(dir) = std::env::var_os("HAHMOSTUDIO_KOKORO_DIR") else {
            eprintln!("ohitettu: HAHMOSTUDIO_KOKORO_DIR puuttuu");
            return;
        };
        let engine = KokoroEngine::load(Path::new(&dir)).unwrap();
        let s = engine
            .synthesize(&SpeechRequest { text: "Hello there!".into(), voice: "af_heart".into(), speed: 1.0 }, &AtomicBool::new(false))
            .unwrap();
        let d = s.audio.duration();
        assert!((0.4..4.0).contains(&d), "kesto {d}");
        let peak = s.audio.samples.iter().fold(0.0f32, |m, x| m.max(x.abs()));
        assert!(peak > 0.02 && peak <= 1.5, "huippu {peak}");
    }
}
