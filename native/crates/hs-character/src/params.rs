use hs_motion::Proportions;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum HairStyle {
    Bald,
    Short,
    Bob,
    Ponytail,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClothingStyle {
    /// Paita ja housut.
    Shirt,
    /// Huppari: paksumpi ylävartalo ja huppu.
    Hoodie,
    /// Mekko: helma heiluu toisioliikkeellä.
    Dress,
}

/// `flat` = pelkät perusvärit ilman ääriviivoja, `cel` = porrastettu varjostus.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum RenderStyle {
    Flat,
    Cel,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FaceParams {
    pub eye_size: f32,
    pub eye_spacing: f32,
    pub eye_color: [u8; 3],
    pub mouth_width: f32,
    pub nose_size: f32,
    pub brow_thickness: f32,
    pub cheeks: bool,
}

impl Default for FaceParams {
    fn default() -> Self {
        FaceParams {
            eye_size: 1.0,
            eye_spacing: 1.0,
            eye_color: [0x2a, 0x22, 0x1e],
            mouth_width: 1.0,
            nose_size: 1.0,
            brow_thickness: 1.0,
            cheeks: true,
        }
    }
}

/// Kaikki hahmon säädettävät parametrit. Värit sRGB-tavuina.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CharacterParams {
    pub name: String,
    /// Pituus metreinä.
    pub height: f32,
    /// Vartalon leveys (1 = normaali).
    pub build: f32,
    pub head_scale: f32,
    pub leg_ratio: f32,
    pub face: FaceParams,
    pub skin: [u8; 3],
    pub hair: [u8; 3],
    pub hair_style: HairStyle,
    pub top: [u8; 3],
    pub bottom: [u8; 3],
    pub shoes: [u8; 3],
    pub clothing: ClothingStyle,
    /// Hihan pituus 0 (hihaton) .. 1 (pitkä).
    pub sleeve: f32,
    /// Lahkeen pituus 0 (shortsit) .. 1 (pitkät).
    pub trouser: f32,
    pub render_style: RenderStyle,
}

fn hex(c: u32) -> [u8; 3] {
    [(c >> 16) as u8, (c >> 8) as u8, c as u8]
}

impl CharacterParams {
    /// Pipsa, Ville, Taru ja Ukko samoilla väreillä kuin `lib/toon3d.ts`.
    pub fn pipsa() -> Self {
        CharacterParams {
            name: "Pipsa".into(),
            height: 1.22,
            build: 1.0,
            head_scale: 1.0,
            leg_ratio: 0.44,
            face: FaceParams::default(),
            skin: hex(0xf5cfae),
            hair: hex(0x1d1b22),
            hair_style: HairStyle::Bob,
            top: hex(0xf2c230),
            bottom: hex(0x2f6f8f),
            shoes: hex(0xc8372d),
            clothing: ClothingStyle::Shirt,
            sleeve: 0.45,
            trouser: 1.0,
            render_style: RenderStyle::Flat,
        }
    }
    pub fn ville() -> Self {
        CharacterParams {
            name: "Ville".into(),
            height: 1.30,
            face: FaceParams { eye_size: 0.9, ..FaceParams::default() },
            skin: hex(0xf6d2b6),
            hair: hex(0xd9631f),
            hair_style: HairStyle::Short,
            top: hex(0xb86a2a),
            bottom: hex(0x2c3a5a),
            shoes: hex(0x4a2f1a),
            clothing: ClothingStyle::Hoodie,
            sleeve: 1.0,
            ..Self::pipsa()
        }
    }
    pub fn taru() -> Self {
        CharacterParams {
            name: "Taru".into(),
            height: 1.26,
            face: FaceParams { eye_size: 1.1, ..FaceParams::default() },
            skin: hex(0x8a5a3c),
            hair: hex(0x231a17),
            hair_style: HairStyle::Ponytail,
            top: hex(0xef7a36),
            bottom: hex(0x4e6fa0),
            shoes: hex(0xf4f4f0),
            clothing: ClothingStyle::Dress,
            sleeve: 0.3,
            ..Self::pipsa()
        }
    }
    pub fn ukko() -> Self {
        CharacterParams {
            name: "Ukko".into(),
            height: 1.74,
            build: 1.15,
            head_scale: 0.78,
            leg_ratio: 0.47,
            face: FaceParams { eye_size: 0.8, brow_thickness: 1.6, cheeks: false, ..FaceParams::default() },
            skin: hex(0xeec3a2),
            hair: hex(0xeceae4),
            hair_style: HairStyle::Short,
            top: hex(0x8fa48a),
            bottom: hex(0x6e5845),
            shoes: hex(0x3e3530),
            clothing: ClothingStyle::Shirt,
            sleeve: 1.0,
            ..Self::pipsa()
        }
    }
    pub fn presets() -> Vec<CharacterParams> {
        vec![Self::pipsa(), Self::ville(), Self::taru(), Self::ukko()]
    }

    pub fn proportions(&self) -> Proportions {
        let d = Proportions::default();
        let adult = ((self.height - 1.2) / 0.6).clamp(0.0, 1.0);
        Proportions {
            height: self.height.clamp(0.6, 2.2),
            leg_ratio: self.leg_ratio.clamp(0.35, 0.55),
            arm_ratio: 0.40 + adult * 0.03,
            shoulder_width: self.height * 0.205 * self.build.clamp(0.6, 1.6),
            hip_width: self.height * 0.135 * self.build.clamp(0.6, 1.6),
            head_ratio: (0.17 - adult * 0.045) * self.head_scale.clamp(0.6, 1.5),
            hand_scale: d.hand_scale,
            hair_length: match self.hair_style {
                HairStyle::Ponytail => 0.18 * self.height / 1.25,
                HairStyle::Bob => 0.10 * self.height / 1.25,
                _ => 0.06,
            },
        }
    }
}
