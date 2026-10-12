use glam::Vec3;
use hs_character::{Character, CharacterParams};
use hs_render::cpu::CpuRenderer;
use hs_render::{environment, props, Camera, DrawItem, Lights, RenderScene, Renderer, ShadingStyle};
use std::sync::Arc;

fn scene(style: ShadingStyle, w: u32, h: u32) -> RenderScene {
    let c = Character::build(CharacterParams::pipsa());
    let mut pose = c.humanoid.rest_pose();
    pose.local[c.humanoid.arm(hs_motion::Side::Left).upper] = glam::Quat::from_rotation_z(1.2);
    let skin = c.humanoid.skeleton.skin_matrices(&pose);
    let env = environment::build("studio-v1");
    let shadow = props::contact_shadow(Vec3::ZERO, 0.3, [0x3c, 0x52, 0x66]);
    RenderScene {
        width: w,
        height: h,
        camera: Camera { eye: Vec3::new(0.4, 0.9, 3.0), target: Vec3::new(0.0, 0.7, 0.0), fov_y: 35.0 },
        lights: Lights::default(),
        style,
        clear: environment::clear_color("studio-v1"),
        items: vec![DrawItem::rigid(Arc::new(env)), DrawItem::rigid(Arc::new(shadow)), DrawItem { mesh: Arc::new(c.mesh), skin }],
    }
}

fn out_dir() -> std::path::PathBuf {
    let d = std::path::PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("render");
    std::fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn cpu_draws_character_over_background() {
    let s = scene(ShadingStyle::Flat, 320, 480);
    let img = CpuRenderer::default().render(&s).unwrap();
    hs_render::export::write_png(&img, &out_dir().join("cpu-flat.png")).unwrap();
    // Keskellä on hahmo (paita keltainen), kulmassa tausta.
    let center = img.pixel(160, 250);
    let corner = img.pixel(5, 5);
    assert_ne!(center, corner);
    let yellowish = (0..img.height).flat_map(|y| (0..img.width).map(move |x| (x, y))).filter(|(x, y)| {
        let p = img.pixel(*x, *y);
        p[0] > 180 && p[1] > 140 && p[2] < 110
    }).count();
    assert!(yellowish > 500, "keltaista paitaa {yellowish} px");
    let cel = CpuRenderer::default().render(&scene(ShadingStyle::Cel, 320, 480)).unwrap();
    hs_render::export::write_png(&cel, &out_dir().join("cpu-cel.png")).unwrap();
    assert!(cel.mean_abs_diff(&img) > 1.0);
}

#[cfg(feature = "gpu")]
#[test]
fn gpu_matches_cpu() {
    let mut gpu = match hs_render::gpu::GpuRenderer::headless() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("GPU-testi ohitettu: {e}");
            return;
        }
    };
    eprintln!("GPU: {}", gpu.adapter_info());
    for style in [ShadingStyle::Flat, ShadingStyle::Cel] {
        let s = scene(style, 320, 480);
        let g = gpu.render(&s).unwrap();
        let c = CpuRenderer::default().render(&s).unwrap();
        hs_render::export::write_png(&g, &out_dir().join(format!("gpu-{style:?}.png"))).unwrap();
        let mad = g.mean_abs_diff(&c);
        let frac = g.differing_fraction(&c, 24);
        eprintln!("{style:?}: keskiero {mad:.2}, poikkeavia {:.2} %", frac * 100.0);
        assert!(mad < 2.5, "keskiero {mad}");
        assert!(frac < 0.03, "poikkeavia {frac}");
    }
}
