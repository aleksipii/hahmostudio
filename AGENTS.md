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
