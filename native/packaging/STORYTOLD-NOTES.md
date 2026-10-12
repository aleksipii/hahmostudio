# Storytold architecture evidence

Inspected public sources on 2026-10-12. The GitHub organization page was
reachable; GitHub's API returned HTTP 403, so the HTML page and raw source URLs
were used instead. No source code was copied or dependency added.

Relevant verified repository: [storytold/filmcraft](https://github.com/storytold/filmcraft).
Its [architecture](https://github.com/storytold/filmcraft/blob/main/docs/architecture.md)
describes a headless engine with egui, CLI, JSON control and MCP clients;
project-changing actions pass through `Session::execute`; exact integer ticks
and rational frame rates; copy-on-write project snapshots; CPU reference and
GPU fast path. It defines explicit foundation/domain/edit/render/engine/UI
layers rather than making UI the project authority.

The [Cargo manifest](https://github.com/storytold/filmcraft/blob/main/Cargo.toml)
uses `crates/*`, `apps/*` and `xtask` workspace members, version 0.7.2, Rust 1.95,
and declares `MIT OR Apache-2.0`. Both
[MIT](https://github.com/storytold/filmcraft/blob/main/LICENSE-MIT) and
[Apache](https://github.com/storytold/filmcraft/blob/main/LICENSE-APACHE) license
files were also read from the raw public sources (MIT copyright 2026 ArtCraft
Team and FilmCraft contributors, Apache License 2.0). Branding has a separately listed license; source
license does not imply permission to reuse its brand.

Applicable to Koeta: retain existing small hs-* crates and tick timebase, keep
project mutation separate from egui, and validate CPU/GPU paths. FilmCraft's
claims about clean-room native codecs are its documented design, not proof
Koeta has those codecs. Koeta continues its existing FFmpeg adapter. A wholesale
workspace migration or Rust version bump is not warranted by this comparison.
This inspection covers FilmCraft's documentation/manifest, not an audit of every
Storytold repository or a verification of its claimed feature completeness.
