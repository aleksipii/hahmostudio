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


def assemble(binary, output, version, signing_identity=None, dmg=None, *, ffmpeg=None, ffprobe=None, tool_license=None, icon=None, minimum_macos="13.0", notary_profile=None):
    if bool(ffmpeg) != bool(ffprobe) or (ffmpeg and not tool_license):
        raise ValueError("Supply both --ffmpeg and --ffprobe plus --tool-license")
    if notary_profile and (not signing_identity or sys.platform != "darwin"):
        raise ValueError("Notarization requires macOS and a signing identity")
    for tool in [ffmpeg, ffprobe]:
        if tool and (not Path(tool).is_file() or not os.access(tool, os.X_OK)):
            raise ValueError("Media tools must be executable files")
    if tool_license and (not Path(tool_license).is_file() or Path(tool_license).stat().st_size > 1024 * 1024):
        raise ValueError("Supply a local license file of at most 1 MiB")
    if icon and (not Path(icon).is_file() or Path(icon).read_bytes()[:4] != b"icns"):
        raise ValueError("--icon must be an ICNS file")
    if not minimum_macos or any(c not in "0123456789." for c in minimum_macos):
        raise ValueError("Invalid minimum macOS version")
    binary = Path(binary).resolve(strict=True)
    if ffmpeg and sys.platform == "darwin":
        app_arches = set(subprocess.check_output(["lipo", "-archs", str(binary)], text=True).split())
        for tool in [ffmpeg, ffprobe]:
            arches = set(subprocess.check_output(["lipo", "-archs", str(tool)], text=True).split())
            if not app_arches.issubset(arches):
                raise ValueError("Media tool architecture does not cover the app architecture")
            libraries = subprocess.check_output(["otool", "-L", str(tool)], text=True).splitlines()[1:]
            if any(not line.strip().split(" (", 1)[0].startswith(("/usr/lib/", "/System/Library/")) for line in libraries):
                raise ValueError("Media tools must use only system libraries; bundle-linked dylibs are not supported")
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
            "LSMinimumSystemVersion": minimum_macos,
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
        if icon:
            shutil.copy2(icon, contents / "Resources" / "Koeta.icns")
            info["CFBundleIconFile"] = "Koeta.icns"
        tools = []
        if ffmpeg:
            directory = contents / "Resources" / "tools"
            directory.mkdir()
            for name, source in [("ffmpeg", ffmpeg), ("ffprobe", ffprobe)]:
                destination = directory / name
                shutil.copy2(source, destination)
                tools.append(destination)
            shutil.copy2(tool_license, directory / "LICENSE.txt")
        with (contents / "Info.plist").open("wb") as stream:
            plistlib.dump(info, stream)
        if signing_identity:
            entitlements = Path(tmp) / "entitlements.plist"
            with entitlements.open("wb") as stream:
                plistlib.dump({"com.apple.security.device.camera": True,
                               "com.apple.security.device.audio-input": True}, stream)
            for tool in tools:
                run("codesign", "--sign", signing_identity, "--options", "runtime", "--timestamp", str(tool))
            run("codesign", "--sign", signing_identity, "--options", "runtime", "--entitlements", str(entitlements), "--timestamp", str(bundle))
            run("codesign", "--verify", "--strict", "--verbose=2", str(bundle))
        if notary_profile:
            archive = Path(tmp) / "Koeta-notary.zip"
            run("ditto", "-c", "-k", "--keepParent", str(bundle), str(archive))
            run("xcrun", "notarytool", "submit", str(archive), "--keychain-profile", notary_profile, "--wait")
            run("xcrun", "stapler", "staple", str(bundle))
            run("xcrun", "stapler", "validate", str(bundle))
        # Rename into a fresh destination; never recursively delete an existing app.
        if output.exists() or output.is_symlink():
            raise FileExistsError(f"Output appeared during packaging: {output}")
        bundle.rename(output)
    if dmg:
        with tempfile.TemporaryDirectory(prefix="koeta-dmg-", dir=dmg.parent) as tmp:
            image = Path(tmp) / "Koeta.dmg"
            installer = Path(tmp) / "installer"
            installer.mkdir()
            shutil.copytree(output, installer / output.name, symlinks=True)
            (installer / "Applications").symlink_to("/Applications", target_is_directory=True)
            run("hdiutil", "create", "-volname", "Koeta", "-srcfolder", str(installer),
                "-format", "UDZO", str(image))
            run("hdiutil", "verify", str(image))
            if signing_identity:
                run("codesign", "--sign", signing_identity, "--timestamp", str(image))
            if notary_profile:
                run("xcrun", "notarytool", "submit", str(image), "--keychain-profile", notary_profile, "--wait")
                run("xcrun", "stapler", "staple", str(image))
                run("xcrun", "stapler", "validate", str(image))
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
    parser.add_argument("--ffmpeg", type=Path)
    parser.add_argument("--ffprobe", type=Path)
    parser.add_argument("--tool-license", type=Path)
    parser.add_argument("--icon", type=Path)
    parser.add_argument("--minimum-macos", default="13.0")
    parser.add_argument("--notary-profile", help="Existing macOS keychain profile; never pass secrets")
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
        app = assemble(args.binary, args.output, version, args.signing_identity, args.dmg, ffmpeg=args.ffmpeg, ffprobe=args.ffprobe, tool_license=args.tool_license, icon=args.icon, minimum_macos=args.minimum_macos, notary_profile=args.notary_profile)
        print(f"Assembled {app}. macOS launch, device permissions and Gatekeeper acceptance need real Mac verification.")
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Packaging failed: {error}\n")


if __name__ == "__main__":
    main()
