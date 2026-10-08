#!/usr/bin/env python3
"""Runs INSIDE a Kaggle (or other) notebook session. Never run on the user's computer.

Takes a Hahmostudio render package, provisions the pinned model files (provision_models.py), starts ComfyUI on
127.0.0.1 only (no tunnel, no public endpoint), checks nodes and model files, runs the packaged graph and writes ONE
result file for the user to download and import back into Hahmostudio. ComfyUI is stopped before returning.
"""
import base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.request

import provision_models

LOADER_FIELDS = {"CheckpointLoaderSimple": "ckpt_name", "UNETLoader": "unet_name", "CLIPLoader": "clip_name", "VAELoader": "vae_name"}
OUT_EXT = {"png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"}
WEIGHT_EXT = {"safetensors", "ckpt", "bin", "pth", "pt", "gguf", "onnx", "sft", "pkl", "h5", "npz"}  # mirrors lib/cloud-render/weights.ts
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]{1,120}$")
MAX_OUTPUT_BYTES = 64 * 1024 * 1024
NEEDED_GB = 25


def say(msg):
    print(msg, flush=True)


def fail(msg):
    raise SystemExit("\n❌ " + msg)


def check_environment():
    try:
        gpu = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"], capture_output=True, text=True, timeout=60)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        gpu = None
    if not gpu or gpu.returncode != 0 or not gpu.stdout.strip():
        fail("GPU ei ole käytössä. Kaggle: oikea paneeli → Session options → Accelerator → GPU T4 x2 tai GPU P100, sitten Run All uudelleen.")
    try:
        urllib.request.urlopen(urllib.request.Request("https://huggingface.co", method="HEAD"), timeout=20)
    except Exception:
        fail("Internet ei ole käytössä. Kaggle: oikea paneeli → Session options → Internet → On (vaatii puhelinnumeron vahvistuksen), sitten Run All uudelleen.")
    return gpu.stdout.strip().splitlines()[0][:200]


def hf_token():
    """HF_TOKEN from the environment, or from Kaggle Secrets (Add-ons → Secrets) when present. Optional for public repos."""
    if os.environ.get("HF_TOKEN"):
        return os.environ["HF_TOKEN"]
    try:
        from kaggle_secrets import UserSecretsClient
        return UserSecretsClient().get_secret("HF_TOKEN") or None
    except Exception:
        return None


def pick_workdir():
    for base in ("/kaggle/temp", "/kaggle/tmp", "/tmp"):
        try:
            os.makedirs(base, exist_ok=True)
            free = shutil.disk_usage(base).free / 1e9
        except OSError:
            continue
        if free >= NEEDED_GB:
            return os.path.join(base, "hahmo")
    fail("Levytilaa ei ole tarpeeksi (tarvitaan noin %d Gt)." % NEEDED_GB)


def install_comfyui(workdir, commit=None):
    comfy = os.path.join(workdir, "ComfyUI")
    if not os.path.isdir(os.path.join(comfy, ".git")):
        say("• Asennetaan ComfyUI…")
        subprocess.run(["git", "clone", "-q", "https://github.com/comfyanonymous/ComfyUI", comfy], check=True)
    if commit:
        subprocess.run(["git", "-C", comfy, "fetch", "-q", "--depth", "1", "origin", commit], check=True)
        subprocess.run(["git", "-C", comfy, "checkout", "-q", commit], check=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", os.path.join(comfy, "requirements.txt")], check=True)
    head = subprocess.run(["git", "-C", comfy, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return comfy, head if re.fullmatch(r"[0-9a-f]{40}", head) else None


def http_json(url, body=None, timeout=60):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def start_comfyui(comfy, port=8188):
    log = open(os.path.join(comfy, "hahmo-comfy.log"), "w")
    # 127.0.0.1 only: nothing is reachable from outside the notebook session.
    proc = subprocess.Popen([sys.executable, "main.py", "--listen", "127.0.0.1", "--port", str(port)], cwd=comfy, stdout=log, stderr=subprocess.STDOUT)
    url = "http://127.0.0.1:%d" % port
    for _ in range(300):
        if proc.poll() is not None:
            fail("ComfyUI pysähtyi käynnistyessä. Lopun loki:\n" + tail(log.name))
        try:
            http_json(url + "/system_stats", timeout=5)
            return proc, url
        except Exception:
            time.sleep(2)
    proc.terminate()
    fail("ComfyUI ei käynnistynyt 10 minuutissa. Lopun loki:\n" + tail(log.name))


def tail(path, n=30):
    try:
        with open(path, errors="replace") as f:
            return "".join(f.readlines()[-n:])
    except OSError:
        return ""


def check_runtime(url, graph):
    info = http_json(url + "/object_info", timeout=120)
    problems = []
    for node_id, n in graph.items():
        spec = info.get(n["class_type"])
        if spec is None:
            problems.append('Node "%s" (%s) is not installed in the runtime.' % (n["class_type"], node_id))
            continue
        field = LOADER_FIELDS.get(n["class_type"])
        if field:
            opts = ((spec.get("input") or {}).get("required") or {}).get(field, [None])[0]
            if not isinstance(opts, list) or n["inputs"].get(field) not in opts:
                problems.append('Model file "%s" is not provisioned in the remote runtime.' % n["inputs"].get(field))
    return problems


def write_inputs(comfy, inputs):
    folder = os.path.realpath(os.path.join(comfy, "input"))
    os.makedirs(folder, exist_ok=True)
    for name, b64 in inputs.items():
        if not SAFE_NAME.match(name):
            fail("Paketissa on kelvoton syötetiedoston nimi.")
        with open(os.path.join(folder, name), "wb") as f:
            f.write(base64.b64decode(b64, validate=True))


def run_graph(url, graph, client_id, poll=5, timeout=12 * 3600):
    sub = http_json(url + "/prompt", {"prompt": graph, "client_id": client_id})
    if not sub.get("prompt_id") or sub.get("node_errors"):
        fail("ComfyUI hylkäsi työnkulun: " + json.dumps(sub.get("node_errors") or sub)[:2000])
    pid, started, last = sub["prompt_id"], time.time(), 0
    while True:
        h = http_json(url + "/history/" + urllib.request.quote(pid)).get(pid) or {}
        if (h.get("status") or {}).get("status_str") == "error":
            fail("ComfyUI ilmoitti renderöintivirheestä: " + json.dumps(h.get("status"))[:2000])
        if h.get("outputs"):
            return h["outputs"]
        elapsed = time.time() - started
        if elapsed > timeout:
            fail("Renderöinti ei valmistunut aikarajassa.")
        if elapsed - last >= 60:
            last = elapsed
            say("  …renderöidään (%d min)" % (elapsed // 60))
        time.sleep(poll)


def collect_outputs(comfy, outputs):
    root = os.path.realpath(os.path.join(comfy, "output"))
    files, total = [], 0
    for node in outputs.values():
        for lst in node.values():
            if not isinstance(lst, list):
                continue
            for o in lst:
                if not isinstance(o, dict):
                    continue  # e.g. SaveVideo's animated:[true]
                name = o.get("filename") or ""
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if not name or ext in WEIGHT_EXT or ext not in OUT_EXT:
                    fail("ComfyUI palautti kielletyn tiedoston: " + name[:120])
                path = os.path.realpath(os.path.join(root, o.get("subfolder") or "", name))
                if not path.startswith(root + os.sep):
                    fail("ComfyUI palautti polun tulostekansion ulkopuolelta.")
                with open(path, "rb") as f:
                    data = f.read()
                total += len(data)
                if total > MAX_OUTPUT_BYTES:
                    fail("Tulos on yli 64 MiB.")
                files.append({"name": re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120], "sha256": hashlib.sha256(data).hexdigest(), "dataBase64": base64.b64encode(data).decode()})
    if not files:
        fail("ComfyUI ei palauttanut yhtään tiedostoa.")
    return files


def run(pkg, comfy_dir=None, comfy_url=None, hf_base_url="https://huggingface.co", out_dir="/kaggle/working", skip_env_checks=False):
    if pkg.get("schema") != 1 or pkg.get("kind") != "hahmostudio-notebook-package" or not re.fullmatch(r"[0-9a-f]{64}", pkg.get("packageHash", "")):
        fail("Tämä ei ole Hahmostudion renderöintipaketti.")
    job = pkg["jobId"]
    if not SAFE_NAME.match(job):
        fail("Paketin työtunnus on kelvoton.")
    say("Hahmostudio · työ %s · %s / %s" % (job, pkg["workflowId"], pkg["modelId"]))
    gpu = None if skip_env_checks else check_environment()
    if gpu:
        say("• GPU: " + gpu)
    commit = None
    if comfy_dir is None:
        comfy_dir, commit = install_comfyui(pick_workdir(), pkg.get("comfyCommit"))
    say("• Ladataan ja tarkistetaan mallit (ensimmäisellä kerralla noin 18 Gt, edistymistä ei näy)…")
    receipt_path = os.path.join(comfy_dir, "hahmo-receipt.json")
    provision_models.provision(pkg["manifest"], comfy_dir, hf_base_url, hf_token(), receipt_path)
    with open(receipt_path) as f:
        receipt = json.load(f)
    proc = None
    try:
        if comfy_url is None:
            say("• Käynnistetään ComfyUI (vain tämän istunnon sisällä)…")
            proc, comfy_url = start_comfyui(comfy_dir)
        checked_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        problems = check_runtime(comfy_url, pkg["graph"])
        if problems:
            fail("Ajoympäristön tarkistus epäonnistui:\n- " + "\n- ".join(problems))
        say("• Tarkistus ✓ – renderöidään…")
        write_inputs(comfy_dir, pkg.get("inputs") or {})
        outputs = collect_outputs(comfy_dir, run_graph(comfy_url, pkg["graph"], job))
    finally:
        if proc:
            proc.terminate()
    result = {"schema": 1, "kind": "hahmostudio-notebook-result", "jobId": job, "packageHash": pkg["packageHash"],
              "runtime": {"checkedAt": checked_at, "comfyCommit": commit, "gpu": gpu},
              "checks": [{"workflowId": pkg["workflowId"], "modelId": pkg["modelId"], "ok": True, "problems": []}],
              "receipt": receipt, "outputs": outputs}
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "hahmo-%s-tulos.json" % job)
    with open(path, "w") as f:
        json.dump(result, f)
    say("\n✅ VALMIS: %s" % os.path.basename(path))
    say("Lataa tiedosto: oikea paneeli → Output → %s → Download. Tuo se Hahmostudiossa painikkeella Tuo tulos." % os.path.basename(path))
    say("Muista sammuttaa istunto (Stop session), jotta GPU-kiintiötä ei kulu turhaan. Älä jaa muistikirjaa tai tuloksia palveluna muille.")
    return path
