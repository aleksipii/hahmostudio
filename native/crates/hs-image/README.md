# Native image document and PSD subset

`hs-image` is a local Rust raster document, with stable layer IDs, source PSD IDs,
source offsets and folder hierarchy. `.koeta` image resources use the existing
`KOETAIMG1` portable workspace; new metadata has serde defaults so older resources
still open. Original PSD bytes remain available in `Document::source_psd`.

PSD v1 import supports:

- 8-bit RGB and grayscale, raw and PackBits channel data.
- Raster alpha and 20-byte user raster masks, including mask offsets, default
  outside values, relative positioning, disabled masks and inverted masks.
- Normal, multiply, screen, overlay, darken, lighten, difference and exclusion.
  Compositing uses source-over alpha, including transparent backdrops.
- Pass-through groups at full opacity without masks; isolated groups with
  supported blend modes, group opacity and raster masks. Nested group visibility
  and masking are evaluated during compositing, rather than flattened on import.

Unsupported appearance-changing data remains an import error: clipping masks,
vector/real masks, mask density/feather, adjustment layers, layer effects,
unsupported blend modes, Blend If ranges, ZIP compression, PSB, other depths or
colour modes. This is not full Photoshop compatibility or colour-profile
conversion. Unsupported input never replaces a valid current document.

Limits are checked before raster/mask allocations: 100 MiB source PSD, 16 MP
canvas, 48 MP decoded planes/rasters, 1000 combined layers and groups, 20 nested
groups, 128 MiB portable resources and 128 MiB simultaneous isolated compositing
buffers. Layer spans belonging to a group must remain contiguous; moving a layer
across another group's span requires an explicit hierarchy/order edit.

Tests construct original, unlicensed tiny PSD bytes and verify actual composited
pixels, alpha, group isolation, mask offsets, visibility, undo/redo, PNG output,
portable save/reopen and explicit rejection. Run from `native/`:

```sh
cargo test --locked -p hs-image
cargo clippy --locked -p hs-image --all-targets
```
