#!/usr/bin/env python3
"""Assemble the native Koeta app without modifying installed apps or user data."""
import argparse
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile
import tomllib

NATIVE = Path(__file__).resolve().parents[1]
BUNDLE_ID = "fi.hahmostudio.native"


def run(*args):
    subprocess.run(args, check=True)


def assemble(binary, output, version, signing_identity=None, dmg=None):
    binary = Path(binary).resolve(strict=True)
    output = Path(output).absolute()
    if not binary.is_file() or not os.access(binary, os.X_OK):
        raise ValueError("--binary must be an executable file")
    if output.suffix != ".app":
        raise ValueError("--output must end in .app")
    if output.exists() or output.is_symlink():
        raise FileExistsError(f"Preserving existing output: {output}; choose a new output")
    if signing_identity or dmg:
        if sys.platform != "darwin":
            raise ValueError("Signing and DMG creation require macOS")
    if dmg:
        dmg = Path(dmg).absolute()
        if dmg.exists() or dmg.is_symlink():
            raise FileExistsError(f"Preserving existing DMG: {dmg}")
        dmg.parent.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="koeta-package-", dir=output.parent) as tmp:
        bundle = Path(tmp) / output.name
        contents = bundle / "Contents"
        (contents / "MacOS").mkdir(parents=True)
        (contents / "Resources").mkdir()
        executable = contents / "MacOS" / "hs-app"
        shutil.copy2(binary, executable)
        executable.chmod(executable.stat().st_mode | 0o111)
        info = {
            "CFBundleName": "Koeta", "CFBundleDisplayName": "Koeta",
            "CFBundleIdentifier": BUNDLE_ID, "CFBundleExecutable": "hs-app",
            "CFBundlePackageType": "APPL", "CFBundleVersion": version,
            "CFBundleShortVersionString": version,
            "LSApplicationCategoryType": "public.app-category.graphics-design",
            "NSHighResolutionCapable": True,
            "NSCameraUsageDescription": "Koeta uses the camera for local character performance when you start it.",
            "NSMicrophoneUsageDescription": "Koeta uses the microphone for local speech recording and lip sync when you start it.",
            "CFBundleDocumentTypes": [{"CFBundleTypeName": "Koeta series project",
                "CFBundleTypeRole": "Editor", "LSHandlerRank": "Alternate",
                "CFBundleTypeExtensions": ["koeta"],
                "LSItemContentTypes": ["fi.hahmostudio.native.project"]}],
            "UTExportedTypeDeclarations": [{"UTTypeIdentifier": "fi.hahmostudio.native.project",
                "UTTypeDescription": "Koeta series project", "UTTypeConformsTo": ["public.data"],
                "UTTypeTagSpecification": {"public.filename-extension": ["koeta"]}}],
        }
        with (contents / "Info.plist").open("wb") as stream:
            plistlib.dump(info, stream)
        if signing_identity:
            run("codesign", "--sign", signing_identity, "--timestamp", str(bundle))
            run("codesign", "--verify", "--strict", "--verbose=2", str(bundle))
        # Rename into a fresh destination; never recursively delete an existing app.
        if output.exists() or output.is_symlink():
            raise FileExistsError(f"Output appeared during packaging: {output}")
        bundle.rename(output)
    if dmg:
        with tempfile.TemporaryDirectory(prefix="koeta-dmg-", dir=dmg.parent) as tmp:
            image = Path(tmp) / "Koeta.dmg"
            run("hdiutil", "create", "-volname", "Koeta", "-srcfolder", str(output),
                "-format", "UDZO", str(image))
            run("hdiutil", "verify", str(image))
            if dmg.exists() or dmg.is_symlink():
                raise FileExistsError(f"DMG appeared during packaging: {dmg}")
            image.rename(dmg)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--binary", type=Path, help="existing macOS hs-app; fixture files allowed for assembly tests")
    source.add_argument("--build", action="store_true", help="build locked release binary on macOS")
    parser.add_argument("--target", choices=["aarch64-apple-darwin", "x86_64-apple-darwin"], default="aarch64-apple-darwin")
    parser.add_argument("--output", type=Path, default=NATIVE / "release" / "Koeta.app")
    parser.add_argument("--signing-identity")
    parser.add_argument("--dmg", type=Path)
    args = parser.parse_args()
    try:
        if args.build:
            if sys.platform != "darwin":
                raise ValueError("--build requires a macOS machine; Linux assembly is fixture validation only")
            subprocess.run(["cargo", "build", "--locked", "--release", "--target", args.target,
                            "-p", "hs-app"], cwd=NATIVE, check=True)
            metadata = subprocess.check_output(["cargo", "metadata", "--locked", "--no-deps", "--format-version", "1"], cwd=NATIVE)
            import json
            args.binary = Path(json.loads(metadata)["target_directory"]) / args.target / "release" / "hahmostudio"
        with (NATIVE / "Cargo.toml").open("rb") as stream:
            version = tomllib.load(stream)["workspace"]["package"]["version"]
        app = assemble(args.binary, args.output, version, args.signing_identity, args.dmg)
        print(f"Assembled {app}. macOS launch, device permissions and Gatekeeper acceptance need real Mac verification.")
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Packaging failed: {error}\n")


if __name__ == "__main__":
    main()
