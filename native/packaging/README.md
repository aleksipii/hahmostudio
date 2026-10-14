# Native Koeta macOS bundle

Requires Python 3.11+ and the repository's Rust toolchain. On Apple Silicon Mac:

```sh
rustup target add aarch64-apple-darwin
python3 native/scripts/package-macos.py --build --output /tmp/Koeta-native.app
open /tmp/Koeta-native.app
```

Use a fresh output location on each invocation. Existing apps, symlinks and disk
images are deliberately preserved rather than replaced. The script does not
install into `/Applications`, remove Electron, modify projects or ship Kokoro
models/user recordings. Native bundle ID is `fi.hahmostudio.native`, separate
from Electron's `fi.hahmostudio.desktop`. Existing native data remains at
`~/Library/Application Support/hahmostudio` (or `HAHMOSTUDIO_DATA_DIR` override).

An existing native Mac binary can be assembled with `--binary PATH`. Apple
Silicon is the default; `--target x86_64-apple-darwin` builds Intel on a Mac with
that Rust target installed. `--binary` copies the supplied executable without
claiming it is a compatible Mach-O binary; Linux use is fixture validation only.

Optional macOS arguments:

```sh
python3 native/scripts/package-macos.py --build \
  --output /tmp/Koeta-signed.app \
  --signing-identity 'YOUR INSTALLED SIGNING IDENTITY' \
  --dmg /tmp/Koeta-signed.dmg
```

A supplied identity signs the assembled app and runs strict codesign verification.
Signing now enables hardened runtime and camera/audio-input entitlements.
Actual Gatekeeper acceptance still requires a real Mac.
Unsigned assembly remains unsigned. No quarantine removal or OS security bypass
is performed. DMG creation and image verification use macOS hdiutil. If image
creation fails after app assembly, the completed app is retained.

The `.koeta` association and local camera/microphone descriptions are declared
in Info.plist. File-open delivery by Finder is a separate runtime integration;
association metadata alone does not prove it works. Verify on a real Mac:
launch, Metal viewport, permission grant/denial, simultaneous camera and mic,
real Kokoro playback, `.koeta` opening from Finder and export with audio.

Linux fixture tests (not real Mac validation):

```sh
python3 -m unittest discover -s native/packaging/tests -v
```

Public release requirements and remaining work: [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

## Self-contained media tools and trusted distribution

Supply executable FFmpeg and FFprobe binaries and their distribution license:

```sh
python3 native/scripts/package-macos.py --build --output /tmp/Koeta-release.app \
  --ffmpeg /path/to/ffmpeg --ffprobe /path/to/ffprobe \
  --tool-license /path/to/LICENSE.txt --icon /path/to/Koeta.icns \
  --minimum-macos 13.0 --signing-identity 'INSTALLED DEVELOPER ID' \
  --notary-profile 'EXISTING KEYCHAIN PROFILE' --dmg /tmp/Koeta-release.dmg
```

The Mac packager checks media-tool architectures and rejects non-system dylib
links. Supply tools built for the app architectures and required codecs; no
FFmpeg binaries are downloaded automatically. The runtime finds them under
Contents/Resources/tools, independently of Finder's PATH. Explicit environment
overrides still take priority. Include all applicable distribution licenses.
The configured minimum macOS version must be verified against the built app
and its dependencies; the default metadata is not an actual compatibility test.

Signing covers nested media tools before the app. With --notary-profile, the
app archive is submitted, stapled and validated before publication, then the
DMG is signed, submitted, stapled and validated. The installer includes an
Applications shortcut. Profile credentials belong in the existing Mac keychain.
Linux tests use mocked Apple commands and cannot verify signing or notarization.
Finder Apple-event delivery is implemented with a bounded queue and project replacement confirmation.
Run `python3 scripts/check-finder-cross.py` after installing the Apple Rust target
for an isolated Cocoa bridge type check. Fresh-start and running-app Finder
delivery still require real Mac tests; this check does not build the full Mac app.

## Retained app branding

The existing ICNS, iconset and original logo are retained in
`native/packaging/icons/` after removal of the Electron shell. Pass
`--icon native/packaging/icons/Hahmostudio.icns` when packaging from the repository root.
The optional `scripts/create-app-icon.py` tool needs Pillow only for regeneration.

## Private-use acceptance and repeatable measurements

Complete the feature work first, then test the actual release app on your Mac.
For this personal-use phase, Developer ID signing and notarization are separate
public-distribution tasks. Keep the operating system's protection settings.
The device, Finder, real Kokoro and standalone MP4 checks in
[RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) still require real Mac runs.

A stdlib-only, read-only sampler can measure an already running release app;
it does not launch the app or request microphone/camera access:

```sh
python3 native/packaging/measure_macos.py \
  --pid 12345 --label playback --seconds 60 --interval 1 \
  --commit EXACT_SOURCE_SHA --notes '1920x1080; production pilot; real Kokoro' \
  --app /Applications/Koeta.app --dmg /path/to/Koeta.dmg \
  --output /path/to/playback-measurement.json
```

Find the app's PID in Activity Monitor. Collect separate `idle`, `playback`,
`minimized`, `synthesis` and `export` reports while performing those workloads.
Record the scene, resolution, audio mode and device conditions in `--notes`.
No output file is overwritten. If the app exits or its PID changes, the saved
partial report has `status: incomplete` and the command exits with code 2.

CPU uses the change in the process's accumulated CPU time over the measurement
window, relative to one CPU core (therefore values may exceed 100%). Memory is
sampled resident memory, **not** a guaranteed allocation peak. The report
measures the selected PID only: FFmpeg child-process usage needs a separate
measurement while it runs. Bundle sizes are logical file bytes, with symlinks
excluded, and separate MacOS/Resources/Frameworks totals; the downloaded Kokoro
model is outside the app and must be counted separately. Energy is explicitly
`unmeasured`; use Instruments Energy Log on the same Mac instead of deriving an
energy figure from CPU. Startup latency, GPU frame times and actual sound/image
quality need their own checks. Python parser and mock tests on Linux do not
constitute a Mac measurement or acceptance.
