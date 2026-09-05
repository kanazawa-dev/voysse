import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.models import Agent, Client, Conversation, HumanDelivery, Message, SocialChannel, User, WhatsAppChannel, WhatsAppCloudChannel, now_utc
from app.security import encrypt_secret
from app.services import human_delivery as service
from conftest import TestingSession


@pytest.fixture
def setup_delivery(authenticated_client, monkeypatch):
    client = authenticated_client
    user_id = uuid.UUID(client.get("/api/auth/me").json()["id"])
    sender = AsyncMock(return_value="outbound-id")
    monkeypatch.setattr(service, "send_channel_message", sender)
    def create(platform="whatsapp"):
        with TestingSession() as db:
            user = db.get(User, user_id)
            customer = Client(agency_id=user.agency_id, name="Customer", portal_slug=uuid.uuid4().hex)
            db.add(customer)
            db.flush()
            agent = Agent(agency_id=user.agency_id, client_id=customer.id, name="Support")
            db.add(agent)
            db.flush()
            common = dict(agency_id=user.agency_id, client_id=customer.id, agent_id=agent.id, status="connected", is_enabled=True)
            fk = {}
            if platform == "whatsapp":
                channel = WhatsAppChannel(**common)
                db.add(channel)
                db.flush()
                fk = {"whatsapp_channel_id": channel.id}
            elif platform == "whatsapp_cloud":
                channel = WhatsAppCloudChannel(**common, phone_number_id="111", encrypted_access_token=encrypt_secret("fake-token"))
                db.add(channel)
                db.flush()
                fk = {"whatsapp_cloud_channel_id": channel.id}
            elif platform in {"instagram", "messenger"}:
                channel = SocialChannel(**common, platform=platform, account_id=uuid.uuid4().hex, encrypted_access_token=encrypt_secret("fake-token"))
                db.add(channel)
                db.flush()
                fk = {"social_channel_id": channel.id}
            conversation = Conversation(agency_id=user.agency_id, client_id=customer.id, agent_id=agent.id,
                                        channel=platform, mode="human", external_chat_id="222", **fk)
            db.add(conversation)
            db.flush()
            db.add(Message(conversation_id=conversation.id, role="user", content="Hello", sender_type="visitor"))
            db.commit()
            return conversation.id
    return client, user_id, create, sender


def send(client, conversation, key=None, content="Human response"):
    return client.post(f"/api/conversations/{conversation}/reply", json={
        "request_id": str(key or uuid.uuid4()), "content": content,
    })


@pytest.mark.parametrize("platform", ["whatsapp", "whatsapp_cloud", "instagram", "messenger", "widget"])
def test_send_confirmation_and_idempotency(setup_delivery, platform):
    client, _, create, sender = setup_delivery
    cid, key = create(platform), uuid.uuid4()
    first = send(client, cid, key)
    assert first.status_code == 200, first.text
    assert first.json()["deliveries"][0]["status"] == ("published" if platform == "widget" else "confirmed")
    assert send(client, cid, key).status_code == 200
    assert sender.await_count == 1
    assert len(client.get(f"/api/conversations/{cid}").json()["messages"]) == 2
    assert send(client, cid, key, "different text").status_code == 409
    assert sender.await_count == 1


def test_timeout_durable_and_never_replayed(setup_delivery):
    client, _, create, sender = setup_delivery
    cid, key = create(), uuid.uuid4()
    async def ambiguous(*args):
        with TestingSession() as db:
            attempt = db.get(HumanDelivery, key)
            assert attempt.status == "sending"
            assert db.scalar(select(func.count(Message.id)).where(Message.conversation_id == cid)) == 1
        raise HTTPException(502, "secret-provider-token-and-private-text")
    sender.side_effect = ambiguous
    result = send(client, cid, key)
    assert result.status_code == 200
    assert result.json()["deliveries"][0]["status"] == "uncertain"
    assert "secret-provider" not in result.text
    assert len(result.json()["messages"]) == 1
    assert send(client, cid, key).json()["deliveries"][0]["status"] == "uncertain"
    assert sender.await_count == 1


def test_missing_message_id_is_uncertain(setup_delivery):
    client, _, create, sender = setup_delivery
    sender.return_value = None
    result = send(client, create())
    assert result.json()["deliveries"][0]["status"] == "uncertain"
    assert len(result.json()["messages"]) == 1


@pytest.mark.parametrize("change,reason", [("mode", "human_control_required"), ("disabled", "destination_unavailable"), ("window", "reply_window_closed"), ("length", "message_too_long")])
def test_preflight_failure_persisted_without_external_call(setup_delivery, change, reason):
    client, _, create, sender = setup_delivery
    cid = create("whatsapp_cloud")
    with TestingSession() as db:
        conv = db.get(Conversation, cid)
        if change == "mode":
            conv.mode = "ai"
        if change == "disabled":
            conv.whatsapp_cloud_channel.is_enabled = False
        if change == "window":
            db.scalar(select(Message).where(Message.conversation_id == cid)).created_at = now_utc() - timedelta(hours=25)
        db.commit()
    result = send(client, cid, content="x" * 4097 if change == "length" else "Hi")
    assert result.status_code == 200, result.text
    assert result.json()["deliveries"][0]["status"] == "failed"
    assert result.json()["deliveries"][0]["error_code"] == reason
    assert len(result.json()["messages"]) == 1
    sender.assert_not_awaited()


def test_crash_record_is_visible_and_not_resent(setup_delivery):
    client, user_id, create, sender = setup_delivery
    cid, key = create(), uuid.uuid4()
    with TestingSession() as db:
        db.add(HumanDelivery(id=key, conversation_id=cid, actor_id=user_id, sender_name="Operator",
            content="Human response", status="sending", updated_at=now_utc() - timedelta(minutes=3)))
        db.commit()
    assert client.get(f"/api/conversations/{cid}").json()["deliveries"][0]["status"] == "uncertain"
    assert send(client, cid, key).json()["deliveries"][0]["status"] == "uncertain"
    sender.assert_not_awaited()


def test_concurrent_same_key_sends_once(setup_delivery):
    _, user_id, create, sender = setup_delivery
    cid, key = create(), uuid.uuid4()
    def run(_):
        with TestingSession() as db:
            try:
                asyncio.run(service.deliver_human(db, db.get(User, user_id), cid, key, "Human response"))
            except HTTPException as exc:
                assert exc.status_code == 409  # Another process still owns the lock.
    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(run, range(2)))
    assert sender.await_count == 1
    with TestingSession() as db:
        assert db.scalar(select(func.count(HumanDelivery.id))) == 1
        assert db.scalar(select(func.count(Message.id)).where(Message.sender_type == "human")) == 1


def test_agency_isolation_and_key_conflict(setup_delivery):
    client, _, create, sender = setup_delivery
    cid = create()
    key = uuid.uuid4()
    assert send(client, cid, key).status_code == 200
    assert send(client, create(), key).status_code == 409
    client.post("/api/auth/register", json={"agency_name": "Other agency", "name": "Other admin",
        "email": "other@agency.com", "password": "other-password"})
    assert send(client, cid).status_code == 404
    assert client.get(f"/api/conversations/{cid}").status_code == 404
    assert sender.await_count == 1


def test_customer_deletion_cascades_attempts(setup_delivery):
    client, _, create, _ = setup_delivery
    cid = create("widget")
    send(client, cid)
    customer = client.get(f"/api/conversations/{cid}").json()["client_id"]
    assert client.delete(f"/api/clients/{customer}").status_code == 204
    with TestingSession() as db:
        assert db.scalar(select(func.count(HumanDelivery.id))) == 0


def test_cloud_does_not_silently_truncate(monkeypatch):
    from app.services import whatsapp_cloud
    sender = AsyncMock()
    monkeypatch.setattr(whatsapp_cloud, "_graph_request", sender)
    with pytest.raises(HTTPException) as error:
        asyncio.run(whatsapp_cloud.send_text("token", "111", "222", "a" * 4097))
    assert error.value.status_code == 400
    sender.assert_not_awaited()


def test_busy_conversation_does_not_block_same_event_loop(setup_delivery):
    _, user_id, create, sender = setup_delivery
    cid = create()
    async def scenario():
        entered, release = asyncio.Event(), asyncio.Event()
        async def slow(*args):
            entered.set()
            await release.wait()
            return "external-id"
        sender.side_effect = slow
        with TestingSession() as first, TestingSession() as second:
            task = asyncio.create_task(service.deliver_human(first, first.get(User, user_id), cid, uuid.uuid4(), "First"))
            await entered.wait()
            try:
                with pytest.raises(HTTPException) as error:
                    await service.deliver_human(second, second.get(User, user_id), cid, uuid.uuid4(), "Second")
                assert error.value.status_code == 409
            finally:
                release.set()
                await task
    asyncio.run(scenario())
    assert sender.await_count == 1


def test_return_to_ai_between_persist_and_send_cancels(setup_delivery, monkeypatch):
    _, user_id, create, sender = setup_delivery
    cid = create()
    with TestingSession() as db:
        commit = db.commit
        first = True
        def commit_then_handoff():
            nonlocal first
            commit()
            if first:
                first = False
                with TestingSession() as operator:
                    operator.get(Conversation, cid).mode = "ai"
                    operator.commit()
        monkeypatch.setattr(db, "commit", commit_then_handoff)
        asyncio.run(service.deliver_human(db, db.get(User, user_id), cid, uuid.uuid4(), "Hi"))
    sender.assert_not_awaited()
    with TestingSession() as db:
        attempt = db.scalar(select(HumanDelivery))
        assert attempt.status == "failed"
        assert attempt.error_code == "human_control_required"
