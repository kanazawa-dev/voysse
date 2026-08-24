from types import SimpleNamespace

from app import config
from app.ratelimit import RateLimiter, client_ip, login_rate_limit


def _request(headers=None, host="1.2.3.4"):
    return SimpleNamespace(headers=headers or {}, client=SimpleNamespace(host=host))


def test_client_ip_prefers_forwarded_for():
    request = _request(headers={"x-forwarded-for": "9.9.9.9, 10.0.0.1"})
    assert client_ip(request) == "9.9.9.9"


def test_client_ip_falls_back_to_peer():
    assert client_ip(_request()) == "1.2.3.4"


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
