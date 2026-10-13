import importlib.util
import os
from pathlib import Path
import plistlib
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/package-macos.py"
spec = importlib.util.spec_from_file_location("package_macos", SCRIPT)
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.binary = self.root / "fixture"
        self.binary.write_bytes(b"fixture, not a macOS binary")
        self.binary.chmod(0o750)
        self.app = self.root / "Koeta.app"

    def test_bundle_metadata_binary_and_permissions(self):
        package.assemble(self.binary, self.app, "0.1.0")
        with (self.app / "Contents/Info.plist").open("rb") as stream:
            info = plistlib.load(stream)
        self.assertEqual(info["CFBundleIdentifier"], "fi.hahmostudio.native")
        self.assertNotEqual(info["CFBundleIdentifier"], "fi.hahmostudio.desktop")
        self.assertTrue(info["NSCameraUsageDescription"])
        self.assertTrue(info["NSMicrophoneUsageDescription"])
        self.assertEqual(info["CFBundleDocumentTypes"][0]["CFBundleTypeExtensions"], ["koeta"])
        executable = self.app / "Contents/MacOS/hs-app"
        self.assertEqual(executable.read_bytes(), self.binary.read_bytes())
        self.assertTrue(os.access(executable, os.X_OK))
        self.assertEqual(sorted(p.name for p in self.app.iterdir()), ["Contents"])

    def test_existing_app_is_preserved(self):
        self.app.mkdir()
        marker = self.app / "user-file"
        marker.write_text("keep")
        with self.assertRaises(FileExistsError):
            package.assemble(self.binary, self.app, "0.1.0")
        self.assertEqual(marker.read_text(), "keep")

    def test_failed_copy_leaves_no_partial_app(self):
        with patch.object(package.shutil, "copy2", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                package.assemble(self.binary, self.app, "0.1.0")
        self.assertFalse(self.app.exists())
        self.assertFalse(list(self.root.glob("koeta-package-*")))

    def test_symlink_destination_preserved(self):
        self.app.symlink_to(self.root / "missing", target_is_directory=True)
        with self.assertRaises(FileExistsError):
            package.assemble(self.binary, self.app, "0.1.0")
        self.assertTrue(self.app.is_symlink())

    def test_signing_failure_does_not_publish(self):
        with patch.object(package.sys, "platform", "darwin"), patch.object(package, "run", side_effect=OSError("sign failure")):
            with self.assertRaises(OSError):
                package.assemble(self.binary, self.app, "0.1.0", signing_identity="Test")
        self.assertFalse(self.app.exists())

    def test_bundled_tools_and_license_are_portable(self):
        license_file = self.root / "LICENSE.txt"
        license_file.write_text("Test fixture license")
        package.assemble(self.binary, self.app, "0.1.0", ffmpeg=self.binary,
                         ffprobe=self.binary, tool_license=license_file)
        tools = self.app / "Contents/Resources/tools"
        self.assertTrue(os.access(tools / "ffmpeg", os.X_OK))
        self.assertEqual((tools / "ffprobe").read_bytes(), self.binary.read_bytes())
        self.assertEqual((tools / "LICENSE.txt").read_text(), "Test fixture license")

    def test_incomplete_media_tools_leave_no_app(self):
        with self.assertRaises(ValueError):
            package.assemble(self.binary, self.app, "0.1.0", ffmpeg=self.binary)
        self.assertFalse(self.app.exists())

    def test_notarization_requires_mac_identity(self):
        with self.assertRaises(ValueError):
            package.assemble(self.binary, self.app, "0.1.0", notary_profile="fixture")
        self.assertFalse(self.app.exists())

    def test_signed_notarized_installer_sequence(self):
        calls = []
        def fake_run(*args):
            calls.append(args)
            if args[:2] == ("hdiutil", "create"):
                folder = Path(args[args.index("-srcfolder") + 1])
                self.assertTrue((folder / "Applications").is_symlink())
                self.assertTrue((folder / self.app.name).is_dir())
                Path(args[-1]).write_bytes(b"fixture image")
            if "--entitlements" in args:
                with Path(args[args.index("--entitlements") + 1]).open("rb") as f:
                    self.assertTrue(plistlib.load(f)["com.apple.security.device.audio-input"])
        dmg = self.root / "Koeta.dmg"
        with patch.object(package.sys, "platform", "darwin"), patch.object(package, "run", side_effect=fake_run):
            package.assemble(self.binary, self.app, "0.1.0", signing_identity="fixture", dmg=dmg, notary_profile="fixture-profile")
        self.assertTrue(dmg.is_file())
        self.assertEqual(sum("notarytool" in a and "submit" in a for a in calls), 2)
        self.assertEqual(sum("stapler" in a and "validate" in a for a in calls), 2)
        self.assertTrue(any("--options" in a and "runtime" in a for a in calls))

    def test_non_executable_rejected(self):
        self.binary.chmod(0o600)
        with self.assertRaises(ValueError):
            package.assemble(self.binary, self.app, "0.1.0")


if __name__ == "__main__":
    unittest.main()
