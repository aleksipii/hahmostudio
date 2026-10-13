//! Renderöinti.
//!
//! Sama kohtaus voidaan piirtää kahdella polulla, joilla on sama varjostusmalli
//! ([`shading`]): GPU-kiihdytetty [`gpu`] (wgpu: Metal, Vulkan, DX12) ja
//! ohjelmistopohjainen [`cpu`]. Testit vertaavat polkuja toisiinsa (FilmCraftin
//! tapaan), ja CPU-polku toimii varapolkuna koneissa ilman GPU:ta.

pub mod caption;
pub mod cpu;
pub mod environment;
pub mod export;
#[cfg(feature = "gpu")]
pub mod gpu;
pub mod props;
pub mod scene;
pub mod shading;

pub use scene::{Camera, DrawItem, Image, Light, Lights, RenderScene, ShadingStyle};

/// Renderöijä, jolla on sama rajapinta molemmille poluille.
pub trait Renderer {
    fn name(&self) -> &'static str;
    fn render(&mut self, scene: &RenderScene) -> Result<Image, RenderError>;
}

#[derive(Debug, thiserror::Error)]
pub enum RenderError {
    #[error("GPU-sovitinta ei löytynyt")]
    NoAdapter,
    #[error("GPU-laitteen luonti epäonnistui: {0}")]
    Device(String),
    #[error("kuvan koko {0}×{1} ei kelpaa")]
    Size(u32, u32),
    #[error("vienti epäonnistui: {0}")]
    Export(String),
}
