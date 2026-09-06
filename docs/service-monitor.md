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

Rollback: remove the scheduled invocation, script, tests and operations CI job.
Worker healthchecks and message queues remain unchanged.
