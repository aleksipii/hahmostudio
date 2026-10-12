//! Näyttämön esikatselu: GPU-renderöijä jakaa eframe:n wgpu-laitteen ja piirtää
//! suoraan tekstuuriin, jonka egui näyttää. Ilman wgpu:ta käytetään CPU-polkua.

use eframe::egui;
use hs_agents::agents::render::FrameBuilder;
use hs_agents::Production;
use hs_render::cpu::CpuRenderer;
use hs_render::gpu::GpuRenderer;
use hs_render::Renderer;

pub struct Viewport {
    gpu: Option<GpuRenderer>,
    texture_id: Option<egui::TextureId>,
    cpu: CpuRenderer,
    cpu_texture: Option<egui::TextureHandle>,
    pub builder: FrameBuilder,
    pub last_ms: f32,
    pub backend_name: String,
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
        Viewport { gpu, texture_id: None, cpu: CpuRenderer { supersample: 1, ..Default::default() }, cpu_texture: None, builder: FrameBuilder::default(), last_ms: 0.0, backend_name }
    }

    pub fn is_gpu(&self) -> bool {
        self.gpu.is_some()
    }

    /// Piirtää ruudun ja palauttaa egui-tekstuurin.
    pub fn draw(&mut self, ui: &egui::Ui, frame: &eframe::Frame, p: &Production, time: f32, size: [u32; 2]) -> Option<egui::TextureId> {
        let f = ((time * p.fps.0 as f32) as u32).min(p.frame_count().saturating_sub(1));
        let scene = self.builder.scene(p, f, size[0].max(16), size[1].max(16))?;
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
        Some(id)
    }
}
