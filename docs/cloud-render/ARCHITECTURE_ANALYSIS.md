# Architecture analysis (Phase 1)

Written before any cloud-render code, from reading the repository.

## Current architecture

| Concern | Where it lives today |
|---|---|
| Entry points | `main.tsx` (Vite/React editor), `server/private-server.mjs` (login-protected Node server), `desktop/main.mjs` (Electron) |
| Rule / script engine | `lib/script-recognizer.ts`, `lib/script-grammar.ts`, `lib/presentation-parser.ts`, `lib/presentation-direction.ts` (deterministic, fi/en) |
| "Canonical" project model | `lib/presentation-model.ts` (`Presentation`: characters, events, sections, bindings, world) is the animation authority; `lib/studio/domain.ts` adapts it to Episode/Scene/Shot with stable IDs, revisions, approvals and locks |
| Animation / timeline | `lib/animation-model.ts`, `lib/presentation-compile.ts`, `lib/presentation-motion.ts`, `lib/screenplay.ts`, `lib/locomotion.ts`, `lib/inverse-kinematics.ts` |
| Assets | PSD import (`lib/psd-import.ts`), `.hahmo` archives (`lib/project-file.ts`), library under `public/library` |
| Persistence | Browser memory + manual `.hahmo`/`.sarja`; Electron journal/recovery (`lib/studio/recovery*.ts`, `desktop/*`) |
| UI | `components/editor.tsx` (monolith) plus panels; Finnish |
| APIs | Only `/api/auth/*`, `/api/audio/*`, `/api/speech/*` on the private server |
| Auth | Single-owner scrypt login + HttpOnly session, origin check on POST |
| Existing cloud | **None.** AGENTS.md: "no backend, accounts or cloud uploads without a requirement" and "keep PSD processing local" |

Key finding: there is **no appearance/age/outfit data and no state-transition model** in the existing rule system. `Presentation` knows names, events (actions, dialogue, environment, props), sections and timing. The cloud layer therefore defines a small canonical schema (`lib/cloud-render/canonical.ts`) and a **read-only adapter** (`canonical-adapter.ts`) that projects a `Presentation` into it. Appearance attributes come from an explicit human-authored supplement; nothing is inferred.

## Integration points
1. `canonicalFromPresentation(presentation, supplement)`: Presentation -> canonical state (never writes back).
2. Private server: opt-in mount (`HAHMOSTUDIO_CLOUD_RENDER=1`) behind the existing login, with the existing origin check; the spec's `/api/...` routes.
3. Editor: one menu item ("Pilvirenderöinti…", private server only) that opens `components/cloud-render-dialog.tsx`.

## Proposed architecture
New, isolated subsystem `lib/cloud-render/` with layers: rules (canonical, rule engine) -> AI (context, director, suggestion schema, validators) -> render (service, router, registries, cost gate, firewall) -> backends (ComfyUI, mock, disabled placeholders) -> storage (Drive, local-dev, memory). See `ARCHITECTURE.md`.

## Risks
- Free-GPU availability is not guaranteed: renders will often be BLOCKED. Intended.
- ComfyUI graphs for video and non-checkpoint models use node names that were **not run against a live ComfyUI here**; `validate()` checks `/object_info` and fails closed, and workflows carry `liveVerified:false`.
- Model revisions/checksums could not be fetched from this build environment, so shipped models stay blocked in PRODUCTION_SAFE until an operator pins them.
- License fields are read from Hub tags, not legal review.
- Output visual identity checking is only a hook (`OutputInspector`); no vision model is bundled.
- Drive integration is tested against a faked HTTP layer only.

## Migration strategy
Purely additive. No existing module's behaviour changed. Feature is off unless the server flag is set.

## Files changed
`components/editor.tsx` (menu item + dialog mount), `server/private-server.mjs` (opt-in route mount + `cloudRender` option), `server/private-server.test.mjs` (+1 test), `package.json` (test glob).

## Files left untouched
All of `lib/*` outside `lib/cloud-render`, `lib/studio/*`, `desktop/*`, rig/animation/export code, `.hahmo` formats.
