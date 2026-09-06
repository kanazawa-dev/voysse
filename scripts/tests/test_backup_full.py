import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('backup_full', Path(__file__).parents[1] / 'backup-full.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class FullBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(backup, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.rows = [{'Service': 'db', 'State': 'running', 'ID': 'db'},
                     {'Service': 'api', 'State': 'running', 'ID': 'api'},
                     {'Service': 'whatsapp', 'State': 'exited', 'ID': 'bridge'}]
        self.result = Mock(stdout=b'{"message_type":"summary","snapshot_id":"abcdef12"}\n')

    def test_requires_explicit_maintenance_before_external_commands(self):
        with patch.object(backup, 'run') as run, self.assertRaises(ValueError):
            backup.backup('test')
        run.assert_not_called()

    def test_only_running_container_restarted_and_retention_scoped(self):
        stopped = [dict(row, State='exited') if row['ID'] == 'api' else row for row in self.rows]
        with patch.object(backup, 'inventory', side_effect=[self.rows, stopped]), \
             patch.object(backup, 'capture'), patch.object(backup, 'run', return_value=self.result) as run:
            backup.backup('test', maintenance=True, retain=True)
        commands = [call.args[0] for call in run.call_args_list]
        self.assertIn(['docker', 'start', 'api'], commands)
        self.assertNotIn(['docker', 'start', 'bridge'], commands)
        self.assertLess(commands.index(['docker', 'start', 'api']), next(i for i, c in enumerate(commands) if c[:2] == ['restic', 'backup']))
        forget = next(c for c in commands if c[:2] == ['restic', 'forget'])
        self.assertEqual(forget[2:8], ['--host', 'test', '--tag', 'voysse-full', '--group-by', 'host,tags'])
        self.assertTrue((self.root / 'backups/full-backup-success.json').is_file())
        self.assertEqual(list((self.root / 'backups').glob('full-*')), [self.root / 'backups/full-backup-success.json'])

    def test_failed_capture_restores_writers_without_upload_or_retention(self):
        stopped = [dict(row, State='exited') for row in self.rows]
        with patch.object(backup, 'inventory', side_effect=[self.rows, stopped]), \
             patch.object(backup, 'capture', side_effect=ValueError('capture failure')), \
             patch.object(backup, 'run', return_value=self.result) as run, self.assertRaises(ValueError):
            backup.backup('test', maintenance=True, retain=True)
        commands = [call.args[0] for call in run.call_args_list]
        self.assertIn(['docker', 'start', 'api'], commands)
        self.assertFalse(any(c[:2] in [['restic', 'backup'], ['restic', 'forget']] for c in commands))
        self.assertFalse((self.root / 'backups/full-backup-success.json').exists())

    def test_partial_stop_failure_attempts_restart(self):
        def fail_stop(command, **kwargs):
            if command[:2] == ['docker', 'stop']:
                raise subprocess.CalledProcessError(1, command)
            return self.result
        with patch.object(backup, 'inventory', return_value=self.rows), \
             patch.object(backup, 'run', side_effect=fail_stop) as run, self.assertRaises(subprocess.CalledProcessError):
            backup.backup('test', maintenance=True)
        self.assertIn(['docker', 'start', 'api'], [call.args[0] for call in run.call_args_list])

    def test_restore_rejects_latest_foreign_snapshot_and_existing_directory(self):
        with self.assertRaises(ValueError):
            backup.restore('test', 'latest', self.root / 'restore')
        with patch.object(backup, 'run', return_value=Mock(stdout=b'[]')), self.assertRaises(ValueError):
            backup.restore('test', 'abcdef12', self.root / 'restore')
        row = {'id': 'abcdef12', 'hostname': 'test', 'tags': ['voysse-full']}
        with patch.object(backup, 'run', return_value=Mock(stdout=json.dumps([row]).encode())) as run:
            with self.assertRaises(FileExistsError):
                backup.restore('test', 'abcdef12', self.root)
            self.assertEqual(run.call_count, 1)
            backup.restore('test', 'abcdef12', self.root / 'restore')
            self.assertIn('--verify', run.call_args.args[0])

    def test_private_password_and_unique_deployment_required(self):
        password = self.root / 'password'
        password.write_text('test-only')
        env = {'RESTIC_REPOSITORY': str(self.root / 'repo'), 'RESTIC_PASSWORD_FILE': str(password), 'VOYSSE_BACKUP_ID': 'test'}
        with patch.dict(os.environ, env), patch.object(backup.shutil, 'which', return_value='/test/tool'):
            password.chmod(0o644)
            with self.assertRaises(ValueError):
                backup.configuration()
            password.chmod(0o600)
            self.assertEqual(backup.configuration(), 'test')

    def test_incomplete_snapshot_summary_rejected(self):
        for data in (b'', b'{"message_type":"status"}', b'{"message_type":"summary","snapshot_id":"invalid"}'):
            with self.subTest(data=data), self.assertRaises(ValueError):
                backup.snapshot_summary(data)

    @unittest.skipUnless(backup.shutil.which('restic'), 'restic CLI required for repository round trip')
    def test_real_restic_round_trip_with_fixture_payloads(self):
        password = self.root / 'password'
        password.write_text('disposable-test-password')
        password.chmod(0o600)
        env = {'RESTIC_REPOSITORY': str(self.root / 'repository'),
               'RESTIC_PASSWORD_FILE': str(password), 'RESTIC_CACHE_DIR': str(self.root / 'cache')}
        stopped = [dict(row, State='exited') for row in self.rows]
        real_run = backup.run
        def command(args, **kwargs):
            return self.result if args[0] == 'docker' else real_run(args, **kwargs)
        def capture(stage, _):
            (stage / 'database.dump').write_text('fixture, not a PostgreSQL dump')
            (stage / 'runtime-keys.json').write_text('{"ENCRYPTION_KEY":"fixture-only"}')
            (stage / 'storage').mkdir()
            (stage / 'storage/file.txt').write_text('fixture attachment')
        with patch.dict(os.environ, env), patch.object(backup, 'inventory', side_effect=[self.rows, stopped]), \
             patch.object(backup, 'capture', side_effect=capture), patch.object(backup, 'run', side_effect=command):
            real_run(['restic', 'init'])
            backup.backup('fixture', maintenance=True, retain=True)
            snapshot = json.loads((self.root / 'backups/full-backup-success.json').read_text())['snapshot_id']
            backup.restore('fixture', snapshot, self.root / 'restored')
            real_run(['restic', 'check', '--read-data'])
        self.assertEqual((self.root / 'restored/storage/file.txt').read_text(), 'fixture attachment')
        self.assertIn('fixture-only', (self.root / 'restored/runtime-keys.json').read_text())

    def test_capture_preserves_runtime_keys_not_just_env_file(self):
        (self.root / '.env.docker').write_text('ENCRYPTION_KEY=edited-not-running')
        (self.root / 'docker-compose.yml').write_text('services: {}')
        stage = self.root / 'stage'
        stage.mkdir()
        values = ['ENCRYPTION_KEY=runtime-key', 'SECRET_KEY=runtime-secret',
                  'WHATSAPP_BRIDGE_TOKEN=runtime-token', 'STORAGE_DIR=/app/backend/storage']
        def command(args, **kwargs):
            return Mock(stdout=json.dumps(values).encode() if '{{json .Config.Env}}' in args else b'fixture-image')
        with patch.object(backup, 'run', side_effect=command):
            backup.capture(stage, 'fixture-api')
        self.assertEqual(json.loads((stage / 'runtime-keys.json').read_text())['ENCRYPTION_KEY'], 'runtime-key')
