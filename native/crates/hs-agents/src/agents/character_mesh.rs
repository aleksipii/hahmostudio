use crate::production::CastMember;
use crate::{AgentError, AgentReport, Production, Slot, StudioAgent};
use hs_character::{Character, CharacterParams};
use hs_core::EventKind;
use std::sync::Arc;

/// Generoi ja muokkaa 3D-hahmot parametrien perusteella. Rakentaa vain
/// muuttuneet hahmot uudelleen (parametrit vertaillaan edelliseen ajoon).
#[derive(Default)]
pub struct CharacterMeshAgent {
    cache: Vec<Arc<Character>>,
}

/// Puhujat ja liikkujat käsikirjoituksen järjestyksessä.
pub fn cast_names(p: &Production) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    if let Some(tl) = &p.timeline {
        for e in &tl.events {
            let n = match &e.kind {
                EventKind::Dialogue { speaker: Some(s), .. } => Some(s),
                EventKind::Motion { character: Some(c), .. } | EventKind::Expression {character:Some(c),..} | EventKind::LookAt {character:Some(c),..} => Some(c),
                _ => None,
            };
            if let Some(n) = n {
                if !names.iter().any(|x| x.eq_ignore_ascii_case(n)) {
                    names.push(n.clone());
                }
            }
        }
    }
    names
}

fn params_for(p: &Production, name: Option<&str>, _index: usize) -> Result<CharacterParams,AgentError> {
    if let Some(n) = name {
        if let Some(c) = p.cast_params.iter().find(|c| c.name.eq_ignore_ascii_case(n)) {
            return Ok(c.clone());
        }
        if let Some(c) = CharacterParams::presets().into_iter().find(|c| c.name.eq_ignore_ascii_case(n)) {
            return Ok(c);
        }
        return Err(AgentError::Failed{agent:"character-mesh",message:format!("Hahmolle {n} puuttuu määritetty profiili. Ulkonäköä ei arvata; valitse nykyinen hahmo tai tuo oma hahmoprofiili.")});
    }
    Ok(p.cast_params.first().cloned().unwrap_or_else(CharacterParams::pipsa))
}

fn reject_derived_cast(p:&mut Production,error:AgentError)->AgentError {
    p.cast.clear();p.motion.clear();p.camera=None;error
}

impl StudioAgent for CharacterMeshAgent {
    fn id(&self) -> &'static str {
        "character-mesh"
    }
    fn name(&self) -> &'static str {
        "Hahmot"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Timeline, Slot::CastParams]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::Cast]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let names = cast_names(p);
        let wanted: Vec<CharacterParams> = if names.is_empty() {
            vec![params_for(p, None, 0).map_err(|error|reject_derived_cast(p,error))?]
        } else {
            names.iter().enumerate().map(|(i, n)| params_for(p, Some(n), i)).collect::<Result<Vec<_>,_>>().map_err(|error|reject_derived_cast(p,error))?
        };
        if wanted.len()>4 {return Err(AgentError::Failed{agent:"character-mesh",message:"Näyttämölle mahtuu enintään neljä hahmoa.".into()});}
        if let Some(tl)=&p.timeline {for event in &tl.events {
            if let EventKind::LookAt{target:hs_core::LookTarget::Character(name),..}=&event.kind {
                if !wanted.iter().any(|c|c.name.eq_ignore_ascii_case(name)){return Err(AgentError::Failed{agent:"character-mesh",message:format!("Katseen kohde {name} ei ole kohtauksen hahmo.")});}
            }
        }}
        for profile in &wanted {crate::audit::validate_profile(profile).map_err(|message|reject_derived_cast(p,AgentError::Failed{agent:"character-mesh",message}))?;}
        let mut built = 0;
        let mut cast = Vec::new();
        let n = wanted.len();
        for (i, params) in wanted.into_iter().enumerate() {
            let character = match self.cache.iter().find(|c| c.params == params) {
                Some(c) => c.clone(),
                None => {
                    built += 1;
                    Arc::new(Character::build(params))
                }
            };
            let spacing = 1.1;
            cast.push(CastMember {
                mesh: Arc::new(character.mesh.clone()),
                start_x: (i as f32 - (n as f32 - 1.0) * 0.5) * spacing,
                lead: i == 0,
                character,
            });
        }
        // Säilytä verkko-Arc samana, jos hahmo ei muuttunut (GPU-välimuisti).
        for m in &mut cast {
            if let Some(old) = p.cast.iter().find(|o| Arc::ptr_eq(&o.character, &m.character)) {
                m.mesh = old.mesh.clone();
            }
        }
        self.cache = cast.iter().map(|c| c.character.clone()).collect();
        let tris: usize = cast.iter().map(|c| c.mesh.triangle_count()).sum();
        let names: Vec<_> = cast.iter().map(|c| c.character.params.name.clone()).collect();
        p.cast = cast;
        Ok(AgentReport::new(format!("{} ({} kolmiota, {built} rakennettu)", names.join(", "), tris)))
    }
}
