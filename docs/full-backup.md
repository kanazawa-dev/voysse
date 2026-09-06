# Back up database, files and recovery keys together

`python3 scripts/backup-full.py backup --maintenance` creates a restic snapshot
of PostgreSQL, backend storage, Compose/environment configuration and the API's
actual runtime encryption/session/bridge keys. **It temporarily stops writers.**
Use an approved maintenance window; no automatic scheduling is installed.

## Configure once

- Install Docker Compose, Python 3 and restic on the Linux host. Use a dedicated
  operator account; Docker access is privileged. Local integration used restic 0.18.
- Set `RESTIC_REPOSITORY` to your repository and `RESTIC_PASSWORD_FILE` to a private
  0600 file outside the repository and backup source. Keep a separate recoverable
  copy of that password; losing it makes recovery impossible.
- Set `VOYSSE_BACKUP_ID` to a unique deployment identifier. Never share it between
  deployments using the same restic repository.
- Configure remote credentials privately and initialize the restic repository
  explicitly with `restic init`. The script never initializes or unlocks it.
- Use an encrypted host filesystem with enough space under `backups/` for a full
  plaintext staging copy. Staging is private and normally removed after upload;
  SIGKILL/power loss can leave files behind. Deletion is not secure erasure.

## Capture and retention

The repository is checked for accessibility before downtime. Only writer
containers that were running are stopped and restarted, including after a partial
stop/capture failure. PostgreSQL stays running for a custom-format dump. The dump
index is checked, but that is not a restore test. Files are copied from the stopped
API container's standard `/app/backend/storage` path. Custom paths are rejected.

Stop external writers and deployments too: this script cannot quiesce processes
outside this Compose project. Unknown services and paused/restarting writers are
rejected. Forced shutdown can interrupt AI/tools or sends; inspect uncertain
channel events after maintenance. Container restart does not prove readiness.

Upload happens after writers restart. Only a complete restic upload writes
`backups/full-backup-success.json`; monitor its age independently. Add `--retention`
only after approving deletion: keep 7 daily, 4 weekly and 12 monthly snapshots,
filtered by deployment host and `voysse-full` tag. Shared-repository prune also
reclaims already-unreferenced data. Never use this option without a reviewed policy.

## Recover without overwriting production

```sh
python3 scripts/backup-full.py check
python3 scripts/backup-full.py restore --snapshot <explicit-id> --destination /private/new-directory
```

Restore requires a matching deployment/tag and a directory that does not exist.
It verifies recovered files but never imports a database or replaces app volumes.
In an isolated environment, restore `database.dump` with `pg_restore`, restore the
storage directory and reconcile `environment.env` with `runtime-keys.json` before
starting the matching application image recorded in `manifest.json`. Confirm
provider credential decryption and attachment reads. Do not connect the restored
workers/bridge to real accounts during a drill; they could send queued messages.

## Verification and remaining operations

`python3 -m unittest discover -s scripts/tests -v` covers maintenance gating,
partial-stop/capture failure recovery, scoped retention, restore guards and a real
restic backup/verified restore/data-check round trip using disposable fixtures.
The round trip does not exercise a real PostgreSQL/Compose restore. Remote storage,
scheduler, backup-age notifications and hosting disaster recovery remain operator
acceptance work. No production backup or outage is implied by local tests.

Rollback: remove the invocation and this script; preserve existing snapshots and
recovery passwords. `scripts/backup-db.sh` remains available for DB-only snapshots.
