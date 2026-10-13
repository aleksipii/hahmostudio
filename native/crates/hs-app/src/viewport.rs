//! Näyttämön esikatselu: GPU-renderöijä jakaa eframe:n wgpu-laitteen ja piirtää
//! suoraan tekstuuriin, jonka egui näyttää. Ilman wgpu:ta käytetään CPU-polkua.

use eframe::egui;
use hs_agents::agents::render::FrameBuilder;
use hs_agents::Production;
use hs_render::cpu::CpuRenderer;
use hs_render::gpu::GpuRenderer;
use hs_render::Renderer;
use std::sync::Arc;

/// Keep strong references: a freed allocation's address must never produce a
/// false cache hit after an editor rebuild.
struct PreviewKey {
    frame: u32,
    size: [u32; 2],
    fps: hs_core::Fps,
    timeline: Option<hs_core::Timeline>,
    camera: Option<Arc<hs_agents::agents::cinematography::CameraTrack>>,
    cast: Vec<hs_agents::production::CastMember>,
    motion: Vec<Arc<hs_motion::procedural::PreparedMotion>>,
    lips: Vec<hs_agents::production::LipClip>,
    live: Option<hs_agents::LiveOverride>,
    contacts: Option<Arc<hs_agents::contacts::ContactPlan>>,
}

impl PreviewKey {
    fn capture(p: &Production, frame: u32, size: [u32; 2]) -> Self {
        Self { frame, size, fps: p.fps, timeline: p.timeline.clone(), camera: p.camera.clone(),
            cast: p.cast.clone(), motion: p.motion.clone(), lips: p.lipsync.clone(), live: p.live.clone(), contacts: p.contacts.clone() }
    }

    fn matches(&self, p: &Production, frame: u32, size: [u32; 2]) -> bool {
        self.frame == frame && self.size == size && self.fps == p.fps
            && self.timeline == p.timeline && self.live == p.live
            && match (&self.contacts, &p.contacts) { (Some(a), Some(b)) => Arc::ptr_eq(a,b), (None,None) => true, _ => false }
            && match (&self.camera, &p.camera) { (Some(a), Some(b)) => Arc::ptr_eq(a, b), (None, None) => true, _ => false }
            && self.cast.len() == p.cast.len() && self.cast.iter().zip(&p.cast).all(|(a,b)|
                Arc::ptr_eq(&a.character, &b.character) && Arc::ptr_eq(&a.mesh, &b.mesh) && a.lead == b.lead && a.start_x == b.start_x)
            && self.motion.len() == p.motion.len() && self.motion.iter().zip(&p.motion).all(|(a,b)| Arc::ptr_eq(a,b))
            && self.lips.len() == p.lipsync.len() && self.lips.iter().zip(&p.lipsync).all(|(a,b)|
                a.speaker == b.speaker && a.start == b.start && Arc::ptr_eq(&a.track, &b.track))
    }
}

pub struct Viewport {
    gpu: Option<GpuRenderer>,
    texture_id: Option<egui::TextureId>,
    cpu: CpuRenderer,
    cpu_texture: Option<egui::TextureHandle>,
    pub builder: FrameBuilder,
    pub last_ms: f32,
    pub backend_name: String,
    cached: Option<(PreviewKey, egui::TextureId)>,
}

impl Viewport {
    pub fn new(cc: &eframe::CreationContext<'_>, force_cpu: bool) -> Viewport {
        let (gpu, backend_name) = match (&cc.wgpu_render_state, force_cpu) {
            (Some(rs), false) => {
                let info = rs.adapter.get_info();
                (Some(GpuRenderer::with_device(rs.device.clone().into(), rs.queue.clone().into(), 1)), format!("GPU: {} ({:?})", info.name, info.backend))
            }
            _ => (None, "CPU".to_string()),
        };
        Viewport { gpu, texture_id: None, cpu: CpuRenderer { supersample: 1, ..Default::default() }, cpu_texture: None, builder: FrameBuilder::default(), last_ms: 0.0, backend_name, cached: None }
    }

    pub fn is_gpu(&self) -> bool {
        self.gpu.is_some()
    }

    /// Piirtää ruudun ja palauttaa egui-tekstuurin.
    pub fn draw(&mut self, ui: &egui::Ui, frame: &eframe::Frame, p: &Production, time: f32, size: [u32; 2]) -> Option<egui::TextureId> {
        let f = ((time * p.fps.0 as f32) as u32).min(p.frame_count().saturating_sub(1));
        let size = [size[0].max(16), size[1].max(16)];
        if let Some((key, id)) = &self.cached {
            if key.matches(p, f, size) { return Some(*id); }
        }
        self.cached = None;
        let scene = self.builder.scene(p, f, size[0], size[1])?;
        let start = std::time::Instant::now();
        let id = if let (Some(gpu), Some(rs)) = (&mut self.gpu, frame.wgpu_render_state()) {
            if gpu.render_to_texture(&scene).is_err() {
                return None;
            }
            let view = gpu.texture()?.create_view(&Default::default());
            let mut renderer = rs.renderer.write();
            match self.texture_id {
                Some(id) => {
                    renderer.update_egui_texture_from_wgpu_texture(&rs.device, &view, wgpu::FilterMode::Linear, id);
                    id
                }
                None => {
                    let id = renderer.register_native_texture(&rs.device, &view, wgpu::FilterMode::Linear);
                    self.texture_id = Some(id);
                    id
                }
            }
        } else {
            let img = self.cpu.render(&scene).ok()?;
            let color = egui::ColorImage::from_rgba_unmultiplied([img.width as usize, img.height as usize], &img.rgba);
            match &mut self.cpu_texture {
                Some(t) => t.set(color, egui::TextureOptions::LINEAR),
                None => self.cpu_texture = Some(ui.ctx().load_texture("nayttamo", color, egui::TextureOptions::LINEAR)),
            }
            self.cpu_texture.as_ref()?.id()
        };
        self.last_ms = start.elapsed().as_secs_f32() * 1000.0;
        self.cached = Some((PreviewKey::capture(p, f, size), id));
        Some(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hs_agents::Pipeline;

    #[test]
    fn preview_reuse_tracks_animation_and_editor_changes() {
        let mut p = Production::new("KALLE: [wait 2s]");
        Pipeline::default().run(&mut p).unwrap();
        let size = [320, 180];
        let key = PreviewKey::capture(&p, 0, size);
        assert!(key.matches(&p, 0, size));
        assert!(!key.matches(&p, 1, size));
        assert!(!key.matches(&p, 0, [640, 360]));
        p.lipsync.push(hs_agents::production::LipClip { speaker: Some("KALLE".into()), start: 0.0,
            track: Arc::new(hs_lipsync::from_text_timed("Hello", 1.0)) });
        assert!(!key.matches(&p, 0, size));
        let lips_key = PreviewKey::capture(&p, 0, size);
        p.lipsync[0].start = 0.2;
        assert!(!lips_key.matches(&p, 0, size));
        p.lipsync.clear();
        p.live = Some(hs_agents::LiveOverride { speaker: "KALLE".into(), mouth: Some(Default::default()), head: None });
        assert!(!key.matches(&p, 0, size));
        let live_key = PreviewKey::capture(&p, 0, size);
        p.live.as_mut().unwrap().head = Some([0.1, 0.0, 0.0]);
        assert!(!live_key.matches(&p, 0, size));
        p.live = None;
        p.timeline.as_mut().unwrap().events.clear();
        assert!(!key.matches(&p, 0, size));
        // Same source rebuilt with fresh immutable render resources must miss.
        let mut rebuilt = Production::new("KALLE: [wait 2s]");
        Pipeline::default().run(&mut rebuilt).unwrap();
        assert!(!key.matches(&rebuilt, 0, size));
    }

    #[test]
    fn isolated_render_resource_changes_invalidate_preview() {
        let mut p = Production::new("KALLE: [wait 2s]");
        let mut other = Production::new("KALLE: [wait 2s]");
        Pipeline::default().run(&mut p).unwrap();
        Pipeline::default().run(&mut other).unwrap();
        let size = [320, 180];
        let key = PreviewKey::capture(&p, 0, size);
        let camera = p.camera.clone();
        p.camera = other.camera.clone();
        assert!(!key.matches(&p, 0, size));
        p.camera = camera;
        let cast = p.cast.clone();
        p.cast = other.cast.clone();
        assert!(!key.matches(&p, 0, size));
        p.cast = cast;
        let motion = p.motion.clone();
        p.motion = other.motion.clone();
        assert!(!key.matches(&p, 0, size));
        p.motion = motion;
        p.fps = hs_core::Fps(p.fps.0 + 1);
        assert!(!key.matches(&p, 0, size));
    }
}
