# Hahmostudio

Finnish, personal-use animation editor (KILSAT Studio / KOETA): web version (React, TypeScript, Vite, private Node server) and a sibling Electron desktop app. The UI is Finnish. Full historical per-version notes (0.1–2.10, including superseded wording) are in `docs/AGENTS-HISTORIA.md`; this file is the condensed, conflict-resolved rule set. When the two differ, this file wins. Detailed behaviour lives in `DEVELOPMENT-*.md`, `KEHITYSMUISTIO.md` and `docs/`.

## Commands
- `npm ci`, `npm run typecheck`, `npm test`, `npm run dev`, `npm run build:private` then `npm run start:private`.
- Desktop: `npm run desktop:build`; `npm run desktop:package:mac` builds the host architecture with local Rhubarb. The installed .app does not update with source changes: rebuild, close the old app, replace only the bundle.
- Vocabulary gaps from own scripts: `npm run vocabulary:gaps -- <folder>`; grammar corpus `tests/fixtures/vocabulary-corpus.txt`.
- CI (`.github/workflows/ci.yml`) runs typecheck, tests and `build:private` on PRs.

## Architecture rules
- Keep importer, normalized document model, renderer, rig/controller, Presentation/Production/Studio layers separate. Studio is an adapter; Presentation/Production stay the animation authority; keep one common tick timebase and source IDs.
- Preserve PSD stable IDs, hierarchy, document-space offsets, draw order and visibility (independent of attachment `parentKey`, which must be acyclic; old rigs without it stay independent).
- Preserve all user work and assets: original cast, backgrounds, library, Otto/Roni/Salla/Mr.Kille/Mr.Handu assets and packs are additive; never overwrite old rigs/tracks or old resources. Keep stable PSD IDs when changing draw order.
- Formats: `.hahmo` v1–v5 readable (v4 raster/mask/vector ops, v5 production state), optional `resource-manifest.json`, optional portable editor history (max 16 states / 128 MiB, never trimmed silently), `.sarja` episodes. Never silently downgrade checksum validation. Validate sizes, layer counts and PNG dimensions before decoding.
- Limits: RGB/grayscale 8-bit PSD, no PSB, 100 MiB input, 16 MP document, 48 MP decoded, 1000 layers. PNG sequence export ≤300 frames / 128 MiB. MP4: local WebCodecs or the desktop ExportQueue (FFmpeg, VideoToolbox verified by a real `allow_sw=0` probe, OpenH264 fallback), 30 fps, max 60 s per episode, 128 MiB per output. Cancel must release encoders, canvases and audio contexts.
- No fake buttons for absent features. Camera, microphone and keyboard stay concurrent; visibility changes never stop devices. Panels stay mounted (PanelDock moves persistent portal hosts); panel sizes validated/clamped; desktop flex stage keeps `min-height:0`.
- Asset URLs respect `import.meta.env.BASE_URL`; GitHub Pages project builds use `VITE_BASE_PATH=/<repo>/`; never publish the editor to public Pages.

## Privacy and hosting
- PSD decoding and all camera/audio analysis stay local. Audio and user voices stay local and are never published in source or app bundles.
- Private Node server: loopback by default, single owner login; remote hosting needs an HTTPS origin and setup token. Do not add accounts or other backends without a requirement.
- Cloud AI render is the one authorized add-on (see Cloud render). Desktop must not read or change web owner credentials.

## Desktop (Electron)
- Keep context isolation, sandbox, no Node integration; narrow validated IPC. Projects/settings live outside the app. Package name, bundle ID and data path are stable.
- Never await `app.whenReady` at ESM module scope (register an async ready callback); keep `desktop/startup.test.mjs` and its loader fixtures (excluded from the production bundle). `startup-status.json` holds only version/phase/time.
- Recovery: two bounded autosave snapshots plus named revisions (never auto-deleted when quota fills); commit records are validated by snapshot and own checksum (max 20 / 512 MiB); a checkpoint is written before a render dispatches; a recovered render is `interrupted` and needs a user retry; autosave replay is not a per-command WAL. Never overwrite user project files; never claim physical power-loss durability from SIGKILL tests.
- Project undo is one disk-backed history (max 16 refs / 384 MiB); ProjectChunks/delta journal rebuild the exact archive with per-chunk and total hashes (a state/Merkle hash is not an archive hash). Journal order is validate → persist → publish; history commit and React publication happen only after the acknowledgement; ack ID/hash/size are verified; different commands are never deduplicated by identical bytes; no cloning of DOM media objects. Raw text is a UI draft until the command is acknowledged.
- Do not publish, change repo permissions or visibility, disable OS security or add auto-updates. A push/upload needs explicit user authorization in that turn (granted once for 2026-10-04 and for the PRs that followed; deleting branches or force pushes need fresh approval).

## Editor workflows
- Workspaces Hahmo / Esitys / Animointi; menus Tiedosto/Muokkaa/Näytä/Ohje share actions; Studio flow tour is opt-in from Ohje (first launch shows the empty script state, not a modal).
- Rig: roles, document-space pivot/joints, validated portable rig JSON; tracks translate/rotate/scale/opacity with linear/smooth/hold; 10000-keyframe limit; unique parts and attachment chains validated. Layer search keeps hierarchy and visibility.
- Gait/IK: stance IK, stance foot slip < 1 px (mitta tests stay), run has a flight phase, frontal walk grows 10–14 % (2D perspective approximation; IK and translation compensate the scale), no 3D. Chain retarget bakes FK/IK for explicitly anchored 2D chains only; raw PSD mapping scales axis-wise; no arbitrary topology retarget.
- Live: face capture owns mapped eyelids, pupils, eyebrows and all mouth-image opacities; speech energy has priority and returns to camera in silence; explicit source choices persist in QuickProfile. Volume-driven mouths are not phonemes; Rhubarb visemes and local whisper.cpp transcription are separate; never fabricate words or speaker identity.
- Camera/head attachment: zero local translation/unit scale and ±25° rotation before preview and recording; legacy keys intact.
- Cutout3D is an optional projection of textured PSD paper planes (not a mesh or 3D rig), sorted by plane offset; camera yaw/pitch are scene settings. Toon meshes are skinned volumes marked review; held library props (mug, book, bag, umbrella) work for 2D rigs, toon3d and Mr.Kille/Handu cutouts, the phone keeps its own path. Backgrounds/props are 2D.

## Presentation, production and review
- Deterministic presentation models; original script/source spans and revision, manual overrides/order, protected holds and reaction locks are preserved; stable reconciled IDs; content-based event IDs so voices, approvals and locks survive moving lines. Never invent dialogue or speed audio to meet editorial windows. Rebuilding an earlier scene cannot shift later content.
- Screenplay/script rules are data (aliases, inflections, profiles, environments, props, constraints); example scripts define no logic; never run code from script text. The recognizer is rule-based and never guesses; unknown essential cues block final assembly; interpretation estimates need review/acceptance. No claim of general natural-language understanding. Vocabulary additions need a corpus line (mapped or an explicit “-” for unsupported).
- The local screenplay parser appends editable motions and never erases earlier playback, mouth tracks or audio; script undo is atomic across animation and scene. Dialogue mouth tracks are preserved (record/live sources cannot overwrite linked dialogue in export).
- Voice replacement commits timing, mouth tracks, resources and approval invalidation as one undo transaction. Original-voice restore needs the exact audio SHA-256. Drafts may have missing resources; committed scenes stay strict. Approve/lock needs all bound resources; unlock does not.
- Studio metadata (all optional schema-1 extensions, old projects stay valid): review comments (open comments block approval/lock; reopening or commenting stales approval but never unlocks), shot tasks (YYYY-MM-DD due dates by explicit calendar day, free-text assignee, orphans kept but not counted), saved search views (localStorage, not project data), work-queue sorting is a view (filter → sort → paginate, missing values last, ties by episode order), CSV export is a read-only projection (UTF-8 BOM, `;`, CRLF, formula-prefix protection, `saveFile kind:export`, never a project backup). Impact checks compare command input/output with the same compiler; a change touching a locked shot is blocked, unchanged approvals move to the new revision. `commandJournal` is a bounded audit field (max 100), not replay. `productionOverview` and `productionIssues` are read-only; technical check ≠ approved ≠ rendered; navigation resolves current IDs and never guesses a target.
- Export preflight is the single resource check (`freezeRender`); a pre-check writes no file and is not render QC. An actual worker preflight and video decode QC precede publication.

## Episode builder and block editor
- `lib/episode-builder.ts` is deterministic and never throws: each line has an outcome; unrecognized lines appear in the check. Modules in `lib/episode/`. Fix suggestions (`lib/review-suggestions.ts`) are shown with the exact change and applied only on confirmation.
- The script text is the source of truth for blocks; a block change rewrites only its line and `blockSentence` must round-trip. Free timing: pauses split, a pause is appended after all content, `Samalla` works only with dialogue; elsewhere the block snaps to an event boundary and says so. Group commands need single-block lines. Keep the motion measure tests, one view per frame, and composition inside the safe area.
- `Presentation.soundCues` is optional and anchored to events. Effects and music are programmatic CC0 or user-imported; footsteps follow the floor of the current environment, effects get a per-environment room reverb, imported music loops with crossfade and fades, and fade transitions duck music. Dialogue is never reverbed.
- Speech synthesis: only the local Kokoro engine for English lines, user-approved model download into the app data folder (never in repo or bundle), lines marked synthetic, user recordings and imports always win and are never overwritten. No cloud TTS. Voice recording is original local PCM.

## Cloud render (0.47, opt-in)
- `HAHMOSTUDIO_CLOUD_RENDER=1`, private server only; additive in `lib/cloud-render/`; the desktop app does not use it. AI output is untrusted, validated deterministically and never writes canon; the rule-based Presentation stays the authority. Zero-cost policy is server-env only, frozen, no paid fallback; provider calls need a PaidComputeFirewall token. No model weights locally or in Drive. Do not claim live ComfyUI/Drive/Colab verification until run. Components must avoid generic arrow functions in files under `lib/cloud-render` (the UI test transpiles .ts as TSX).

## Process
- Report each development update with: current phase, what is done, next work. Report simulated vs packaged-startup vs real-device verification separately; M1/VideoToolbox/device, GUI and hardware tests stay unverified until actually run. Honest limits belong in `DEVELOPMENT-*.md` and `KEHITYSMUISTIO.md`; do not label a request finished while acceptance work remains.
- Browser or visual previews are allowed when the user authorizes them for that change (granted for the Studio redesign, the KILSAT/KOETA UI work and later UI checks); otherwise report code tests only.
- Pillow is only needed to regenerate artwork, never at app runtime.
