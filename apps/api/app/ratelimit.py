"""Public request quotas, shared through PostgreSQL by default."""

import hashlib
import hmac
import math
import time
from threading import Lock

from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .config import get_settings
from .database import engine


def client_ip(request: Request) -> str:
    """Use the ASGI peer, resolved by the server's trusted-proxy policy.

    Reading raw forwarding headers here would bypass Uvicorn's allowlist and
    let direct callers choose a fresh quota bucket for every request.
    """
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """FastAPI dependency that allows ``times`` requests per ``seconds`` per IP."""

    def __init__(self, times: int, seconds: int, *, name: str) -> None:
        self.times = times
        self.seconds = seconds
        self.name = name
        self._hits: dict[str, tuple[int, float]] = {}
        self._lock = Lock()

    def _register(self, identifier: str) -> tuple[int, float]:
        now = time.monotonic()
        with self._lock:
            count, window_start = self._hits.get(identifier, (0, now))
            if now - window_start >= self.seconds:
                count, window_start = 0, now
            count += 1
            self._hits[identifier] = (count, window_start)
            # Bound memory: drop windows that have already expired.
            if len(self._hits) > 10_000:
                self._hits = {k: v for k, v in self._hits.items() if now - v[1] < self.seconds}
        return count, window_start

    def _register_shared(self, identifier: str) -> tuple[int, int]:
        # Never retain raw IP addresses. Include quota settings in the namespace
        # so changing a window cannot reuse incompatible counters.
        key = hmac.new(get_settings().secret_key.encode(),
            f"{identifier}:{self.times}:{self.seconds}".encode(), hashlib.sha256).hexdigest()
        with engine.begin() as connection:
            connection.execute(text("SET LOCAL lock_timeout = '2s'"))
            connection.execute(text("SET LOCAL statement_timeout = '3s'"))
            # Bounded cleanup; skip rows another request is updating.
            connection.execute(text("""
                DELETE FROM rate_limit_buckets WHERE key IN (
                    SELECT key FROM rate_limit_buckets WHERE expires_at <= now()
                    ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
                )
            """))
            row = connection.execute(text("""
                INSERT INTO rate_limit_buckets (key, hits, expires_at)
                VALUES (:key, 1, now() + :seconds * interval '1 second')
                ON CONFLICT (key) DO UPDATE SET
                    hits = CASE WHEN rate_limit_buckets.expires_at <= now() THEN 1
                           ELSE least(rate_limit_buckets.hits + 1, :cap) END,
                    expires_at = CASE WHEN rate_limit_buckets.expires_at <= now()
                        THEN now() + :seconds * interval '1 second'
                        ELSE rate_limit_buckets.expires_at END
                RETURNING hits, extract(epoch FROM (expires_at - now())) AS remaining
            """), {"key": key, "seconds": self.seconds, "cap": self.times + 1}).one()
            # now() is transaction-start time; a concurrently inserted bucket
            # can be newer than this transaction. Never advertise over one window.
            return row.hits, max(1, min(self.seconds, math.ceil(row.remaining)))

    def __call__(self, request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        identifier = f"{self.name}:{client_ip(request)}"
        if get_settings().rate_limit_backend == "postgres":
            try:
                count, retry_after = self._register_shared(identifier)
            except SQLAlchemyError:
                # Never silently fall back to process-local limits during outage.
                raise HTTPException(503, "Request protection is temporarily unavailable.",
                                    headers={"Retry-After": "5"}) from None
        else:
            count, window_start = self._register(identifier)
            retry_after = max(1, math.ceil(self.seconds - (time.monotonic() - window_start)))
        if count > self.times:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again.",
                headers={"Retry-After": str(retry_after)},
            )


# Shared limiters. Credential endpoints are strict (brute-force defense); the
# widget message endpoint is throttled because each call spends LLM tokens.
login_rate_limit = RateLimiter(10, 60, name="login")
widget_rate_limit = RateLimiter(30, 60, name="widget")
# The Meta webhook is authenticated by its HMAC signature; this generous limit
# only guards against floods of unsigned traffic.
whatsapp_cloud_webhook_rate_limit = RateLimiter(300, 60, name="whatsapp-cloud-webhook")
cloud_interest_rate_limit = RateLimiter(5, 300, name="cloud-interest")
admin_login_rate_limit = RateLimiter(10, 60, name="admin-login")
