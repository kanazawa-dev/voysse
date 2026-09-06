#!/usr/bin/env python3
"""Read-only Compose watchdog. Run on the host, not inside an application worker."""
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {"db", "api", "web", "whatsapp", "whatsapp-cloud-worker", "whatsapp-qr-worker", "proxy"}
PROBED = REQUIRED - {"proxy"} | {"social-worker"}


def parse_services(raw):
    # Compose releases emit either a JSON array or one JSON object per line.
    try:
        rows = json.loads(raw)
    except ValueError:
        rows = [json.loads(line) for line in raw.splitlines() if line.strip()]
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError("Invalid service inventory")
    return rows


def failures(rows, social=False):
    expected = REQUIRED | ({"social-worker"} if social else set())
    problems = []
    for service in sorted(expected):
        replicas = [row for row in rows if row.get("Service") == service]
        if not replicas:
            problems.append(f"{service}:missing")
        elif any(row.get("State") != "running" for row in replicas):
            problems.append(f"{service}:not_running")
        elif service in PROBED and any(row.get("Health") != "healthy" for row in replicas):
            problems.append(f"{service}:not_healthy")
    return problems


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def notify(url, problems):
    target = urlsplit(url)
    if target.scheme != "https" or not target.hostname or target.username or target.password or target.fragment:
        raise ValueError("Webhook requires HTTPS without userinfo or fragment")
    # Generic receiver contract; never include logs, env, names, or raw Docker output.
    body = json.dumps({"status": "unhealthy", "problems": problems}).encode()
    request = Request(url, body, {"Content-Type": "application/json"}, method="POST")
    with build_opener(NoRedirect()).open(request, timeout=10) as response:
        if not 200 <= response.status < 300:
            raise ValueError("Alert was not accepted")


def main():
    social = os.getenv("VOYSSE_MONITOR_SOCIAL", "false")
    if social not in ("true", "false"):
        print("Invalid VOYSSE_MONITOR_SOCIAL; use true or false", file=sys.stderr)
        return 2
    try:
        result = subprocess.run(
            ["docker", "compose", "--env-file", ".env.docker", "--profile", "social",
             "ps", "--all", "--format", "json"],
            cwd=ROOT, capture_output=True, text=True, check=True, timeout=30,
        )
        problems = failures(parse_services(result.stdout), social == "true")
    except (OSError, ValueError, subprocess.SubprocessError):
        problems = ["inventory:unavailable"]
    if not problems:
        print("Expected services are running; configured probes are healthy")
        return 0
    print("Service check failed: " + ", ".join(problems), file=sys.stderr)
    webhook = os.getenv("VOYSSE_ALERT_WEBHOOK_URL")
    if webhook:
        try:
            notify(webhook, problems)
        except Exception:
            # Transport exceptions can contain the secret webhook URL.
            print("Alert delivery failed; check the receiver privately", file=sys.stderr)
            return 2
        print("Alert accepted by receiver", file=sys.stderr)
    else:
        print("No alert receiver configured", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
