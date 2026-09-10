from types import SimpleNamespace
import asyncio

import pytest
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app import config
from app.ratelimit import RateLimiter, client_ip, login_rate_limit


def _request(headers=None, host="1.2.3.4"):
    return SimpleNamespace(headers=headers or {}, client=SimpleNamespace(host=host))


def test_client_ip_ignores_untrusted_forwarded_for():
    request = _request(headers={"x-forwarded-for": "9.9.9.9, 10.0.0.1"})
    assert client_ip(request) == "1.2.3.4"


def test_client_ip_falls_back_to_peer():
    assert client_ip(_request()) == "1.2.3.4"


@pytest.mark.parametrize("peer,forwarded,expected", [
    ("198.51.100.1", "192.0.2.9", "198.51.100.1"),
    ("10.0.0.2", "192.0.2.9", "192.0.2.9"),
    ("10.0.0.2", "192.0.2.99, 198.51.100.1", "198.51.100.1"),
    ("10.0.0.2", "2001:db8::1", "2001:db8::1"),
    ("10.0.0.2", "", "10.0.0.2"),
])
def test_server_proxy_policy_is_preserved(peer, forwarded, expected):
    resolved = []

    async def app(scope, receive, send):
        resolved.append(client_ip(Request(scope)))

    scope = {"type": "http", "client": (peer, 1234),
             "headers": [(b"x-forwarded-for", forwarded.encode())]}
    middleware = ProxyHeadersMiddleware(app, trusted_hosts="10.0.0.0/24")
    asyncio.run(middleware(scope, None, None))
    assert resolved == [expected]


def test_rotating_forged_headers_cannot_bypass_quota(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_BACKEND", "memory")
    config.get_settings.cache_clear()
    limiter = RateLimiter(times=2, seconds=60, name="forged-header")
    app = FastAPI()

    @app.get("/", dependencies=[Depends(limiter)])
    def endpoint():
        return {"ok": True}

    try:
        with TestClient(ProxyHeadersMiddleware(app, trusted_hosts="10.0.0.2")) as client:
            responses = [client.get("/", headers={"x-forwarded-for": f"192.0.2.{i}"})
                         for i in range(3)]
        assert [response.status_code for response in responses] == [200, 200, 429]
        assert "Retry-After" in responses[-1].headers
    finally:
        config.get_settings.cache_clear()


def test_register_counts_within_window_and_resets():
    limiter = RateLimiter(times=2, seconds=60, name="unit")
    assert limiter._register("a")[0] == 1
    assert limiter._register("a")[0] == 2
    assert limiter._register("a")[0] == 3
    # A different identifier is tracked independently.
    assert limiter._register("b")[0] == 1


def test_login_rate_limit_returns_429(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    config.get_settings.cache_clear()
    login_rate_limit._hits.clear()
    try:
        creds = {"email": "nobody@example.com", "password": "wrong-password"}
        for _ in range(10):
            assert client.post("/api/auth/login", json=creds).status_code == 401
        blocked = client.post("/api/auth/login", json=creds)
        assert blocked.status_code == 429
        assert "Retry-After" in blocked.headers
    finally:
        login_rate_limit._hits.clear()
        config.get_settings.cache_clear()
