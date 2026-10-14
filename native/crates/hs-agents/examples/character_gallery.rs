//! Review original family silhouettes and faces using the actual CPU renderer.
//! cargo run --locked -p hs-agents --example character_gallery -- gallery.png
use glam::Vec3;
use hs_character::{Character, CharacterParams};
use hs_render::{
    cpu::CpuRenderer, Camera, DrawItem, Image, Lights, RenderScene, Renderer, ShadingStyle,
};
use std::{path::Path, sync::Arc};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("Provide a PNG output path")?;
    let (w, h) = (320u32, 400u32);
    let mut gallery = Image::new(w * 4, h * 4);
    let mut renderer = CpuRenderer {
        supersample: 2,
        threads: 2,
    };
    for (column, params) in [
        CharacterParams::kalle(),
        CharacterParams::maija(),
        CharacterParams::eetu(),
        CharacterParams::ronja(),
    ]
    .into_iter()
    .enumerate()
    {
        let character = Character::build(params);
        let rig = &character.humanoid;
        let mesh = Arc::new(character.mesh.clone());
        let head = rig.skeleton.bind_positions()[rig.head] + Vec3::Y * rig.head_height * 0.5;
        for row in 0..4 {
            let mut pose = rig.rest_pose();
            if row == 3 {
                hs_motion::expression::apply_expression(
                    rig,
                    &mut pose,
                    hs_core::timeline::Expression::Happy,
                    false,
                );
            }
            let skin = rig.skeleton.skin_matrices(&pose);
            let (target, distance, angle) = if row == 0 {
                (
                    Vec3::Y * rig.proportions.height * 0.51,
                    rig.proportions.height * 2.1,
                    0.0f32,
                )
            } else {
                (
                    head,
                    rig.head_height * 3.8,
                    if row == 2 { 0.65f32 } else { 0.0 },
                )
            };
            let scene = RenderScene {
                width: w,
                height: h,
                camera: Camera {
                    eye: target
                        + Vec3::new(
                            angle.sin() * distance,
                            distance * 0.015,
                            angle.cos() * distance,
                        ),
                    target,
                    fov_y: 32.0,
                },
                lights: Lights::default(),
                style: ShadingStyle::Flat,
                clear: [37, 48, 61],
                outline: 1.2,
                items: vec![DrawItem::skinned(mesh.clone(), skin.clone())
                    .with_outline(character.params.extras.outline)],
            };
            let image = renderer.render(&scene)?;
            for y in 0..h as usize {
                let dst =
                    ((row * h as usize + y) * gallery.width as usize + column * w as usize) * 4;
                gallery.rgba[dst..dst + w as usize * 4]
                    .copy_from_slice(&image.rgba[y * w as usize * 4..(y + 1) * w as usize * 4]);
            }
        }
    }
    hs_render::export::write_png(&gallery, Path::new(&path))?;
    Ok(())
}
