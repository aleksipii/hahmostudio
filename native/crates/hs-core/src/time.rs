//! Yhteinen kokonaislukuaikapohja.
//!
//! Aika esitetään "flickseinä" (705 600 000 tikkiä sekunnissa). Luku jakautuu
//! tasan yleisillä ruutunopeuksilla (24, 25, 30, 48, 60, 120) ja
//! näytetaajuuksilla (44 100, 48 000), joten ruudut ja ääninäytteet osuvat
//! täsmälleen samaan aikaan ilman liukulukuvirheiden kertymistä.

use serde::{Deserialize, Serialize};
use std::ops::{Add, AddAssign, Sub};

pub const TICKS_PER_SECOND: i64 = 705_600_000;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Tick(pub i64);

impl Tick {
    pub const ZERO: Tick = Tick(0);

    pub fn from_seconds(seconds: f64) -> Tick {
        Tick((seconds * TICKS_PER_SECOND as f64).round() as i64)
    }
    pub fn seconds(self) -> f64 {
        self.0 as f64 / TICKS_PER_SECOND as f64
    }
    pub fn max(self, other: Tick) -> Tick {
        Tick(self.0.max(other.0))
    }
    pub fn min(self, other: Tick) -> Tick {
        Tick(self.0.min(other.0))
    }
}

impl Add for Tick {
    type Output = Tick;
    fn add(self, rhs: Tick) -> Tick {
        Tick(self.0 + rhs.0)
    }
}
impl AddAssign for Tick {
    fn add_assign(&mut self, rhs: Tick) {
        self.0 += rhs.0;
    }
}
impl Sub for Tick {
    type Output = Tick;
    fn sub(self, rhs: Tick) -> Tick {
        Tick(self.0 - rhs.0)
    }
}

/// Kokonaislukuinen ruutunopeus. Hahmostudion vienti käyttää 30 fps:ää,
/// vanhat `.hahmo`-animaatiot tyypillisesti 24 fps:ää.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Fps(pub u32);

impl Fps {
    pub const EXPORT: Fps = Fps(30);

    pub fn ticks_per_frame(self) -> i64 {
        TICKS_PER_SECOND / self.0 as i64
    }
    pub fn frame_to_tick(self, frame: u32) -> Tick {
        Tick(frame as i64 * self.ticks_per_frame())
    }
    /// Ruutu, jonka aikaväliin tikki osuu (alaspäin pyöristäen).
    pub fn tick_to_frame(self, tick: Tick) -> u32 {
        (tick.0.max(0) / self.ticks_per_frame()) as u32
    }
    /// Ruutumäärä, joka peittää keston kokonaan (ylöspäin pyöristäen).
    pub fn frames_covering(self, duration: Tick) -> u32 {
        let per = self.ticks_per_frame();
        ((duration.0.max(0) + per - 1) / per) as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn common_rates_divide_evenly() {
        for fps in [24, 25, 30, 48, 50, 60, 120] {
            assert_eq!(TICKS_PER_SECOND % fps, 0, "{fps} fps");
        }
        for rate in [44_100, 48_000, 24_000] {
            assert_eq!(TICKS_PER_SECOND % rate, 0, "{rate} Hz");
        }
    }

    #[test]
    fn frame_round_trip_is_exact() {
        let fps = Fps(30);
        for frame in [0, 1, 29, 30, 1799] {
            assert_eq!(fps.tick_to_frame(fps.frame_to_tick(frame)), frame);
        }
        assert_eq!(fps.frames_covering(Tick::from_seconds(2.0)), 60);
        assert_eq!(fps.frames_covering(Tick::from_seconds(2.01)), 61);
    }
}
