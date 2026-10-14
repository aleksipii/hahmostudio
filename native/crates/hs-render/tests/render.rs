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
        outline: 2.0,
        items: vec![DrawItem::rigid(Arc::new(env)), DrawItem::rigid(Arc::new(shadow)), DrawItem::skinned(Arc::new(c.mesh), skin)],
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
    // Ääriviivat: hahmon reunalla on mustetta, ilman niitä ei.
    let dark = |img: &hs_render::Image| img.rgba.chunks(4).filter(|p| p[0] < 30 && p[1] < 30 && p[2] < 30).count();
    let mut plain = scene(ShadingStyle::Flat, 320, 480);
    plain.outline = 0.0;
    let plain = CpuRenderer::default().render(&plain).unwrap();
    assert!(dark(&img) > dark(&plain) + 400, "{} vs {}", dark(&img), dark(&plain));
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

/// An opaque planar prop keeps diffuse illumination constant across pixels,
/// so the actual rendered gradient comes from the camera-dependent highlight.
fn highlight_scene(style: ShadingStyle, flag: f32) -> RenderScene {
    use hs_character::mesh::Vertex;
    let vertices = [(-1.5, -1.5), (1.5, -1.5), (1.5, 1.5), (-1.5, 1.5)]
        .into_iter().map(|(x, y)| Vertex {
            position: [x, y, 0.0], normal: [0.0, 0.0, 1.0],
            color: [0.12, 0.12, 0.12, 0.0], bones: [0, 0], weight: 1.0, shade: flag,
        }).collect();
    let mesh = hs_character::mesh::CharacterMesh { vertices, indices: vec![0, 1, 2, 0, 2, 3] };
    let disabled = hs_render::scene::Light { dir: -Vec3::Z, color: Vec3::ZERO };
    RenderScene {
        width: 64, height: 64,
        camera: Camera { eye: Vec3::new(0.0, 0.0, 3.0), target: Vec3::ZERO, fov_y: 60.0 },
        lights: Lights {
            key: hs_render::scene::Light { dir: -Vec3::Z, color: Vec3::X },
            fill: disabled, rim: disabled, ambient: Vec3::splat(0.1),
        },
        style, clear: [0, 0, 0], outline: 0.0,
        items: vec![DrawItem::rigid(Arc::new(mesh))],
    }
}

fn render_sample(scene: &RenderScene) -> hs_render::Image {
    CpuRenderer { supersample: 1, threads: 1 }.render(scene).unwrap()
}

#[test]
fn beauty_highlight_tracks_view_and_key_color_in_rendered_pixels() {
    for style in [ShadingStyle::Flat, ShadingStyle::Cel] {
        let mut s = highlight_scene(style, 1.0);
        let front = render_sample(&s);
        let center = front.pixel(32, 32);
        let edge = front.pixel(8, 32);
        assert!(center[0] > edge[0] + 5, "{style:?}: center {center:?}, edge {edge:?}");
        assert!(center[1].abs_diff(edge[1]) <= 1, "red key must not add green glare");
        assert_eq!(center[3], 255);
        s.camera.eye.x = 3.0;
        let angled = render_sample(&s).pixel(32, 32);
        assert!(center[0] > angled[0] + 5, "{style:?}: front {center:?}, angled {angled:?}");
    }
}

#[test]
fn beauty_highlight_does_not_light_unlit_faces_backgrounds_or_disabled_key() {
    for style in [ShadingStyle::Flat, ShadingStyle::Cel] {
        for flag in [0.0, 0.6, 1.0] {
            let mut s = highlight_scene(style, flag);
            if flag == 1.0 { s.lights.key.color = Vec3::ZERO; }
            let front = render_sample(&s).pixel(32, 32);
            s.camera.eye.x = 3.0;
            let angled = render_sample(&s).pixel(32, 32);
            for c in 0..3 {
                assert!(front[c].abs_diff(angled[c]) <= 1, "{style:?}, flag {flag}: {front:?} vs {angled:?}");
            }
        }
    }
}

#[test]
fn directional_light_magnitude_does_not_change_rendered_intensity() {
    for style in [ShadingStyle::Flat, ShadingStyle::Cel] {
        let mut s = scene(style, 96, 144);
        let unit = render_sample(&s);
        s.lights.key.dir *= 37.0;
        s.lights.fill.dir *= 7.0;
        s.lights.rim.dir *= 0.3;
        let scaled = render_sample(&s);
        assert!(unit.mean_abs_diff(&scaled) < 0.02);
        assert_eq!(unit.differing_fraction(&scaled, 1), 0.0);
    }
}

#[cfg(feature = "gpu")]
#[test]
fn gpu_matches_cpu_for_view_dependent_highlight_and_scaled_directions() {
    let mut gpu = match hs_render::gpu::GpuRenderer::headless() {
        Ok(g) => g,
        Err(e) => { eprintln!("GPU-testi ohitettu: {e}"); return; }
    };
    for style in [ShadingStyle::Flat, ShadingStyle::Cel] {
        for flag in [0.0, 0.6, 1.0] {
            let mut s = highlight_scene(style, flag);
            s.lights.key.dir *= 12.0;
            for eye_x in [0.0, 3.0] {
                s.camera.eye.x = eye_x;
                let g = gpu.render(&s).unwrap();
                let c = CpuRenderer { supersample: 2, threads: 1 }.render(&s).unwrap();
                // Center is away from raster coverage/AA differences.
                let gp = g.pixel(32, 32);
                let cp = c.pixel(32, 32);
                for channel in 0..4 {
                    assert!(gp[channel].abs_diff(cp[channel]) <= 1, "{style:?}, flag {flag}, eye {eye_x}: GPU {gp:?}, CPU {cp:?}");
                }
                assert!(g.differing_fraction(&c, 24) < 0.04);
            }
        }
    }
}
