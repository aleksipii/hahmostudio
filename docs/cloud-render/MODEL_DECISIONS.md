# Model decisions

Priority order used: commercial-use compatibility, clear licence, open model, anime/cartoon quality, character consistency, image-to-video, reference support, VRAM, workflow compatibility, reproducibility.

| Model | Role | Licence tag (HF, 2026-10-07) | Decision |
|---|---|---|---|
| `black-forest-labs/FLUX.1-schnell` | text→image | apache-2.0 (gated repo) | `allowed`; needs accepted HF token in runtime; ~12 GB+ VRAM |
| `Wan-AI/Wan2.2-TI2V-5B` | image→video | apache-2.0 | `allowed`; the only video model sized for a 16–24 GB GPU |
| `Wan-AI/Wan2.2-I2V-A14B` | image→video | apache-2.0 | `allowed`; 40 GB+ VRAM, not for free-tier GPUs |
| `stabilityai/stable-diffusion-xl-base-1.0` | img2img / reference | openrail++ | `restricted` (use-based restrictions) → blocked in PRODUCTION_SAFE |
| `cagliostrolab/animagine-xl-4.0` | anime | openrail++ | `restricted`; training-data provenance not reviewed |
| `Lightricks/LTX-Video` | image→video | other | `unknown` → blocked |

Honest gaps:
- **No shipped model is production-safe out of the box**: exact revisions and file checksums could not be retrieved from this environment (Hub API blocked), and the registry refuses to guess. Pin them with `HAHMOSTUDIO_MODEL_PINS_FILE` (`{"flux1-schnell":{"revision":"<40-hex>","files":[{"path":"...","sha256":"...","comfyFolder":"diffusion_models","role":"unet"}, ...]}}`). A pin can add a revision/hashes but can never change licence or commercial-use fields.
- The only commercially clean models above are general-purpose. None is anime-specialised; anime/cartoon look comes from prompting and reference images. The anime fine-tune is restricted until a human reviews it.
- "Character consistency" here means img2img from approved reference images plus output flagging. There is no identity adapter (IP-Adapter/LoRA training) yet.
- `character_animation` is registered but `implemented:false` and always blocks.
