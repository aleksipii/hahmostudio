# Hahmostudio

This is a Finnish, personal-use browser animation editor. Phase 03 includes PSD import, rig definitions, timeline/keyframes, tweening, playback and PNG sequence export. A private Node server protects the editor and assets with a single-owner login. Use React, TypeScript and Vite. Keep the importer, normalized document model, renderer and future rig/controller separate.

- Install dependencies with `npm ci`.
- Check types with `npm run typecheck`.
- Build the private version with `npm run build:private`, then run `npm run start:private`.
- Test with `npm test`.
- Develop with `npm run dev`.
- Keep PSD decoding and all camera/audio analysis local by default.
- The UI is Finnish. Preserve the current editor layout.
- PSD layer naming is optional. Preserve stable PSD IDs, hierarchy and document-space offsets.
- Rig editor includes role assignment, document-space pivot/joint placement and validated portable rig JSON import/export. Preserve PSD import and layer inspection. Animation tracks support translation, rotation around the rig pivot, scale and opacity with linear/smooth/hold interpolation.
- Later stages: rig animation/rendering, timeline, keyframes, tweening, audio track, webcam recording to keyframes, lip sync to mouth track, clips and nested timelines.
- Do not add a backend, accounts or cloud uploads without a requirement.
- The owner now requests single-user private access. GitHub Pages cannot provide the Node login server. Use the private Node server on loopback by default; remote hosting requires an HTTPS origin and setup token. Do not publish the editor to public Pages. Keep PSD processing local.
- GitHub Pages project deployments use `VITE_BASE_PATH=/<repository-name>/`. Private Pages on a unique root domain uses `/`. Asset URLs must respect `import.meta.env.BASE_URL`.

Current limitations: RGB/grayscale 8-bit PSD, no PSB, maximum 100 MiB input, 16 MP document, 48 MP decoded pixels, 1000 layers. Group/vector/clipping masks, adjustments and effects are flagged where unsupported. Working state is in browser memory; complete projects can be saved manually. Rig definitions and animation tracks can be saved as JSON. PNG export is capped to 300 frames and 128 MiB; animation mode uses the scene size, other modes cap the longest edge to 1080 px. Camera capture, two-bone inverse kinematics and local Rhubarb mouth-cue recognition are implemented. Nested clips remain a future stage.

Parts now support optional parentKey links with acyclic validation and stable-ID remapping. Ancestor transforms and animated opacity compose through the chain. Keep PSD draw order and visibility independent of attachment relationships. Old rigs without parentKey remain independent.

Portable .hahmo project archive now contains normalized layer PNGs, visibility, animation/rig and optional audio. Validate import size, layers and PNG dimensions before decoding. Audio stays local. Volume-driven two-mouth animation is not phoneme detection. MP4 export uses local WebCodecs H.264/AAC, 30 fps and scene dimensions (1080x1920, 1920x1080, 1080x1080), max 60 seconds per episode and 128 MiB per output. Five saved episodes can be concatenated into a 1920x1080 compilation; preserve portrait content with side fill. Scene settings persist in .hahmo and episode snapshots persist in .sarja. Cancel must release encoders/canvases/audio contexts.

Walk generation creates editable local rotation tracks with optional attached-body translation/bounce. Preserve unrelated tracks, validate unique parts and attachment chains, and enforce 10000-keyframe limit. It does not pin feet or bend knees automatically. Layer search must preserve hierarchy and visibility.

## Desktop continuity (2026-10-03)

Electron is now a sibling of the existing web version, not a new editor. Keep the shared platform bridge, normalized models, Finnish Hahmo/Esitys/Animointi workspaces and .hahmo v1/v2 / .sarja compatibility. Preserve all user work/assets. The three-workspace layout supersedes the earlier preserve-layout instruction. Keep camera, microphone and keyboard concurrent; no global controller replacement for hand keys. No fake buttons for absent clips/drawing/segmentation. See docs/ROADMAP.md.

Run npm test and npm run desktop:build; npm run desktop:package:mac builds the host architecture with local Rhubarb. Electron renderer must keep context isolation, sandbox and no Node integration; use narrow validated IPC. Store projects/settings outside the app. Do not read/change the web owner credentials for desktop. Do not publish, change repo permissions, disable OS security or add auto-updates. Current user asks code tests without browser/visual tests; identify simulated, packaged startup and real device verification separately. Installed .app does not update with source changes: rebuild, close old app and replace only the bundle.

Desktop 0.2.1: never await app.whenReady at ESM module scope. Electron awaits entry-module completion before appCodeLoaded; register an asynchronous ready callback instead. Preserve desktop/startup.test.mjs and its loader fixtures (excluded from production bundle). startup-status.json is a local diagnostic with version/phase/time, no session token or user content.


Desktop 0.3.0: preserve original Otto bytes and the additional original PSD/.hahmo library. Scene has optional validated frame-based cuts and screenplay text. The local screenplay parser appends editable motions and must never erase earlier playback, mouth tracks or audio. Only explicit supported cues are interpreted; no TTS/cloud model is present. Keep script undo atomic for animation and scene. Attached camera heads use zero local translation/unit scale and ±25° rotation before both preview and recording; saved legacy keys stay intact. Resource generators need Pillow only when regenerating artwork, never at app runtime.


0.4.0: QuickProfile.views has disjoint validated semantic maps for original multiview artwork. Preserve old single-view packs and IDs. Root opacity chooses a view, raw editing filters to current bindings, and live mixing hides inactive roots. Manual view changes must undo their profile mappings too. Scene.phone and phoneCues persist and follow the actual active hand transform. ViewLayout only hides mounted panels; never stop devices on a visibility change. Profile gait has stance IK; frontal motion remains a stylized 2D perspective approximation, not 3D.


0.5.0: compact Tiedosto/Muokkaa/Näytä/Ohje menus share existing actions, with native Mac view/help actions. Pane visibility keeps controllers mounted. Panel dimensions are independently validated/clamped and stored locally; desktop flex stage must retain min-height:0 even with a timeline. Keep keyboard/pointer separators and original Roni/Salla paper-cutout 3-view packs, including source PSD and old library assets. No browser/device tests were authorized; report code/runtime checks separately.

0.6.0: preserve deterministic presentation models, original script/source refs, actual voice durations and protected holds. Never invent dialogue or speed audio to meet editorial windows. Keep cast assets separate from the base PSD; do not overwrite old rigs/tracks. .hahmo v3 must still read v1/v2. Preparation drafts and voice blobs must roundtrip. Production undo includes audio. Rebuilding an earlier scene cannot shift later content. Renderer camera changes must not reset actors or props. Record/live sources cannot overwrite linked dialogue mouth tracks in export. Keep Roni/Salla stable PSD IDs when changing draw order.

0.7.0: example scripts must not define production logic. Generic speaker aliases/inflections, direction requirements, profiles, environments, placement, props and constraints are data. Unknown essential cues/resources block final assembly; interpretation estimates require review/acceptance. Motion uses existing screenplay/IK safely, preserving dialogue mouth tracks in active views. Keep shared-world continuity independent of hard camera cuts and title-card expiry. Never run code from script text. Document rule-based interpretation limits; do not claim arbitrary natural-language understanding or synthesis when only imported voices are available.

0.8.0: preserve the original cast and backgrounds alongside Studio additions. Face capture owns mapped eyelids, pupils/gaze, eyebrows and all mouth-image opacities; do not merely scale an invisible mouth. Automatic mouth arbitration gives speech energy priority and returns to camera during silence; explicit camera/microphone choices persist in QuickProfile. Repliikki recording is original local PCM, never synthesis. Studio mouthSmile remains optional for old packs. Cutout3D is optional validated XYZ projection of textured PSD paper planes, shared by preview and export; it is not a volumetric mesh or a 3D skeletal rig. Camera yaw/pitch are scene settings, not animated tracks. All paper planes are parallel after camera projection: sort by plane offset, not average projected vertex Z, to avoid eyes disappearing behind the head. Preserve all previous camera/head attachment, project and audio safeguards.

0.9.0: the latest request authorizes a targeted UI preview alongside code checks. Layer raster operations, nondestructive masks, simple vector geometry and local content transforms persist in .hahmo v4; read v1–v3 and retain stable layer keys/crops/rigs. ExportQueue uses immutable project bytes, one isolated BrowserWindow renderer, acknowledged frame writes, FFmpeg child processes and atomic finalization. VideoToolbox must pass an actual allow_sw=0 probe; OpenH264 is the explicit fallback. Local whisper.cpp/base transcription is separate from RMS activity and Rhubarb visemes; do not fabricate words or speaker identity. Bundle arm64 runtimes/models/licenses/source archives. Keep honest device, language, GUI and hardware test limits in DEVELOPMENT-0.9.md and the test report. No publication or permission changes are authorized.
