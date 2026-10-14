//! cargo run -p hs-render --no-default-features --example render_3d_psd -- output.psd
use glam::Vec3;
use hs_render::{Camera, DrawItem, Lights, RenderScene, ShadingStyle};
use std::sync::Arc;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args_os()
        .nth(1)
        .ok_or("Usage: render_3d_psd output.psd")?;
    let character = hs_character::Character::build(hs_character::CharacterParams::kalle());
    let scene = RenderScene {
        width: 256,
        height: 256,
        camera: Camera {
            eye: Vec3::new(0.0, 1.0, 4.0),
            target: Vec3::new(0.0, 1.0, 0.0),
            fov_y: 40.0,
        },
        lights: Lights::default(),
        style: ShadingStyle::Flat,
        clear: [240, 240, 240],
        outline: 0.0,
        items: vec![DrawItem::rigid(Arc::new(character.mesh))],
    };
    let buffers = hs_render::raytrace::render(&scene, Default::default())?;
    hs_render::psd_exporter::save_atomic(&buffers, std::path::Path::new(&path))?;
    Ok(())
}
