# Render backends

```ts
interface RenderBackend {
  descriptor: {id, class: 'free'|'owned'|'paid'|'unknown', provider, billingProvider, enabled}
  getCapabilities(); estimateCost(job);            // offline
  staticValidate?(job);                            // offline (graph can be built)
  validate(job, token); render(job, token, inputs?); cancel(jobId, token?)   // need an ExecutionToken
}
```

## ComfyUIBackend
HTTP client for `/object_info`, `/upload/image`, `/prompt`, `/history/{id}`, `/view`, `/interrupt`, `/queue`. ComfyUI is a backend only: workflows are `WorkflowRegistry` entries (`id`, `revision`, `liveVerified`) and graphs are built from approved jobs.
- `validate` confirms every node class is installed and every pinned model file is listed in the loader options (`provisioned remotely`), else blocks.
- `render` uploads reference images, submits the graph with the job's exact seed, polls, downloads outputs; refuses weight-like files, unknown types and oversize results.
- Models are provisioned **inside the runtime** by `cloud/runtime/provision_models.py` from a manifest (`buildProvisionManifest`), which verifies exact revision and SHA-256 and deletes mismatches.

Workflows: `text_to_image`, `image_to_image`, `character_reference` (img2img, no identity adapter), `image_to_video` (Wan2.2 TI2V node names, **unverified live**), `character_animation` (composite, see below).

## MockRenderBackend
Simulates free / paid / unknown class and costs EUR 0, 0.01, unknown; records every provider call so tests can prove none happened.

## Adding a provider
Implement `RenderBackend`, classify it explicitly, register it in `server.ts`. Nothing else changes. RunPod/Modal exist only as disabled placeholders (`DisabledBackend`); Colab is a ComfyUI URL, not Colab-specific code.

## character_animation (composite)
Implemented in `RenderService` (not in a backend): for a **locked** scene it makes one `image_to_video` clip per approved event (timeline order, max 12), seeded from the acting character's approved reference image, with a prompt compiled from only that event. Each clip is a normal single job: own validation, model/licence check, cost gate, firewall token, provider calls, output checks, upload, audit and liveVerified evaluation. Clips run strictly one after another; the first blocked/failed clip ends the run (no retry on another backend, no partial "success"). The preflight card aggregates all clips (sum of costs; any unknown/non-zero cost in zero-cost mode blocks) and its fingerprint binds the whole clip plan. The server does **not** join videos (no ffmpeg dependency): it uploads `<id>-sequence.json` (ordered clips with files) for the studio to assemble. Limits: it animates only what the rule engine already approved (no new actions), identity consistency is only as good as the reference image plus the palette check, clip length is whatever the model produces (timing in the manifest is intent, not guaranteed duration), and it inherits the `image_to_video` graph's unverified-live status.
