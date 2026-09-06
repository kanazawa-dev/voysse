"""Exercise the real HTTPS transport against an isolated local receiver."""
import json
import contextlib
import io
import os
from pathlib import Path
import ssl
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from test_check_services import healthy, monitor


class MonitorTransportTests(unittest.TestCase):
    def test_actual_https_delivery_and_redirect_rejection(self):
        received = []

        class Receiver(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append((self.path, json.loads(self.rfile.read(int(self.headers["Content-Length"])))))
                self.send_response(302 if self.path == "/redirect" else 204)
                if self.path == "/redirect":
                    self.send_header("Location", "/leaked")
                self.end_headers()

            def log_message(self, *args):
                pass

        with tempfile.TemporaryDirectory() as directory:
            cert, key = (str(Path(directory) / name) for name in ("cert.pem", "key.pem"))
            subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                            "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost",
                            "-addext", "subjectAltName=DNS:localhost"],
                           check=True, capture_output=True, timeout=30)
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(cert, key)
            server = ThreadingHTTPServer(("127.0.0.1", 0), Receiver)
            server.socket = context.wrap_socket(server.socket, server_side=True)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with patch.dict(os.environ, {"SSL_CERT_FILE": cert, "NO_PROXY": "localhost"}):
                    base = f"https://localhost:{server.server_port}"
                    monitor.notify(base + "/alert", ["proxy:not_running"])
                    with self.assertRaises(HTTPError) as redirect:
                        monitor.notify(base + "/redirect", ["api:missing"])
                    self.assertEqual(redirect.exception.code, 302)
                    with patch.dict(os.environ, {
                        "VOYSSE_MONITOR_BACKUP": "true", "VOYSSE_BACKUP_ID": "fixture",
                        "VOYSSE_MONITOR_SOCIAL": "false", "VOYSSE_BACKUP_MAX_AGE_HOURS": "26",
                        "VOYSSE_ALERT_WEBHOOK_URL": base + "/backup",
                    }), patch.object(monitor, "ROOT", Path(directory)), \
                         patch.object(monitor.subprocess, "run", return_value=Mock(stdout=json.dumps(healthy()))), \
                         contextlib.redirect_stderr(io.StringIO()):
                        self.assertEqual(monitor.main(), 1)
                self.assertEqual(received, [
                    ("/alert", {"status": "unhealthy", "problems": ["proxy:not_running"]}),
                    ("/redirect", {"status": "unhealthy", "problems": ["api:missing"]}),
                    ("/backup", {"status": "unhealthy", "problems": ["backup:missing"]}),
                ])
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)
