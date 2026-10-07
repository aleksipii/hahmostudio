# Deployment

1. `npm ci && npm run build:private`.
2. Server env:
```
HAHMOSTUDIO_CLOUD_RENDER=1
GOOGLE_OAUTH_CLIENT_ID=...  GOOGLE_OAUTH_CLIENT_SECRET=...  GOOGLE_OAUTH_REFRESH_TOKEN=...
HAHMOSTUDIO_MODEL_PINS_FILE=/path/pins.json          # exact revisions + checksums
HAHMOSTUDIO_COLAB_COMFYUI_URL=https://<tunnel>       # https only
HAHMOSTUDIO_COLAB_CLASSIFIED_FREE=yes                # your statement that this path is free
HAHMOSTUDIO_COMFYUI_BEARER=...                       # protect the runtime
# optional: HAHMOSTUDIO_MODEL_MODE=DEVELOPMENT (never for production)
```
3. `npm run start:private` (loopback by default; remote hosting still needs HTTPS origin + setup token). The server loads `lib/cloud-render/*.ts` through Node's type stripping (Node ≥ 22.18, or add `--experimental-strip-types`).
4. In the cloud runtime (Colab/pod/own GPU), never locally: install ComfyUI, then provision each model with a manifest and `provision_models.py`:
```
python cloud/runtime/provision_models.py manifest.json --comfy-dir /content/ComfyUI     # HF_TOKEN env for gated repos
```
Manifests come from `buildProvisionManifest(model, 'PRODUCTION_SAFE', policy)`, which refuses unpinned or unlicensed models. Start ComfyUI with `--listen` behind the tunnel.
5. Open the editor → menu → "Pilvirenderöinti…".

No weights ever touch the local machine or Drive. The repo test `repository contains no model weight files` guards the source tree.

## Verification status
Automated: schema/validators/gate/firewall/pipeline/API/Drive+ComfyUI with fakes/provision script against a local server (`npm test`). **Not verified:** a real ComfyUI run, a real Drive account, a real Colab GPU, the dialog in a browser (build and typecheck only).
