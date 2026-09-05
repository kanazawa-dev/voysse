#!/usr/bin/env bash
# Local snapshot only: off-site encryption/retention is an operator responsibility.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
mkdir -p backups
target="$(mktemp "backups/voysse-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump")"
if ! docker compose --env-file .env.docker exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$target"; then
  echo "Backup failed; incomplete file retained for inspection: $target" >&2
  exit 1
fi
docker compose --env-file .env.docker exec -T db pg_restore --list < "$target" > /dev/null
sha256sum "$target" > "$target.sha256"
printf 'Snapshot validated (archive list only, not a restore test): %s\n' "$target"
