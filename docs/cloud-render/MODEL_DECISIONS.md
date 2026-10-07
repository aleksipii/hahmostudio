# Model decisions

Priority order used: commercial-use compatibility, clear licence, open model, anime/cartoon quality, character consistency, image-to-video, reference support, VRAM, workflow compatibility, reproducibility.

| Model | Role | Licence tag (HF, 2026-10-07) | Decision |
|---|---|---|---|
| `black-forest-labs/FLUX.1-schnell` | text→image | apache-2.0 (gated repo) | `allowed` by licence but **not provisionable yet** (text encoders live in another repo; one repo per model here) |
| `Comfy-Org/Wan_2.2_ComfyUI_Repackaged` (Wan2.2 TI2V 5B single files) | image→video | apache-2.0 (tag of the repackage repo) | `allowed`; the only model whose files ComfyUI can load from one repo; ~18 GB of files, 16–24 GB GPU class. Upstream `Wan-AI/Wan2.2-TI2V-5B` is sharded/.pth and not loadable by ComfyUI |
| `Wan-AI/Wan2.2-I2V-A14B` | image→video | apache-2.0 | `allowed`; 40 GB+ VRAM, not for free-tier GPUs |
| `stabilityai/stable-diffusion-xl-base-1.0` | img2img / reference | openrail++ | `restricted` (use-based restrictions) → blocked in PRODUCTION_SAFE |
| `cagliostrolab/animagine-xl-4.0` | anime | openrail++ | `restricted`; training-data provenance not reviewed |
| `Lightricks/LTX-Video` | image→video | other | `unknown` → blocked |

Honest gaps:
- **No shipped model is production-safe out of the box**: exact revisions and file checksums could not be retrieved from this environment (Hub API blocked), and the registry refuses to guess. Pin them with `HAHMOSTUDIO_MODEL_PINS_FILE` (`{"flux1-schnell":{"revision":"<40-hex>","files":[{"path":"...","sha256":"...","comfyFolder":"diffusion_models","role":"unet"}, ...]}}`). A pin can add a revision/hashes but can never change licence or commercial-use fields.
- The only commercially clean models above are general-purpose. None is anime-specialised; anime/cartoon look comes from prompting and reference images. The anime fine-tune is restricted until a human reviews it.
- "Character consistency" here means img2img from approved reference images plus output flagging. There is no identity adapter (IP-Adapter/LoRA training) yet.
- `character_animation` is a composite of `image_to_video` clips (see RENDER_BACKENDS.md); it needs a pinned video model and shares that workflow's unverified-live status.
