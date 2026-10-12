//! Toisioliike vaimentuvilla siniaalloilla.
//!
//! Hiukset ja vaatteet reagoivat kehon kiihtyvyyteen. Jokainen kiihtyvyysmuutos
//! on "isku", jonka vaste on vaimeneva siniaalto `A·e^(−ζωt)·sin(ω_d·t)`.
//! Vaste lasketaan konvoluutiona menneen ikkunan yli suoraan ajan funktiona,
//! joten tulos ei riipu siitä, missä järjestyksessä ruudut lasketaan
//! (selaus, rinnakkainen vienti ja toisto antavat saman kuvan).

use glam::Vec3;
use serde::{Deserialize, Serialize};
use std::f32::consts::TAU;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct DampedSine {
    /// Ominaistaajuus (Hz).
    pub frequency: f32,
    /// Vaimennussuhde ζ (0 = ei vaimene, 1 = kriittinen).
    pub damping: f32,
    /// Vahvistus: kuinka monta radiaania vaste on yksikkökiihtyvyyttä kohden.
    pub gain: f32,
}

impl DampedSine {
    pub const HAIR: DampedSine = DampedSine { frequency: 1.6, damping: 0.18, gain: 0.55 };
    pub const CLOTH: DampedSine = DampedSine { frequency: 2.4, damping: 0.30, gain: 0.30 };

    /// Impulssivaste hetkellä `t` iskun jälkeen.
    pub fn kernel(&self, t: f32) -> f32 {
        if t < 0.0 {
            return 0.0;
        }
        let w = TAU * self.frequency;
        let zeta = self.damping.clamp(0.0, 0.99);
        let wd = w * (1.0 - zeta * zeta).sqrt();
        (-zeta * w * t).exp() * (wd * t).sin()
    }

    /// Aika, jonka jälkeen vaste on alle 1 % (konvoluutioikkuna).
    pub fn settle_time(&self) -> f32 {
        let w = TAU * self.frequency;
        (100.0f32).ln() / (self.damping.max(0.05) * w)
    }

    /// Vaste hetkellä `t`, kun `accel(τ)` antaa kehon kiihtyvyyden (m/s²) hetkellä τ.
    /// Integroidaan kiinteällä askeleella, joten tulos on deterministinen.
    pub fn response(&self, t: f32, accel: impl Fn(f32) -> Vec3) -> Vec3 {
        const STEP: f32 = 1.0 / 120.0;
        let window = self.settle_time().min(4.0);
        let n = (window / STEP).ceil() as i32;
        let mut sum = Vec3::ZERO;
        let tq = (t / STEP).floor() * STEP;
        for k in 0..n {
            let tau = tq - k as f32 * STEP;
            if tau < 0.0 {
                break;
            }
            sum += accel(tau) * self.kernel(t - tau) * STEP;
        }
        sum * self.gain * TAU * self.frequency
    }
}

/// Numeerinen kiihtyvyys paikkafunktiosta (keskeisdifferenssi).
pub fn acceleration(pos: impl Fn(f32) -> Vec3, t: f32) -> Vec3 {
    const H: f32 = 1.0 / 60.0;
    (pos(t + H) - pos(t) * 2.0 + pos(t - H)) / (H * H)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kernel_decays_and_oscillates() {
        let s = DampedSine::HAIR;
        let peak = (0..200).map(|k| s.kernel(k as f32 / 100.0).abs()).fold(0.0f32, f32::max);
        assert!(peak > 0.3);
        assert!(s.kernel(s.settle_time()).abs() < 0.011);
        let signs: Vec<bool> = (1..200).map(|k| s.kernel(k as f32 / 100.0) > 0.0).collect();
        assert!(signs.windows(2).any(|w| w[0] != w[1]), "värähtelee");
    }

    #[test]
    fn sudden_stop_makes_hair_swing_then_settle() {
        // Juoksu pysähtyy hetkellä 1 s: kiihtyvyys taaksepäin.
        let pos = |t: f32| Vec3::new(0.0, 0.0, 3.0 * t.min(1.0) - if t > 1.0 { 0.0 } else { 0.0 });
        let accel = |t: f32| acceleration(pos, t);
        let s = DampedSine::HAIR;
        let early = s.response(0.5, accel).length();
        let after = s.response(1.25, accel).length();
        let late = s.response(4.5, accel).length();
        assert!(early < 1e-3, "tasainen liike ei heiluta: {early}");
        assert!(after > 0.05, "pysähdys heilauttaa: {after}");
        assert!(late < after * 0.1, "vaimenee: {late}");
        // Determinismi: sama aika, sama tulos.
        assert_eq!(s.response(1.25, accel), s.response(1.25, accel));
    }
}
