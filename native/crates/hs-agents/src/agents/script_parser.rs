use crate::{AgentError, AgentReport, Production, Slot, StudioAgent};
use hs_core::Severity;

/// Lukee käsikirjoituksen tagit ja muuntaa ne aikajanan tapahtumiksi.
#[derive(Default)]
pub struct ScriptParserAgent;

impl StudioAgent for ScriptParserAgent {
    fn id(&self) -> &'static str {
        "script-parser"
    }
    fn name(&self) -> &'static str {
        "Käsikirjoitus"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Script]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::Timeline]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let plan = hs_script::parse(&p.script);
        let timeline = hs_script::to_timeline(&plan, &p.script, p.fps);
        p.diagnostics = plan.diagnostics.clone();
        let errors = plan.diagnostics.iter().filter(|d| d.severity == Severity::Error).count();
        let summary = format!(
            "{} riviä, {:.1} s, {} tapahtumaa{}",
            plan.beats.len(),
            plan.seconds,
            timeline.events.len(),
            if errors > 0 { format!(", {errors} virhettä") } else { String::new() }
        );
        p.plan = Some(plan);
        p.timeline = Some(timeline);
        Ok(AgentReport { summary })
    }
}
