//! Hahmostudion ääni: offline-puhesynteesi, WAV ja huulisynkka.
//!
//! * [`engine`]: puhemoottorin rajapinta ja rivien synteesi välimuisteineen
//!   (säännöt kuten Electron-versiossa: oma ääni säilyy, suomea ei lausuta
//!   englantilaisella äänellä, tukemattomia ohjeita ei arvata).
//! * [`kokoro`]: Kokoro-82M puhtaalla Rustilla (candle), toimii ilman verkkoa,
//!   kun malli on kerran ladattu käyttäjän luvalla ([`store`]).
//! * [`lipsync`] (hs-lipsync): visemit äänestä ja tekstistä, Adobe Characterin tapaan.

pub mod engine;
#[cfg(feature = "kokoro")]
pub mod kokoro;
pub mod spoken;
pub mod store;
pub mod wav;

pub use engine::{BackgroundEngine, DialogueLine, LineResult, LineStatus, Speech, SpeechCache, SpeechEngine, SpeechRequest, TestEngine};
pub use hs_lipsync::{self as lipsync, MouthShape, Viseme, VisemeTrack};
pub use wav::Audio;

#[derive(Debug, thiserror::Error)]
pub enum VoiceError {
    #[error("{0}")]
    Audio(String),
    #[error("{0}")]
    Engine(String),
    #[error("{0}")]
    Model(String),
    #[error("puhesynteesi peruttiin")]
    Cancelled,
    /// Rivi on jonossa taustasynteesissä ([`engine::BackgroundEngine`]).
    #[error("puhe on tulossa")]
    Pending,
    #[error("{0}")]
    Io(#[from] std::io::Error),
}
