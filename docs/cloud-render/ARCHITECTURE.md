# Cloud AI Render Engine: architecture

**Rules define reality. AI suggests. Unverified AI output is never rendered.**

```
Presentation (rule-based, existing)
   │ canonicalFromPresentation()  (read-only projection)
   ▼
CanonicalState ──► SceneLock (approved scene snapshot + hash)
   │
   ▼ buildAIContext()  (scene-scoped, deep-frozen, no policy inside)
AIDirector (untrusted) ──► raw JSON
   │ parseSuggestion()  strict schema, unknown fields rejected
   ▼
validateSuggestion()  layers 1-7 (entities, attributes, actions, timeline, continuity, prompt fragments)
   │ REJECTED → stop        APPROVED → branded ApprovedSuggestion
   ▼
compilePrompt()  deterministic; accepts only ApprovedSuggestion
   ▼
ModelRouter (license / revision / cost) → BackendRegistry.select (static, no fallback)
   ▼
ComputeCostGate → PaidComputeFirewall → ExecutionToken
   ▼
RenderBackend.validate/render (token required)  → ComfyUI runtime (models provisioned remotely)
   ▼
validateOutput() → StorageBackend (Google Drive) → audit + reproducibility record
```

## Layers (all under `lib/cloud-render/`)
| Layer | Files |
|---|---|
| Rules | `canonical.ts` (state, `RuleEngine`, `CanonicalStore`), `canonical-adapter.ts` |
| AI | `ai-context.ts`, `ai-suggestion.ts` (schema, directors), `ai-validator.ts`, `continuity.ts`, `vocabulary.ts`, `prompt-compiler.ts`, `scene-lock.ts`, `character-refs.ts` |
| Render | `pipeline.ts` (`RenderService`, `ProjectStore`), `models.ts`, `workflows.ts`, `compute.ts`, `backends.ts`, `output-validation.ts`, `audit.ts`, `provision.ts` |
| Backends | `comfyui-backend.ts`, `mock-backend.ts`, `DisabledBackend` |
| Storage | `storage.ts`, `storage-gdrive.ts`, `storage-local.ts` |
| API | `api.ts` (router), `server.ts` (wiring from server env) |

## Authority and permissions
- Only `RuleEngine.commit` can change a `CanonicalStore` (writer symbol is module-private). Readers get deep-frozen copies.
- The AI Director receives only an `AIContext`. It has no handle to the store, policy, registries or storage.
- Suggestions can carry *claims* (attributes, location, holding) but claims are only compared with canon, never applied.
- State-changing actions (`pick_up`, `put_down`, `move_to`) proposed by AI are rejected unless they echo an approved scene event.

## Mode A and Mode B
Mode A (rule-based production) is the existing studio and is untouched. Mode B is `useAI:true`. With `useAI:false` the deterministic `RuleBasedDirector` supplies neutral framing, and the same validators and gates still run. No LLM is configured by default.

## Render request flow (`RenderService.run`)
1 receive → 2 load canon → 3 load scene → 4 validate scene + scene lock → 5 AI context → 6 suggestion → 7 validate → 8 reject hallucinations → 9 compile prompt → 10 select model → 11 verify license/revision → (inputs from storage) → 12 select backend → 13 estimate cost → 14 `ComputeCostGate` → 15 `PaidComputeFirewall` → 16 provider (`validate`, `render`) → 17 render → 18 validate output → 19 upload → 20 audit → 21 return record.
States: QUEUED, VALIDATING, COST_CHECK, AUTHORIZED, SUBMITTING, RENDERING, VALIDATING_OUTPUT, UPLOADING, COMPLETED, BLOCKED, FAILED, CANCELLED.

## Replaceability
Provider-specific code exists only in backend classes. Swapping GPU provider = registering another `RenderBackend`. Swapping storage = another `StorageBackend`. Rule engine, director, canonical state, validators, prompt compiler, model registry, job type, UI do not change.
