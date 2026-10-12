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
        &[Slot::Plan]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let plan = hs_script::parse(&p.script);
        p.diagnostics = plan.diagnostics.clone();
        let errors = plan.diagnostics.iter().filter(|d| d.severity == Severity::Error).count();
        let summary = format!(
            "{} riviä, {:.1} s{}",
            plan.beats.len(),
            plan.seconds,
            if errors > 0 { format!(", {errors} virhettä") } else { String::new() }
        );
        p.plan = Some(plan);
        Ok(AgentReport::new(summary))
    }
}
