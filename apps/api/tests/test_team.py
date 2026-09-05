from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import TeamInvitation, User
from conftest import TestingSession


def invite(client, email="operator@example.com", role="operator"):
    result = client.post("/api/team/invitations", json={"email": email, "role": role})
    assert result.status_code == 201, result.text
    return result.json()


def accept(client, token):
    return client.post("/api/team/accept", json={"token": token, "name": "New Teammate", "password": "secure-new-password"})


def login(client, email="operator@example.com"):
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": email, "password": "secure-new-password"}).status_code == 200


def test_invitation_is_single_use_and_no_secret_in_list(authenticated_client):
    client = authenticated_client
    invitation = invite(client)
    listed = client.get("/api/team/invitations").json()
    assert len(listed) == 1
    assert "token" not in str(listed) and "token_hash" not in str(listed)
    with TestingSession() as db:
        assert db.scalar(select(TeamInvitation)).token_hash != invitation["token"]
    assert accept(client, invitation["token"]).status_code == 204
    assert accept(client, invitation["token"]).status_code == 400
    login(client)
    assert client.get("/api/auth/me").json()["role"] == "operator"


def test_operator_permissions_are_server_side(authenticated_client):
    client = authenticated_client
    assert accept(client, invite(client)["token"]).status_code == 204
    login(client)
    for path in ("/api/agents", "/api/clients", "/api/team/members", "/api/team/invitations"):
        assert client.get(path).status_code == 403, path
    assert client.post("/api/team/invitations", json={"email": "intruder@example.com", "role": "admin"}).status_code == 403
    assert client.get("/api/conversations/inbox").status_code == 200
    assert client.get("/api/conversations/inbox-agents").json() == []
    assert client.post("/api/conversations", json={"agent_id": "00000000-0000-0000-0000-000000000000"}).status_code == 403


def test_revocation_and_reissue(authenticated_client):
    client = authenticated_client
    first = invite(client)
    second = invite(client)
    assert accept(client, first["token"]).status_code == 400
    assert client.delete("/api/team/invitations/" + second["id"]).status_code == 204
    assert accept(client, second["token"]).status_code == 400


def test_expiration_and_inactive_agency(authenticated_client):
    token = invite(authenticated_client)["token"]
    with TestingSession() as db:
        invitation = db.scalar(select(TeamInvitation))
        invitation.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert accept(authenticated_client, token).status_code == 400
    token = invite(authenticated_client)["token"]
    with TestingSession() as db:
        db.scalar(select(User)).agency.is_active = False
        db.commit()
    assert accept(authenticated_client, token).status_code == 400


def test_cannot_remove_or_demote_self(authenticated_client):
    client = authenticated_client
    me = client.get("/api/auth/me").json()["id"]
    assert client.patch("/api/team/members/" + me, json={"role": "operator"}).status_code == 409
    assert client.delete("/api/team/members/" + me).status_code == 409


def test_role_change_and_removal_invalidate_sessions(authenticated_client):
    client = authenticated_client
    admin_cookie = client.cookies.get("access_token")
    assert accept(client, invite(client)["token"]).status_code == 204
    login(client)
    member_id = client.get("/api/auth/me").json()["id"]
    member_cookie = client.cookies.get("access_token")
    client.cookies.clear()
    client.cookies.set("access_token", admin_cookie)
    assert client.patch("/api/team/members/" + member_id, json={"role": "admin"}).status_code == 200
    client.cookies.clear()
    client.cookies.set("access_token", member_cookie)
    assert client.get("/api/auth/me").status_code == 401
    login(client)
    member_cookie = client.cookies.get("access_token")
    client.cookies.clear()
    client.cookies.set("access_token", admin_cookie)
    assert client.delete("/api/team/members/" + member_id).status_code == 204
    client.cookies.clear()
    client.cookies.set("access_token", member_cookie)
    assert client.get("/api/auth/me").status_code == 401


def test_cross_agency_member_is_not_accessible(authenticated_client):
    client = authenticated_client
    first_id = client.get("/api/auth/me").json()["id"]
    assert client.post("/api/auth/register", json={"agency_name": "Second Agency", "name": "Second Owner", "email": "second@example.com", "password": "second-password"}).status_code == 201
    assert client.patch("/api/team/members/" + first_id, json={"role": "operator"}).status_code == 404
    assert client.delete("/api/team/members/" + first_id).status_code == 404
    assert len(client.get("/api/team/members").json()) == 1


def test_existing_account_cannot_be_taken_over_by_invitation(authenticated_client):
    assert authenticated_client.post("/api/team/invitations", json={"email": "ana@prisma.com", "role": "admin"}).status_code == 409


def test_operator_can_only_see_own_agency_conversation_and_no_tool_traces(authenticated_client):
    from app.models import Agent, Client, Conversation, Message
    client = authenticated_client
    agency_id = client.get("/api/auth/me").json()["agency"]["id"]
    import uuid
    with TestingSession() as db:
        customer = Client(agency_id=uuid.UUID(agency_id), name="Customer", portal_slug="customer")
        db.add(customer)
        db.flush()
        agent = Agent(agency_id=customer.agency_id, client_id=customer.id, name="Support")
        db.add(agent)
        db.flush()
        conversation = Conversation(agency_id=customer.agency_id, client_id=customer.id, agent_id=agent.id, title="Hello", channel="widget")
        db.add(conversation)
        db.flush()
        db.add(Message(conversation_id=conversation.id, role="assistant", content="Hello", sender_type="ai", tool_calls=[{"secret": "internal-tool-data"}]))
        db.commit()
        cid = str(conversation.id)
    assert accept(client, invite(client)["token"]).status_code == 204
    login(client)
    detail = client.get("/api/conversations/" + cid)
    assert detail.status_code == 200
    assert detail.json()["messages"][0]["tool_calls"] is None
    assert client.post("/api/conversations/" + cid + "/read").status_code == 204
    assert client.patch("/api/conversations/" + cid + "/mode", json={"mode": "human"}).status_code == 200
    assert client.post("/api/conversations/" + cid + "/reply", json={"content": "Human reply"}).status_code == 200
    assert client.post("/api/conversations/" + cid + "/messages", json={"content": "Trigger AI"}).status_code == 403
    assert client.post("/api/auth/register", json={"agency_name": "Other Agency", "name": "Other Owner", "email": "other@example.com", "password": "other-password"}).status_code == 201
    assert client.get("/api/conversations/" + cid).status_code == 404


def test_concurrent_accept_only_one_account(authenticated_client):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException, Response
    from app.routers.team import AcceptInvitation, accept as accept_endpoint
    token = invite(authenticated_client)["token"]
    payload = AcceptInvitation(token=token, name="Operator", password="new-secure-password")
    def consume(_):
        with TestingSession() as db:
            try:
                accept_endpoint(payload, Response(), db)
                return 204
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(consume, range(2))) == [204, 400]


def test_concurrent_admin_demotion_cannot_remove_last_admin(authenticated_client):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException
    from app.routers.team import RoleRequest, change_role
    import uuid
    client = authenticated_client
    admin_id = uuid.UUID(client.get("/api/auth/me").json()["id"])
    assert accept(client, invite(client, role="admin")["token"]).status_code == 204
    with TestingSession() as db:
        other_id = db.scalar(select(User.id).where(User.id != admin_id))
    # Both actors are loaded before either mutation. The agency lock must
    # revalidate the stale administrator after the winner commits.
    from threading import Barrier
    barrier = Barrier(2)
    def demote(pair):
        actor, target = pair
        with TestingSession() as db:
            user = db.get(User, actor)
            barrier.wait(timeout=5)
            try:
                change_role(target, RoleRequest(role="operator"), db, user)
                return 200
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(demote, [(admin_id, other_id), (other_id, admin_id)])) == [200, 403]
    with TestingSession() as db:
        assert len(db.scalars(select(User).where(User.role == "admin")).all()) == 1
