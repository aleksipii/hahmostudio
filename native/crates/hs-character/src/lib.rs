//! Parametrinen 3D-hahmogeneraattori.
//!
//! Hahmo rakennetaan luurangon ympärille suljetuista, ääriviivattomista
//! muodoista (ellipsoidit, kartiomaiset kapselit, laatikot), samaan tapaan kuin
//! nykyiset toon3d-hahmot. Jokainen kärkipiste on sidottu enintään kahteen
//! luuhun, joten nivelet taipuvat pehmeästi. Generointi kestää millisekunteja.

pub mod mesh;
pub mod params;

pub use mesh::{srgb_to_linear, Bind, CharacterMesh, MeshBuilder, Vertex};
pub use params::{CharacterParams, ClothingStyle, FaceParams, HairStyle, RenderStyle};

use hs_motion::{Humanoid, ProceduralMotion};

/// Valmis hahmo: parametrit, luuranko ja verkko.
#[derive(Clone, Debug)]
pub struct Character {
    pub params: CharacterParams,
    pub humanoid: Humanoid,
    pub mesh: CharacterMesh,
}

impl Character {
    pub fn build(params: CharacterParams) -> Character {
        let humanoid = Humanoid::new(params.proportions());
        let mesh = mesh::build(&params, &humanoid);
        Character { params, humanoid, mesh }
    }

    pub fn motion(&self) -> ProceduralMotion {
        let mut m = ProceduralMotion::new(self.humanoid.clone());
        m.name = Some(self.params.name.clone());
        m
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn presets_build_well_under_a_minute() {
        for preset in CharacterParams::presets() {
            let start = Instant::now();
            let c = Character::build(preset.clone());
            let took = start.elapsed();
            assert!(took.as_secs_f32() < 1.0, "{}: {took:?}", preset.name);
            assert!(c.mesh.triangle_count() > 2_000, "{}", preset.name);
            assert!(c.mesh.vertices.iter().all(|v| v.bones[0] < c.humanoid.skeleton.len() as u32 && v.bones[1] < c.humanoid.skeleton.len() as u32));
            assert!(c.mesh.indices.iter().all(|i| (*i as usize) < c.mesh.vertices.len()));
            let (min, max) = c.mesh.bounds();
            let height = max.y - min.y;
            assert!((height - preset.height).abs() < preset.height * 0.08, "{}: korkeus {height}", preset.name);
        }
    }

    #[test]
    fn parameters_change_the_mesh() {
        let base = CharacterParams::pipsa();
        let mut tall = base.clone();
        tall.height = 1.6;
        let mut big_eyes = base.clone();
        big_eyes.face.eye_size = 1.6;
        let a = Character::build(base).mesh;
        let b = Character::build(tall).mesh;
        let c = Character::build(big_eyes).mesh;
        assert!(b.bounds().1.y > a.bounds().1.y + 0.2);
        assert_eq!(a.vertices.len(), c.vertices.len(), "kasvoparametri ei saa muuttaa topologiaa");
        let differs = a.vertices.iter().zip(&c.vertices).any(|(x, y)| x.position != y.position);
        assert!(differs);
    }

    #[test]
    fn params_round_trip_as_json() {
        let p = CharacterParams::taru();
        let s = serde_json::to_string(&p).unwrap();
        assert_eq!(serde_json::from_str::<CharacterParams>(&s).unwrap(), p);
    }
}
