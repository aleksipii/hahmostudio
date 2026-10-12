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

    def test_non_executable_rejected(self):
        self.binary.chmod(0o600)
        with self.assertRaises(ValueError):
            package.assemble(self.binary, self.app, "0.1.0")


if __name__ == "__main__":
    unittest.main()
