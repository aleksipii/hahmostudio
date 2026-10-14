//! Original acting cadence persists without altering screenplay or audio.
use hs_agents::{project, Production};
use hs_motion::acting_style::ActingStyle;
use hs_project::{ProjectAsset, Series};
use hs_voice::Audio;
use std::sync::Arc;

fn source(style: ActingStyle) -> Production {
    let mut p = Production::new("KALLE: Keep this exact recording. [wait 1s]");
    p.acting_style = style;
    p.own_audio.insert(
        "retained-original-recording".into(),
        Arc::new(Audio {
            sample_rate: 24000,
            samples: vec![0.0, -0.0, 0.12345, -0.8, 1.5],
        }),
    );
    p
}
fn series(p: &Production) -> Series {
    let mut episode = project::capture_checked(p, "pilot".into(), 1, "Original".into()).unwrap();
    episode.assets.push(ProjectAsset {
        id: "worlds".into(),
        kind: "library".into(),
        bytes: hs_project::library::SeriesLibrary::default()
            .encode()
            .unwrap(),
    });
    Series {
        id: "show".into(),
        name: "Series".into(),
        episodes: vec![episode],
    }
}
#[test]
fn every_style_round_trips_without_touching_script_pcm_or_other_resources() {
    for style in [
        ActingStyle::Smooth,
        ActingStyle::Stepped12,
        ActingStyle::Stepped15,
    ] {
        let original = source(style);
        let captured = series(&original);
        let style_asset = captured.episodes[0]
            .assets
            .iter()
            .find(|a| a.kind == "acting-style")
            .unwrap();
        assert_eq!(style_asset.id, "acting-style");
        let reopened = hs_project::decode(&hs_project::encode(&captured).unwrap()).unwrap();
        assert_eq!(reopened.episodes[0].assets, captured.episodes[0].assets);
        let restored = project::restore_checked(&reopened.episodes[0]).unwrap();
        assert_eq!(restored.acting_style, style);
        assert_eq!(restored.script, original.script);
        assert!(restored.voice_engine.is_none());
        let own = &restored.own_audio["retained-original-recording"];
        let original_own = &original.own_audio["retained-original-recording"];
        assert_eq!(own.sample_rate, original_own.sample_rate);
        assert_eq!(
            own.samples.iter().map(|s| s.to_bits()).collect::<Vec<_>>(),
            original_own
                .samples
                .iter()
                .map(|s| s.to_bits())
                .collect::<Vec<_>>()
        );
    }
}
#[test]
fn legacy_missing_resource_restores_smooth_without_synthesis() {
    let mut old = series(&source(ActingStyle::Stepped15));
    old.episodes[0].assets.retain(|a| a.kind != "acting-style");
    let loaded = hs_project::decode(&hs_project::encode(&old).unwrap()).unwrap();
    let restored = project::restore_checked(&loaded.episodes[0]).unwrap();
    assert_eq!(restored.acting_style, ActingStyle::Smooth);
    assert_eq!(restored.own_audio.len(), 1);
    assert!(restored.voice_engine.is_none());
}
#[test]
fn invalid_and_duplicate_style_resources_are_rejected_before_application() {
    for bytes in [
        b"null".to_vec(),
        b"{}".to_vec(),
        b"\"unknown\"".to_vec(),
        b"\"smooth\" trailing".to_vec(),
        vec![b' '; hs_motion::acting_style::MAX_BYTES + 1],
    ] {
        let mut invalid = series(&source(ActingStyle::Smooth));
        invalid.episodes[0]
            .assets
            .iter_mut()
            .find(|a| a.kind == "acting-style")
            .unwrap()
            .bytes = bytes;
        assert!(project::restore_checked(&invalid.episodes[0]).is_err());
        assert!(hs_project::encode(&invalid).is_err());
    }
    let mut duplicate = series(&source(ActingStyle::Smooth));
    let mut style = duplicate.episodes[0]
        .assets
        .iter()
        .find(|a| a.kind == "acting-style")
        .unwrap()
        .clone();
    style.id = "second-style".into();
    duplicate.episodes[0].assets.push(style);
    assert!(project::restore_checked(&duplicate.episodes[0]).is_err());
    assert!(hs_project::encode(&duplicate).is_err());
}
