"""Backup freshness is opt-in, deployment-bound, read-only and fail closed."""
import contextlib
from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

from test_check_services import healthy, monitor


class BackupMonitorTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.marker = root / "backups/full-backup-success.json"
        self.marker.parent.mkdir()
        self.root_patch = patch.object(monitor, "ROOT", root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.now = datetime(2026, 9, 6, tzinfo=timezone.utc)
        self.data = {"deployment": "fixture", "snapshot_id": "a" * 64,
                     "completed_at": self.now.isoformat()}

    def write(self, **changes):
        self.marker.write_text(json.dumps(self.data | changes))

    def check(self):
        return monitor.backup_failures("fixture", 26, self.now)

    def test_fresh_boundary_stale_and_future(self):
        for seconds, expected in [(0, []), (26 * 3600, []),
                                  (26 * 3600 + 1, ["backup:stale"]),
                                  (-1, ["backup:future_timestamp"])]:
            with self.subTest(seconds=seconds):
                self.write(completed_at=(self.now - timedelta(seconds=seconds)).isoformat())
                before = self.marker.read_bytes()
                self.assertEqual(self.check(), expected)
                self.assertEqual(self.marker.read_bytes(), before)
        self.write(completed_at="2026-09-05T20:00:00-04:00")
        self.assertEqual(self.check(), [])

    def test_missing_wrong_deployment_and_invalid_marker(self):
        self.assertEqual(self.check(), ["backup:missing"])
        self.write(deployment="another")
        self.assertEqual(self.check(), ["backup:deployment_mismatch"])
        for changes in [{"snapshot_id": None}, {"snapshot_id": "secret"},
                        {"completed_at": "2026-09-06T00:00:00"},
                        {"completed_at": "invalid"}, {"completed_at": None}]:
            self.write(**changes)
            self.assertEqual(self.check(), ["backup:invalid_marker"])
        for raw in [b"null", b"[]", b"{", b"\xff", b"x" * 4097,
                    b"[" * 2000 + b"]" * 2000]:
            self.marker.write_bytes(raw)
            self.assertEqual(self.check(), ["backup:invalid_marker"])
        self.marker.write_text(json.dumps({"deployment": "fixture", "snapshot_id": "a" * 64}))
        self.assertEqual(self.check(), ["backup:invalid_marker"])
        self.marker.unlink()
        self.marker.mkdir()
        self.assertEqual(self.check(), ["backup:invalid_marker"])

    def run_main(self, env=None, inventory_error=None, delivery_error=None):
        output = io.StringIO()
        values = {"VOYSSE_MONITOR_BACKUP": "true", "VOYSSE_BACKUP_ID": "fixture"}
        with patch.dict(os.environ, values | (env or {}), clear=True), \
             patch.object(monitor.subprocess, "run", return_value=Mock(stdout=json.dumps(healthy())),
                          side_effect=inventory_error) as run, \
             patch.object(monitor, "notify", side_effect=delivery_error) as notify, \
             contextlib.redirect_stderr(output), contextlib.redirect_stdout(output):
            code = monitor.main()
        return code, output.getvalue(), run, notify

    def test_missing_alert_and_inventory_error_combine_without_private_data(self):
        code, output, _, notify = self.run_main(
            {"VOYSSE_ALERT_WEBHOOK_URL": "https://receiver.test/secret"},
            subprocess.TimeoutExpired("secret", 30))
        self.assertEqual(code, 1)
        notify.assert_called_once_with("https://receiver.test/secret",
                                      ["inventory:unavailable", "backup:missing"])
        self.assertNotIn("secret", output)

    def test_disabled_no_receiver_and_delivery_failure(self):
        code, _, _, notify = self.run_main({"VOYSSE_MONITOR_BACKUP": "false"})
        self.assertEqual(code, 0)
        notify.assert_not_called()
        code, _, _, notify = self.run_main()
        self.assertEqual(code, 1)
        notify.assert_not_called()
        code, output, _, _ = self.run_main(
            {"VOYSSE_ALERT_WEBHOOK_URL": "secret"}, delivery_error=ValueError("secret"))
        self.assertEqual(code, 2)
        self.assertNotIn("secret", output)

    def test_invalid_config_prevents_inventory_or_delivery(self):
        for env in [{"VOYSSE_MONITOR_BACKUP": "yes"}, {"VOYSSE_BACKUP_ID": ""},
                    {"VOYSSE_BACKUP_ID": "secret/bad"}] + [
                        {"VOYSSE_BACKUP_MAX_AGE_HOURS": value}
                        for value in ["0", "-1", "1.5", "NaN", "8761", "", "9" * 5000]]:
            with self.subTest(env=env):
                code, output, run, notify = self.run_main(env)
                self.assertEqual(code, 2)
                self.assertNotIn("secret", output)
                run.assert_not_called()
                notify.assert_not_called()

    def test_fresh_marker_does_not_alert(self):
        self.write(completed_at=datetime.now(timezone.utc).isoformat())
        code, _, run, notify = self.run_main()
        self.assertEqual(code, 0)
        self.assertEqual(run.call_count, 1)  # Only read-only Compose inventory.
        notify.assert_not_called()
