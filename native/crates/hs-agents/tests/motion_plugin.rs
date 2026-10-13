use hs_agents::motion_plugin::*;
use hs_character::{Character, CharacterParams};
use std::collections::HashSet;
fn target() -> CharacterParams {
    CharacterParams::presets()
        .into_iter()
        .find(|p| p.name == "Kalle")
        .unwrap()
}
#[test]
fn complete_lazy_catalog_is_unique_and_parseable() {
    let templates = templates();
    assert_eq!(templates.len(), 324);
    let mut sequences = HashSet::new();
    let mut ids = HashSet::new();
    for t in templates {
        assert!(sequences.insert(t.steps.clone()));
        for d in 0..25 {
            for orientation in Orientation::ALL {
                let v = variant(t.index, d, orientation).unwrap();
                assert!(ids.insert(v.id));
                let seconds = 1.0 + d as f64 / 10.0;
                let mut source = format!("KALLE: [view {}] [wait 0.5s]", orientation.label());
                for step in &t.steps {
                    source.push_str(&format!("\nKALLE: [{step} {seconds:.1}s]"));
                }
                let plan = hs_script::parse(&source);
                assert!(plan.is_assemblable(), "{source}: {:?}", plan.diagnostics);
            }
        }
    }
    assert_eq!(ids.len(), VARIANT_COUNT);
    assert_eq!(plugins()[0].info().variants, 32400);
    assert!(variant(324, 0, Orientation::Front).is_err());
    assert!(variant(0, 25, Orientation::Front).is_err());
}
#[test]
fn every_template_binds_real_native_pipeline() {
    for t in templates() {
        let v = variant(t.index, 0, Orientation::Front).unwrap();
        bind_variant(&v, &target()).unwrap_or_else(|e| panic!("{}: {e}", t.name));
    }
}
#[test]
fn profiles_are_rebuilt_and_semantic_binding_rejects_wrong_skeletons() {
    let v = variant(17, 0, Orientation::Front).unwrap();
    let first = bind_variant(&v, &target()).unwrap();
    let mut jane = target();
    jane.name = "Jane".into();
    jane.height = 1.12;
    jane.leg_ratio = 0.4;
    let second = bind_variant(&v, &jane).unwrap();
    assert!(second.script.starts_with("JANE:"));
    assert_eq!(
        first.binding.joints.keys().collect::<Vec<_>>(),
        second.binding.joints.keys().collect::<Vec<_>>()
    );
    let a = Character::build(first.target);
    let b = Character::build(second.target);
    assert_ne!(
        a.humanoid.skeleton.bind_positions(),
        b.humanoid.skeleton.bind_positions()
    );
    for (character, script) in [(&a, &first.script), (&b, &second.script)] {
        let plan = hs_script::parse(script);
        let timeline = hs_script::to_timeline(&plan, script, hs_core::Fps(30));
        let motion = character.motion().prepare(&timeline);
        let pose = motion.evaluate(&timeline, 1.0).pose;
        assert!(pose.local.iter().all(|q| q.is_finite()));
        let world = character.humanoid.skeleton.world(&pose);
        let surfaces = hs_motion::Side::BOTH.map(|side| {
            let arm = character.humanoid.arm(side);
            let hand = world[arm.hand];
            hand.pos
                + hand.rot
                    * glam::Vec3::new(-side.sign() * arm.hand_len * 0.11, -arm.hand_len * 0.24, 0.)
        });
        assert!(
            surfaces[0].distance(surfaces[1]) < 0.002,
            "retargeted clap {surfaces:?}"
        );
    }
    let mut broken = a.humanoid.skeleton.clone();
    broken.joints[1].parent = None;
    assert!(HumanoidBinding::validate(&broken).is_err());
    let mut broken = a.humanoid.skeleton.clone();
    broken.joints[0].name = "other".into();
    assert!(HumanoidBinding::validate(&broken).is_err());
    let mut broken = a.humanoid.skeleton.clone();
    let forearm = broken.find("l_forearm").unwrap();
    broken.joints[forearm].offset = glam::Vec3::ZERO;
    assert!(HumanoidBinding::validate(&broken).is_err());
    let mut broken = a.humanoid.skeleton;
    broken.joints[1].parent = Some(999);
    assert!(HumanoidBinding::validate(&broken).is_err());
}
#[test]
fn malformed_actor_variant_and_forged_bound_preview_never_append() {
    let v = variant(7, 0, Orientation::Left).unwrap();
    let p = target();
    let mut forged = v.clone();
    forged.id = "other.plugin/t7".into();
    assert!(bind_variant(&forged, &p).is_err());
    for name in ["Jane Smith", "Jane: evil", "Jane\nKALLE", "Jane[wait]", ""] {
        let mut p = p.clone();
        p.name = name.into();
        assert!(bind_variant(&v, &p).is_err(), "{name}");
    }
    let bound = bind_variant(&v, &p).unwrap();
    let original = "KALLE: [wait 1s]\r\n";
    let next = append_checked(original, &bound).unwrap();
    assert!(next.starts_with(original));
    assert!(!next.replace("\r\n", "").contains('\n'));
    let mut forged = bound.clone();
    forged.script.push_str("\nKALLE: Surprise");
    assert!(append_checked(original, &forged).is_err());
    let mut forged = bound.clone();
    forged.binding.joints.clear();
    assert!(append_checked(original, &forged).is_err());
    let mut forged = bound.clone();
    forged.total_seconds = 0.0;
    assert!(append_checked(original, &forged).is_err());
    assert!(append_checked("KALLE: [wait 59s]", &bound).is_err());
    assert!(append_checked("KALLE: [not supported]", &bound).is_err());
    assert_eq!(original, "KALLE: [wait 1s]\r\n");
}
