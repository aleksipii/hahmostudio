//! GPU-kiihdytetty renderöinti wgpu:lla (Metal / Vulkan / DX12 / GL).
//!
//! Verkot ladataan GPU:lle kerran ja pidetään välimuistissa; ruutukohtaisesti
//! päivitetään vain luumatriisit. Sama renderöijä toimii käyttöliittymässä
//! (eframe:n jakama laite, tulos tekstuurina) ja headless-viennissä
//! (oma laite, tulos luetaan takaisin kuvaksi).

use crate::scene::{Image, RenderScene, ShadingStyle};
use crate::{RenderError, Renderer};
use glam::Mat4;
use hs_character::{srgb_to_linear, CharacterMesh, Vertex};
use std::collections::HashMap;
use std::sync::{Arc, Weak};
use wgpu::util::DeviceExt;

pub const MAX_BONES: usize = 64;
const BONE_BLOCK: u64 = (MAX_BONES * 64) as u64;
pub const COLOR_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8UnormSrgb;
const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float;

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Globals {
    view_proj: [[f32; 4]; 4],
    eye: [f32; 4],
    key_dir: [f32; 4],
    key_col: [f32; 4],
    fill_dir: [f32; 4],
    fill_col: [f32; 4],
    rim_dir: [f32; 4],
    rim_col: [f32; 4],
    ambient: [f32; 4],
    style: [f32; 4],
}

struct GpuMesh {
    source: Weak<CharacterMesh>,
    vertices: wgpu::Buffer,
    indices: wgpu::Buffer,
    count: u32,
}

struct Targets {
    width: u32,
    height: u32,
    msaa: Option<wgpu::TextureView>,
    color: wgpu::Texture,
    color_view: wgpu::TextureView,
    depth: wgpu::TextureView,
}

pub struct GpuRenderer {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
    pipeline: wgpu::RenderPipeline,
    globals: wgpu::Buffer,
    globals_group: wgpu::BindGroup,
    bones_layout: wgpu::BindGroupLayout,
    bones: wgpu::Buffer,
    bones_group: wgpu::BindGroup,
    bones_capacity: u64,
    meshes: HashMap<usize, GpuMesh>,
    targets: Option<Targets>,
    samples: u32,
    adapter_info: String,
}

fn vec4(v: glam::Vec3, w: f32) -> [f32; 4] {
    [v.x, v.y, v.z, w]
}

impl GpuRenderer {
    /// Luo oman laitteen (headless). Palauttaa virheen, jos GPU:ta ei ole.
    pub fn headless() -> Result<GpuRenderer, RenderError> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor { backends: wgpu::Backends::from_env().unwrap_or(wgpu::Backends::PRIMARY), ..Default::default() });
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            compatible_surface: None,
        }))
        .ok_or(RenderError::NoAdapter)?;
        let info = adapter.get_info();
        let (device, queue) = pollster::block_on(adapter.request_device(
            &wgpu::DeviceDescriptor { label: Some("hahmostudio"), required_features: wgpu::Features::empty(), required_limits: wgpu::Limits::default(), memory_hints: wgpu::MemoryHints::Performance },
            None,
        ))
        .map_err(|e| RenderError::Device(e.to_string()))?;
        let samples = if adapter.get_texture_format_features(COLOR_FORMAT).flags.sample_count_supported(4) { 4 } else { 1 };
        let mut r = Self::with_device(Arc::new(device), Arc::new(queue), samples);
        r.adapter_info = format!("{} ({:?})", info.name, info.backend);
        Ok(r)
    }

    /// Käyttää olemassa olevaa laitetta (esim. eframe:n). `samples` = MSAA (1 tai 4).
    pub fn with_device(device: Arc<wgpu::Device>, queue: Arc<wgpu::Queue>, samples: u32) -> GpuRenderer {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some("toon"), source: wgpu::ShaderSource::Wgsl(include_str!("../shaders/toon.wgsl").into()) });
        let globals_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("globals"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None },
                count: None,
            }],
        });
        let bones_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("bones"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX,
                ty: wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: true, min_binding_size: wgpu::BufferSize::new(BONE_BLOCK) },
                count: None,
            }],
        });
        let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: Some("toon"), bind_group_layouts: &[&globals_layout, &bones_layout], push_constant_ranges: &[] });
        let attributes = wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x4, 3 => Uint32x2, 4 => Float32, 5 => Float32];
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("toon"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                compilation_options: Default::default(),
                buffers: &[wgpu::VertexBufferLayout { array_stride: std::mem::size_of::<Vertex>() as u64, step_mode: wgpu::VertexStepMode::Vertex, attributes: &attributes }],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                compilation_options: Default::default(),
                targets: &[Some(wgpu::ColorTargetState { format: COLOR_FORMAT, blend: None, write_mask: wgpu::ColorWrites::ALL })],
            }),
            primitive: wgpu::PrimitiveState { cull_mode: None, ..Default::default() },
            depth_stencil: Some(wgpu::DepthStencilState { format: DEPTH_FORMAT, depth_write_enabled: true, depth_compare: wgpu::CompareFunction::Less, stencil: Default::default(), bias: Default::default() }),
            multisample: wgpu::MultisampleState { count: samples, ..Default::default() },
            multiview: None,
            cache: None,
        });
        let globals = device.create_buffer(&wgpu::BufferDescriptor { label: Some("globals"), size: std::mem::size_of::<Globals>() as u64, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let globals_group = device.create_bind_group(&wgpu::BindGroupDescriptor { label: Some("globals"), layout: &globals_layout, entries: &[wgpu::BindGroupEntry { binding: 0, resource: globals.as_entire_binding() }] });
        let (bones, bones_group) = Self::bone_buffer(&device, &bones_layout, 8);
        GpuRenderer {
            device,
            queue,
            pipeline,
            globals,
            globals_group,
            bones_layout,
            bones,
            bones_group,
            bones_capacity: 8,
            meshes: HashMap::new(),
            targets: None,
            samples,
            adapter_info: String::from("eframe"),
        }
    }

    fn bone_buffer(device: &wgpu::Device, layout: &wgpu::BindGroupLayout, items: u64) -> (wgpu::Buffer, wgpu::BindGroup) {
        let buffer = device.create_buffer(&wgpu::BufferDescriptor { label: Some("bones"), size: BONE_BLOCK * items, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("bones"),
            layout,
            entries: &[wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding { buffer: &buffer, offset: 0, size: wgpu::BufferSize::new(BONE_BLOCK) }) }],
        });
        (buffer, group)
    }

    pub fn adapter_info(&self) -> &str {
        &self.adapter_info
    }

    fn ensure_targets(&mut self, width: u32, height: u32) {
        if self.targets.as_ref().is_some_and(|t| t.width == width && t.height == height) {
            return;
        }
        let size = wgpu::Extent3d { width, height, depth_or_array_layers: 1 };
        let color = self.device.create_texture(&wgpu::TextureDescriptor {
            label: Some("color"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: COLOR_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        let msaa = (self.samples > 1).then(|| {
            self.device
                .create_texture(&wgpu::TextureDescriptor {
                    label: Some("msaa"),
                    size,
                    mip_level_count: 1,
                    sample_count: self.samples,
                    dimension: wgpu::TextureDimension::D2,
                    format: COLOR_FORMAT,
                    usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                    view_formats: &[],
                })
                .create_view(&Default::default())
        });
        let depth = self
            .device
            .create_texture(&wgpu::TextureDescriptor {
                label: Some("depth"),
                size,
                mip_level_count: 1,
                sample_count: self.samples,
                dimension: wgpu::TextureDimension::D2,
                format: DEPTH_FORMAT,
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                view_formats: &[],
            })
            .create_view(&Default::default());
        let color_view = color.create_view(&Default::default());
        self.targets = Some(Targets { width, height, msaa, color, color_view, depth });
    }

    fn mesh_key(mesh: &Arc<CharacterMesh>) -> usize {
        Arc::as_ptr(mesh) as usize
    }

    fn upload(&mut self, mesh: &Arc<CharacterMesh>) {
        let key = Self::mesh_key(mesh);
        if let Some(m) = self.meshes.get(&key) {
            if m.source.upgrade().is_some_and(|s| Arc::ptr_eq(&s, mesh)) {
                return;
            }
        }
        let vertices = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("vertices"), contents: bytemuck::cast_slice(&mesh.vertices), usage: wgpu::BufferUsages::VERTEX });
        let indices = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: Some("indices"), contents: bytemuck::cast_slice(&mesh.indices), usage: wgpu::BufferUsages::INDEX });
        self.meshes.insert(key, GpuMesh { source: Arc::downgrade(mesh), vertices, indices, count: mesh.indices.len() as u32 });
    }

    /// Piirtää kohtauksen tekstuuriin ja palauttaa sen näkymän (käyttöliittymää varten).
    pub fn render_to_texture(&mut self, scene: &RenderScene) -> Result<&wgpu::TextureView, RenderError> {
        self.draw(scene)?;
        Ok(&self.targets.as_ref().expect("kohde luotu").color_view)
    }

    pub fn texture(&self) -> Option<&wgpu::Texture> {
        self.targets.as_ref().map(|t| &t.color)
    }

    fn draw(&mut self, scene: &RenderScene) -> Result<(), RenderError> {
        if scene.width == 0 || scene.height == 0 || scene.width > 8192 || scene.height > 8192 {
            return Err(RenderError::Size(scene.width, scene.height));
        }
        self.ensure_targets(scene.width, scene.height);
        // Poista välimuistista verkot, joita ei enää ole.
        self.meshes.retain(|_, m| m.source.strong_count() > 0);
        for item in &scene.items {
            self.upload(&item.mesh);
        }
        let l = &scene.lights;
        let globals = Globals {
            view_proj: scene.camera.view_proj(scene.width as f32 / scene.height as f32).to_cols_array_2d(),
            eye: vec4(scene.camera.eye, 1.0),
            key_dir: vec4(l.key.dir, 0.0),
            key_col: vec4(l.key.color, 0.0),
            fill_dir: vec4(l.fill.dir, 0.0),
            fill_col: vec4(l.fill.color, 0.0),
            rim_dir: vec4(l.rim.dir, 0.0),
            rim_col: vec4(l.rim.color, 0.0),
            ambient: vec4(l.ambient, 0.0),
            style: [if scene.style == ShadingStyle::Cel { 1.0 } else { 0.0 }, 0.0, 0.0, 0.0],
        };
        self.queue.write_buffer(&self.globals, 0, bytemuck::bytes_of(&globals));
        let n = scene.items.len().max(1) as u64;
        if n > self.bones_capacity {
            let cap = n.next_power_of_two();
            let (b, g) = Self::bone_buffer(&self.device, &self.bones_layout, cap);
            self.bones = b;
            self.bones_group = g;
            self.bones_capacity = cap;
        }
        let mut block = vec![Mat4::IDENTITY; MAX_BONES * scene.items.len()];
        for (i, item) in scene.items.iter().enumerate() {
            assert!(item.skin.len() <= MAX_BONES, "liikaa luita: {}", item.skin.len());
            block[i * MAX_BONES..i * MAX_BONES + item.skin.len()].copy_from_slice(&item.skin);
        }
        if !block.is_empty() {
            self.queue.write_buffer(&self.bones, 0, bytemuck::cast_slice(&block));
        }
        let t = self.targets.as_ref().expect("kohde luotu");
        let clear = srgb_to_linear(scene.clear);
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("frame") });
        {
            let (view, resolve) = match &t.msaa {
                Some(m) => (m, Some(&t.color_view)),
                None => (&t.color_view, None),
            };
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("scene"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view,
                    resolve_target: resolve,
                    ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color { r: clear[0] as f64, g: clear[1] as f64, b: clear[2] as f64, a: 1.0 }), store: wgpu::StoreOp::Store },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment { view: &t.depth, depth_ops: Some(wgpu::Operations { load: wgpu::LoadOp::Clear(1.0), store: wgpu::StoreOp::Discard }), stencil_ops: None }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &self.globals_group, &[]);
            for (i, item) in scene.items.iter().enumerate() {
                let m = &self.meshes[&Self::mesh_key(&item.mesh)];
                pass.set_bind_group(1, &self.bones_group, &[(i as u64 * BONE_BLOCK) as u32]);
                pass.set_vertex_buffer(0, m.vertices.slice(..));
                pass.set_index_buffer(m.indices.slice(..), wgpu::IndexFormat::Uint32);
                pass.draw_indexed(0..m.count, 0, 0..1);
            }
        }
        self.queue.submit(Some(encoder.finish()));
        Ok(())
    }

    fn read_back(&self) -> Image {
        let t = self.targets.as_ref().expect("kohde luotu");
        let unpadded = t.width * 4;
        let padded = unpadded.div_ceil(wgpu::COPY_BYTES_PER_ROW_ALIGNMENT) * wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
        let buffer = self.device.create_buffer(&wgpu::BufferDescriptor { label: Some("readback"), size: (padded * t.height) as u64, usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ, mapped_at_creation: false });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("readback") });
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo { texture: &t.color, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
            wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(padded), rows_per_image: Some(t.height) } },
            wgpu::Extent3d { width: t.width, height: t.height, depth_or_array_layers: 1 },
        );
        self.queue.submit(Some(encoder.finish()));
        let slice = buffer.slice(..);
        slice.map_async(wgpu::MapMode::Read, |_| {});
        let _ = self.device.poll(wgpu::Maintain::Wait);
        let data = slice.get_mapped_range();
        let mut img = Image::new(t.width, t.height);
        for y in 0..t.height as usize {
            let src = &data[y * padded as usize..y * padded as usize + unpadded as usize];
            img.rgba[y * unpadded as usize..(y + 1) * unpadded as usize].copy_from_slice(src);
        }
        drop(data);
        buffer.unmap();
        img
    }
}

impl Renderer for GpuRenderer {
    fn name(&self) -> &'static str {
        "GPU"
    }

    fn render(&mut self, scene: &RenderScene) -> Result<Image, RenderError> {
        self.draw(scene)?;
        Ok(self.read_back())
    }
}
