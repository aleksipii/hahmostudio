//! Reproducible portable pilot with explicit TestEngine audio, NOT Kokoro speech.
//! cargo run -p hs-agents --example production_pilot -- /tmp/pilot-test.koeta
use std::{path::Path,sync::Arc};
fn main()->Result<(),Box<dyn std::error::Error>>{
 let path=std::env::args_os().nth(1).ok_or("Usage: production_pilot output.koeta")?;
 let mut p=hs_agents::Production::new(include_str!("../../../examples/production-pilot.en.txt"));
 p.voice_engine=Some(Arc::new(hs_voice::TestEngine::default()));p.width=160;p.height=90;
 hs_agents::Pipeline::default().run(&mut p)?;
 let mut episode=hs_agents::project::capture_checked(&p,"production-pilot-test".into(),1,"Pilot — TEST tones, not Kokoro".into())?;
 let event=p.timeline.as_ref().ok_or("Timeline missing")?.events.iter().find(|e|matches!(e.kind,hs_core::EventKind::ObjectContact{contact:hs_core::ObjectContact::Place{..},..})).ok_or("Floor contact missing")?;
 let frame=p.fps.tick_to_frame(event.start+hs_core::Tick::from_seconds(event.duration.seconds()*0.5));
 let mut builder=hs_agents::agents::render::FrameBuilder::default();let scene=builder.scene(&p,frame,64,112).ok_or("Scene unavailable")?;
 let buffers=hs_render::raytrace::render(&scene,Default::default())?;
 let doc=hs_image::Document::import_psd(&hs_render::psd_exporter::encode(&buffers)?)?;
 episode.assets.push(hs_project::ProjectAsset{id:"image-workspace".into(),kind:"image".into(),bytes:doc.encode()?});
 episode.assets.push(hs_project::ProjectAsset{id:"render-settings".into(),kind:"render-settings".into(),bytes:hs_project::render_settings::RenderSettings::default().encode()?});
 let series=hs_project::Series{id:"production-pilot-test-series".into(),name:"Koeta pilot — TEST AUDIO".into(),episodes:vec![episode]};
 hs_project::save_atomic(Path::new(&path),&series)?;
 let loaded=hs_project::decode(&std::fs::read(&path)?)?;let mut reopened=hs_agents::project::restore_checked(&loaded.episodes[0])?;
 hs_agents::Pipeline::default().run(&mut reopened)?;
 if reopened.voice_lines.len()!=8||reopened.voice_lines.iter().any(|l|l.speech.is_none())||reopened.mix.as_ref().map(|m|&m.samples)!=p.mix.as_ref().map(|m|&m.samples){return Err("Portable pilot audio did not reopen exactly".into());}
 println!("Saved and reopened {} with eight retained TEST audio lines and six editable AOV layers",Path::new(&path).display());Ok(())
}
