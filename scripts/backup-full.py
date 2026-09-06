#!/usr/bin/env python3
"""Operator-invoked, maintenance-window backup. No implicit repository creation."""
import argparse
import fcntl
import json
import importlib.util
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '--env-file', '.env.docker', '--profile', 'social']
WRITERS = {'api', 'whatsapp', 'whatsapp-cloud-worker', 'whatsapp-qr-worker', 'social-worker'}
TAG = 'voysse-full'


def run(args, *, cwd=ROOT, stdout=subprocess.PIPE, stdin=None):
    # Never expose command output: Docker/restic errors can contain secrets.
    return subprocess.run(args, cwd=cwd, stdin=stdin, stdout=stdout,
                          stderr=subprocess.PIPE, check=True, timeout=3600)


def inventory():
    result = run(COMPOSE + ['ps', '--all', '--format', 'json'])
    spec = importlib.util.spec_from_file_location('service_monitor', ROOT / 'scripts/check-services.py')
    monitor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(monitor)
    return monitor.parse_services(result.stdout.decode())


def configuration():
    deployment = os.environ.get('VOYSSE_BACKUP_ID', '')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}', deployment):
        raise ValueError('Set a unique VOYSSE_BACKUP_ID (letters, numbers, underscore, hyphen)')
    if not os.environ.get('RESTIC_REPOSITORY') or not os.environ.get('RESTIC_PASSWORD_FILE'):
        raise ValueError('RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE are required')
    credential_path = Path(os.environ['RESTIC_PASSWORD_FILE'])
    if not credential_path.is_file() or credential_path.stat().st_mode & 0o077:
        raise ValueError('The restic password file must be private (0600)')
    if not shutil.which('restic') or not shutil.which('docker'):
        raise ValueError('Install restic and Docker Compose on the backup host')
    return deployment


def snapshot_summary(raw):
    summaries = [row for row in map(json.loads, raw.decode().splitlines())
                 if row.get('message_type') == 'summary']
    snapshot = summaries[-1].get('snapshot_id', '') if summaries else ''
    if not re.fullmatch(r'[0-9a-f]{8,64}', snapshot):
        raise ValueError('Backup did not return a snapshot ID')
    return snapshot


def capture(stage, api_id):
    with (stage / 'database.dump').open('wb') as output:
        run(COMPOSE + ['exec', '-T', 'db', 'sh', '-c',
            'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl'], stdout=output)
    with (stage / 'database.dump').open('rb') as source:
        run(COMPOSE + ['exec', '-T', 'db', 'pg_restore', '--list'], stdin=source)
    (stage / 'storage').mkdir()
    run(['docker', 'cp', f'{api_id}:/app/backend/storage/.', str(stage / 'storage')])
    shutil.copyfile(ROOT / '.env.docker', stage / 'environment.env')
    shutil.copyfile(ROOT / 'docker-compose.yml', stage / 'docker-compose.yml')
    # Runtime keys may differ from a newly edited .env.docker. Preserve both.
    values = json.loads(run(['docker', 'inspect', '--format', '{{json .Config.Env}}', api_id]).stdout)
    env = dict(item.split('=', 1) for item in values if '=' in item)
    if env.get('STORAGE_DIR') != '/app/backend/storage':
        raise ValueError('Custom storage paths require a reviewed backup configuration')
    keys = {key: env.get(key, '') for key in ('ENCRYPTION_KEY', 'SECRET_KEY', 'WHATSAPP_BRIDGE_TOKEN')}
    if not all(keys.values()):
        raise ValueError('Explicit runtime recovery keys are required')
    (stage / 'runtime-keys.json').write_text(json.dumps(keys))
    (stage / 'manifest.json').write_text(json.dumps({
        'format': 1, 'created_at': datetime.now(timezone.utc).isoformat(),
        'api_image': run(['docker', 'inspect', '--format', '{{.Image}}', api_id]).stdout.decode().strip(),
        'storage_path': '/app/backend/storage',
    }))


def backup(deployment, *, maintenance=False, retain=False):
    if not maintenance:
        raise ValueError('Backup requires --maintenance; this temporarily stops application writers')
    run(['restic', 'snapshots', '--json'])  # Fail before downtime if the repository is inaccessible.
    rows = inventory()
    apis = [row for row in rows if row.get('Service') == 'api']
    if len(apis) != 1 or not apis[0].get('ID'):
        raise ValueError('Exactly one existing API container is required')
    if not any(row.get('Service') == 'db' and row.get('State') == 'running' for row in rows):
        raise ValueError('The database must be running')
    if any(row.get('Service') not in WRITERS | {'db', 'web', 'proxy'} for row in rows):
        raise ValueError('Unknown services require a reviewed quiescence policy')
    if any(row.get('Service') in WRITERS and row.get('State') in {'paused', 'restarting'} for row in rows):
        raise ValueError('Resolve paused/restarting writers before backup')
    running = [row['ID'] for row in rows
               if row.get('Service') in WRITERS and row.get('State') == 'running']
    state = ROOT / 'backups'
    state.mkdir(mode=0o700, exist_ok=True)
    # Keep plaintext on an operator-controlled encrypted filesystem until upload.
    with tempfile.TemporaryDirectory(prefix='full-', dir=state) as temporary:
        stage = Path(temporary)
        try:
            if running:
                run(['docker', 'stop', '--time', '60', *running])
            if any(row.get('Service') in WRITERS and row.get('State') in
                   {'running', 'restarting', 'paused'} for row in inventory()):
                raise ValueError('Application writers are not fully stopped')
            capture(stage, apis[0]['ID'])
        finally:
            # A partial stop must also restore the services that were running.
            if running:
                run(['docker', 'start', *running])
        result = run(['restic', 'backup', '--json', '--host', deployment, '--tag', TAG,
                      '--group-by', 'host,tags', '.'], cwd=stage)
        snapshot = snapshot_summary(result.stdout)
        # Retention is explicit and only follows a complete successful upload.
        if retain:
            run(['restic', 'forget', '--host', deployment, '--tag', TAG,
                 '--group-by', 'host,tags', '--keep-daily', '7', '--keep-weekly', '4',
                 '--keep-monthly', '12', '--prune'])
        marker = state / 'full-backup-success.json'
        temporary_marker = state / '.full-backup-success.tmp'
        temporary_marker.write_text(json.dumps({'snapshot_id': snapshot,
            'deployment': deployment, 'completed_at': datetime.now(timezone.utc).isoformat()}))
        os.replace(temporary_marker, marker)
        print(f'Encrypted snapshot saved: {snapshot}; restore drill still required')


def restore(deployment, snapshot, destination):
    # No production database import, volume replacement, latest alias, or overwrite.
    if not re.fullmatch(r'[0-9a-f]{8,64}', snapshot):
        raise ValueError('Supply an explicit snapshot ID, not latest')
    rows = json.loads(run(['restic', 'snapshots', '--json', '--host', deployment,
                          '--tag', TAG, snapshot]).stdout)
    if len(rows) != 1 or rows[0].get('hostname') != deployment or TAG not in rows[0].get('tags', []):
        raise ValueError('Snapshot does not belong to this deployment')
    destination = destination.absolute()
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)
    run(['restic', 'restore', rows[0]['id'], '--verify', '--target', str(destination)])
    print('Snapshot restored to a new private directory; nothing imported into the application')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['backup', 'restore', 'check'])
    parser.add_argument('--maintenance', action='store_true')
    parser.add_argument('--retention', action='store_true')
    parser.add_argument('--snapshot', default='')
    parser.add_argument('--destination', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    def interrupted(*_):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    try:
        deployment = configuration()
        state = ROOT / 'backups'
        state.mkdir(mode=0o700, exist_ok=True)
        with (state / '.full-backup.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if args.action == 'backup':
                backup(deployment, maintenance=args.maintenance, retain=args.retention)
            elif args.action == 'restore':
                if not args.destination:
                    raise ValueError('Restore requires --destination (a new directory)')
                restore(deployment, args.snapshot, args.destination)
            else:
                run(['restic', 'check', '--read-data'])
                print('Repository data check completed; application restore drill still required')
        return 0
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError, KeyboardInterrupt):
        print('Backup operation failed; inspect service state and repository privately', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
