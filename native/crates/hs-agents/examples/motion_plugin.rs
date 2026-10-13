//! Create a fresh series showing a plugin motion adapted to a custom character.
use hs_agents::{motion_plugin, Pipeline, Production};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("Anna uuden .koeta-tiedoston polku.")?;
    match std::fs::symlink_metadata(&path) {
        Ok(_) => return Err("Kohde on jo olemassa; esimerkki ei korvaa projektia.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
        Err(error) => return Err(error.into()),
    }
    let mut jane = hs_character::CharacterParams::maija();
    jane.name = "Jane".into();
    jane.height = 1.12;
    jane.build = 1.05;
    jane.leg_ratio = 0.45;
    let variant = motion_plugin::variant(17, 10, motion_plugin::Orientation::Front)?;
    let plugin = motion_plugin::plugins().into_iter().find(|p| p.info().id == motion_plugin::PLUGIN_ID).ok_or("Liikeplugin puuttuu rekisteristä.")?;
    let bound = plugin.bind(&variant, &jane)?;
    let mut production = Production::new(bound.script);
    production.cast_params = vec![jane];
    Pipeline::default().run(&mut production)?;
    let episode = hs_agents::project::capture(&production,"episode-1".into(),1,"Jane claps".into());
    hs_project::save_atomic(std::path::Path::new(&path), &hs_project::Series {
        id: "plugin-demo-series".into(), name: "Custom character plugin demo".into(), episodes: vec![episode],
    })?;
    println!("{path}");
    Ok(())
}
