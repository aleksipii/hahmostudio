#!/usr/bin/env python3
"""Read-only, stdlib-only workload measurements of an already running Mac app.

CPU percent is relative to one core and can exceed 100. RSS is sampled, not a
true allocation high-water mark. Child encoders are deliberately not included.
No energy estimate is invented from CPU usage; use Instruments separately.
"""
import argparse
import json
import math
import os
from pathlib import Path
import platform
import subprocess
import sys
import time


def cpu_seconds(value):
    """Parse Darwin ps [[days-]hours:]minutes:seconds[.fraction]."""
    days = 0
    if "-" in value:
        day, value = value.split("-", 1)
        days = int(day)
    fields = value.split(":")
    if len(fields) not in (2, 3):
        raise ValueError("Unrecognized ps CPU time")
    numbers = [float(x) for x in fields]
    if any(not math.isfinite(x) or x < 0 for x in numbers):
        raise ValueError("Invalid ps CPU time")
    seconds = numbers[-1] + 60 * numbers[-2]
    if len(numbers) == 3:
        seconds += 3600 * numbers[0]
    return days * 86400 + seconds


def read_process(pid):
    result = subprocess.run(
        ["/bin/ps", "-p", str(pid), "-o", "lstart=", "-o", "time=", "-o", "rss="],
        check=False, capture_output=True, text=True,
        env={**os.environ, "LC_ALL": "C"}, timeout=5,
    )
    if result.returncode or not result.stdout.strip():
        raise RuntimeError("Target process exited or ps could not read it")
    fields = result.stdout.split()
    if len(fields) != 7:
        raise ValueError("Unexpected Darwin ps process record")
    rss = int(fields[-1])
    if rss < 0:
        raise ValueError("Invalid resident memory")
    return {"identity": " ".join(fields[:5]), "cpu_seconds": cpu_seconds(fields[-2]),
            "rss_bytes": rss * 1024}


def measure(pid, duration, interval, reader=read_process, clock=time.monotonic, sleeper=time.sleep):
    start = clock()
    first = reader(pid)
    samples = [{"elapsed_seconds": 0.0, **first}]
    status = "completed"
    error = None
    while clock() - start < duration:
        sleeper(min(interval, max(0, duration - (clock() - start))))
        try:
            sample = reader(pid)
            if sample["identity"] != first["identity"]:
                raise RuntimeError("PID was reused; replacement process was not measured")
            if sample["cpu_seconds"] < samples[-1]["cpu_seconds"]:
                raise RuntimeError("Process CPU counter went backwards")
        except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as exc:
            status, error = "incomplete", str(exc)
            break
        samples.append({"elapsed_seconds": clock() - start, **sample})
    elapsed = samples[-1]["elapsed_seconds"]
    cpu = samples[-1]["cpu_seconds"] - first["cpu_seconds"]
    return {"status": status, "error": error, "requested_seconds": duration,
            "observed_seconds": elapsed, "cpu_seconds": cpu,
            "mean_cpu_percent_one_core": 100 * cpu / elapsed if elapsed > 0 else None,
            "peak_sampled_rss_bytes": max(s["rss_bytes"] for s in samples),
            "samples": samples, "scope": "target PID only; child encoders excluded",
            "energy": {"status": "unmeasured", "reason": "Use Instruments Energy Log on the actual Mac"}}


def logical_size(path):
    """Logical bytes; symlinks excluded so bundles cannot traverse user folders."""
    if path.is_symlink():
        raise ValueError("Measurement root must not be a symlink")
    if path.is_file():
        return path.stat().st_size
    if not path.is_dir():
        raise ValueError(f"Missing measurement path: {path}")
    return sum(p.stat().st_size for p in path.rglob("*") if not p.is_symlink() and p.is_file())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--label", required=True, help="idle / playback / minimized / synthesis / export")
    parser.add_argument("--commit", required=True, help="Exact tested source revision")
    parser.add_argument("--notes", default="", help="Resolution, scene, audio mode and device conditions")
    parser.add_argument("--seconds", type=float, default=60)
    parser.add_argument("--interval", type=float, default=1)
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--dmg", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("Real workload measurements require macOS; Linux tests are not Mac acceptance")
    if args.pid <= 0 or not all(math.isfinite(v) and v > 0 for v in (args.seconds, args.interval)):
        parser.error("PID, duration and interval must be positive and finite")
    try:
        sizes = {"app_logical_bytes": logical_size(args.app)}
        for section in ("MacOS", "Resources", "Frameworks"):
            folder = args.app / "Contents" / section
            if folder.exists():
                sizes[section.lower() + "_logical_bytes"] = logical_size(folder)
        if args.dmg:
            sizes["dmg_bytes"] = logical_size(args.dmg)
        report = {"schema": 1, "platform": platform.platform(), "machine": platform.machine(),
                  "commit": args.commit, "label": args.label, "notes": args.notes,
                  "pid": args.pid, "sizes": sizes,
                  "measurement": measure(args.pid, args.seconds, args.interval)}
        # Exclusive creation: never replace an earlier measurement or project.
        with args.output.open("x", encoding="utf-8") as output:
            json.dump(report, output, indent=2, allow_nan=False)
            output.write("\n")
        return 0 if report["measurement"]["status"] == "completed" else 2
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        parser.exit(2, f"Measurement failed: {exc}\n")


if __name__ == "__main__":
    sys.exit(main())
