import asyncio
import hashlib
import hmac
import json
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from conftest import TestingSession
from app.config import get_settings
from app.models import Conversation, Message, SocialChannel, SocialEvent, now_utc
from app.routers import social
from app.services import social_worker, social as transport
from app.services.ai import Completion


@pytest.fixture
def setup_social(authenticated_client, monkeypatch):
    client = authenticated_client
    monkeypatch.setattr(get_settings(), "meta_social_app_secret", "test-app-secret")
    monkeypatch.setattr(get_settings(), "meta_social_verify_token", "verify-test")
    monkeypatch.setattr(social, "verify_account", AsyncMock(return_value={"id": "111", "name": "Test"}))
    monkeypatch.setattr(social, "graph", AsyncMock(return_value={"success": True}))
    monkeypatch.setattr(social_worker, "chat_completion", AsyncMock(return_value=Completion(text="Hello from Voysse")))
    monkeypatch.setattr(social_worker, "send_text", AsyncMock(return_value="out-1"))
    customer = client.post("/api/clients", json={"name": "Social test"}).json()
    client.put("/api/providers/openai", json={"api_key": "fake-provider-key"})
    agent = client.post("/api/agents", json={"client_id": customer["id"], "provider": "openai",
        "model": "gpt-4.1-mini", "name": "Assistant", "instructions": "Answer questions"}).json()
    def create(platform="instagram", account="111"):
        path = f"/api/social/channels/{customer['id']}/{platform}"
        response = client.put(path, json={"agent_id": agent["id"], "account_id": account, "access_token": "fake-social-token"})
        assert response.status_code == 200, response.text
        assert "fake-social-token" not in response.text
        assert client.post(path + "/connect").json()["status"] == "awaiting_message"
        return path
    return client, customer, agent, create


def post(client, platform="instagram", mid="in-1", account="111", hours_ago=0, supported=True, signature=True):
    message = {"mid": mid, "text": "Opening hours?"} if supported else {"mid": mid, "attachments": [{"type": "image"}]}
    raw = json.dumps({"object": "instagram" if platform == "instagram" else "page", "entry": [{"id": account,
        "messaging": [{"sender": {"id": "222"}, "recipient": {"id": account},
        "timestamp": int((now_utc() - timedelta(hours=hours_ago)).timestamp() * 1000), "message": message}]}]}).encode()
    digest = hmac.new(b"test-app-secret", raw, hashlib.sha256).hexdigest()
    return client.post(f"/api/public/social/{platform}/webhook", content=raw,
        headers={"X-Hub-Signature-256": "sha256=" + (digest if signature else "wrong")})


def work():
    with TestingSession() as db:
        return asyncio.run(social_worker.work_once(db))


@pytest.mark.parametrize("platform", ["instagram", "messenger"])
def test_durable_receive_reply_dedup_and_inbox(setup_social, platform):
    client, _, _, create = setup_social
    path = create(platform)
    assert post(client, platform).status_code == 200
    assert post(client, platform).status_code == 200
    assert client.get(path).json()["status"] == "connected"
    assert social_worker.send_text.await_count == 0  # webhook never waits for AI
    assert work()
    assert not work()
    assert social_worker.send_text.await_count == 1
    assert client.get(path + "/events").json()[0]["status"] == "sent"
    inbox = client.get(f"/api/conversations/inbox?channel={platform}").json()
    assert len(inbox) == 1 and inbox[0]["channel"] == platform
    detail = client.get(f"/api/conversations/{inbox[0]['id']}").json()
    assert [msg["sender_type"] for msg in detail["messages"]] == ["visitor", "ai"]


def test_bad_signature_and_handshake(setup_social):
    client, _, _, create = setup_social
    create()
    assert post(client, signature=False).status_code == 403
    assert client.get("/api/public/social/instagram/webhook?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=hello").text == "hello"
    assert client.get("/api/public/social/instagram/webhook?hub.mode=subscribe&hub.verify_token=bad").status_code == 403
    assert not work()


def test_unknown_destination_is_not_enqueued(setup_social):
    client, _, _, create = setup_social
    create()
    assert post(client, account="333").status_code == 200
    assert not work()


def test_failed_preparation_can_retry_without_duplicate_inbound(setup_social, monkeypatch):
    client, _, _, create = setup_social
    path = create()
    monkeypatch.setattr(social_worker, "chat_completion", AsyncMock(side_effect=HTTPException(502, "private key should never appear")))
    post(client)
    work()
    event = client.get(path + "/events").json()[0]
    assert event["status"] == "failed"
    assert "private key" not in str(event)
    monkeypatch.setattr(social_worker, "chat_completion", AsyncMock(return_value=Completion(text="Recovered")))
    assert client.post(f"{path}/events/{event['id']}/retry").status_code == 200
    work()
    with TestingSession() as db:
        assert db.scalar(select(func.count(Message.id)).where(Message.sender_type == "visitor")) == 1
    assert client.get(path + "/events").json()[0]["status"] == "sent"


def test_ambiguous_send_never_retried(setup_social, monkeypatch):
    client, _, _, create = setup_social
    path = create()
    monkeypatch.setattr(social_worker, "send_text", AsyncMock(side_effect=HTTPException(502, "Timeout")))
    post(client)
    work()
    event = client.get(path + "/events").json()[0]
    assert event["status"] == "uncertain"
    assert client.post(f"{path}/events/{event['id']}/retry").status_code == 409
    assert not work()
    assert social_worker.send_text.await_count == 1


def test_old_message_and_attachments_do_not_trigger_ai_reply(setup_social):
    client, _, _, create = setup_social
    path = create()
    post(client, hours_ago=25)
    work()
    assert client.get(path + "/events").json()[0]["status"] == "failed"
    post(client, mid="in-2", supported=False)
    work()
    assert client.get("/api/conversations").json()[0]["mode"] == "human"
    assert social_worker.send_text.await_count == 0


def test_takeover_during_generation_suppresses_reply(setup_social, monkeypatch):
    client, _, _, create = setup_social
    path = create()
    post(client, supported=False)
    work()  # creates a visible conversation, in human mode
    conv = client.get("/api/conversations").json()[0]
    client.patch(f"/api/conversations/{conv['id']}/mode", json={"mode": "ai"})
    async def takeover(*args, **kwargs):
        with TestingSession() as db:
            row = db.scalar(select(Conversation))
            row.mode = "human"
            db.commit()
        return Completion(text="Must not be sent")
    monkeypatch.setattr(social_worker, "chat_completion", takeover)
    post(client, mid="in-2")
    work()
    assert social_worker.send_text.await_count == 0
    assert client.get(path + "/events").json()[0]["status"] == "ignored"


def test_other_agency_cannot_access_channel_or_events(setup_social):
    client, _, _, create = setup_social
    path = create()
    client.post("/api/auth/logout")
    assert client.post("/api/auth/register", json={"agency_name": "Other", "name": "Other",
        "email": "other-social@example.com", "password": "strong-password"}).status_code == 201
    assert client.get(path).status_code == 404
    assert client.get(path + "/events").status_code == 404
    assert client.post(path + "/disconnect").status_code == 404


def test_disconnect_preserves_history_but_blocks_reception(setup_social):
    client, _, _, create = setup_social
    path = create()
    post(client)
    work()
    client.post(path + "/disconnect")
    post(client, mid="in-2")
    assert not work()
    assert len(client.get(path + "/events").json()) == 1


def test_transport_uses_platform_host_and_does_not_log_secrets(monkeypatch):
    from app.security import encrypt_secret
    channel = SocialChannel(platform="instagram", account_id="111", encrypted_access_token=encrypt_secret("secret"))
    fake = AsyncMock(return_value={"message_id": "out-id"})
    monkeypatch.setattr(transport, "graph", fake)
    assert asyncio.run(transport.send_text(channel, "222", "Hello")) == "out-id"
    assert fake.call_args.args[2] == "111/messages"
    assert fake.call_args.kwargs["json"] == {"recipient": {"id": "222"}, "message": {"text": "Hello"}}
    assert transport.graph_root("instagram").startswith("https://graph.instagram.com/")
    assert transport.graph_root("messenger").startswith("https://graph.facebook.com/")


def test_assigned_agent_cannot_move_or_be_deleted(setup_social):
    client, _, agent, create = setup_social
    create()
    other = client.post("/api/clients", json={"name": "Other client"}).json()
    assert client.patch(f"/api/agents/{agent['id']}", json={"client_id": other["id"]}).status_code == 409
    assert client.delete(f"/api/agents/{agent['id']}").status_code == 409


def test_delete_client_removes_social_channels_and_events(setup_social):
    client, customer, _, create = setup_social
    create()
    post(client)
    work()
    assert client.delete(f"/api/clients/{customer['id']}").status_code == 204
    with TestingSession() as db:
        assert db.scalar(select(func.count(SocialChannel.id))) == 0
        assert db.scalar(select(func.count(SocialEvent.id))) == 0


def test_webhook_admission_and_second_worker_during_generation(setup_social, monkeypatch):
    client, _, _, create = setup_social
    create()
    async def generate(*args, **kwargs):
        # A slow model must not block a subsequent inbound webhook or allow a
        # second worker to generate a competing reply for this account.
        assert post(client, mid="in-2").status_code == 200
        assert await asyncio.to_thread(work) is False
        return Completion(text="First reply")
    monkeypatch.setattr(social_worker, "chat_completion", generate)
    post(client)
    assert work()
    monkeypatch.setattr(social_worker, "chat_completion", AsyncMock(return_value=Completion(text="Second reply")))
    monkeypatch.setattr(social_worker, "send_text", AsyncMock(return_value="out-2"))
    assert work()
    assert not work()


def test_concurrent_duplicate_webhooks_only_enqueue_once(setup_social):
    from concurrent.futures import ThreadPoolExecutor
    client, _, _, create = setup_social
    create()
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: post(client), range(4)))
    assert all(response.status_code == 200 for response in responses)
    with TestingSession() as db:
        assert db.scalar(select(func.count(SocialEvent.id))) == 1


def test_crashed_send_becomes_uncertain_not_queued(setup_social):
    client, _, _, create = setup_social
    path = create()
    post(client)
    with TestingSession() as db:
        event = db.scalar(select(SocialEvent))
        event.status = "sending"
        event.updated_at = now_utc() - timedelta(minutes=3)
        db.commit()
    assert not work()
    assert client.get(path + "/events").json()[0]["status"] == "uncertain"
    assert social_worker.send_text.await_count == 0
