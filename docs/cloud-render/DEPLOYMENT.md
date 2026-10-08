# Deployment

1. `npm ci && npm run build:private`.
1b. Pin models (your machine, network needed, metadata only): `PINS_OUT=pins.json HF_TOKEN=... node --experimental-strip-types scripts/make-model-pin.ts flux1-schnell black-forest-labs/FLUX.1-schnell flux1-schnell.safetensors=diffusion_models:unet ...` (one `path=folder:role` per file; repeat per model). It records Hub's current commit; review it before use.
2. Server env:
```
HAHMOSTUDIO_CLOUD_RENDER=1
GOOGLE_OAUTH_CLIENT_ID=...  GOOGLE_OAUTH_CLIENT_SECRET=...  GOOGLE_OAUTH_REFRESH_TOKEN=...
HAHMOSTUDIO_MODEL_PINS_FILE=/path/pins.json          # exact revisions + checksums
HAHMOSTUDIO_COLAB_COMFYUI_URL=https://<tunnel>       # https only
HAHMOSTUDIO_COLAB_CLASSIFIED_FREE=yes                # your statement that this path is free
HAHMOSTUDIO_COMFYUI_BEARER=...                       # only protects the runtime if a proxy in front of ComfyUI checks it; plain ComfyUI ignores it
HAHMOSTUDIO_COMFYUI_TIMEOUT_MS=1800000               # optional, 60000-3600000 (default 600000); slow GPUs such as a T4 need more
# optional: HAHMOSTUDIO_MODEL_MODE=DEVELOPMENT (never for production)
```
3. `npm run start:private` (loopback by default; remote hosting still needs HTTPS origin + setup token). The server loads `lib/cloud-render/*.ts` through Node's type stripping (Node ≥ 22.18, or add `--experimental-strip-types`).
4. In the cloud runtime (Colab/pod/own GPU), never locally: install ComfyUI, then provision each model with a manifest and `provision_models.py`:
```
python cloud/runtime/provision_models.py manifest.json --comfy-dir /content/ComfyUI     # HF_TOKEN env for gated repos
```
Manifests come from `buildProvisionManifest(model, 'PRODUCTION_SAFE', policy)`, which refuses unpinned or unlicensed models. Start ComfyUI with `--listen` behind the tunnel.
5. Check the runtime without rendering. Authoritative: the editor dialog's "Suorita renderöinniton esitarkistus" (or `POST /api/live-verification/smoke`), which records evidence in the server's ledger. `scripts/cloud-render-smoke.ts` is a diagnostic only and does not count toward liveVerified. It goes through the cost gate and firewall, then confirms nodes and pinned model files per workflow/model pair via `/object_info`. A pair that passes is the evidence for flipping a workflow's `liveVerified` after one real render.
6. Open the editor → menu → "Pilvirenderöinti…".

No weights ever touch the local machine or Drive. The repo test `repository contains no model weight files` guards the source tree.

## Verification status
Automated: schema/validators/gate/firewall/pipeline/API/Drive+ComfyUI with fakes/provision script against a local server (`npm test`). **Not verified:** a real ComfyUI run, a real Drive account, a real Colab GPU, the dialog in a browser (build and typecheck only).

## Real-render authorization and liveVerified
- The dialog first shows the **authorization card** from `POST /api/render/preflight` (backend, class, estimated cost, maximum, paid compute/fallback, model id/revision/licence/commercial use, workflow, status). Preflight contacts no provider and mints no token. The render button is enabled only when the server says AUTHORIZED, and the render request must carry that card's `authorizationFingerprint`; if backend, cost, model pin, workflow, policy or scene changed since, the server blocks with `authorization-changed`. The server recomputes everything; the browser cannot supply policy.
- Provisioning writes a **receipt** (`provision_models.py --receipt provision-receipt.json`) only after every file matched its pinned SHA-256. Copy receipts into the server directory `HAHMOSTUDIO_PROVISION_RECEIPTS_DIR`; the server accepts a receipt only if repo, revision and every file hash equal its own pin. (This is an operator attestation produced inside the runtime; the server cannot read the runtime's disk itself.)
- A workflow is `liveVerified` (shown by `/api/backends` and the ledger) only after a render where all hold: the server's own smoke check passed for that backend/workflow/model fingerprint (within 24 h, before the render), revision pinned, receipt matches, PRODUCTION_SAFE licence/commercial validation passes, the render COMPLETED with validated output, outputs and the record/audit files exist in storage, and the backend is not a mock. The record shows `liveVerification.missing` otherwise. There is no API to set it, and changing a model pin withdraws it.
