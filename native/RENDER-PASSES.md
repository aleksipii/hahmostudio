# Software 3D → layered PSD

Use **Tiedosto → Vie nykyinen 3D-ruutu PSD-passeina…**. The export freezes the
current posed scene, camera, frame and publication dimensions. Software ray
tracing runs on a background thread; cancellation preserves an existing target.
It does not burn subtitles or raster outlines into the geometry passes.
Raster-only painted contact-shadow decorations are excluded from all AOVs.

Layers, from bottom to top:

| Layer | Pixels / Photoshop composition |
| --- | --- |
| Background | Opaque scene clear colour |
| Diffuse / Base Color | Interpolated mesh base colour, sRGB, no lighting |
| Ambient Occlusion | Cosine-weighted finite-radius visibility; Multiply |
| Specular | Shadow-tested directional Blinn–Phong highlights; Screen |
| Depth Map | Radial camera distance, near white / far black; hidden |
| Normal Map | Face-forward world-space XYZ mapped from −1…1 to RGB; hidden |

Geometry pixels share the same hit and alpha coverage. Background has alpha255;
misses in other passes have alpha0. Depth defaults: near0.05m, far100m; configure
`RayTraceOptions` for useful lens-blur range. AO defaults:8 deterministic samples,
0.3m radius. Utility layers must be enabled explicitly for inspection. The merged
PSD preview combines base×AO plus Screen specular; it is not the cel rasterizer's
beauty pass or physically based global illumination.

`hs-render::raytrace` skins the existing indexed meshes once, builds a bounded
median-split triangle BVH, and evaluates all passes together. Up to8 standard Rust
worker threads by default; results do not depend on thread count. Limits:
4million pixels, dimensions≤30000, 200000 triangles,≤64 AO samples,
128MiB PSD output. Export temporarily allocates geometry and pass buffers;
none are retained by the idle studio.

The new rendering/writing path uses `glam`, standard Rust and Pure Rust crates;
it does not call WGPU or C/C++ bindings. WGPU remains the existing preview backend.
The wider application still has its existing audio/camera/platform dependencies.

**Crate limitation:** `psd`0.3.5 only reads PSDs; it has no exporter API.
`psd_exporter.rs` writes PSDv1 RGB8 RAW planar layers in Rust, then decodes with
`psd` and compares all six layer pixel buffers before atomic replacement.
That crate also reverses the visibility flag; tests independently verify correct
Photoshop hidden-layer flags with Koeta's PSD importer. Actual Photoshop and Mac
acceptance remain unrun. The encoder uses the PSD-specified flags.

Reproducible CPU-only example (no GPU feature required):

```sh
cargo run --locked -p hs-render --no-default-features \
  --example render_3d_psd -- /tmp/character-passes.psd
cargo test --locked -p hs-render --no-default-features --test raytrace_psd
```

Unsupported: transparency/refraction, material textures, reflections/path tracing,
volumetrics, PSD16/32-bit or HDR. Mesh `color.a` is Koeta's outline weight,
not material transparency; generated AOV geometry is opaque.
