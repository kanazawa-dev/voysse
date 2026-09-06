import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("monitor", Path(__file__).parents[1] / "check-services.py")
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


def healthy():
    return [{"Service": service, "State": "running", "Health": "healthy"}
            for service in monitor.REQUIRED]


class ServiceMonitorTests(unittest.TestCase):
    def test_array_and_json_lines(self):
        rows = healthy()
        self.assertEqual(monitor.parse_services(json.dumps(rows)), rows)
        self.assertEqual(monitor.parse_services("\n".join(map(json.dumps, rows))), rows)
        self.assertEqual(monitor.parse_services(json.dumps(rows[0])), rows[:1])

    def test_invalid_inventory(self):
        for raw in ("null", "42", '["bad"]', "bad output"):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                monitor.parse_services(raw)

    def test_missing_stopped_and_unprobed(self):
        self.assertEqual(monitor.failures(healthy()), [])
        for service in monitor.REQUIRED:
            rows = [row for row in healthy() if row["Service"] != service]
            self.assertIn(f"{service}:missing", monitor.failures(rows))
            rows.append({"Service": service, "State": "exited"})
            self.assertIn(f"{service}:not_running", monitor.failures(rows))
        for health in ("", "starting", "unhealthy", None):
            rows = healthy() + [{"Service": "api", "State": "running", "Health": health}]
            self.assertIn("api:not_healthy", monitor.failures(rows))

    def test_social_is_explicit(self):
        self.assertEqual(monitor.failures(healthy(), True), ["social-worker:missing"])
        self.assertEqual(monitor.failures(healthy(), False), [])

    def test_proxy_only_requires_running(self):
        rows = healthy()
        next(row for row in rows if row["Service"] == "proxy").pop("Health")
        self.assertEqual(monitor.failures(rows), [])

    def run_main(self, result=None, error=None, env=None, delivery_error=None):
        output = io.StringIO()
        with patch.dict(os.environ, env or {}, clear=True), \
             patch.object(monitor.subprocess, "run", return_value=result, side_effect=error) as run, \
             patch.object(monitor, "notify", side_effect=delivery_error) as notify, \
             contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            code = monitor.main()
        return code, output.getvalue(), run, notify

    def test_healthy_does_not_alert(self):
        code, _, run, notify = self.run_main(Mock(stdout=json.dumps(healthy())))
        self.assertEqual(code, 0)
        self.assertIn("--all", run.call_args.args[0])
        self.assertEqual(run.call_args.kwargs["timeout"], 30)
        notify.assert_not_called()

    def test_inventory_errors_are_alertable_and_redacted(self):
        for error in (OSError("secret"), subprocess.TimeoutExpired("secret", 30), ValueError("secret")):
            code, output, _, notify = self.run_main(error=error, env={"VOYSSE_ALERT_WEBHOOK_URL": "https://receiver.test/secret"})
            self.assertEqual(code, 1)
            self.assertNotIn("secret", output)
            notify.assert_called_once_with("https://receiver.test/secret", ["inventory:unavailable"])

    def test_no_receiver_and_failed_delivery(self):
        code, output, _, notify = self.run_main(Mock(stdout="[]"))
        self.assertEqual(code, 1)
        self.assertIn("No alert receiver", output)
        notify.assert_not_called()
        code, output, _, _ = self.run_main(Mock(stdout="[]"), env={"VOYSSE_ALERT_WEBHOOK_URL": "secret"}, delivery_error=ValueError("secret"))
        self.assertEqual(code, 2)
        self.assertNotIn("secret", output)

    def test_invalid_config_fails_closed(self):
        code, _, run, _ = self.run_main(env={"VOYSSE_MONITOR_SOCIAL": "treu"})
        self.assertEqual(code, 2)
        run.assert_not_called()

    def test_https_contract_and_no_redirects(self):
        response = Mock(status=202)
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        opener = Mock()
        opener.open.return_value = response
        with patch.object(monitor, "build_opener", return_value=opener):
            monitor.notify("https://receiver.test/private", ["api:missing"])
        request = opener.open.call_args.args[0]
        self.assertEqual(json.loads(request.data), {"status": "unhealthy", "problems": ["api:missing"]})
        self.assertEqual(opener.open.call_args.kwargs["timeout"], 10)
        self.assertIsNone(monitor.NoRedirect().redirect_request(None, None, 302, None, None, "https://other.test"))
        for url in ("http://receiver.test", "https://user:pass@receiver.test", "https://receiver.test/#secret"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                monitor.notify(url, [])


if __name__ == "__main__":
    unittest.main()
