#!/usr/bin/env python3
"""Runs INSIDE the cloud GPU runtime (Colab, a rented pod, your own server). Never run on the user's computer.

Downloads the exact pinned files listed in a provision manifest into ComfyUI's models folder and verifies SHA-256.
Fails closed: bad revision, unknown folder, path traversal, hash mismatch -> nothing is kept and the exit code is non-zero.

  python provision_models.py manifest.json --comfy-dir /content/ComfyUI
"""
import argparse, hashlib, json, os, re, sys, urllib.request

FOLDERS = {"checkpoints", "diffusion_models", "text_encoders", "clip", "vae", "loras", "clip_vision"}
REV = re.compile(r"^[0-9a-f]{40}$")
SHA = re.compile(r"^[0-9a-f]{64}$")
REPO = re.compile(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def provision(manifest, comfy_dir, base_url="https://huggingface.co", token=None):
    if manifest.get("schema") != 1 or not REPO.match(manifest.get("repo", "")) or not REV.match(manifest.get("revision", "")):
        raise SystemExit("manifest rejected: repo/revision invalid (an exact 40-hex commit is required)")
    root = os.path.realpath(os.path.join(comfy_dir, "models"))
    for f in manifest["files"]:
        if f["comfyFolder"] not in FOLDERS or not SHA.match(f["sha256"]):
            raise SystemExit("manifest rejected: bad folder or checksum for " + f["path"])
        parts = f["path"].split("/")
        if f["path"].startswith("/") or ".." in parts or not f["path"]:
            raise SystemExit("manifest rejected: unsafe path " + f["path"])
        target = os.path.realpath(os.path.join(root, f["comfyFolder"], parts[-1]))
        if not target.startswith(root + os.sep):
            raise SystemExit("manifest rejected: path escapes models dir")
        if os.path.exists(target) and sha256_file(target) == f["sha256"]:
            print("ok (cached)", target)
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        url = "%s/%s/resolve/%s/%s" % (base_url, manifest["repo"], manifest["revision"], "/".join(urllib.request.quote(p) for p in parts))
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token} if token else {})
        tmp = target + ".part"
        h = hashlib.sha256()
        with urllib.request.urlopen(req) as r, open(tmp, "wb") as out:
            for chunk in iter(lambda: r.read(1 << 20), b""):
                h.update(chunk)
                out.write(chunk)
        if h.hexdigest() != f["sha256"]:
            os.remove(tmp)
            raise SystemExit("checksum mismatch for %s: refusing to keep the file" % f["path"])
        os.replace(tmp, target)
        print("verified", target)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--comfy-dir", required=True)
    ap.add_argument("--base-url", default="https://huggingface.co")
    a = ap.parse_args()
    provision(json.load(open(a.manifest)), a.comfy_dir, a.base_url, os.environ.get("HF_TOKEN"))
