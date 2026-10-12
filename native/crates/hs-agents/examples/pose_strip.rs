//! Kehitystyökalu: piirtää liikkeen vaiheet sivusta yhteen kuvaan.
//! Käyttö: cargo run -p hs-agents --example pose_strip -- "[juokse oikealle 2s]" 2.0 2.6 6 ulos.png
use glam::Vec3;
use hs_agents::{Pipeline, Production};
use hs_render::{cpu::CpuRenderer, environment, Camera, DrawItem, Lights, RenderScene, Renderer, ShadingStyle};
use std::sync::Arc;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let script = args.get(1).cloned().unwrap_or_else(|| "[juokse oikealle 2s]".into());
    let from: f32 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(0.5);
    let to: f32 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(1.5);
    let n: usize = args.get(4).and_then(|s| s.parse().ok()).unwrap_or(6);
    let out = args.get(5).cloned().unwrap_or_else(|| "strip.png".into());
    let mut p = Production::new(script);
    Pipeline::default().run(&mut p).expect("putki");
    let tl = p.timeline.as_ref().unwrap();
    let env = Arc::new(environment::build("studio-v1"));
    let (w, h) = (220u32, 330u32);
    let mut strip = vec![0u8; (w as usize * n) * h as usize * 4];
    for k in 0..n {
        let t = from + (to - from) * k as f32 / (n.max(2) - 1) as f32;
        let f = p.motion[0].evaluate(tl, t);
        let target = Vec3::new(f.root.x, 0.62, f.root.z);
        let scene = RenderScene {
            width: w,
            height: h,
            camera: Camera { eye: target + Vec3::new(0.0, 0.1, 3.2), target, fov_y: 35.0 },
            lights: Lights::default(),
            style: ShadingStyle::Flat,
            clear: [40, 50, 60],
            items: vec![DrawItem::rigid(env.clone()), DrawItem { mesh: p.cast[0].mesh.clone(), skin: p.cast[0].character.humanoid.skeleton.skin_matrices(&f.pose) }],
        };
        let img = CpuRenderer::default().render(&scene).unwrap();
        for y in 0..h as usize {
            let src = &img.rgba[y * w as usize * 4..(y + 1) * w as usize * 4];
            let dst = (y * w as usize * n + k * w as usize) * 4;
            strip[dst..dst + w as usize * 4].copy_from_slice(src);
        }
    }
    let img = hs_render::Image { width: w * n as u32, height: h, rgba: strip };
    hs_render::export::write_png(&img, std::path::Path::new(&out)).unwrap();
}
