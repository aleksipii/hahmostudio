# Hahmostudio

This is a Finnish, personal-use browser animation editor. Phase 01 (PSD importer and layer viewer) is implemented. Use React, TypeScript and Vite. Keep the importer, normalized document model, renderer and future rig/controller separate.

- Install dependencies with `npm ci`.
- Check types with `npm run typecheck`.
- Build with `npm run build`.
- Develop with `npm run dev`.
- Keep PSD decoding and all camera/audio analysis local by default.
- The UI is Finnish. Preserve the current editor layout.
- PSD layer naming is optional. Preserve stable PSD IDs, hierarchy and document-space offsets.
- Next authorized development stage is the rig editor: layer role assignment, pivot/joint placement and portable rig JSON import/export. Preserve PSD import and layer inspection.
- Later stages: rig animation/rendering, timeline, keyframes, tweening, audio track, webcam recording to keyframes, lip sync to mouth track, clips and nested timelines.
- Do not add a backend, accounts or cloud uploads without a requirement.
- The owner wants a private repository and private access. Do not enable Pages or deploy externally without an explicit hosting request for that action. A private repository does not make Pages private; private Pages needs an eligible Enterprise Cloud organization.
- GitHub Pages project deployments use `VITE_BASE_PATH=/<repository-name>/`. Private Pages on a unique root domain uses `/`. Asset URLs must respect `import.meta.env.BASE_URL`.

Current limitations: RGB/grayscale 8-bit PSD, no PSB, maximum 100 MiB input, 16 MP document, 48 MP decoded pixels, 1000 layers. Group/vector/clipping masks, adjustments and effects are flagged where unsupported. Editor state is session-only. No rigging or timeline has been implemented yet.
