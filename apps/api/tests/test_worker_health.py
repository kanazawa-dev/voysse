import asyncio
from contextlib import nullcontext
from unittest.mock import AsyncMock

import pytest

from app.scripts import social_worker, whatsapp_cloud_worker
from app.services import worker_health


def test_health_requires_progress_and_expires(tmp_path, monkeypatch):
    path = tmp_path / 'progress'
    clock = [1000.0]
    monkeypatch.setattr(worker_health.time, 'monotonic', lambda: clock[0])
    assert not worker_health.healthy(path)
    worker_health.record_progress(path)
    assert worker_health.healthy(path)
    assert path.stat().st_mode & 0o777 == 0o600
    clock[0] += 300
    assert worker_health.healthy(path)
    clock[0] += 1
    assert not worker_health.healthy(path)
    worker_health.reset(path)
    assert not path.exists()
    worker_health.reset(path)


@pytest.mark.parametrize('value', ['invalid', 'nan', 'inf', '-inf', '2000', b'\xff'])
def test_invalid_or_future_heartbeat_is_unhealthy(tmp_path, monkeypatch, value):
    path = tmp_path / 'progress'
    path.write_bytes(value if isinstance(value, bytes) else value.encode())
    monkeypatch.setattr(worker_health.time, 'monotonic', lambda: 1000)
    assert not worker_health.healthy(path)


@pytest.mark.parametrize('worker', [social_worker, whatsapp_cloud_worker])
@pytest.mark.parametrize('fails', [False, True])
def test_worker_records_only_completed_iteration(worker, fails, monkeypatch, tmp_path):
    path = tmp_path / 'progress'
    path.write_text('old process')
    monkeypatch.setattr(worker, 'reset', lambda: worker_health.reset(path))
    monkeypatch.setattr(worker, 'record_progress', lambda: worker_health.record_progress(path))
    monkeypatch.setattr(worker, 'SessionLocal', lambda: nullcontext(object()))

    async def work(db):
        assert not path.exists(), 'Old heartbeat must be removed on startup'
        if fails:
            raise RuntimeError('private-provider-value')
        return False

    class StopLoop(BaseException):
        pass

    async def stop(_):
        raise StopLoop()

    monkeypatch.setattr(worker, 'work_once', work)
    monkeypatch.setattr(worker.asyncio, 'sleep', stop)
    with pytest.raises(StopLoop):
        asyncio.run(worker.main())
    assert worker_health.healthy(path) is not fails


@pytest.mark.parametrize('worker', [social_worker, whatsapp_cloud_worker])
def test_interrupted_work_does_not_report_progress(worker, monkeypatch):
    record = []
    monkeypatch.setattr(worker, 'reset', lambda: None)
    monkeypatch.setattr(worker, 'record_progress', lambda: record.append(True))
    monkeypatch.setattr(worker, 'SessionLocal', lambda: nullcontext(object()))
    monkeypatch.setattr(worker, 'work_once', AsyncMock(side_effect=asyncio.CancelledError))
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(worker.main())
    assert record == []
