from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import func, insert, select, text
from sqlalchemy.exc import OperationalError

from app import config, ratelimit
from app.models import RateLimitBucket, now_utc
from app.ratelimit import RateLimiter
from test_ratelimit import _request


@pytest.fixture(autouse=True)
def shared_settings(monkeypatch):
    from conftest import test_engine
    monkeypatch.setattr(ratelimit, "engine", test_engine)
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_BACKEND", "postgres")
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


def test_independent_instances_share_atomic_quota():
    def request(_):
        limiter = RateLimiter(5, 60, name="shared")
        try:
            limiter(_request())
            return 200
        except HTTPException as error:
            assert 1 <= int(error.headers["Retry-After"]) <= 60
            return error.status_code
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(request, range(20)))
    assert results.count(200) == 5
    assert results.count(429) == 15


def test_buckets_expire_and_hide_addresses():
    from conftest import test_engine
    limiter = RateLimiter(1, 60, name="private")
    limiter(_request())
    with test_engine.begin() as connection:
        bucket = connection.execute(select(RateLimitBucket)).one()
        assert len(bucket.key) == 64
        assert "1.2.3.4" not in bucket.key
        connection.execute(text("UPDATE rate_limit_buckets SET expires_at = now() - interval '1 second'"))
    limiter(_request())
    with pytest.raises(HTTPException) as error:
        limiter(_request())
    assert error.value.status_code == 429


def test_forged_forwarding_headers_share_the_peer_bucket():
    limiter = RateLimiter(1, 60, name="forged-forwarding")
    limiter(_request(headers={"x-forwarded-for": "192.0.2.1"}))
    with pytest.raises(HTTPException) as error:
        limiter(_request(headers={"x-forwarded-for": "192.0.2.2"}))
    assert error.value.status_code == 429


def test_quota_names_and_clients_are_independent():
    a = RateLimiter(1, 60, name="a")
    b = RateLimiter(1, 60, name="b")
    a(_request())
    b(_request())
    a(_request(host="4.3.2.1"))
    with pytest.raises(HTTPException):
        a(_request())


def test_database_failure_does_not_disable_protection(monkeypatch):
    limiter = RateLimiter(1, 60, name="fail-closed")
    def fail(_):
        raise OperationalError("private SQL", {}, Exception("secret password"))
    monkeypatch.setattr(limiter, "_register_shared", fail)
    with pytest.raises(HTTPException) as error:
        limiter(_request())
    assert error.value.status_code == 503
    assert "secret" not in error.value.detail
    assert not limiter._hits


def test_memory_fallback_requires_explicit_configuration(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_BACKEND", "memory")
    config.get_settings.cache_clear()
    limiter = RateLimiter(1, 60, name="local")
    limiter(_request())
    with pytest.raises(HTTPException) as error:
        limiter(_request())
    assert error.value.status_code == 429
    assert limiter._hits


def test_rejections_cap_counts_without_extending_window():
    from conftest import test_engine
    limiter = RateLimiter(1, 60, name="bounded")
    limiter(_request())
    with test_engine.connect() as connection:
        before = connection.scalar(select(RateLimitBucket.expires_at))
    for _ in range(5):
        with pytest.raises(HTTPException):
            limiter(_request())
    with test_engine.connect() as connection:
        bucket = connection.execute(select(RateLimitBucket)).one()
        assert bucket.hits == 2
        assert bucket.expires_at == before


def test_cleanup_is_bounded():
    from conftest import test_engine
    with test_engine.begin() as connection:
        connection.execute(insert(RateLimitBucket), [
            {"key": f"{i:064x}", "hits": 1, "expires_at": now_utc() - timedelta(minutes=1)}
            for i in range(150)
        ])
    RateLimiter(1, 60, name="cleanup")(_request())
    with test_engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(RateLimitBucket)) == 51


def test_disabled_limits_do_not_connect(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    config.get_settings.cache_clear()
    monkeypatch.setattr(ratelimit, "engine", None)
    RateLimiter(1, 60, name="disabled")(_request())


@pytest.mark.parametrize('remaining, expected', [(60.001, 60), (60, 60), (15.1, 16), (0.1, 1), (-0.1, 1)])
def test_shared_retry_bounds_with_newer_concurrent_bucket(monkeypatch, remaining, expected):
    from contextlib import nullcontext
    from types import SimpleNamespace
    row = SimpleNamespace(hits=6, remaining=remaining)
    connection = SimpleNamespace(execute=lambda *args, **kwargs: SimpleNamespace(one=lambda: row))
    monkeypatch.setattr(ratelimit, 'engine', SimpleNamespace(begin=lambda: nullcontext(connection)))
    limiter = RateLimiter(5, 60, name='newer-bucket')
    assert limiter._register_shared('client') == (6, expected)
    with pytest.raises(HTTPException) as error: limiter(_request())
    assert error.value.status_code == 429
    assert error.value.headers['Retry-After'] == str(expected)
