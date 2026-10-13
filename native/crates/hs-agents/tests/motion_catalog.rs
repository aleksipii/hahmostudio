use hs_agents::motion_library::{append_checked,catalog};
#[test]
fn exactly_2000_unique_assets_use_supported_explicit_motion_recipes() {
    let items=catalog();assert_eq!(items.len(),2000);
    let mut ids=std::collections::HashSet::new();
    let mut scripts=std::collections::HashSet::new();
    for p in &items {
        assert!(ids.insert(&p.id));assert!(scripts.insert(&p.script));
        let plan=hs_script::parse(&p.script);
        assert!(plan.is_assemblable(),"{}: {:?}",p.id,plan.diagnostics);
        assert!((1..=2).contains(&plan.beats.len()));
        assert!(plan.beats.iter().all(|b| b.text.is_empty() && b.speaker.as_deref()==Some(p.profile.as_str())));
        assert!(plan.seconds<=6.8+1e-6);
    }
    for profile in ["Kalle","Maija","Eetu","Ronja"] {assert_eq!(items.iter().filter(|p|p.profile==profile).count(),500);}
}
#[test]
fn adding_asset_preserves_original_text_and_rejects_forged_or_oversize_changes() {
    let mut p=catalog().into_iter().find(|p|p.family=="turn-point" && p.profile=="Maija").unwrap();
    let source="KALLE: Hello! [wait 1s]\r\n";
    let next=append_checked(source,&p).unwrap();
    assert!(next.starts_with(source));assert!(next.contains("\r\nMAIJA:"));
    assert!(!next.replace("\r\n", "").contains('\n'));
    assert!(append_checked("KALLE: [unknown]",&p).is_err());
    p.script="MAIJA: Invented speech.".into();
    assert!(append_checked(source,&p).is_err());
    let long="KALLE: [wait 20s]\n".repeat(3);
    assert!(append_checked(&long,&catalog()[0]).is_err());
}
#[test]
fn all_families_and_profiles_pass_actual_production_preflight() {
    for p in catalog().into_iter().filter(|p| (p.seconds-1.0).abs()<1e-9) {
        let mut production=hs_agents::Production::new(&p.script);
        hs_agents::Pipeline::default().run(&mut production).unwrap();
        let report=hs_agents::audit::inspect(&production);
        assert!(report.allowed(),"{}: {:?}",p.id,report.diagnostics);
    }
}
