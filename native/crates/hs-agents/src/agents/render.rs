//! GPU-kiihdytetty renderöinti ja headless-vienti.

use crate::agents::cinematography::ShotKind;
use crate::production::{Backend, RenderRequest};
use crate::{AgentError, AgentReport, Production, Slot, StudioAgent};
use glam::Vec3;
use hs_character::{CharacterMesh, RenderStyle};
use hs_render::cpu::CpuRenderer;
use hs_render::export::{self, Mp4Writer, MAX_PNG_SEQUENCE};
use hs_render::{environment, props, DrawItem, RenderScene, Renderer, ShadingStyle};
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// Rakentaa ruudun kohtauksen tuotannon tilasta. Lavasteverkot pidetään välimuistissa.
#[derive(Default)]
pub struct FrameBuilder {
    environments: HashMap<String, Arc<CharacterMesh>>,
}

impl FrameBuilder {
    pub fn scene(&mut self, p: &Production, frame: u32, width: u32, height: u32) -> Option<RenderScene> {
        let tl = p.timeline.as_ref()?;
        let camera = p.camera.as_ref()?;
        let t = frame as f32 / p.fps.0 as f32;
        let env_id = camera.background_at(t).to_string();
        let env = self.environments.entry(env_id.clone()).or_insert_with(|| Arc::new(environment::build(&env_id))).clone();
        let (cam, lights, _) = camera.camera_at(t, width as f32 / height as f32);
        let floor = environment::clear_color(&env_id);
        let mut items = vec![DrawItem::rigid(env)];
        let frames: Vec<_> = p.motion.iter().map(|m| m.evaluate(tl, t)).collect();
        // Keskustelu: puhuja ja kumppani kääntyvät hieman toisiaan kohti (sitcom-lavastus),
        // kun kumpikaan ei liiku eikä ole erikseen käännetty.
        let turns: Vec<f32> = {
            let mut turns = vec![0.0f32; frames.len()];
            if let Some(shot) = camera.shot_at(t).filter(|s| matches!(s.kind, ShotKind::Medium | ShotKind::CloseUp | ShotKind::TwoShot | ShotKind::OverShoulder)) {
                if let Some(other) = shot.partner.filter(|o| *o != shot.subject && *o < frames.len() && shot.subject < frames.len()) {
                    let ease = ((t - shot.start) / 0.35).clamp(0.0, 1.0);
                    let ease = ease * ease * (3.0 - 2.0 * ease);
                    for (a, b) in [(shot.subject, other), (other, shot.subject)] {
                        let (fa, fb) = (&frames[a], &frames[b]);
                        let still = fa.velocity.length() < 0.05 && fa.yaw.abs() < 0.2;
                        let dx = fb.root.x - fa.root.x;
                        if still && dx.abs() > 0.05 {
                            turns[a] = dx.signum() * 0.5 * ease;
                        }
                    }
                }
            }
            turns
        };
        for ((member, motion), (mut f, turn)) in p.cast.iter().zip(&p.motion).zip(frames.into_iter().zip(turns)) {
            if turn != 0.0 {
                f.pose.root_rot = glam::Quat::from_rotation_y(turn) * f.pose.root_rot;
            }
            // Äänellinen huulisynkka korvaa tekstistä arvioidun suun.
            let humanoid = &member.character.humanoid;
            if let Some(shape) = p.mouth_at(&|s| motion.motion.speaks(s), t) {
                hs_motion::face::apply_mouth(humanoid, &mut f.pose, &shape);
            }
            if let Some(live) = p.live.as_ref().filter(|l| member.character.params.name.eq_ignore_ascii_case(&l.speaker)) {
                if let Some(shape) = &live.mouth {
                    hs_motion::face::apply_mouth(humanoid, &mut f.pose, shape);
                }
                if let Some([yaw, pitch, roll]) = live.head {
                    // Kierto jaetaan kaulalle ja päälle, jotta liike näyttää luonnolliselta.
                    let q = glam::Quat::from_euler(glam::EulerRot::YXZ, yaw * 0.65, pitch * 0.7, roll * 0.7);
                    f.pose.local[humanoid.neck] = glam::Quat::from_euler(glam::EulerRot::YXZ, yaw * 0.35, pitch * 0.3, roll * 0.3) * f.pose.local[humanoid.neck];
                    f.pose.local[humanoid.head] = q * f.pose.local[humanoid.head];
                }
            }
            let skeleton = &member.character.humanoid.skeleton;
            let shadow_floor = if env_id == "studio-v1" { [0x3c, 0x52, 0x66] } else { floor };
            let scale = 1.0 / (1.0 + f.root.y * 2.5);
            items.push(DrawItem::rigid(Arc::new(props::contact_shadow(Vec3::new(f.root.x, 0.0, f.root.z), member.character.humanoid.proportions.height * 0.22 * scale, shadow_floor))));
            items.push(DrawItem::skinned(member.mesh.clone(), skeleton.skin_matrices(&f.pose)).with_outline(member.character.params.extras.outline));
            if let Some(phone) = &f.props.phone {
                items.push(DrawItem::rigid(Arc::new(props::phone(phone))).with_outline(true));
            }
        }
        let style = match p.cast.first().map(|c| c.character.params.render_style) {
            Some(RenderStyle::Cel) => ShadingStyle::Cel,
            _ => ShadingStyle::Flat,
        };
        // Sarjakuvaääriviiva skaalautuu kuvan korkeuden mukaan (1080×1920: noin 4 px).
        let outline = (height as f32 * 0.0021).max(1.2);
        Some(RenderScene { width, height, camera: cam, lights, style, clear: environment::clear_color(&env_id), outline, items })
    }
}

/// Valitsee renderöijän: GPU, jos pyydetty tai saatavilla, muuten CPU.
pub fn make_renderer(backend: Backend) -> Result<Box<dyn Renderer>, AgentError> {
    #[cfg(feature = "gpu")]
    {
        if backend != Backend::Cpu {
            match hs_render::gpu::GpuRenderer::headless() {
                Ok(g) => return Ok(Box::new(g)),
                Err(e) if backend == Backend::Gpu => return Err(AgentError::Failed { agent: "render", message: e.to_string() }),
                Err(_) => {}
            }
        }
    }
    #[cfg(not(feature = "gpu"))]
    if backend == Backend::Gpu {
        return Err(AgentError::Failed { agent: "render", message: "GPU-tuki ei ole mukana tässä käännöksessä".into() });
    }
    Ok(Box::new(CpuRenderer::default()))
}

#[derive(Default)]
pub struct RustRenderAgent {
    frames: FrameBuilder,
}

impl RustRenderAgent {
    pub fn render_frame(&mut self, p: &Production, renderer: &mut dyn Renderer, frame: u32) -> Result<hs_render::Image, AgentError> {
        let scene = self.frames.scene(p, frame, p.width, p.height).ok_or(AgentError::Missing { agent: "render", slot: Slot::Camera })?;
        renderer.render(&scene).map_err(|e| AgentError::Failed { agent: "render", message: e.to_string() })
    }
}

/// Poistaa väliaikaisen tiedoston, kun vienti päättyy millä tavalla tahansa.
struct TempFile(std::path::PathBuf);

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

fn fail(e: impl ToString) -> AgentError {
    AgentError::Failed { agent: "render", message: e.to_string() }
}

impl StudioAgent for RustRenderAgent {
    fn id(&self) -> &'static str {
        "render"
    }
    fn name(&self) -> &'static str {
        "Renderöinti"
    }
    fn reads(&self) -> &'static [Slot] {
        &[Slot::Camera, Slot::LipSync, Slot::RenderRequest]
    }
    fn writes(&self) -> &'static [Slot] {
        &[Slot::Output]
    }
    fn run(&mut self, p: &mut Production) -> Result<AgentReport, AgentError> {
        let request = p.render_request.clone();
        if request == RenderRequest::None {
            return Ok(AgentReport::new("esikatselu valmis"));
        }
        if let Some(plan) = &p.plan {
            if !plan.is_assemblable() {
                return Err(fail("Käsikirjoituksessa on virheitä; korjaa ne ennen vientiä."));
            }
        }
        let total = p.frame_count();
        let mut renderer = make_renderer(p.backend)?;
        let backend = renderer.name();
        let report = |p: &Production, i: u32| {
            if let Some(cb) = &p.progress {
                cb(i, total);
            }
        };
        let summary = match &request {
            RenderRequest::None => unreachable!(),
            RenderRequest::Still { frame, path } => {
                let img = self.render_frame(p, renderer.as_mut(), (*frame).min(total.saturating_sub(1)))?;
                export::write_png(&img, path).map_err(fail)?;
                format!("{} ({backend})", path.display())
            }
            RenderRequest::PngSequence(dir) => {
                if total > MAX_PNG_SEQUENCE {
                    return Err(fail("PNG-sarja on enintään 300 ruutua; käytä MP4-vientiä."));
                }
                std::fs::create_dir_all(dir).map_err(fail)?;
                for i in 0..total {
                    if p.cancel.load(Ordering::Relaxed) {
                        return Err(AgentError::Cancelled);
                    }
                    let img = self.render_frame(p, renderer.as_mut(), i)?;
                    export::write_png(&img, &dir.join(format!("ruutu-{i:04}.png"))).map_err(fail)?;
                    report(p, i + 1);
                }
                format!("{total} PNG-ruutua kansioon {} ({backend})", dir.display())
            }
            RenderRequest::Mp4(path) => {
                // Ääniraita väliaikaiseen WAV-tiedostoon viennin ajaksi.
                let audio = TempFile(path.with_extension("aani.wav"));
                if let Some(mix) = &p.mix {
                    std::fs::write(&audio.0, hs_voice::wav::encode(mix)).map_err(fail)?;
                }
                let audio_arg = p.mix.is_some().then_some(audio.0.as_path());
                let mut writer = Mp4Writer::create_with_audio(path, p.width, p.height, p.fps.0, audio_arg).map_err(fail)?;
                for i in 0..total {
                    if p.cancel.load(Ordering::Relaxed) {
                        writer.cancel();
                        return Err(AgentError::Cancelled);
                    }
                    let img = match self.render_frame(p, renderer.as_mut(), i) {
                        Ok(img) => img,
                        Err(e) => {
                            writer.cancel();
                            return Err(e);
                        }
                    };
                    if let Err(e) = writer.push(&img) {
                        writer.cancel();
                        return Err(fail(e));
                    }
                    report(p, i + 1);
                }
                let size = writer.finish().map_err(fail)?;
                format!("{} ({:.1} MiB, {total} ruutua, {backend})", path.display(), size as f64 / 1048576.0)
            }
        };
        p.output = Some(summary.clone());
        Ok(AgentReport::new(summary))
    }
}
