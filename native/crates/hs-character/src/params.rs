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

/// Päähine.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum HatStyle {
    #[default]
    None,
    /// Pipo tupsulla.
    Beanie,
    /// Lippalakki.
    Cap,
}

/// Lisävarusteet ja sarjakuvamaiset liioittelut. Puuttuvat kentät (vanhat
/// tallennukset) saavat oletusarvot.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Extras {
    pub hat: HatStyle,
    pub hat_color: [u8; 3],
    pub glasses: bool,
    /// Vatsa 0 (ei) .. 1 (iso).
    pub belly: f32,
    /// Ääriviiva (sarjakuvatyyli).
    pub outline: bool,
}

impl Default for Extras {
    fn default() -> Self {
        Extras { hat: HatStyle::None, hat_color: [0x2f, 0x5f, 0xb0], glasses: false, belly: 0.0, outline: true }
    }
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
    /// Kokoro-ääni (esim. `af_heart`). Puuttuva ääni: rivi jää ilman synteettistä puhetta.
    #[serde(default)]
    pub voice: Option<String>,
    #[serde(default)]
    pub extras: Extras,
}

fn hex(c: u32) -> [u8; 3] {
    [(c >> 16) as u8, (c >> 8) as u8, c as u8]
}

impl CharacterParams {
    /// Alkuperäiset hahmopohjat. Värit ovat hahmon omia, eivät globaali paletti.
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
            voice: Some("af_heart".into()),
            extras: Extras::default(),
        }
    }
    pub fn ville() -> Self {
        CharacterParams {
            name: "Ville".into(),
            voice: Some("am_adam".into()),
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
            voice: Some("af_bella".into()),
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
            voice: Some("bm_george".into()),
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
    /// Sarjan alkuperäinen perhe: lämmin iho, hillityt vaatteet ja yhteinen
    /// petrooli–koralli–mustikka-paletti. Mittasuhteet säilyttävät rigisopimuksen.
    /// Näitä käytetään vain uusia hahmoja luotaessa; tallennetut parametrit
    /// luetaan sellaisinaan eikä käyttäjän ulkonäkövalintoja migroida.
    pub fn kalle() -> Self {
        CharacterParams {
            name: "Kalle".into(),
            voice: Some("am_michael".into()),
            height: 1.78,
            build: 1.3,
            head_scale: 1.75,
            leg_ratio: 0.4,
            face: FaceParams { eye_size: 1.12, eye_spacing: 1.0, brow_thickness: 1.1, mouth_width: 1.12, nose_size: 0.95, cheeks: false, ..FaceParams::default() },
            skin: hex(0xeec4a5),
            hair: hex(0x49362f),
            hair_style: HairStyle::Short,
            top: hex(0xece2d0),
            bottom: hex(0x3e6570),
            shoes: hex(0x40383a),
            clothing: ClothingStyle::Shirt,
            sleeve: 0.4,
            trouser: 1.0,
            extras: Extras { glasses: true, belly: 0.9, ..Extras::default() },
            ..Self::pipsa()
        }
    }
    pub fn maija() -> Self {
        CharacterParams {
            name: "Maija".into(),
            voice: Some("af_nicole".into()),
            height: 1.68,
            build: 0.95,
            head_scale: 1.7,
            leg_ratio: 0.43,
            face: FaceParams { eye_size: 1.15, eye_spacing: 1.0, mouth_width: 1.05, nose_size: 0.82, ..FaceParams::default() },
            skin: hex(0xf0cbb3),
            hair: hex(0x8b4638),
            hair_style: HairStyle::Bob,
            top: hex(0x3c8180),
            bottom: hex(0x35465e),
            shoes: hex(0x9e5b56),
            clothing: ClothingStyle::Shirt,
            sleeve: 0.9,
            trouser: 1.0,
            ..Self::pipsa()
        }
    }
    pub fn eetu() -> Self {
        CharacterParams {
            name: "Eetu".into(),
            voice: Some("am_adam".into()),
            height: 1.0,
            build: 1.15,
            head_scale: 1.7,
            leg_ratio: 0.36,
            face: FaceParams { eye_size: 1.23, eye_spacing: 0.98, mouth_width: 1.05, nose_size: 0.62, cheeks: false, ..FaceParams::default() },
            skin: hex(0xeec5a8),
            hair: hex(0x4d3930),
            hair_style: HairStyle::Short,
            top: hex(0xcd735f),
            bottom: hex(0x40546b),
            shoes: hex(0x39454f),
            clothing: ClothingStyle::Hoodie,
            sleeve: 1.0,
            trouser: 1.0,
            extras: Extras { hat: HatStyle::Beanie, hat_color: hex(0x477f87), ..Extras::default() },
            ..Self::pipsa()
        }
    }
    pub fn ronja() -> Self {
        CharacterParams {
            name: "Ronja".into(),
            voice: Some("af_bella".into()),
            height: 1.04,
            build: 1.0,
            head_scale: 1.65,
            leg_ratio: 0.37,
            face: FaceParams { eye_size: 1.25, eye_spacing: 0.98, nose_size: 0.58, ..FaceParams::default() },
            skin: hex(0xad7959),
            hair: hex(0x332b30),
            hair_style: HairStyle::Ponytail,
            top: hex(0x79688e),
            bottom: hex(0x3e4657),
            shoes: hex(0xeae1d1),
            clothing: ClothingStyle::Dress,
            sleeve: 0.3,
            trouser: 1.0,
            extras: Extras { hat: HatStyle::None, hat_color: hex(0xcd735f), ..Extras::default() },
            ..Self::pipsa()
        }
    }

    pub fn presets() -> Vec<CharacterParams> {
        vec![Self::pipsa(), Self::ville(), Self::taru(), Self::ukko(), Self::kalle(), Self::maija(), Self::eetu(), Self::ronja()]
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
            head_ratio: (0.17 - adult * 0.045) * self.head_scale.clamp(0.6, 1.8),
            hand_scale: d.hand_scale,
            hair_length: match self.hair_style {
                HairStyle::Ponytail => 0.18 * self.height / 1.25,
                HairStyle::Bob => 0.10 * self.height / 1.25,
                _ => 0.06,
            },
        }
    }
}

#[cfg(test)]
mod preset_tests {
    use super::*;

    #[test]
    fn refreshed_family_preserves_rig_dimensions_and_distinct_voices() {
        let family = [CharacterParams::kalle(), CharacterParams::maija(), CharacterParams::eetu(), CharacterParams::ronja()];
        let dimensions = [(1.78, 1.3, 1.75, 0.4), (1.68, 0.95, 1.7, 0.43), (1.0, 1.15, 1.7, 0.36), (1.04, 1.0, 1.65, 0.37)];
        for (index, (character, expected)) in family.iter().zip(dimensions).enumerate() {
            assert_eq!((character.height, character.build, character.head_scale, character.leg_ratio), expected);
            let rig = character.proportions();
            assert_eq!(rig.height, expected.0);
            assert_eq!(rig.leg_ratio, expected.3);
            assert!(character.face.eye_size <= 1.25 && character.face.eye_spacing >= 0.98);
            assert!(character.voice.is_some());
            for other in &family[..index] {
                assert_ne!(character.top, other.top);
                assert_ne!(character.voice, other.voice);
            }
        }
        assert_eq!(family[3].extras.hat, HatStyle::None);
        assert_eq!(family[3].hair_style, HairStyle::Ponytail);
    }

    #[test]
    fn existing_user_appearance_is_not_replaced_by_new_presets() {
        let mut original = CharacterParams::kalle();
        original.top = [12, 34, 56];
        original.face.eye_size = 1.45;
        original.face.eye_spacing = 0.78;
        original.hair_style = HairStyle::Bald;
        original.extras.hat = HatStyle::Cap;
        let serialized = serde_json::to_value(&original).unwrap();
        let restored: CharacterParams = serde_json::from_value(serialized).unwrap();
        assert_eq!(restored, original);
        assert_ne!(restored, CharacterParams::kalle());
    }
}
