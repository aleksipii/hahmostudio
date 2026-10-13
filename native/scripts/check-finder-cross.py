#!/usr/bin/env python3
"""Typecheck only the Cocoa file-open bridge; this is not a Mac app/hardware test."""
import argparse
from pathlib import Path
import subprocess
import tempfile
import tomllib


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=["aarch64-apple-darwin", "x86_64-apple-darwin"], default="aarch64-apple-darwin")
    args = parser.parse_args()
    native = Path(__file__).resolve().parents[1]
    with (native / "crates/hs-app/Cargo.toml").open("rb") as stream:
        dependencies = tomllib.load(stream)["target"]['cfg(target_os = "macos")']["dependencies"]
    lines = ['[package]', 'name = "koeta-finder-check"', 'version = "0.1.0"', 'edition = "2021"', '[dependencies]']
    import json
    for name, value in dependencies.items():
        if isinstance(value, str):
            lines.append(f"{name} = {json.dumps(value)}")
        else:
            features = ', '.join(json.dumps(f) for f in value["features"])
            lines.append(f'{name} = {{ version = {json.dumps(value["version"])}, default-features = false, features = [{features}] }}')
    with tempfile.TemporaryDirectory(prefix="koeta-finder-check-") as folder:
        root = Path(folder)
        (root / "src").mkdir()
        (root / "Cargo.toml").write_text('\n'.join(lines) + '\n')
        modules = []
        for module in ["file_open", "finder_macos"]:
            source = native / f"crates/hs-app/src/{module}.rs"
            modules.append(f'#[path = {json.dumps(str(source))}] pub mod {module};')
        (root / "src/lib.rs").write_text('\n'.join(modules) + '\n')
        subprocess.run(["cargo", "check", "--manifest-path", str(root / "Cargo.toml"), "--target", args.target], check=True)
    print("Cocoa bridge typechecked. Full app build, Finder launch and permissions require a real Mac.")


if __name__ == "__main__":
    main()
