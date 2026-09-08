from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import func, select

from app.models import Agent, Client, SolutionInstallation, User
from conftest import TestingSession


SETTINGS = {"instructions": "Answer approved questions.", "personality": "Friendly",
            "temperature": 0.7, "max_tokens": 2048, "memory_limit": 30}


def create(c):
    response = c.post("/api/solutions", json={"name": "Support", "settings": SETTINGS})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def customer(c, name="First"):
    response = c.post("/api/clients", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def install(c, solution, client_id, version=1):
    return c.post(f"/api/solutions/{solution}/installations",
                  json={"client_id": client_id, "version_number": version, "name": "Support agent"})


def test_library_publication_is_immutable_and_pinned(authenticated_client):
    c = authenticated_client
    solution, client_id = create(c), customer(c)
    result = install(c, solution, client_id)
    assert result.status_code == 201, result.text
    installed = result.json()
    assert installed["revision"] == 1 and installed["local_overrides"] == []
    agent = c.get("/api/agents/" + installed["agent_id"]).json()
    assert not agent["is_active"] and not agent["widget_enabled"] and agent["model"] == ""
    assert agent["manual_context"] == "" and agent["brief_products"] == ""
    assert c.get(f'/api/agents/{installed["agent_id"]}/documents').json() == []
    updated = {**SETTINGS, "personality": "Formal"}
    payload = {"expected_latest_version": 1, "settings": updated}
    assert c.post(f"/api/solutions/{solution}/versions", json=payload).status_code == 201
    assert c.post(f"/api/solutions/{solution}/versions", json=payload).status_code == 409
    assert c.get(f"/api/solutions/{solution}/versions/1").json()["settings"] == SETTINGS
    assert c.get(f"/api/solutions/{solution}/versions/2").json()["settings"] == updated
    assert c.get("/api/agents/" + installed["agent_id"]).json() == agent
    assert c.get(f"/api/solutions/{solution}/installations").json() == [installed]
    assert c.patch(f"/api/solutions/{solution}/versions/1", json={"settings": updated}).status_code == 405
    assert c.get("/api/solutions").json()[0]["latest_version"] == 2
    listed = c.get(f"/api/solutions/{solution}/versions?limit=1&offset=1").json()
    assert listed[0]["number"] == 1 and "settings" not in listed[0]


def test_installations_isolate_clients_and_reject_duplicate_without_orphan(authenticated_client):
    c = authenticated_client
    solution, first_client, second_client = create(c), customer(c), customer(c, "Second")
    first, second = install(c, solution, first_client), install(c, solution, second_client)
    assert first.status_code == second.status_code == 201
    assert first.json()["agent_id"] != second.json()["agent_id"]
    assert install(c, solution, first_client).status_code == 409
    assert len(c.get("/api/agents").json()) == 2
    assert c.patch("/api/agents/" + first.json()["agent_id"], json={"client_id": second_client}).status_code == 409
    assert c.patch("/api/agents/" + first.json()["agent_id"], json={"personality": "Custom"}).status_code == 200
    assert c.get("/api/agents/" + second.json()["agent_id"]).json()["personality"] == "Friendly"


def test_cross_agency_cannot_read_publish_or_install(authenticated_client):
    c = authenticated_client
    solution, first_client = create(c), customer(c)
    assert c.post("/api/auth/register", json={"agency_name": "Other", "name": "Owner",
        "email": "other@example.com", "password": "safe-other-password"}).status_code == 201
    other_solution, other_client = create(c), customer(c)
    assert [s["id"] for s in c.get("/api/solutions").json()] == [other_solution]
    for path in ("versions", "versions/1", "installations"):
        assert c.get(f"/api/solutions/{solution}/{path}").status_code == 404
    assert c.post(f"/api/solutions/{solution}/versions", json={"expected_latest_version": 1, "settings": SETTINGS}).status_code == 404
    assert install(c, solution, other_client).status_code == 404
    assert install(c, other_solution, first_client).status_code == 404
    assert c.get("/api/agents").json() == []


def test_authentication_roles_and_suspension(authenticated_client):
    c = authenticated_client
    solution, client_id = create(c), customer(c)
    c.cookies.clear()
    assert c.get("/api/solutions").status_code == 401
    assert install(c, solution, client_id).status_code == 401
    c.post("/api/auth/login", json={"email": "ana@prisma.com", "password": "contrasena-segura"})
    with TestingSession.begin() as db:
        db.scalar(select(User)).role = "operator"
    for path in ("/api/solutions", f"/api/solutions/{solution}/versions/1", f"/api/solutions/{solution}/installations"):
        assert c.get(path).status_code == 403
    assert c.post("/api/solutions", json={"name": "Support", "settings": SETTINGS}).status_code == 403
    assert c.post(f"/api/solutions/{solution}/versions", json={"expected_latest_version": 1, "settings": SETTINGS}).status_code == 403
    assert install(c, solution, client_id).status_code == 403
    with TestingSession.begin() as db:
        user = db.scalar(select(User))
        user.role = "admin"
        user.agency.is_active = False
    assert c.get("/api/solutions").status_code == 403
    assert install(c, solution, client_id).status_code == 403


def test_validation_missing_version_inactive_client_and_no_side_effects(authenticated_client):
    c = authenticated_client
    for body in ({"name": " ", "settings": SETTINGS}, {"name": "x", "settings": {**SETTINGS, "api_key": "secret"}},
                 {"name": "x", "settings": SETTINGS, "agency_id": "injected"}, {"name": "x", "settings": {}}):
        assert c.post("/api/solutions", json=body).status_code == 422
    assert c.get("/api/solutions").json() == []
    solution, client_id = create(c), customer(c)
    assert install(c, solution, client_id, 2).status_code == 404
    assert install(c, solution, client_id, True).status_code == 422
    with TestingSession.begin() as db:
        db.scalar(select(Client)).is_active = False
    assert install(c, solution, client_id).status_code == 409
    assert c.get("/api/solutions?limit=101").status_code == 422
    assert c.get("/api/agents").json() == []


def test_concurrent_publication_and_installation(authenticated_client):
    c = authenticated_client
    solution, client_id = create(c), customer(c)
    def publish(_):
        return c.post(f"/api/solutions/{solution}/versions",
                      json={"expected_latest_version": 1, "settings": SETTINGS}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(publish, range(2))) == [201, 409]
        assert sorted(pool.map(lambda _: install(c, solution, client_id).status_code, range(2))) == [201, 409]
    with TestingSession() as db:
        assert db.scalar(select(func.count()).select_from(Agent)) == 1
        assert db.scalar(select(func.count()).select_from(SolutionInstallation)) == 1
