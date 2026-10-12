//! `hahmostudio-cli` – headless-käyttö ilman käyttöliittymää.
//!
//! ```text
//! hahmostudio-cli tarkista  <käsikirjoitus.txt>
//! hahmostudio-cli renderöi  <käsikirjoitus.txt> -o <video.mp4 | kansio/ | kuva.png> [--ruutu N] [--koko 1080x1920] [--gpu | --cpu] [--hahmot hahmot.json]
//! hahmostudio-cli hahmo     <projekti.hahmo> -o <kuva.png | kansio/> [--ruutu N]
//! hahmostudio-cli mittaa    [<käsikirjoitus.txt>] [--koko 540x960]
//! ```
//! Englanninkieliset aliakset: check, render, hahmo, bench.

use hs_agents::{Backend, Pipeline, Production, RenderRequest, Slot};
use hs_core::Severity;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Instant;

const EXAMPLE: &str = "[tausta studio]\nPIPSA: Hei! Tervetuloa mukaan. [vilkuta 2s]\n[juokse oikealle 2s]\nPIPSA: Laitan viestin. [näpyttele puhelinta 3s]\n[tausta kaupunki ilta]\nVILLE: Nähdään! [hyppää]";

struct Args {
    positional: Vec<String>,
    output: Option<PathBuf>,
    frame: Option<u32>,
    size: Option<(u32, u32)>,
    backend: Backend,
    cast: Option<PathBuf>,
}

fn parse_args(raw: &[String]) -> Result<Args, String> {
    let mut a = Args { positional: Vec::new(), output: None, frame: None, size: None, backend: Backend::Auto, cast: None };
    let mut it = raw.iter();
    while let Some(x) = it.next() {
        match x.as_str() {
            "-o" | "--ulos" | "--out" => a.output = Some(it.next().ok_or("-o vaatii polun")?.into()),
            "--ruutu" | "--frame" => a.frame = Some(it.next().ok_or("--ruutu vaatii numeron")?.parse().map_err(|_| "virheellinen ruutu")?),
            "--koko" | "--size" => {
                let s = it.next().ok_or("--koko vaatii arvon, esim. 1080x1920")?;
                let (w, h) = s.split_once('x').ok_or("koko muodossa LxK")?;
                a.size = Some((w.parse().map_err(|_| "leveys")?, h.parse().map_err(|_| "korkeus")?));
            }
            "--gpu" => a.backend = Backend::Gpu,
            "--cpu" => a.backend = Backend::Cpu,
            "--hahmot" | "--cast" => a.cast = Some(it.next().ok_or("--hahmot vaatii polun")?.into()),
            _ if x.starts_with('-') => return Err(format!("tuntematon valitsin {x}")),
            _ => a.positional.push(x.clone()),
        }
    }
    Ok(a)
}

fn read_script(a: &Args) -> Result<String, String> {
    match a.positional.first() {
        Some(p) => std::fs::read_to_string(p).map_err(|e| format!("{p}: {e}")),
        None => Ok(EXAMPLE.to_string()),
    }
}

fn production(a: &Args) -> Result<Production, String> {
    let mut p = Production::new(read_script(a)?);
    if let Some((w, h)) = a.size {
        p.width = w;
        p.height = h;
    }
    p.backend = a.backend;
    if let Some(path) = &a.cast {
        let text = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
        p.cast_params = serde_json::from_str(&text).map_err(|e| format!("hahmot: {e}"))?;
    }
    Ok(p)
}

fn print_diagnostics(p: &Production) -> bool {
    let mut errors = false;
    for d in &p.diagnostics {
        let tag = match d.severity {
            Severity::Error => {
                errors = true;
                "VIRHE"
            }
            Severity::Warning => "huom.",
            Severity::Info => "tieto",
        };
        eprintln!("rivi {:>3}  {tag}: {}", d.line, d.message);
    }
    errors
}

fn run_pipeline(pipe: &mut Pipeline, p: &mut Production) -> Result<(), String> {
    let runs = pipe.run(p).map_err(|e| e.to_string())?;
    for r in runs {
        eprintln!("  {:<16} {:>8.1} ms  {}", r.name, r.took.as_secs_f64() * 1000.0, r.outcome.unwrap_or_else(|e| e));
    }
    Ok(())
}

fn check(a: &Args) -> Result<(), String> {
    let mut p = production(a)?;
    let mut pipe = Pipeline::default();
    let result = run_pipeline(&mut pipe, &mut p);
    let errors = print_diagnostics(&p);
    result?;
    if let Some(cam) = &p.camera {
        println!("{}", serde_json::to_string_pretty(&cam.shots).unwrap());
    }
    if errors {
        return Err("käsikirjoituksessa on virheitä".into());
    }
    Ok(())
}

fn render(a: &Args) -> Result<(), String> {
    let out = a.output.clone().ok_or("anna tuloste valitsimella -o")?;
    let mut p = production(a)?;
    let ext = out.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    p.render_request = match ext.as_str() {
        "mp4" => RenderRequest::Mp4(out.clone()),
        "png" => RenderRequest::Still { frame: a.frame.unwrap_or(0), path: out.clone() },
        _ => RenderRequest::PngSequence(out.clone()),
    };
    let last = Arc::new(std::sync::atomic::AtomicU32::new(0));
    let l = last.clone();
    p.progress = Some(Arc::new(move |done, total| {
        let pct = done * 100 / total.max(1);
        if pct / 10 != l.swap(pct, std::sync::atomic::Ordering::Relaxed) / 10 {
            eprintln!("  {pct:>3} % ({done}/{total})");
        }
    }));
    let mut pipe = Pipeline::default();
    pipe.mark_dirty(Slot::RenderRequest);
    let start = Instant::now();
    let result = run_pipeline(&mut pipe, &mut p);
    print_diagnostics(&p);
    result?;
    eprintln!("valmis {:.1} s: {}", start.elapsed().as_secs_f64(), p.output.unwrap_or_default());
    Ok(())
}

fn hahmo(a: &Args) -> Result<(), String> {
    let path = a.positional.first().ok_or("anna .hahmo-tiedosto")?;
    let out = a.output.clone().ok_or("anna tuloste valitsimella -o")?;
    let bytes = std::fs::read(path).map_err(|e| format!("{path}: {e}"))?;
    let project = hs_hahmo::Project::open(&bytes).map_err(|e| e.to_string())?;
    eprintln!("{} (muoto v{}), {} ruutua @ {} fps", project.document.name, project.version, project.frame_count(), project.fps());
    let frames: Vec<u32> = match (out.extension().and_then(|e| e.to_str()), a.frame) {
        (Some("png"), f) => vec![f.unwrap_or(0)],
        _ => (0..project.frame_count().min(hs_render::export::MAX_PNG_SEQUENCE)).collect(),
    };
    if frames.len() > 1 {
        std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
    }
    for f in &frames {
        let pix = project.render(*f).map_err(|e| e.to_string())?;
        let target = if frames.len() == 1 { out.clone() } else { out.join(format!("ruutu-{f:04}.png")) };
        pix.save_png(&target).map_err(|e| format!("{}: {e}", target.display()))?;
    }
    eprintln!("{} ruutua kirjoitettu", frames.len());
    Ok(())
}

fn bench(a: &Args) -> Result<(), String> {
    let mut p = production(a)?;
    let (w, h) = a.size.unwrap_or((540, 960));
    let mut pipe = Pipeline::default();
    let start = Instant::now();
    run_pipeline(&mut pipe, &mut p)?;
    eprintln!("putki {:.1} ms", start.elapsed().as_secs_f64() * 1000.0);
    let tl = p.timeline.clone().ok_or("ei aikajanaa")?;
    let frames = tl.frame_count();
    let t0 = Instant::now();
    for f in 0..frames {
        for m in &p.motion {
            std::hint::black_box(m.evaluate(&tl, f as f32 / p.fps.0 as f32));
        }
    }
    let motion_ms = t0.elapsed().as_secs_f64() * 1000.0 / frames as f64;
    eprintln!("liike: {motion_ms:.3} ms/ruutu ({} hahmoa)", p.motion.len());
    let mut builder = hs_agents::agents::render::FrameBuilder::default();
    for backend in [Backend::Cpu, Backend::Gpu] {
        let Ok(mut r) = hs_agents::agents::render::make_renderer(backend) else {
            eprintln!("{backend:?}: ei saatavilla");
            continue;
        };
        let n = frames.min(60);
        let t = Instant::now();
        for f in 0..n {
            let scene = builder.scene(&p, f * frames / n, w, h).ok_or("kohtaus")?;
            r.render(&scene).map_err(|e| e.to_string())?;
        }
        let ms = t.elapsed().as_secs_f64() * 1000.0 / n as f64;
        eprintln!("{}: {w}×{h} {ms:.1} ms/ruutu ({:.1} fps)", r.name(), 1000.0 / ms);
    }
    Ok(())
}

fn main() -> ExitCode {
    let raw: Vec<String> = std::env::args().skip(1).collect();
    let Some(cmd) = raw.first().cloned() else {
        eprintln!("käyttö: hahmostudio-cli <tarkista|renderöi|hahmo|mittaa> ...");
        return ExitCode::from(2);
    };
    let args = match parse_args(&raw[1..]) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("virhe: {e}");
            return ExitCode::from(2);
        }
    };
    let result = match cmd.as_str() {
        "tarkista" | "check" => check(&args),
        "renderöi" | "renderoi" | "render" => render(&args),
        "hahmo" => hahmo(&args),
        "mittaa" | "bench" => bench(&args),
        _ => Err(format!("tuntematon komento {cmd}")),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("virhe: {e}");
            ExitCode::FAILURE
        }
    }
}
