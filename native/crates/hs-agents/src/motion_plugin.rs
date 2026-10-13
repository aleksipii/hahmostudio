//! Lazy, profile-independent native humanoid motion recipes. No downloaded code.
use crate::{motion_library, Pipeline, Production};
use hs_character::{Character, CharacterParams};
use hs_motion::skeleton::Skeleton;
use serde::Serialize;
use std::collections::BTreeMap;

pub const PLUGIN_ID: &str = "koeta.motion.humanoid.v1";
pub const TEMPLATE_COUNT: usize = 324;
pub const DURATION_COUNT: usize = 25;
pub const VARIANT_COUNT: usize = 32_400;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum Orientation {
    Front,
    Left,
    Right,
    Back,
}
impl Orientation {
    pub const ALL: [Self; 4] = [Self::Front, Self::Left, Self::Right, Self::Back];
    pub fn label(self) -> &'static str {
        match self {
            Self::Front => "front",
            Self::Left => "left",
            Self::Right => "right",
            Self::Back => "back",
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct MotionVariant {
    pub id: String,
    pub template_index: usize,
    pub duration_index: usize,
    pub orientation: Orientation,
}
#[derive(Clone, Debug, Serialize)]
pub struct MotionTemplate {
    pub index: usize,
    pub name: String,
    pub steps: Vec<&'static str>,
}
#[derive(Clone, Debug, Serialize)]
pub struct PluginInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub variants: usize,
    pub templates: usize,
    pub supported_rig: &'static str,
}
pub trait MotionPlugin: Send + Sync {
    fn info(&self) -> PluginInfo;
    fn bind(
        &self,
        variant: &MotionVariant,
        target: &CharacterParams,
    ) -> Result<BoundMotion, String>;
}
pub struct NativeHumanoidPlugin;
impl MotionPlugin for NativeHumanoidPlugin {
    fn info(&self) -> PluginInfo {
        plugin_info()
    }
    fn bind(&self, v: &MotionVariant, p: &CharacterParams) -> Result<BoundMotion, String> {
        bind_variant(v, p)
    }
}
pub fn plugin_info() -> PluginInfo {
    PluginInfo {
        id: PLUGIN_ID,
        name: "Koeta Native Humanoid",
        variants: VARIANT_COUNT,
        templates: TEMPLATE_COUNT,
        supported_rig: "Koeta native Humanoid semantic joints v1",
    }
}
pub fn plugins() -> Vec<Box<dyn MotionPlugin>> {
    vec![Box::new(NativeHumanoidPlugin)]
}
fn template(index: usize) -> Result<MotionTemplate, String> {
    if index >= TEMPLATE_COUNT {
        return Err("Tuntematon liikepohja.".into());
    }
    let (a, b) = if index < 18 {
        (index, None)
    } else {
        let pair = index - 18;
        let a = pair / 17;
        let other = pair % 17;
        (a, Some(if other >= a { other + 1 } else { other }))
    };
    let mut steps = motion_library::RECIPES[a].2.to_vec();
    let mut name = motion_library::RECIPES[a].1.to_string();
    if let Some(b) = b {
        steps.extend_from_slice(motion_library::RECIPES[b].2);
        name.push_str(" → ");
        name.push_str(motion_library::RECIPES[b].1);
    }
    Ok(MotionTemplate { index, name, steps })
}
pub fn templates() -> Vec<MotionTemplate> {
    (0..TEMPLATE_COUNT)
        .map(|i| template(i).expect("bounded template"))
        .collect()
}
pub fn variant(
    template_index: usize,
    duration_index: usize,
    orientation: Orientation,
) -> Result<MotionVariant, String> {
    template(template_index)?;
    if duration_index >= DURATION_COUNT {
        return Err("Tuntematon liikkeen kesto.".into());
    }
    Ok(MotionVariant {
        id: format!(
            "{PLUGIN_ID}/t{template_index:03}/d{duration_index:02}/{}",
            orientation.label()
        ),
        template_index,
        duration_index,
        orientation,
    })
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct HumanoidBinding {
    pub contract: &'static str,
    pub joints: BTreeMap<String, usize>,
}
impl HumanoidBinding {
    /// Validate semantic roles and ancestry before FK/IK can index the rig.
    pub fn validate(s: &Skeleton) -> Result<Self, String> {
        let mut all = BTreeMap::new();
        for (i, j) in s.joints.iter().enumerate() {
            if !j.offset.is_finite()
                || j.parent.is_some_and(|p| p >= i)
                || all.insert(j.name.clone(), i).is_some()
            {
                return Err("Virheellinen tai monitulkintainen luuranko.".into());
            }
        }
        let mut expected: Vec<(String, Option<String>)> = vec![
            ("pelvis".into(), None),
            ("spine".into(), Some("pelvis".into())),
            ("chest".into(), Some("spine".into())),
            ("neck".into(), Some("chest".into())),
            ("head".into(), Some("neck".into())),
        ];
        for side in ["l", "r"] {
            for (name, parent) in [
                ("clavicle", "chest"),
                ("upper_arm", "clavicle"),
                ("forearm", "upper_arm"),
                ("hand", "forearm"),
                ("thigh", "pelvis"),
                ("shin", "thigh"),
                ("foot", "shin"),
                ("toe", "foot"),
            ] {
                let parent = if ["chest", "pelvis"].contains(&parent) {
                    parent.into()
                } else {
                    format!("{side}_{parent}")
                };
                expected.push((format!("{side}_{name}"), Some(parent)));
            }
            for finger in hs_motion::humanoid::FINGER_NAMES {
                for n in 1..=3 {
                    expected.push((
                        format!("{side}_{finger}{n}"),
                        Some(if n == 1 {
                            format!("{side}_hand")
                        } else {
                            format!("{side}_{finger}{}", n - 1)
                        }),
                    ));
                }
            }
        }
        let mut joints = BTreeMap::new();
        for (name, parent) in expected {
            let i = *all
                .get(&name)
                .ok_or_else(|| format!("Humanoid-nivel {name} puuttuu."))?;
            let wanted = parent.as_ref().and_then(|p| all.get(p)).copied();
            let joint = &s.joints[i];
            if joint.offset.length_squared() < 1e-12
                || joint.offset.length_squared() > 100.0
                || (name == "pelvis" && joint.offset.y <= 0.0)
            {
                return Err(format!(
                    "Humanoid-nivelen {name} geometria ei vastaa tuettua sopimusta."
                ));
            }
            if s.joints[i].parent != wanted {
                return Err(format!(
                    "Humanoid-nivelen {name} hierarkia ei vastaa tuettua sopimusta."
                ));
            }
            joints.insert(name, i);
        }
        Ok(Self {
            contract: "koeta.native.humanoid.v1",
            joints,
        })
    }
}
#[derive(Clone, Debug)]
pub struct BoundMotion {
    pub variant: MotionVariant,
    pub target: CharacterParams,
    pub script: String,
    pub total_seconds: f64,
    pub binding: HumanoidBinding,
}
fn script_for(v: &MotionVariant, target: &CharacterParams) -> Result<(String, f64), String> {
    if variant(v.template_index, v.duration_index, v.orientation)? != *v {
        return Err("Liikevariantin tunniste ei vastaa sisältöä.".into());
    }
    crate::audit::validate_profile(target)?;
    let seconds = 1.0 + v.duration_index as f64 / 10.0;
    let t = template(v.template_index)?;
    let actor = target.name.to_uppercase();
    let mut script = format!("{actor}: [view {}] [wait 0.5s]", v.orientation.label());
    for step in &t.steps {
        script.push_str(&format!("\n{actor}: [{step} {seconds:.1}s]"));
    }
    let plan = hs_script::parse(&script);
    if !plan.is_assemblable()
        || plan.beats.iter().any(|b| {
            !b.text.is_empty()
                || !b
                    .speaker
                    .as_ref()
                    .is_some_and(|n| n.eq_ignore_ascii_case(&target.name))
        })
    {
        return Err("Hahmon nimi ei sovellu käsikirjoituksen turvalliseksi tunnisteeksi.".into());
    }
    Ok((script, 0.5 + seconds * t.steps.len() as f64))
}
pub fn bind_variant(v: &MotionVariant, target: &CharacterParams) -> Result<BoundMotion, String> {
    let (script, total_seconds) = script_for(v, target)?;
    let mut p = Production::new(script.clone());
    p.cast_params = vec![target.clone()];
    Pipeline::default().run(&mut p).map_err(|e| e.to_string())?;
    let report = crate::audit::inspect(&p);
    if !report.allowed() {
        return Err(report
            .diagnostics
            .iter()
            .filter(|d| d.severity == hs_core::Severity::Error)
            .map(|d| d.message.clone())
            .collect::<Vec<_>>()
            .join(" "));
    }
    let character = p.cast.first().ok_or("Hahmon luuranko puuttuu.")?;
    let binding = HumanoidBinding::validate(&character.character.humanoid.skeleton)?;
    Ok(BoundMotion {
        variant: v.clone(),
        target: target.clone(),
        script,
        total_seconds,
        binding,
    })
}
pub fn append_checked(source: &str, bound: &BoundMotion) -> Result<String, String> {
    let (script, total_seconds) = script_for(&bound.variant, &bound.target)?;
    let skeleton = Character::build(bound.target.clone()).humanoid.skeleton;
    if script != bound.script
        || total_seconds != bound.total_seconds
        || HumanoidBinding::validate(&skeleton)? != bound.binding
    {
        return Err("Liikkeen esikatselu on muuttunut; tarkista se uudelleen.".into());
    }
    if !source.is_empty() && !hs_script::parse(source).is_assemblable() {
        return Err("Korjaa käsikirjoituksen virheet ennen lisäämistä.".into());
    }
    let ending = if source.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let separator = if source.is_empty() || source.ends_with('\n') {
        ""
    } else {
        ending
    };
    let next = format!("{source}{separator}{}", script.replace('\n', ending));
    if next.chars().count() > hs_script::MAX_SCRIPT_CHARS {
        return Err("Käsikirjoituksen kokoraja ylittyisi.".into());
    }
    let plan = hs_script::parse(&next);
    if !plan.is_assemblable() || plan.beats.iter().map(|b| b.seconds).sum::<f64>() > 60.0 {
        return Err("Liike aiheuttaisi käsikirjoitusvirheen tai ylittäisi 60 sekuntia.".into());
    }
    Ok(next)
}
