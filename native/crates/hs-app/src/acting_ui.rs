//! Scene acting-style controls; the host owns persistence, history and validation.
use eframe::egui;
use hs_motion::acting_style::ActingStyle;

/// Returns true only when an enabled user control changes the authored style.
/// The host must revalidate contacts/collision and refresh the scene afterwards.
pub fn ui(ui: &mut egui::Ui, style: &mut ActingStyle, enabled: bool) -> bool {
    let previous = *style;
    ui.heading("Animaation tyyli");
    ui.add_enabled_ui(enabled, |ui| {
        ui.selectable_value(style, ActingStyle::Smooth, "Pehmeä 3D");
        ui.selectable_value(style, ActingStyle::Stepped12, "Stop motion · 12 asentoa/s");
        ui.selectable_value(style, ActingStyle::Stepped15, "Stop motion · 15 asentoa/s");
    });
    if !enabled {
        ui.label("Tyylin muuttaminen odottaa lukituksen avaamista tai käynnissä olevan työn valmistumista.");
    }
    ui.separator();
    ui.label(description(*style));
    previous != *style
}

fn description(style: ActingStyle) -> &'static str {
    match style {
        ActingStyle::Smooth => "Jatkuva 3D-liike ja pehmeät ilmeiden vaihdot.",
        ActingStyle::Stepped12 | ActingStyle::Stepped15 => {
            "Stop motion porrastaa vapaat käsivarsien ja pään asennot. Hahmon paikka, jalat, kontaktit, kamera, puhe ja huulisynkka säilyttävät jatkuvan ajoituksensa. Kontaktikäsi ja avainruuduilla ohjatut nivelet säilyttävät oman ohjauksensa."
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_picker_preserves_every_supported_authored_style() {
        for original in [
            ActingStyle::Smooth,
            ActingStyle::Stepped12,
            ActingStyle::Stepped15,
        ] {
            let ctx = egui::Context::default();
            let mut style = original;
            let mut changed = true;
            let _ = ctx.run(egui::RawInput::default(), |ctx| {
                egui::CentralPanel::default().show(ctx, |panel| {
                    changed = ui(panel, &mut style, false);
                });
            });
            assert!(!changed);
            assert_eq!(style, original);
        }
    }
}
