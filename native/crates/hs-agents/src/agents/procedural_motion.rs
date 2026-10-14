use crate::{AgentError, AgentReport, Production, Slot, StudioAgent};
use glam::Vec3;
use std::sync::Arc;

/// Laskee orgaanisen liikkeen ilman avainruutuja: valmistelee jokaiselle
/// hahmolle tilattoman liikefunktion (juuren rata lasketaan kerran).
#[derive(Default)]
pub struct ProceduralMotionAgent;

impl StudioAgent for ProceduralMotionAgent {
    fn id(&self) -> &'static str {
        "procedural-motion"
    }
    fn name(&self) -> &'static str {
        "Liike"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Timeline, Slot::Cast]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::Motion]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let tl = p.timeline.as_ref().ok_or(AgentError::Missing { agent: "procedural-motion", slot: Slot::Timeline })?;
        p.motion = p
            .cast
            .iter()
            .map(|c| {
                let mut m = c.character.motion();
                m.lead = c.lead;
                m.start = Vec3::new(c.start_x, 0.0, 0.0);
                m.prepare(tl).with_layers(tl).map(Arc::new).map_err(|message|AgentError::Failed {agent:"procedural-motion",message})
            })
            .collect::<Result<Vec<_>,_>>()?;
        Ok(AgentReport::new(format!("{} hahmoa, {} ruutua", p.motion.len(), tl.frame_count())))
    }
}
