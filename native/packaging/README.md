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
This is not notarization, hardened-runtime certification, or Gatekeeper approval.
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
