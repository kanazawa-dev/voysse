# Detect missing or unhealthy services

Run `python3 scripts/check-services.py` on the Compose host. This read-only check
detects missing, stopped, starting, and unhealthy required services. It does not
restart containers or replay messages. Python 3 and Docker Compose are required.

## Configure alerts

1. Set `VOYSSE_MONITOR_SOCIAL=true` if Instagram/Messenger are deployed. The default
   is `false`; the Cloud and QR workers are always required.
2. Set `VOYSSE_ALERT_WEBHOOK_URL` in the scheduler's private environment to an
   operator-controlled HTTPS receiver. Do not put the URL in source control or
   command arguments. Redirects are rejected.
3. Schedule the command every minute using the host's scheduler. Use a dedicated
   operator account with Docker access; that access is privileged. No Docker socket
   is mounted inside the app. The script resolves the project directory itself.
4. Verify receipt during an approved staging outage and restore the service.
   A passing unit test does not prove your receiver or scheduler is configured.

The receiver must accept a JSON POST such as:

```json
{"status":"unhealthy","problems":["whatsapp-cloud-worker:missing"]}
```

There is one alert per failing invocation, including repeated failures. Configure
grouping/rate controls at the receiver. Recovery notifications are not implemented.
The payload contains only fixed service/error codes, never Docker output, message
content, credentials, or webhook URLs. Transport failures are redacted.

| Exit | Meaning |
| --- | --- |
| 0 | All expected services pass their configured checks |
| 1 | A service failed; receiver accepted the alert, or none was configured |
| 2 | Configuration or alert delivery failed |

Docker inventory failure also triggers an alert. A receiver's 2xx response means
accepted, not that a human read it. Startup counts as not healthy; allow deployment
maintenance windows in the scheduler/receiver. `proxy` has no Docker health probe,
so only its running state is checked. This does not test public DNS/TLS or delivery.

## Enable backup freshness monitoring

After configuring [full backups](full-backup.md), set these in the monitor's
private scheduler environment (not only in the backup job):

```sh
VOYSSE_MONITOR_BACKUP=true
VOYSSE_BACKUP_ID=your-deployment-id
VOYSSE_BACKUP_MAX_AGE_HOURS=26
```

Use the same deployment ID as the backup job. The default is disabled; when enabled,
max age defaults to 26 hours (daily backup plus two hours of margin). Choose an
integer from 1 to 8760 for your approved cadence. Invalid configuration exits 2
before checking services and must be observed by the scheduler.

The monitor reads only `backups/full-backup-success.json` under this checkout,
limited to 4 KiB. It requires a matching deployment, a valid snapshot ID and a
timezone-aware completion timestamp. Exactly the maximum age still passes;
anything older fails. A future timestamp fails rather than extending freshness.

| Problem code | Meaning |
| --- | --- |
| `backup:missing` | No completion marker exists |
| `backup:stale` | Last recorded completion exceeds the configured age |
| `backup:deployment_mismatch` | Marker belongs to another deployment |
| `backup:future_timestamp` | Check the host clock and completion evidence |
| `backup:invalid_marker` | Unreadable, malformed or oversized evidence |

Backup and service problems share one redacted HTTPS alert per invocation, even
when Docker inventory fails. No snapshot ID, deployment name, path or file content
is included. Exit codes remain unchanged; exit 0 covers all enabled checks.

This is **local completion evidence**, not a remote repository check or restore
test. Keep the checkout/marker operator-controlled. The monitor does not read
restic credentials, schedule a backup, stop writers, delete snapshots or repair
the marker. Run it from the same checkout as the backup job. Independently monitor
scheduler failures and host outages. No scheduler or receiver is installed here.

## Remaining external monitoring

A host-local script cannot report its own host or scheduler disappearing. Configure
an independent uptime/dead-man monitor and verify its notification path separately.
Check public HTTP readiness externally too. Q07 remains partial until these paths
are exercised on the actual hosting environment.

## Verification and rollback

Run `python3 -m unittest discover -s scripts/tests -v` (OpenSSL and loopback socket
access are needed for the local HTTPS test). Tests cover both Compose
JSON formats, missing replicas, unhealthy states, inventory errors, redaction and
the HTTPS receiver contract, including actual delivery to a temporary TLS receiver
and rejected redirects. No database, paid service, or external notification needed.

To roll back only backup freshness checks, unset `VOYSSE_MONITOR_BACKUP` or set it
to `false`; service checks and stored backups remain unchanged.

Full monitor rollback: remove the scheduled invocation, script, tests and operations CI job.
Worker healthchecks and message queues remain unchanged.
