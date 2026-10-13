//! Agenttiputki.
//!
//! Jokainen osa-alue on oma [`StudioAgent`]-toteutuksensa, joka lukee ja
//! kirjoittaa tuotannon ([`Production`]) nimettyjä paikkoja ([`Slot`]).
//! [`Pipeline`] järjestää agentit riippuvuuksien mukaan ja ajaa vain ne, joiden
//! syötteet ovat muuttuneet: käsikirjoituksen muokkaus ajaa jäsentimen ja
//! sen jälkeiset vaiheet, hahmon parametrin muutos vain verkon ja liikkeen.
//! Uusia agentteja voi rekisteröidä ([`Pipeline::register`]) kuten liitännäisiä.
//!
//! Agentit ovat deterministisiä eivätkä koskaan suorita käsikirjoituksen
//! tekstiä koodina. Ne eivät myöskään keksi repliikkejä: käsikirjoitus on
//! totuuden lähde (AGENTS.md).

pub mod agents;
pub mod production;
pub mod subtitles;

pub use agents::{
    character_mesh::CharacterMeshAgent, cinematography::CinematographyAgent, procedural_motion::ProceduralMotionAgent,
    render::RustRenderAgent, script_parser::ScriptParserAgent,
    voice::{LipSyncAgent, TimingAgent, VoiceAgent},
};
pub use production::{Backend, LiveOverride, Production, RenderRequest, VoiceLine};

use serde::Serialize;
use std::collections::BTreeSet;
use std::time::{Duration, Instant};

/// Tuotannon tietopaikat, joiden kautta agentit kommunikoivat.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum Slot {
    Script,
    /// Jäsennetty käsikirjoitus (rivit, kestot, tagit).
    Plan,
    CastParams,
    /// Puhemoottori, omat äänitykset ja hyväksytyt huomautukset.
    Voice,
    /// Rivien puhe.
    Audio,
    Timeline,
    LipSync,
    Cast,
    Motion,
    Camera,
    RenderRequest,
    Output,
}

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("{agent}: puuttuva syöte {slot:?}")]
    Missing { agent: &'static str, slot: Slot },
    #[error("{agent}: {message}")]
    Failed { agent: &'static str, message: String },
    #[error("vienti peruttiin")]
    Cancelled,
}

#[derive(Clone, Debug, Serialize)]
pub struct AgentReport {
    /// Lyhyt suomenkielinen yhteenveto käyttöliittymään.
    pub summary: String,
    /// Tuotos on sama kuin edellisellä ajolla: seuraavia vaiheita ei tarvitse ajaa.
    pub unchanged: bool,
}

impl AgentReport {
    pub fn new(summary: impl Into<String>) -> Self {
        AgentReport { summary: summary.into(), unchanged: false }
    }

    pub fn unchanged(mut self) -> Self {
        self.unchanged = true;
        self
    }
}

/// Yksi osa-alue putkessa.
pub trait StudioAgent: Send {
    /// Pysyvä tunniste (lokit, asetukset).
    fn id(&self) -> &'static str;
    /// Suomenkielinen nimi käyttöliittymään.
    fn name(&self) -> &'static str;
    fn reads(&self) -> &'static [Slot];
    fn writes(&self) -> &'static [Slot];
    fn run(&mut self, production: &mut Production) -> Result<AgentReport, AgentError>;
}

#[derive(Clone, Debug, Serialize)]
pub struct AgentRun {
    pub id: &'static str,
    pub name: &'static str,
    #[serde(serialize_with = "ser_duration")]
    pub took: Duration,
    pub outcome: Result<String, String>,
}

fn ser_duration<S: serde::Serializer>(d: &Duration, s: S) -> Result<S::Ok, S::Error> {
    s.serialize_f64(d.as_secs_f64() * 1000.0)
}

pub struct Pipeline {
    agents: Vec<Box<dyn StudioAgent>>,
    dirty: BTreeSet<Slot>,
    pub history: Vec<AgentRun>,
}

impl Default for Pipeline {
    /// Vakioputki: jäsennin → ääni → ajoitus → huulisynkka → hahmot → liike → kamera → renderöinti.
    fn default() -> Self {
        let mut p = Pipeline::empty();
        p.register(Box::new(ScriptParserAgent));
        p.register(Box::new(VoiceAgent::default()));
        p.register(Box::new(TimingAgent));
        p.register(Box::new(LipSyncAgent::default()));
        p.register(Box::new(CharacterMeshAgent::default()));
        p.register(Box::new(ProceduralMotionAgent));
        p.register(Box::new(CinematographyAgent));
        p.register(Box::new(RustRenderAgent::default()));
        p
    }
}

impl Pipeline {
    pub fn empty() -> Self {
        Pipeline { agents: Vec::new(), dirty: [Slot::Script, Slot::CastParams, Slot::Voice].into_iter().collect(), history: Vec::new() }
    }

    /// Lisää agentin ja järjestää putken uudelleen riippuvuuksien mukaan.
    pub fn register(&mut self, agent: Box<dyn StudioAgent>) {
        self.agents.push(agent);
        self.sort();
    }

    pub fn agents(&self) -> impl Iterator<Item = &dyn StudioAgent> {
        self.agents.iter().map(|a| a.as_ref())
    }

    /// Topologinen järjestys: agentti ajetaan sen jälkeen, kun sen lukemat paikat on kirjoitettu.
    fn sort(&mut self) {
        let mut ordered: Vec<Box<dyn StudioAgent>> = Vec::new();
        let mut pending: Vec<Box<dyn StudioAgent>> = std::mem::take(&mut self.agents);
        let mut produced: BTreeSet<Slot> = BTreeSet::new();
        let all_writes: BTreeSet<Slot> = pending.iter().flat_map(|a| a.writes().iter().copied()).collect();
        while !pending.is_empty() {
            let pos = pending
                .iter()
                .position(|a| a.reads().iter().all(|r| !all_writes.contains(r) || produced.contains(r)))
                .unwrap_or(0); // kehä: säilytä rekisteröintijärjestys
            let a = pending.remove(pos);
            produced.extend(a.writes().iter().copied());
            ordered.push(a);
        }
        self.agents = ordered;
    }

    pub fn mark_dirty(&mut self, slot: Slot) {
        self.dirty.insert(slot);
    }

    pub fn is_dirty(&self) -> bool {
        !self.dirty.is_empty()
    }

    /// Ajaa agentit, joiden syötteet ovat muuttuneet. Pysähtyy ensimmäiseen virheeseen.
    pub fn run(&mut self, production: &mut Production) -> Result<Vec<AgentRun>, AgentError> {
        let mut runs = Vec::new();
        for agent in &mut self.agents {
            if !agent.reads().iter().any(|r| self.dirty.contains(r)) {
                continue;
            }
            let start = Instant::now();
            let result = agent.run(production);
            let took = start.elapsed();
            let run = AgentRun {
                id: agent.id(),
                name: agent.name(),
                took,
                outcome: result.as_ref().map(|r| r.summary.clone()).map_err(|e| e.to_string()),
            };
            self.history.push(run.clone());
            runs.push(run);
            match result {
                Ok(r) if r.unchanged => {}
                Ok(_) => self.dirty.extend(agent.writes().iter().copied()),
                Err(e) => return Err(e),
            }
        }
        self.dirty.clear();
        Ok(runs)
    }
}
