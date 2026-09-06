#!/usr/bin/env python3
"""Read-only Compose watchdog. Run on the host, not inside an application worker."""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {"db", "api", "web", "whatsapp", "whatsapp-cloud-worker", "whatsapp-qr-worker", "proxy"}
PROBED = REQUIRED - {"proxy"} | {"social-worker"}


def backup_failures(deployment, max_hours, now=None):
    """Check local completion evidence, not remote integrity or restorability."""
    marker = ROOT / "backups/full-backup-success.json"
    try:
        with marker.open("rb") as source:
            raw = source.read(4097)
        if len(raw) > 4096:
            return ["backup:invalid_marker"]
        data = json.loads(raw)
        if not isinstance(data, dict):
            return ["backup:invalid_marker"]
        if data.get("deployment") != deployment:
            return ["backup:deployment_mismatch"]
        snapshot = data.get("snapshot_id")
        if not isinstance(snapshot, str) or not re.fullmatch(r"[0-9a-f]{8,64}", snapshot):
            return ["backup:invalid_marker"]
        completed = datetime.fromisoformat(data["completed_at"])
        if completed.tzinfo is None:
            return ["backup:invalid_marker"]
        age = ((now or datetime.now(timezone.utc)) - completed).total_seconds()
        if age < 0:
            return ["backup:future_timestamp"]
        return ["backup:stale"] if age > max_hours * 3600 else []
    except FileNotFoundError:
        return ["backup:missing"]
    except (OSError, ValueError, TypeError, KeyError, OverflowError, RecursionError):
        return ["backup:invalid_marker"]


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
    backup_enabled = os.getenv("VOYSSE_MONITOR_BACKUP", "false")
    if backup_enabled not in ("true", "false"):
        print("Invalid VOYSSE_MONITOR_BACKUP; use true or false", file=sys.stderr)
        return 2
    if backup_enabled == "true":
        deployment = os.getenv("VOYSSE_BACKUP_ID", "")
        hours = os.getenv("VOYSSE_BACKUP_MAX_AGE_HOURS", "26")
        if (not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}", deployment)
                or not re.fullmatch(r"[0-9]{1,4}", hours) or not 1 <= int(hours) <= 8760):
            print("Invalid backup monitor ID or max age (1–8760 integer hours)", file=sys.stderr)
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
    if backup_enabled == "true":
        problems.extend(backup_failures(deployment, int(hours)))
    if not problems:
        print("Expected services and enabled backup freshness checks are healthy")
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
