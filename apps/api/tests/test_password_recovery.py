from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

import jwt
import pytest
from sqlalchemy import select

from app.config import get_settings
from app.models import User
from app.security import create_admin_token, create_portal_token
from app.services import password_recovery as recovery
from conftest import TestingSession


@pytest.fixture
def mail(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "test-mail")
    monkeypatch.setattr(settings, "smtp_from", "hello@example.com")
    monkeypatch.setattr(settings, "auth_public_url", "https://app.example.com")
    monkeypatch.setattr(recovery, "SessionLocal", TestingSession)
    messages = []
    monkeypatch.setattr(recovery, "send_recovery_email", lambda email, token: messages.append((email, token)))
    return messages


def request(client):
    return client.post("/api/auth/forgot-password", json={"email": "ana@prisma.com"})


def reset(client, token):
    return client.post("/api/auth/reset-password", json={"token": token, "password": "new-secure-password"})


def test_reset_single_use_revokes_old_sessions(authenticated_client, mail):
    client = authenticated_client
    old_cookie = client.cookies.get("access_token")
    assert request(client).status_code == 202
    token = mail[0][1]
    with TestingSession() as db:
        user = db.scalar(select(User))
        assert user.reset_token_hash == recovery.token_digest(token)
        assert user.reset_token_hash != token
    assert reset(client, token).status_code == 204
    assert reset(client, token).status_code == 400
    client.cookies.set("access_token", old_cookie)
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": "ana@prisma.com", "password": "contrasena-segura"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "ana@prisma.com", "password": "new-secure-password"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_unknown_and_known_have_same_response_and_cooldown(authenticated_client, mail):
    known = request(authenticated_client)
    unknown = authenticated_client.post("/api/auth/forgot-password", json={"email": "missing@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert known.headers["cache-control"] == "no-store"
    request(authenticated_client)
    assert len(mail) == 1


def test_expired_and_replaced_tokens(authenticated_client, mail):
    request(authenticated_client)
    old = mail[0][1]
    with TestingSession() as db:
        user = db.scalar(select(User))
        user.reset_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        user.reset_requested_at = datetime.now(timezone.utc) - timedelta(seconds=61)
        db.commit()
    assert reset(authenticated_client, old).status_code == 400
    request(authenticated_client)
    assert reset(authenticated_client, old).status_code == 400
    assert reset(authenticated_client, mail[-1][1]).status_code == 204


def test_suspended_agency_cannot_recover(authenticated_client, mail):
    request(authenticated_client)
    token = mail[0][1]
    with TestingSession() as db:
        user = db.scalar(select(User))
        user.agency.is_active = False
        db.commit()
    assert reset(authenticated_client, token).status_code == 400
    assert request(authenticated_client).status_code == 202
    assert len(mail) == 1


def test_unconfigured_is_honest_uniform_503(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "smtp_host", "")
    assert request(client).status_code == 503


def test_mail_failure_clears_token_without_logging_secret(authenticated_client, mail, monkeypatch, caplog):
    def fail(email, token):
        raise RuntimeError("sensitive-token-" + token)
    monkeypatch.setattr(recovery, "send_recovery_email", fail)
    assert request(authenticated_client).status_code == 202
    with TestingSession() as db:
        assert db.scalar(select(User)).reset_token_hash is None
    assert "sensitive-token" not in caplog.text
    assert "delivery failed" in caplog.text


def test_token_types_cannot_authenticate_as_user(authenticated_client):
    user_id = authenticated_client.get("/api/auth/me").json()["id"]
    for token in (create_admin_token(user_id), create_portal_token(user_id, "portal")):
        authenticated_client.cookies.clear()
        authenticated_client.cookies.set("access_token", token)
        assert authenticated_client.get("/api/auth/me").status_code == 401


def test_legacy_session_revoked_after_reset(authenticated_client, mail):
    user_id = authenticated_client.get("/api/auth/me").json()["id"]
    token = jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, get_settings().secret_key, algorithm="HS256")
    authenticated_client.cookies.clear()
    authenticated_client.cookies.set("access_token", token)
    assert authenticated_client.get("/api/auth/me").status_code == 200
    request(authenticated_client)
    assert reset(authenticated_client, mail[0][1]).status_code == 204
    authenticated_client.cookies.set("access_token", token)
    assert authenticated_client.get("/api/auth/me").status_code == 401


def test_utf8_password_limit(authenticated_client, mail):
    request(authenticated_client)
    assert authenticated_client.post("/api/auth/reset-password", json={"token": mail[0][1], "password": "界" * 30}).status_code == 422
    assert reset(authenticated_client, mail[0][1]).status_code == 204


def test_concurrent_consumption_only_one_wins(authenticated_client, mail):
    # Separate DB sessions; endpoint itself performs the locking transaction.
    from fastapi import HTTPException, Response
    from app.routers.auth import ResetPasswordRequest, reset_password
    request(authenticated_client)
    payload = ResetPasswordRequest(token=mail[0][1], password="concurrent-new-password")
    def consume():
        with TestingSession() as db:
            try:
                reset_password(payload, Response(), db)
                return 204
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(lambda _: consume(), range(2))) == [204, 400]


def test_recovery_origin_does_not_accept_external_http(mail, monkeypatch):
    for origin in ("http://example.com", "https://example.com?redirect=evil", "https://user:pass@example.com"):
        monkeypatch.setattr(get_settings(), "auth_public_url", origin)
        assert not recovery.recovery_configured()
