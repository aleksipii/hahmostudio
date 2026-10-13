# hs-project

UI-free portable native Koeta series persistence. `.koeta` is a new native
format, not a reader/writer for legacy `.sarja` or `.hahmo`.

## API

- `Series { id, name, episodes }` contains ordered episodes.
- `Episode { id, number, name, script, cast, fps, width, height,
  accepted_notices, audio, captions, caption_settings, assets }` stores the currently implemented production inputs.
- `AudioBinding { line_key, speech, source }` preserves the complete `Speech`
  (mono samples, sample rate and optional IPA phonemes).
- `AudioSource::Own` identifies user audio. `Synthesized { engine, voice, speed,
  model_version, cache_key }` carries synthesis provenance. Callers must preserve
  user audio priority and only reuse synthesized audio for a matching cache key.
- `ProjectAsset { id, kind, bytes }` stores opaque `image`, `editing` or `recordings`
  resources. IDs are unique per episode; at most one resource of each kind is
  accepted. Content must be domain-validated by consumers before application.
- `captions` preserves editable `hs_subtitle::CaptionCue` values and
  `caption_settings` preserves enabled/burn-in flags and caption style.
- `encode(&Series)` / `decode(&[u8])` work without filesystem access.
- `save_atomic(&Path, &Series)` / `load(&Path)` handle disk persistence.

Stable series/episode IDs must contain 1–128 ASCII letters, digits, underscores
or hyphens. Episode numbers start at one. Audio line keys are opaque (1–512
UTF-8 bytes); unbound/orphaned audio is intentionally preserved. One own and
one synthesized binding may coexist per line, allowing restore of the original
synthesized voice; duplicate bindings of the same source class are rejected. The crate does
not synthesize, play audio or infer missing dialogue. Own recording vs import
is currently represented by the same `Own` provenance.

## Version 2 archive and version 1 migration

The ZIP contains one `manifest.json`, numbered `audio/N.f32` entries and
optional `assets/N.bin` entries. The manifest includes `format: "koeta-series"`,
`version: 2`, domain values, caption data, resource paths, lengths and SHA-256
checksums. Asset bytes are opaque and may contain image/editing domain formats or versioned recording provenance metadata.
No domain image or editing decoder runs inside this archive layer. Audio entries are raw little-endian f32 mono samples, preserving
sample bits exactly (including negative zero), unlike 16-bit PCM conversion.
The manifest sample rate and sample count determine decoding.

Limits: 128 MiB compressed input/output and total expanded entries, 4096 entries,
8 MiB manifest, 1–1000 episodes, 100 cast members per episode, dimensions up to
4096×4096, 1–60 fps. Mono audio uses 8–192 kHz, at most 600 seconds per binding,
and finite samples; floating-point peaks above 1 are preserved for downstream
playback/export limiting. Character float parameters must be finite.
Captions follow `hs_subtitle::validate_cues` (at most 4096 cues per episode,
nonnegative integer tick times with exclusive ends within 60 seconds). Font
height must be finite and within 0.02–0.08; bottom margin within 0.02–0.20.
Disabled captions retain and validate their cues/style.
These are archive bounds; application export constraints remain independent.

The loader rejects unknown schema versions/manifest-owned fields, unsafe or unexpected paths,
duplicate entries/bindings/episode IDs, missing or unreferenced resources,
duplicate episode numbers, incorrect lengths, corrupt CRCs and SHA-256 mismatches. It never extracts ZIP
paths onto the filesystem or accesses external resources.

Atomic save serializes first, writes a same-directory temporary file, flushes
and syncs it, reloads/validates it and then replaces the target using tempfile's
platform-specific atomic persistence. Errors leave the previous target intact.
Temporary files are removed on ordinary error paths. This is not an autosave,
undo journal, or physical power-loss durability guarantee.

The reader accepts versions 1 and 2. Version 1 migrates in memory with empty
captions/assets and default caption settings; saving writes version 2. Unknown
versions are rejected without modifying the input file. Version 1 archives
claiming nondefault version 2 data are rejected. Backward migration does not
regenerate audio, quantize samples or discard orphan bindings.

Future tracks, cameras, layout and legacy migration require
explicit schema evolution; this crate does not claim persistence for data that
is absent from `Episode`.

## Verification

`cargo test --locked -p hs-project` from `native/` covers exact audio/domain
round trips, orphan/provenance preservation, malformed resource checksums,
truncated/unsafe/duplicate/oversized ZIP entries, unsupported versions,
missing resources, invalid IDs/nonfinite samples and failure preservation.
Schema-v2 tests cover version-1 migration, opaque asset/caption round trips with
untouched audio, corrupt assets, invalid cross-type paths and invalid disabled
caption settings that cannot overwrite the previous project.
