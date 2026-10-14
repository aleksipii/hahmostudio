import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "measure_macos.py"
spec = importlib.util.spec_from_file_location("measure_macos", SCRIPT)
measure = importlib.util.module_from_spec(spec)
spec.loader.exec_module(measure)


class MeasurementTests(unittest.TestCase):
    def test_cpu_time_darwin_formats(self):
        self.assertEqual(measure.cpu_seconds("01:02.25"), 62.25)
        self.assertEqual(measure.cpu_seconds("2:01:02"), 7262)
        self.assertEqual(measure.cpu_seconds("1-02:01:02"), 93662)
        for text in ("unknown", "nan:00", "-1:00", "1:2:3:4"):
            with self.assertRaises(ValueError):
                measure.cpu_seconds(text)

    def test_cpu_delta_not_lifetime_average_and_rss_units(self):
        class Timer:
            now = 0
            def clock(self): return self.now
            def sleep(self, seconds): self.now += seconds
        timer = Timer()
        data = iter([dict(identity="same", cpu_seconds=100, rss_bytes=1000),
                     dict(identity="same", cpu_seconds=101, rss_bytes=2000),
                     dict(identity="same", cpu_seconds=104, rss_bytes=1500)])
        result = measure.measure(42, 2, 1, lambda pid: next(data), timer.clock, timer.sleep)
        self.assertEqual(result["mean_cpu_percent_one_core"], 200)
        self.assertEqual(result["peak_sampled_rss_bytes"], 2000)
        self.assertEqual(result["energy"]["status"], "unmeasured")

    def test_pid_reuse_is_incomplete_and_excludes_replacement(self):
        records = iter([dict(identity="original", cpu_seconds=3, rss_bytes=10),
                        dict(identity="new", cpu_seconds=9, rss_bytes=100)])
        result = measure.measure(42, 1, 1, lambda pid: next(records), lambda: 0, lambda _: None)
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(len(result["samples"]), 1)
        self.assertEqual(result["peak_sampled_rss_bytes"], 10)

    def test_ps_darwin_record_and_rss_conversion(self):
        class Result:
            returncode = 0
            stdout = "Mon Oct 12 10:02:01 2026 02:03.50 2048\n"
        with patch.object(measure.subprocess, "run", return_value=Result()):
            record = measure.read_process(42)
        self.assertEqual(record["cpu_seconds"], 123.5)
        self.assertEqual(record["rss_bytes"], 2097152)

    def test_size_excludes_symlink_user_data(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            app = root / "Koeta.app"
            app.mkdir()
            (app / "binary").write_bytes(b"1234")
            outside = root / "model"
            outside.write_bytes(b"123456789")
            (app / "model-link").symlink_to(outside)
            self.assertEqual(measure.logical_size(app), 4)
            with self.assertRaises(ValueError):
                measure.logical_size(app / "model-link")

    def test_non_mac_runtime_refuses_measurement(self):
        with patch.object(measure.sys, "platform", "linux"), patch.object(measure.sys, "argv", [
            "measure", "--pid", "42", "--label", "idle", "--commit", "test",
            "--app", "/missing", "--output", "/missing"]):
            with self.assertRaises(SystemExit) as result:
                measure.main()
        self.assertEqual(result.exception.code, 2)
