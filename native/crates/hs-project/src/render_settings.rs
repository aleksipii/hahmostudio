//! Portable software render-pass controls, independent of renderer/UI.
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct RenderSettings {
    pub ao_samples: u32,
    pub ao_radius: f32,
    pub ao_strength: f32,
    pub depth_near: f32,
    pub depth_far: f32,
}
impl Default for RenderSettings {
    fn default() -> Self {
        Self {
            ao_samples: 8,
            ao_radius: 0.3,
            ao_strength: 1.0,
            depth_near: 0.05,
            depth_far: 100.0,
        }
    }
}
impl RenderSettings {
    pub fn validate(&self) -> Result<(), String> {
        if self.ao_samples > 64
            || ![
                self.ao_radius,
                self.ao_strength,
                self.depth_near,
                self.depth_far,
            ]
            .iter()
            .all(|v| v.is_finite())
            || !(0.001..=5.0).contains(&self.ao_radius)
            || !(0.0..=1.0).contains(&self.ao_strength)
            || self.depth_near < 0.0
            || self.depth_far > 1000.0
            || self.depth_far <= self.depth_near
        {
            return Err(
                "AO: 0–64 näytettä, säde0.001–5m, voimakkuus0–1; syvyys0–1000m ja loppu > alku."
                    .into(),
            );
        }
        Ok(())
    }
    pub fn encode(&self) -> Result<Vec<u8>, String> {
        self.validate()?;
        serde_json::to_vec(self).map_err(|e| e.to_string())
    }
    pub fn decode(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() > 4096 {
            return Err("Renderasetukset liian suuret".into());
        }
        let value: Self = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        value.validate()?;
        Ok(value)
    }
}
