from fastapi.testclient import TestClient

from app import config
from app.models import AdminUser
from app.security import hash_password
from tests.conftest import TestingSession


def _create_admin(email: str = "team@voysse.com", password: str = "very-secure-key") -> None:
    db = TestingSession()
    try:
        db.add(AdminUser(name="Voysse Team", email=email, password_hash=hash_password(password)))
        db.commit()
    finally:
        db.close()


def test_admin_endpoints_require_auth(client: TestClient):
    assert client.get("/api/admin/auth/me").status_code == 401
    assert client.get("/api/admin/leads").status_code == 401
    assert client.get("/api/admin/agencies").status_code == 401


def test_admin_login_and_lists(client: TestClient):
    _create_admin()
    login = client.post("/api/admin/auth/login", json={"email": "team@voysse.com", "password": "very-secure-key"})
    assert login.status_code == 200
    assert client.get("/api/admin/auth/me").json()["email"] == "team@voysse.com"

    client.post("/api/public/cloud-interest", json={"name": "Eve", "email": "eve@other.com", "agency_name": "Other Co"})
    leads = client.get("/api/admin/leads")
    assert leads.status_code == 200
    assert leads.json()[0]["email"] == "eve@other.com"

    client.post(
        "/api/auth/register",
        json={"agency_name": "Luna Studio", "name": "Owner", "email": "equipo@luna.com", "password": "very-secure-key"},
    )
    agencies = client.get("/api/admin/agencies")
    assert agencies.status_code == 200
    entry = next(a for a in agencies.json() if a["name"] == "Luna Studio")
    assert entry["is_active"] is True
    assert entry["owner_email"] == "equipo@luna.com"
    assert entry["user_count"] == 1

    assert client.post("/api/admin/auth/logout").status_code == 204
    assert client.get("/api/admin/auth/me").status_code == 401


def test_wrong_admin_credentials_are_rejected(client: TestClient):
    _create_admin()
    bad = client.post("/api/admin/auth/login", json={"email": "team@voysse.com", "password": "wrong-password"})
    assert bad.status_code == 401
    assert client.get("/api/admin/auth/me").status_code == 401


def test_suspending_an_agency_blocks_its_users(client: TestClient):
    _create_admin()
    client.post("/api/admin/auth/login", json={"email": "team@voysse.com", "password": "very-secure-key"})

    register = client.post(
        "/api/auth/register",
        json={"agency_name": "Norte Agency", "name": "Owner", "email": "owner@norte.com", "password": "very-secure-key"},
    )
    agency_id = register.json()["agency"]["id"]
    client.post("/api/auth/logout")

    agencies = client.get("/api/admin/agencies").json()
    entry = next(a for a in agencies if a["id"] == agency_id)
    assert entry["is_active"] is True

    suspended = client.patch(f"/api/admin/agencies/{agency_id}", json={"is_active": False})
    assert suspended.status_code == 200
    assert suspended.json()["is_active"] is False

    blocked = client.post("/api/auth/login", json={"email": "owner@norte.com", "password": "very-secure-key"})
    assert blocked.status_code == 403

    reactivated = client.patch(f"/api/admin/agencies/{agency_id}", json={"is_active": True})
    assert reactivated.status_code == 200
    allowed = client.post("/api/auth/login", json={"email": "owner@norte.com", "password": "very-secure-key"})
    assert allowed.status_code == 200


def test_suspending_kicks_out_an_active_session(client: TestClient):
    _create_admin()
    register = client.post(
        "/api/auth/register",
        json={"agency_name": "Sur Agency", "name": "Owner", "email": "owner@sur.com", "password": "very-secure-key"},
    )
    agency_id = register.json()["agency"]["id"]
    assert client.get("/api/auth/me").status_code == 200

    client.post("/api/admin/auth/login", json={"email": "team@voysse.com", "password": "very-secure-key"})
    # Suspending as the admin logs the admin's own session into the admin
    # cookie, not the agency cookie, so the agency session cookie set earlier
    # by /auth/register is still the one TestClient sends on /api/auth/me.
    client.patch(f"/api/admin/agencies/{agency_id}", json={"is_active": False})

    assert client.get("/api/auth/me").status_code == 403


def test_require_agency_approval_gates_new_registrations(client: TestClient, monkeypatch):
    monkeypatch.setenv("REQUIRE_AGENCY_APPROVAL", "true")
    config.get_settings.cache_clear()
    try:
        _create_admin()
        client.post("/api/admin/auth/login", json={"email": "team@voysse.com", "password": "very-secure-key"})

        register = client.post(
            "/api/auth/register",
            json={"agency_name": "Pendiente Co", "name": "Owner", "email": "owner@pendiente.com", "password": "very-secure-key"},
        )
        assert register.status_code == 201
        assert register.json()["agency"]["is_active"] is False
        # No working session was set for the pending agency.
        assert "access_token" not in client.cookies

        blocked = client.post("/api/auth/login", json={"email": "owner@pendiente.com", "password": "very-secure-key"})
        assert blocked.status_code == 403
        assert blocked.json()["detail"] == "agency_pending_approval"

        agency_id = register.json()["agency"]["id"]
        activated = client.patch(f"/api/admin/agencies/{agency_id}", json={"is_active": True})
        assert activated.status_code == 200

        allowed = client.post("/api/auth/login", json={"email": "owner@pendiente.com", "password": "very-secure-key"})
        assert allowed.status_code == 200
    finally:
        config.get_settings.cache_clear()
