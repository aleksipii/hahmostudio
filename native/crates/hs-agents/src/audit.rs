//! Deterministic production proof: binds authored actions to implemented resources.
//! This is preflight, not proof of artistic quality or physical simulation.
use crate::Production;
use hs_core::{Diagnostic, EventKind, Expression, LookTarget, MotionKind, Severity};
use serde::Serialize;
use std::collections::{BTreeMap, HashSet};

#[derive(Clone, Debug, Serialize)]
pub struct Row {
    pub line: usize,
    pub source: String,
    pub actor: Option<String>,
    pub dialogue: String,
    pub motion: String,
    pub motion_seconds: f64,
    pub motion_start_seconds: f64,
    pub motion_end_seconds: f64,
    pub background: String,
    pub prop: Option<String>,
    pub expression: Expression,
    pub phone_visible: bool,
    pub look_at: Option<LookTarget>,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub shots: Vec<String>,
    pub authored_camera: bool,
    pub chair_contact: Option<String>,
    pub object_contact: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
pub struct Report {
    pub diagnostics: Vec<Diagnostic>,
    pub rows: Vec<Row>,
}
impl Report {
    pub fn allowed(&self) -> bool {
        !self.rows.is_empty()
            && !self
                .diagnostics
                .iter()
                .any(|d| d.severity == Severity::Error)
    }
}

pub fn validate_profile(p: &hs_character::CharacterParams) -> Result<(), String> {
    if p.name.trim().is_empty() || p.name.trim() != p.name || p.name.chars().count() > 256 {
        return Err("Hahmoprofiilin nimi ei kelpaa.".into());
    }
    for (name, value, min, max) in [
        ("height", p.height, 0.1, 4.0),
        ("build", p.build, 0.1, 4.0),
        ("head", p.head_scale, 0.1, 4.0),
        ("legs", p.leg_ratio, 0.1, 0.9),
        ("eyes", p.face.eye_size, 0.1, 4.0),
        ("eye spacing", p.face.eye_spacing, 0.1, 4.0),
        ("mouth", p.face.mouth_width, 0.1, 4.0),
        ("nose", p.face.nose_size, 0.1, 4.0),
        ("brows", p.face.brow_thickness, 0.1, 4.0),
        ("sleeve", p.sleeve, 0.0, 1.0),
        ("trouser", p.trouser, 0.0, 1.0),
        ("belly", p.extras.belly, 0.0, 1.0),
    ] {
        if !value.is_finite() || value < min || value > max {
            return Err(format!("Hahmon {} mitta {name} ei kelpaa.", p.name));
        }
    }
    Ok(())
}

pub fn inspect(p: &Production) -> Report {
    let fresh = hs_script::parse(&p.script);
    let mut report = Report {
        diagnostics: fresh.diagnostics.clone(),
        rows: Vec::new(),
    };
    if p.plan.as_ref() != Some(&fresh) {
        report.diagnostics.push(Diagnostic::error(
            0,
            "Suunnitelma ei vastaa nykyistä käsikirjoitusta. Aja tarkistus uudelleen.",
        ));
        return report;
    }
    let Some(timeline) = &p.timeline else {
        report
            .diagnostics
            .push(Diagnostic::error(0, "Todellinen ajoitus puuttuu."));
        return report;
    };
    if timeline.events.iter().any(|e| matches!(e.kind, EventKind::WorldObject { .. } | EventKind::ObjectContact { .. })) && !p.contacts.as_ref().is_some_and(|plan| plan.matches(p)) {
        report.diagnostics.push(Diagnostic::error(0, "Tarkistettu esinekontaktisuunnitelma puuttuu tai on vanhentunut."));
    }
    let durations = crate::agents::voice::timed_seconds(&fresh, &p.voice_lines);
    let expected = hs_script::to_timeline_with(&fresh, &p.script, p.fps, &durations);
    if expected.events != timeline.events
        || expected.duration != timeline.duration
        || expected.fps != timeline.fps
    {
        report.diagnostics.push(Diagnostic::error(
            0,
            "Aikajanan tapahtumat tai resurssit eivät vastaa tarkistettua käsikirjoitusta.",
        ));
    }
    if timeline.duration.seconds() > 60.0 || p.frame_count() > 1800 || p.fps.0 == 0 {
        report.diagnostics.push(Diagnostic::error(
            0,
            "Tuotannon ajoitus ylittää tuetut rajat.",
        ));
    }
    if p.cast.len() != p.motion.len() {
        report.diagnostics.push(Diagnostic::error(
            0,
            "Hahmojen liikeresurssit eivät täsmää.",
        ));
    }
    let mut profiles = HashSet::new();
    for profile in &p.cast_params {
        if !profiles.insert(profile.name.to_lowercase()) {
            report.diagnostics.push(Diagnostic::error(
                0,
                "Kahdella hahmoprofiililla on sama nimi.",
            ));
        }
        if let Err(error) = validate_profile(profile) {
            report.diagnostics.push(Diagnostic::error(0, error));
        }
    }
    if p.voice_lines.iter().any(|line| {
        line.provenance
            .as_ref()
            .is_some_and(|meta| meta.engine == "test")
    }) {
        report.diagnostics.push(Diagnostic::warning(0,"Puhe on testisynteesiä, ei aitoa Kokoro-puhetta. Sitä ei hyväksytä oikean jakson puhetestiksi."));
    }
    let preset_names: HashSet<_> = hs_character::CharacterParams::presets()
        .iter()
        .map(|c| c.name.to_lowercase())
        .collect();
    let presets = hs_character::CharacterParams::presets();
    for member in &p.cast {
        let intended = p.cast_params.iter().chain(presets.iter()).find(|profile| {
            profile
                .name
                .eq_ignore_ascii_case(&member.character.params.name)
        });
        if intended.is_none_or(|profile| profile != &member.character.params) {
            report.diagnostics.push(Diagnostic::error(0,"Kohtauksen hahmoparametrit eivät vastaa nykyisiä profiileja. Aja tuotantoputki uudelleen."));
        }
    }
    let active: HashSet<_> = p
        .cast
        .iter()
        .map(|c| c.character.params.name.to_lowercase())
        .collect();
    if !fresh.beats.iter().any(|beat| beat.speaker.is_some()) {
        report.diagnostics.push(Diagnostic::error(
            0,
            "Kohtauksen hahmoa ei ole nimetty. Oletushahmoa ei käytetä lopullisessa tuotannossa.",
        ));
    }
    if let Some(camera) = &p.camera {
        let continuous = camera
            .shots
            .first()
            .is_some_and(|shot| shot.start.abs() < 0.001)
            && camera
                .shots
                .last()
                .is_some_and(|shot| (shot.end as f64 - timeline.duration.seconds()).abs() < 0.001)
            && camera
                .shots
                .windows(2)
                .all(|pair| (pair[1].start - pair[0].end).abs() < 0.001);
        if !continuous {
            report.diagnostics.push(Diagnostic::error(
                0,
                "Kameraotokset eivät kata koko kohtausta yhtenäisesti.",
            ));
        }
        if camera
            .shots
            .windows(2)
            .any(|pair| pair[1].start < pair[0].end - 0.00001)
        {
            report
                .diagnostics
                .push(Diagnostic::error(0, "Kameraotokset menevät päällekkäin."));
        }
        for shot in &camera.shots {
            if !shot.start.is_finite()
                || !shot.end.is_finite()
                || !shot.angle.is_finite()
                || shot.start < 0.0
                || shot.end <= shot.start
                || shot.end as f64 > timeline.duration.seconds() + 0.001
                || shot.subject >= p.cast.len()
                || shot
                    .partner
                    .is_some_and(|i| i >= p.cast.len() || i == shot.subject)
            {
                report.diagnostics.push(Diagnostic::error(
                    0,
                    "Kameraotoksen ajoitus tai kohde ei kelpaa.",
                ));
            }
        }
    }
    let lines: Vec<_> = p.script.lines().collect();
    let mut background = "studio-v1".to_string();
    let mut props = BTreeMap::<String, Option<String>>::new();
    let mut expressions = BTreeMap::<String, Expression>::new();
    let mut looks = BTreeMap::<String, LookTarget>::new();
    let mut seated = BTreeMap::<String, bool>::new();
    let mut chair_background: Option<String> = None;
    for beat in &fresh.beats {
        let actor = beat.speaker.as_ref().map(|s| s.to_lowercase());
        if let Some(name) = &actor {
            if !profiles.contains(name) && !preset_names.contains(name) {
                report.diagnostics.push(Diagnostic::error(
                    beat.line,
                    format!(
                        "Hahmolle {} puuttuu määritetty profiili; ulkonäköä ei arvata.",
                        beat.speaker.as_deref().unwrap()
                    ),
                ));
            }
            if !active.contains(name) {
                report.diagnostics.push(Diagnostic::error(
                    beat.line,
                    "Rivin hahmo ei ole toteutuneessa 3D-kohtauksessa.",
                ));
            }
        } else if !beat.text.is_empty()
            || beat.motion != MotionKind::Wait
            || beat.prop.is_some()
            || beat.expression.is_some()
            || beat.look_at.is_some()
            || beat.phone.is_some()
            || beat.view.is_some()
        {
            report.diagnostics.push(Diagnostic::error(beat.line,"Nimeä repliikin tai toiminnan hahmo: NAME: teksti [ohje]. Kohdetta ei valita arvaamalla."));
        }
        if beat.view.is_some() && matches!(beat.motion, MotionKind::TurnLeft | MotionKind::TurnRight | MotionKind::WalkBackward) {
            report.diagnostics.push(Diagnostic::error(beat.line, "Anna kääntyminen tai takaperin kävely ilman samanaikaista view-ohjetta. Suunta voidaan asettaa edeltävällä erillisellä rivillä."));
        }
        if let (Some(view), MotionKind::Walk(direction) | MotionKind::Run(direction)) =
            (beat.view, beat.motion)
        {
            let expected = match direction {
                hs_core::Direction::Left => hs_core::View::Left,
                hs_core::Direction::Right => hs_core::View::Right,
                hs_core::Direction::Front => hs_core::View::Front,
            };
            if view != expected {
                report.diagnostics.push(Diagnostic::error(beat.line,"Vartalon suunta ja kävely/juoksusuunta ovat ristiriidassa. Sivuaskelia ei ole toteutettu; käytä liikkeen suuntaa tai erillistä katsetavoitetta."));
            }
        }
        if let Some(bg) = &beat.background {
            background = bg.clone();
        }
        let mut chair_contact = None;
        if chair_background
            .as_ref()
            .is_some_and(|bg| bg != &background)
        {
            report.diagnostics.push(Diagnostic::error(beat.line, "Tuolin sisältävässä kohtauksessa lavastetta ei voi vaihtaa. Aloita uusi kohtaus/jakso."));
        }
        if let Some(name) = &actor {
            let was_seated = seated.get(name).copied().unwrap_or(false);
            match beat.motion {
                MotionKind::Sit => {
                    if was_seated {
                        report
                            .diagnostics
                            .push(Diagnostic::error(beat.line, "Hahmo istuu jo tuolilla."));
                    }
                    if background.starts_with("car") || background.starts_with("phone") {
                        report.diagnostics.push(Diagnostic::error(
                            beat.line,
                            "Tässä lavasteessa erillistä tuolikontaktia ei tueta.",
                        ));
                    }
                    if beat.seconds < 1.0 {
                        report.diagnostics.push(Diagnostic::error(
                            beat.line,
                            "Istuminen tarvitsee vähintään 1 sekunnin.",
                        ));
                    }
                    chair_background.get_or_insert(background.clone());
                    seated.insert(name.clone(), true);
                    chair_contact = Some("istuu omalla tuolilla".into());
                }
                MotionKind::Stand => {
                    if !was_seated {
                        report.diagnostics.push(Diagnostic::error(
                            beat.line,
                            "Nouseminen tarvitsee edeltävän tuolille istumisen.",
                        ));
                    }
                    seated.insert(name.clone(), false);
                    chair_contact = Some("nousee omalta tuolilta".into());
                }
                MotionKind::Wait | MotionKind::Nod if was_seated => {
                    chair_contact = Some("istuu omalla tuolilla".into());
                }
                _ if was_seated => {
                    report.diagnostics.push(Diagnostic::error(beat.line, "Nouse tuolilta ennen tätä liikettä. Istuen tuetaan tällä hetkellä puhetta, taukoa ja nyökkäystä."));
                }
                _ => {}
            }
            if (was_seated || beat.motion == MotionKind::Sit) && beat.view.is_some() {
                report.diagnostics.push(Diagnostic::error(
                    beat.line,
                    "Vartaloa ei voi kääntää tuolikontaktissa. Käytä erillistä katsetavoitetta.",
                ));
            }
        }
        if !hs_render::environment::KNOWN.contains(&background.as_str()) {
            report.diagnostics.push(Diagnostic::error(
                beat.line,
                "Taustalta puuttuu toteutettu 3D-lavaste.",
            ));
        }
        if let Some(name) = &actor {
            if let Some(prop) = &beat.prop {
                props.insert(name.clone(), prop.clone());
            }
            if let Some(expression) = beat.expression {
                expressions.insert(name.clone(), expression);
            }
            if let Some(target) = &beat.look_at {
                looks.insert(name.clone(), target.clone());
            }
        }
        let prop = actor
            .as_ref()
            .and_then(|name| props.get(name).cloned().flatten());
        if prop
            .as_ref()
            .is_some_and(|id| !hs_render::props::HELD.contains(&id.as_str()))
        {
            report.diagnostics.push(Diagnostic::error(
                beat.line,
                "Esineeltä puuttuu toteutettu 3D-malli.",
            ));
        }
        if beat.motion == MotionKind::PhoneTap && prop.is_some() {
            report.diagnostics.push(Diagnostic::error(beat.line,"Puhelimen näpyttely ja kädessä oleva esine käyttävät samoja käsiä. Poista esine ennen näpyttelyä."));
        }
        if beat.phone == Some(hs_core::PhoneView::Hidden) && beat.motion == MotionKind::PhoneTap {
            report.diagnostics.push(Diagnostic::error(
                beat.line,
                "Piilotettu puhelin ja puhelimen näpyttely ovat ristiriidassa.",
            ));
        }
        let look_at = actor.as_ref().and_then(|name| looks.get(name)).cloned();
        if let Some(LookTarget::Character(target)) = &look_at {
            if actor
                .as_ref()
                .is_some_and(|name| name.eq_ignore_ascii_case(target))
            {
                report.diagnostics.push(Diagnostic::error(beat.line,"Hahmo ei voi kohdistaa katsetta omaan päähänsä. Peilikatse ei ole toteutettu toiminto."));
            }
            if !active.contains(&target.to_lowercase()) {
                report.diagnostics.push(Diagnostic::error(
                    beat.line,
                    format!("Katseen kohde {target} puuttuu kohtauksesta."),
                ));
            }
        }
        let event = timeline
            .events
            .iter()
            .find(|e| e.source.line == beat.line && matches!(e.kind, EventKind::Motion { .. }));
        let Some(event) = event else {
            report.diagnostics.push(Diagnostic::error(
                beat.line,
                "Riviltä puuttuu jäljitettävä liiketapahtuma.",
            ));
            continue;
        };
        if event.kind
            != (EventKind::Motion {
                character: beat.speaker.clone(),
                motion: beat.motion,
            })
            || event.source.text != lines.get(beat.line.saturating_sub(1)).unwrap_or(&"").trim()
        {
            report.diagnostics.push(Diagnostic::error(
                beat.line,
                "Toteutunut tapahtuma ei vastaa käsikirjoituksen ohjetta.",
            ));
        }
        if beat.motion == MotionKind::Sit {
            if let Some(motion) = actor
                .as_ref()
                .and_then(|name| {
                    p.cast
                        .iter()
                        .position(|c| c.character.params.name.eq_ignore_ascii_case(name))
                })
                .and_then(|i| p.motion.get(i))
            {
                if let Some(chair) = motion.chair_at(event.start.seconds() as f32) {
                    let (root, yaw) = motion.root_at(event.start.seconds() as f32);
                    let angle = (yaw - chair.yaw).sin().atan2((yaw - chair.yaw).cos()).abs();
                    if glam::Vec3::new(root.x, 0.0, root.z).distance(chair.standing_position) > 0.02
                        || angle > 0.05
                    {
                        report.diagnostics.push(Diagnostic::error(beat.line, "Hahmo ei ole oman tuolinsa kohdalla ja suunnassa. Tuolia ei siirretä hahmon mukana."));
                    }
                }
            }
        }
        if beat.motion == MotionKind::Clap {
            if let Some(motion) = actor.as_ref().and_then(|name| p.cast.iter().position(|c| c.character.params.name.eq_ignore_ascii_case(name))).and_then(|i| p.motion.get(i)) {
                let pose = motion.evaluate(timeline, (event.start.seconds() + event.duration.seconds()*0.5) as f32).pose;
                let h = &motion.motion.humanoid;
                let world = h.skeleton.world(&pose);
                let surfaces = hs_motion::Side::BOTH.map(|side| {
                    let arm = h.arm(side);
                    let hand = world[arm.hand];
                    hand.pos + hand.rot * glam::Vec3::new(-side.sign()*arm.hand_len*0.11, -arm.hand_len*0.24, 0.0)
                });
                let gap = surfaces[0].distance(surfaces[1]);
                if !gap.is_finite() || gap > 0.004 {
                    report.diagnostics.push(Diagnostic::error(beat.line,"Taputuksen kädet eivät kohtaa tämän hahmon mittasuhteilla. Kontaktia ei korvata pelkällä käsien heiluttelulla."));
                }
            }
        }
        let start = event.start.seconds();
        let end = timeline
            .events
            .iter()
            .filter(|other| {
                other.start == event.start
                    && other.source.line == beat.line
                    && !matches!(other.kind, EventKind::Background { .. })
            })
            .map(|other| other.end())
            .max()
            .unwrap_or(event.end())
            .seconds();
        let sample = (start + (end - start) * 0.5) as f32;
        if p.camera
            .as_ref()
            .is_some_and(|camera| camera.background_at(sample) != background)
        {
            report.diagnostics.push(Diagnostic::error(
                beat.line,
                "Toteutuva kameran lavaste ei vastaa käsikirjoitusta.",
            ));
        }
        let phone_visible = actor
            .as_ref()
            .and_then(|name| {
                p.cast
                    .iter()
                    .position(|c| c.character.params.name.eq_ignore_ascii_case(name))
            })
            .and_then(|index| p.motion.get(index))
            .is_some_and(|motion| motion.evaluate(timeline, sample).props.phone.is_some());
        if matches!(beat.motion, MotionKind::Clap | MotionKind::Shrug | MotionKind::PointForward) && (prop.is_some() || phone_visible) {
            report.diagnostics.push(Diagnostic::error(beat.line, "Tämä käsiele tarvitsee vapaat kädet. Poista kädessä oleva esine ja piilota puhelin ensin."));
        }
        for (name, held) in &props {
            if held.is_some()
                && p.cast
                    .iter()
                    .position(|c| c.character.params.name.eq_ignore_ascii_case(name))
                    .and_then(|index| p.motion.get(index))
                    .is_some_and(|motion| motion.evaluate(timeline, sample).props.phone.is_some())
            {
                report.diagnostics.push(Diagnostic::error(
                    beat.line,
                    format!("Hahmon {name} näkyvä puhelin ja toinen esine käyttävät samoja käsiä."),
                ));
            }
        }
        let shots = p
            .camera
            .as_ref()
            .map(|camera| {
                camera
                    .shots
                    .iter()
                    .filter(|s| (s.end as f64).min(end) - (s.start as f64).max(start) > 0.00001)
                    .map(|s| s.kind.finnish().to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if shots.is_empty() {
            report.diagnostics.push(Diagnostic::error(
                beat.line,
                "Riviltä puuttuu toteutuva kameraotos.",
            ));
        }
        report.rows.push(Row {
            line: beat.line,
            source: lines
                .get(beat.line.saturating_sub(1))
                .unwrap_or(&"")
                .to_string(),
            actor: beat.speaker.clone(),
            dialogue: beat.text.clone(),
            motion: p.contacts.as_ref().and_then(|plan|plan.summary(beat.line)).unwrap_or_else(||beat.motion.finnish_name().into()),
            motion_seconds: event.duration.seconds(),
            motion_start_seconds: start,
            motion_end_seconds: event.end().seconds(),
            background: background.clone(),
            prop,
            phone_visible,
            expression: actor
                .as_ref()
                .and_then(|name| expressions.get(name))
                .copied()
                .unwrap_or_default(),
            look_at,
            start_seconds: fresh.beats.iter().position(|b|b.line==beat.line).and_then(|i|p.beat_times.get(i)).map_or(start, |t|t.0 as f64),
            end_seconds: fresh.beats.iter().position(|b|b.line==beat.line).and_then(|i|p.beat_times.get(i)).map_or(end, |t|(t.0+t.1) as f64).max(end),
            shots,
            authored_camera: beat.camera.is_some(),
            object_contact: p.contacts.as_ref().and_then(|plan|plan.summary(beat.line)),
            chair_contact,
        });
    }
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ready(script: &str) -> Production {
        let mut p = Production::new(script);
        p.cast_params = hs_character::CharacterParams::presets();
        crate::Pipeline::default().run(&mut p).unwrap();
        p
    }
    #[test]
    fn binds_real_assets_actor_state_timing_and_shots_without_inventing_speech() {
        let p=ready("[background living room]\n[shot two shot]\nKALLE: Hello! [prop coffee cup] [expression happy] [wave 2s]\nMAIJA: Hi! [look at Kalle] [wait 1s]\nKALLE: [prop none] [wait 1s]");
        let report = inspect(&p);
        assert!(report.allowed(), "{:?}", report.diagnostics);
        assert_eq!(report.rows[0].prop.as_deref(), Some("mug"));
        assert_eq!(report.rows[2].prop, None);
        assert_eq!(report.rows[2].expression, Expression::Happy);
        assert_eq!(report.rows[0].background, "apartment-v1");
        assert_eq!(report.rows[0].dialogue, "Hello!");
        assert!(report
            .rows
            .iter()
            .all(|r| r.end_seconds > r.start_seconds && !r.shots.is_empty()));
    }
    #[test]
    fn hand_conflict_and_unnamed_actor_block_final_assembly() {
        let p = ready("KALLE: [prop coffee cup] [wait 1s]\nKALLE: [texting on phone 2s]");
        assert!(!inspect(&p).allowed());
        let p = ready("[walk left 2s]");
        assert!(!inspect(&p).allowed());
        let p = ready("KALLE: [wait 1s]\n[view left]\n[wait 1s]");
        assert!(!inspect(&p).allowed());
    }
    #[test]
    fn stale_plan_and_invalid_profile_are_not_marked_ready() {
        let mut p = ready("KALLE: Hello! [wave 2s]");
        p.script.push_str("\nMAIJA: Hi!");
        assert!(!inspect(&p).allowed());
        let mut profile = hs_character::CharacterParams::kalle();
        profile.height = f32::NAN;
        assert!(validate_profile(&profile).is_err());
        profile.height = 1.7;
        profile.leg_ratio = 0.0;
        assert!(validate_profile(&profile).is_err());
    }
    #[test]
    fn all_parser_resources_have_real_models() {
        for (_, id) in hs_script::BACKGROUND_ALIASES {
            assert!(hs_render::environment::KNOWN.contains(id), "{id}");
        }
        for (_, id) in hs_script::PROP_ALIASES {
            if *id != "none" {
                assert!(hs_render::props::HELD.contains(id), "{id}");
            }
        }
    }
}
