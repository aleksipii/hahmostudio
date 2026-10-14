//! GPU-kiihdytetty renderöinti ja headless-vienti.

use crate::agents::cinematography::ShotKind;
use crate::production::{Backend, RenderRequest};
use crate::{AgentError, AgentReport, Production, Slot, StudioAgent};
use glam::Vec3;
use hs_core::EventKind;
use hs_motion::Side;
use hs_character::{CharacterMesh, RenderStyle};
use hs_render::cpu::CpuRenderer;
use hs_render::export::{self, Mp4Writer, MAX_PNG_SEQUENCE};
use hs_render::{environment, props, DrawItem, RenderScene, Renderer, ShadingStyle};
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// Deterministic ease at both ends of authored gaze, including short cues.
pub fn gaze_weight(time: f32, start: f32, end: f32) -> f32 {
    let blend = ((end - start) * 0.5).min(0.25).max(0.001);
    let smooth = |x: f32| { let x = x.clamp(0.0, 1.0); x * x * (3.0 - 2.0 * x) };
    smooth((time - start) / blend) * smooth((end - time) / blend)
}

/// Validate authored pose bindings and cross-domain ownership before rendering.
pub fn validate_pose_tracks(p: &Production) -> Result<(), String> {
    if p.pose_tracks.tracks.is_empty() { return Ok(()); }
    let actors: Vec<_> = p
        .cast
        .iter()
        .map(|member| {
            (
                member.character.params.name.as_str(),
                &member.character.humanoid.skeleton,
            )
        })
        .collect();
    p.pose_tracks.validate(&actors)?;
    if p.pose_tracks.tracks.is_empty() {
        return Ok(());
    }
    let timeline = p
        .timeline
        .as_ref()
        .ok_or("3D-avainruudut tarvitsevat valmiin aikajanan")?;
    p.pose_tracks
        .validate_duration(timeline.duration.seconds())?;
    for (index, member) in p.cast.iter().enumerate() {
        let name = &member.character.params.name;
        if !p.pose_tracks.has_actor(name) {
            continue;
        }
        if p.contacts
            .as_ref()
            .is_some_and(|plan| plan.uses_actor(index))
            || p.scenery
                .as_ref()
                .is_some_and(|plan| plan.uses_actor(index))
        {
            return Err(format!(
                "3D-avainruudut ja toteutettu kontakti eivät voi ohjata samaa hahmoa: {name}"
            ));
        }
        if timeline.events.iter().any(|event| match &event.kind {
            EventKind::Motion {
                character,
                motion: hs_core::MotionKind::PhoneTap,
            } => character
                .as_ref()
                .map_or(member.lead, |actor| actor.eq_ignore_ascii_case(name)),
            EventKind::Phone {character,view} if *view != hs_core::PhoneView::Hidden => character.as_ref().map_or(member.lead,|actor|actor.eq_ignore_ascii_case(name)),
            _ => false,
        }) {
            return Err(format!(
                "3D-avainruudut ja puhelinkontakti eivät voi ohjata samaa hahmoa: {name}"
            ));
        }
    }
    Ok(())
}

/// Rakentaa ruudun kohtauksen tuotannon tilasta. Lavasteverkot pidetään välimuistissa.
#[derive(Default)]
pub struct FrameBuilder {
    pub last_error: Option<String>,
    environments: HashMap<String, Arc<CharacterMesh>>,
    /// Käteen otetut esineet (hahmon osoite, esine) → verkko.
    held: HashMap<(usize, String), Arc<CharacterMesh>>,
    held_owners: Vec<Arc<hs_character::Character>>,
}

impl FrameBuilder {
    pub fn scene(&mut self, p: &Production, frame: u32, width: u32, height: u32) -> Option<RenderScene> {
        self.last_error = None;
        let tl = p.timeline.as_ref()?;
        let camera = p.camera.as_ref()?;
        if let Err(error)=validate_pose_tracks(p) {self.last_error=Some(error);return None;}
        if self.held_owners.len() != p.cast.len() || !self.held_owners.iter().zip(&p.cast).all(|(a, b)| Arc::ptr_eq(a, &b.character)) {
            self.held.clear();
            self.held_owners = p.cast.iter().map(|c| c.character.clone()).collect();
        }
        let t = frame as f32 / p.fps.0 as f32;
        let env_id = camera.background_at(t).to_string();
        let env = self.environments.entry(env_id.clone()).or_insert_with(|| Arc::new(environment::build(&env_id))).clone();
        let (mut cam, lights, _) = camera.camera_at(t, width as f32 / height as f32);
        let mut items = vec![DrawItem::rigid(env)];
        let mut frames = match crate::acting::frames(p, t) { Ok(frames)=>frames, Err(error)=>{self.last_error=Some(error);return None;} };
        if frames.len()!=p.cast.len(){self.last_error=Some("Hahmojen liikeresurssit ovat vanhentuneet".into());return None;}
        let original_roots:Vec<_>=frames.iter().map(|frame|frame.root).collect();
        if let Some(scenery)=&p.scenery {if let Err(error)=scenery.apply_roots(p,&mut frames,t){self.last_error=Some(error);return None;}}
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
                        let authored_view=tl.events_at(p.fps.frame_to_tick(frame)).any(|event|match &event.kind {
                            EventKind::CharacterView{character,..}=>match character {Some(name)=>name.eq_ignore_ascii_case(&p.cast[a].character.params.name),None=>p.cast[a].lead},
                            _=>false,
                        });
                        let seated = p.motion[a].chair_at(t).is_some();
                        let authored_look = tl.events_at(p.fps.frame_to_tick(frame)).any(|event| match &event.kind {
                            EventKind::LookAt { character, .. } => match character { Some(name) => name.eq_ignore_ascii_case(&p.cast[a].character.params.name), None => p.cast[a].lead },
                            _ => false,
                        });
                        let authored_turn = tl.events.iter().any(|event| match &event.kind {
                            EventKind::Motion { character, motion: hs_core::MotionKind::TurnLeft | hs_core::MotionKind::TurnRight | hs_core::MotionKind::WalkBackward } => match character { Some(name) => name.eq_ignore_ascii_case(&p.cast[a].character.params.name), None => p.cast[a].lead },
                            _ => false,
                        });
                        let contact = p.contacts.as_ref().is_some_and(|plan| plan.uses_actor(a)) || p.scenery.as_ref().is_some_and(|plan| plan.uses_actor(a));
                        let still = !contact && !authored_turn && !seated && !authored_view && !authored_look && fa.velocity.length() < 0.05 && fa.yaw.abs() < 0.2;
                        let dx = fb.root.x - fa.root.x;
                        if still && dx.abs() > 0.05 {
                            turns[a] = dx.signum() * 0.5 * ease;
                        }
                    }
                }
            }
            turns
        };
        for (f, turn) in frames.iter_mut().zip(&turns) { if *turn != 0.0 { f.pose.root_rot = glam::Quat::from_rotation_y(*turn) * f.pose.root_rot; } }
        for (member, frame) in p.cast.iter().zip(&mut frames) {
            if !p.pose_tracks.has_actor(&member.character.params.name) { continue; }
            if let Err(error) = p.pose_tracks.apply_frame(
                &member.character.params.name,
                &member.character.humanoid.skeleton,
                frame,
                t as f64,
            ) {
                self.last_error = Some(error);
                return None;
            }
        }
        if let Some(plan) = &p.contacts {
            if !plan.matches(p) {self.last_error=Some("Esinekontaktin resurssit ovat vanhentuneet".into()); return None; }
            let objects=match plan.evaluate(p,t,&mut frames) {Ok(objects)=>objects,Err(error)=>{self.last_error=Some(error);return None;}};
            for object in objects {
                if let Some(stand)=&object.stand {items.push(DrawItem::rigid(stand.clone()));}
                items.push(DrawItem { mesh: object.mesh.clone(), skin: vec![crate::contacts::ContactPlan::transform(&object)], outline: true, ray_visible: true });
            }
        }
        if let Some(scenery) = &p.scenery {
            if let Err(error) = scenery.apply_contacts(p, &mut frames, t) {
                self.last_error = Some(error);
                return None;
            }
            for (mesh, transform) in scenery.meshes(t) {
                items.push(DrawItem {
                    mesh,
                    skin: vec![transform],
                    outline: true,
                    ray_visible: true,
                });
            }
        }
        if let Some(collision)=&p.collision {
            if let Err(error)=collision.evaluate(p,t,&frames){self.last_error=Some(error);return None;}
        }
        // The camera was planned against procedural roots. Follow authored root
        // movement and stairs while preserving the shot's framing and direction.
        if let Some(shot) = camera.shot_at(t) {
            let indices: Vec<usize> = match shot.kind {
                ShotKind::Wide => (0..frames.len()).collect(),
                ShotKind::TwoShot => std::iter::once(shot.subject)
                    .chain(shot.partner)
                    .filter(|index| *index < frames.len())
                    .collect(),
                _ => std::iter::once(shot.subject)
                    .filter(|index| *index < frames.len())
                    .collect(),
            };
            if !indices.is_empty() {
                let delta = indices
                    .iter()
                    .map(|index| frames[*index].root - original_roots[*index])
                    .sum::<Vec3>()
                    / indices.len() as f32;
                cam.eye += delta;
                cam.target += delta;
                if indices.len() > 1 {
                    let spread = |roots: &[Vec3]| {
                        let xs: Vec<_> = indices.iter().map(|index| roots[*index].x).collect();
                        xs.iter().copied().fold(f32::NEG_INFINITY, f32::max)
                            - xs.iter().copied().fold(f32::INFINITY, f32::min)
                    };
                    let roots: Vec<_> = frames.iter().map(|frame| frame.root).collect();
                    let margin = p
                        .cast
                        .iter()
                        .map(|member| member.character.params.height)
                        .fold(0.1_f32, f32::max);
                    let zoom =
                        ((spread(&roots) + margin) / (spread(&original_roots) + margin)).max(1.0);
                    cam.eye = cam.target + (cam.eye - cam.target) * zoom;
                }
            }
        }
        let positions:Vec<_>=frames.iter().map(|f|f.root).collect();
        for (index,((member, motion), (mut f, turn))) in p.cast.iter().zip(&p.motion).zip(frames.into_iter().zip(turns)).enumerate() {
            let _ = turn;
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
            let now=hs_core::Tick::from_seconds(t as f64);
            let mine=|character:&Option<String>| character.as_ref().map_or(index==0,|c|c.eq_ignore_ascii_case(&member.character.params.name));
            let speaking=p.mouth_at(&|s|motion.motion.speaks(s),t).is_some() || p.live.as_ref().is_some_and(|l|l.speaker.eq_ignore_ascii_case(&member.character.params.name)&&l.mouth.is_some());
            let (from, to, progress)=crate::acting::expression(tl,&member.character.params.name,index==0,t,p.acting_style);
            hs_motion::expression::apply_expression_blend(humanoid,&mut f.pose,from,to,progress,speaking);
            for event in tl.events.iter().filter(|e|e.start<=now && now<e.end()) {
                match &event.kind {
                    EventKind::LookAt{character,target} if mine(character) && !p.live.as_ref().is_some_and(|l|l.speaker.eq_ignore_ascii_case(&member.character.params.name)&&l.head.is_some())=>{
                        let destination=match target {
                            hs_core::LookTarget::Camera=>Some(cam.eye),
                            hs_core::LookTarget::Character(name)=>p.cast.iter().position(|c|c.character.params.name.eq_ignore_ascii_case(name)).map(|other|positions[other]+Vec3::Y*p.cast[other].character.params.height*0.9),
                        };
                        if let Some(destination)=destination {
                            let from=f.root+Vec3::Y*member.character.params.height*0.9;
                            let local=f.pose.root_rot.inverse()*(destination-from);
                            let weight = gaze_weight(t, event.start.seconds() as f32, event.end().seconds() as f32);
                            let yaw=local.x.atan2(local.z).clamp(-0.7,0.7) * weight;
                            let pitch=(-local.y).atan2(local.x.hypot(local.z)).clamp(-0.45,0.45) * weight;
                            f.pose.local[humanoid.head]=glam::Quat::from_euler(glam::EulerRot::YXZ,yaw,pitch,0.0)*f.pose.local[humanoid.head];
                        }
                    }
                    _=>{}
                }
            }
            let skeleton = &member.character.humanoid.skeleton;
            let shadow_floor = environment::floor_color(&env_id);
            let scale = 1.0 / (1.0 + f.root.y * 2.5);
            items.push(DrawItem::rigid(Arc::new(props::contact_shadow(Vec3::new(f.root.x, 0.0, f.root.z), member.character.humanoid.proportions.height * 0.22 * scale, shadow_floor))).raster_only());
            if let Some(chair) = motion.chair_at(t) { items.push(DrawItem::rigid(Arc::new(props::chair(&chair)))); }
            // Esine oikeassa kädessä: viimeisin [esine ...] -ohje tälle hahmolle.
            let lead = std::ptr::eq(member, &p.cast[0]);
            let item = tl
                .events
                .iter()
                .filter(|e| e.start.seconds() as f32 <= t)
                .filter_map(|e| match &e.kind {
                    EventKind::Prop { character, item } => {
                        let mine = match character {
                            Some(c) => c.eq_ignore_ascii_case(&member.character.params.name),
                            None => lead,
                        };
                        mine.then_some((e.start, item))
                    }
                    _ => None,
                })
                .max_by_key(|(start, _)| *start)
                .and_then(|(_, item)| item.clone());
            if item.is_some() { hs_motion::hands::curl_fingers(humanoid, &mut f.pose, Side::Right, 0.65); }
            let skin = skeleton.skin_matrices(&f.pose);
            if let Some(id) = item {
                let arm = humanoid.arm(Side::Right);
                let key = (Arc::as_ptr(&member.character) as usize, id.clone());
                let mesh = match self.held.get(&key) {
                    Some(m) => Some(m.clone()),
                    None => {
                        let wrist = skeleton.bind_positions()[arm.hand];
                        let s = Side::Right.sign();
                        let palm = wrist + Vec3::new(-s * arm.hand_len * 0.02, -arm.hand_len * 0.26, 0.0);
                        props::held(&id, palm, s).map(|m| {
                            let m = Arc::new(m);
                            self.held.insert(key, m.clone());
                            m
                        })
                    }
                };
                if let Some(mesh) = mesh {
                    items.push(DrawItem { mesh, skin: vec![skin[arm.hand]], outline: true, ray_visible: true });
                }
            }
            items.push(DrawItem::skinned(member.mesh.clone(), skin).with_outline(member.character.params.extras.outline));
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
        let scene = self.frames.scene(p, frame, p.width, p.height).ok_or_else(|| self.frames.last_error.as_ref().map_or(AgentError::Missing { agent:"render",slot:Slot::Camera },fail))?;
        let mut image = renderer.render(&scene).map_err(|e| AgentError::Failed { agent: "render", message: e.to_string() })?;
        hs_subtitle::burn_captions(&mut image, p.fps.frame_to_tick(frame), &crate::captions::cues(p), &p.caption_settings).map_err(fail)?;
        Ok(image)
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
        let proof=crate::audit::inspect(p);
        if !proof.allowed() {return Err(fail(proof.diagnostics.iter().filter(|d|d.severity==hs_core::Severity::Error).map(|d|format!("Rivi {}: {}",d.line,d.message)).collect::<Vec<_>>().join("\n")));}
        validate_pose_tracks(p).map_err(fail)?;
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
                if !p.allow_silent_export && p.voice_lines.iter().any(|l|l.speech.is_none()) {
                    return Err(fail("Repliikeiltä puuttuu ääni. Tuota tai tuo ääni, tai valitse nimenomaisesti hiljainen luonnosvienti."));
                }
                // Ääniraita väliaikaiseen WAV-tiedostoon viennin ajaksi.
                let audio = if let Some(mix) = &p.mix {
                    use std::io::Write;
                    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or_else(|| std::path::Path::new("."));
                    let mut temporary = tempfile::Builder::new().prefix(".koeta-audio-").suffix(".wav").tempfile_in(parent).map_err(fail)?;
                    temporary.write_all(&hs_voice::wav::encode(mix)).map_err(fail)?;
                    temporary.flush().map_err(fail)?;
                    Some(temporary)
                } else { None };
                let audio_arg = audio.as_ref().map(|file| file.path());
                let subtitles = if p.caption_settings.enabled {
                    use std::io::Write;
                    let cues=crate::captions::cues(p);
                    if cues.is_empty() {None} else {
                        let parent=path.parent().filter(|p|!p.as_os_str().is_empty()).unwrap_or_else(||std::path::Path::new("."));
                        let mut temporary=tempfile::Builder::new().prefix(".koeta-subtitles-").suffix(".srt").tempfile_in(parent).map_err(fail)?;
                        temporary.write_all(hs_subtitle::to_srt(&cues).map_err(fail)?.as_bytes()).map_err(fail)?;
                        temporary.flush().map_err(fail)?;
                        Some(temporary)
                    }
                } else { None };
                let mut writer = Mp4Writer::create_full(path, p.width, p.height, p.fps.0, audio_arg, subtitles.as_ref().map(|file|file.path())).map_err(fail)?;
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

#[cfg(test)]
mod cache_tests {
    use super::*;
    #[test]
    fn gaze_has_continuous_endpoints_and_a_full_hold() {
        assert_eq!(gaze_weight(1.0, 1.0, 3.0), 0.0);
        assert_eq!(gaze_weight(3.0, 1.0, 3.0), 0.0);
        assert_eq!(gaze_weight(2.0, 1.0, 3.0), 1.0);
        assert!(gaze_weight(1.001, 1.0, 3.0) < 0.001);
        assert!(gaze_weight(2.999, 1.0, 3.0) < 0.001);
        for i in 0..101 { assert!((0.0..=1.0).contains(&gaze_weight(i as f32 / 100.0, 0.0, 0.1))); }
    }

    #[test]
    fn held_meshes_are_released_between_character_rebuilds() {
        let mut builder = FrameBuilder::default();
        for _ in 0..8 {
            let mut p = Production::new("KALLE: [prop coffee cup] [wait 1s]");
            crate::Pipeline::default().run(&mut p).unwrap();
            builder.scene(&p, 0, 160, 90).unwrap();
            assert_eq!(builder.held.len(), 1);
            assert_eq!(builder.held_owners.len(), p.cast.len());
            assert!(Arc::ptr_eq(&builder.held_owners[0], &p.cast[0].character));
            let cached = builder.held.values().next().unwrap().clone();
            builder.scene(&p, 1, 160, 90).unwrap();
            assert!(Arc::ptr_eq(&cached, builder.held.values().next().unwrap()));
        }
        let mut empty = Production::new("KALLE: [wait 1s]");
        crate::Pipeline::default().run(&mut empty).unwrap();
        builder.scene(&empty, 0, 160, 90).unwrap();
        assert!(builder.held.is_empty());
    }
}

#[cfg(test)]
mod authored_pose_tests {
    use super::*;
    use hs_motion::pose_edit::{Interpolation, PoseKey};
    fn ready(source:&str)->Production {let mut p=Production::new(source);crate::Pipeline::default().run(&mut p).unwrap();p}
    #[test]
    fn keyed_fk_changes_actual_render_and_survives_project_roundtrip() {
        let mut p=ready("[camera medium]\nKALLE: [wait 3s]");
        let mut builder=FrameBuilder::default();
        let base=builder.scene(&p,30,160,90).unwrap();
        let root_before=p.motion[0].evaluate(p.timeline.as_ref().unwrap(),1.0).root;
        let humanoid=&p.cast[0].character.humanoid;
        let arm=humanoid.arm(Side::Right).upper;
        let joint=humanoid.skeleton.joints[arm].name.clone();
        p.pose_tracks.upsert("Kalle",Some(&joint),PoseKey::from_euler_degrees(1.0,[0.0,0.0,75.0],[0.0;3],Interpolation::Linear)).unwrap();
        p.pose_tracks.upsert("Kalle",None,PoseKey::from_euler_degrees(1.0,[0.0;3],(root_before+Vec3::X).to_array(),Interpolation::Linear)).unwrap();
        validate_pose_tracks(&p).unwrap();
        let mut pipeline=crate::Pipeline::default(); pipeline.run(&mut p).unwrap();
        let unchanged=builder.scene(&p,0,160,90).unwrap();
        let mut original=ready("[camera medium]\nKALLE: [wait 3s]");
        let original_scene=builder.scene(&original,0,160,90).unwrap();
        assert_eq!(unchanged.camera,original_scene.camera);
        assert_eq!(unchanged.items.last().unwrap().skin,original_scene.items.last().unwrap().skin);
        let keyed=builder.scene(&p,30,160,90).unwrap();
        assert!((keyed.camera.target-base.camera.target-Vec3::X).length()<0.001);
        assert_ne!(keyed.items.last().unwrap().skin,base.items.last().unwrap().skin);
        let mut renderer=CpuRenderer::default();
        assert_ne!(renderer.render(&keyed).unwrap().rgba,renderer.render(&base).unwrap().rgba);
        let episode=crate::project::capture_checked(&p,"pose-episode".into(),1,"Pose".into()).unwrap();
        let series=hs_project::Series{id:"pose-series".into(),name:"Pose".into(),episodes:vec![episode]};
        let opened=hs_project::decode(&hs_project::encode(&series).unwrap()).unwrap();
        original=crate::project::restore_checked(&opened.episodes[0]).unwrap();
        crate::Pipeline::default().run(&mut original).unwrap();
        assert_eq!(original.pose_tracks,p.pose_tracks);
        let restored=builder.scene(&original,30,160,90).unwrap();
        assert_eq!(restored.camera,keyed.camera);
        assert_eq!(restored.items.last().unwrap().skin,keyed.items.last().unwrap().skin);
        assert_eq!(renderer.render(&restored).unwrap().rgba,renderer.render(&keyed).unwrap().rgba);
    }
    #[test]
    fn authored_contact_conflict_has_explicit_render_error() {
        let mut p=ready("[object cup mug on stand at -0.25 1.22 0.20]\nKALLE: [pick up cup 2s]");
        p.pose_tracks.upsert("Kalle",None,PoseKey::from_euler_degrees(0.0,[0.0;3],[0.0;3],Interpolation::Linear)).unwrap();
        assert!(validate_pose_tracks(&p).unwrap_err().contains("kontakti"));
        let mut builder=FrameBuilder::default();assert!(builder.scene(&p,0,160,90).is_none());assert!(builder.last_error.unwrap().contains("kontakti"));
        let mut agent=RustRenderAgent::default();let error=agent.render_frame(&p,&mut CpuRenderer::default(),0).unwrap_err();assert!(matches!(error,AgentError::Failed{..}));
        let mut phone=ready("KALLE: [tap phone 2s]");phone.pose_tracks=p.pose_tracks;
        assert!(validate_pose_tracks(&phone).unwrap_err().contains("puhelin"));
    }
}

#[cfg(test)]
mod psd_scene_tests {
    #[test]
    fn posed_studio_scene_exports_readable_aovs() {
        let mut p=crate::Production::new("[background studio]\nKALLE: [wave 2s]\nMAIJA: [nod 2s] [at 0s]");
        crate::Pipeline::default().run(&mut p).unwrap();
        let mut builder=super::FrameBuilder::default();
        let scene=builder.scene(&p,15,48,48).unwrap();
        let buffers=hs_render::raytrace::render(&scene,hs_render::raytrace::RayTraceOptions{ao_samples:2,..Default::default()}).unwrap();
        let bytes=hs_render::psd_exporter::encode(&buffers).unwrap();
        assert_eq!(&bytes[..4],b"8BPS");
        assert!(buffers.diffuse.chunks_exact(4).any(|pixel|pixel[3]==255));
        let moved=builder.scene(&p,35,48,48).unwrap();
        let moved=hs_render::raytrace::render(&moved,hs_render::raytrace::RayTraceOptions{ao_samples:2,..Default::default()}).unwrap();
        assert_ne!(buffers.diffuse,moved.diffuse,"render passes must use actual animated bones");
    }
}
