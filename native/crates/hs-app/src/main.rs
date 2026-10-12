//! Hahmostudio – natiivi työpöytäsovellus.
//!
//! Käynnistys: `hahmostudio [käsikirjoitus.txt]`.
//! Testikäyttö: `hahmostudio --kuvakaappaus kuva.png [--aika 5.0] [käsikirjoitus.txt]`
//! piirtää ikkunan, tallentaa kuvakaappauksen ja sulkeutuu.

mod app;
mod export_job;
mod panels;
mod viewport;

fn main() -> eframe::Result<()> {
    let mut args = std::env::args().skip(1);
    let mut options = app::LaunchOptions::default();
    while let Some(a) = args.next() {
        match a.as_str() {
            "--kuvakaappaus" | "--screenshot" => options.screenshot = args.next().map(Into::into),
            "--aika" | "--time" => options.time = args.next().and_then(|s| s.parse().ok()),
            "--cpu" => options.force_cpu = true,
            _ => options.script_path = Some(a.into()),
        }
    }
    let native = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_title("Hahmostudio")
            .with_inner_size([1440.0, 900.0])
            .with_min_inner_size([900.0, 600.0]),
        renderer: eframe::Renderer::Wgpu,
        persist_window: options.screenshot.is_none(),
        ..Default::default()
    };
    eframe::run_native("Hahmostudio", native, Box::new(move |cc| Ok(Box::new(app::StudioApp::new(cc, options)))))
}
