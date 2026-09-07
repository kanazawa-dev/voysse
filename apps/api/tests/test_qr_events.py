import asyncio
import uuid
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select, func

from app.config import get_settings
from app.models import Conversation, Message, WhatsAppQREvent, WhatsAppChannel, now_utc
from app.services import whatsapp_qr_worker as worker, whatsapp_inbound, ai
from conftest import TestingSession


@pytest.fixture
def setup(authenticated_client, monkeypatch):
    client = authenticated_client
    customer = client.post("/api/clients", json={"name": "QR customer", "is_active": True}).json()
    client.put("/api/providers/openai", json={"api_key": "secret"})
    agent = client.post("/api/agents", json={"client_id": customer["id"], "provider": "openai",
        "model": "gpt-4.1-mini", "name": "Host", "is_active": True}).json()
    channel = client.put(f"/api/whatsapp/channels/{customer['id']}", json={"agent_id": agent["id"]}).json()
    with TestingSession() as db:
        row = db.get(WhatsAppChannel, uuid.UUID(channel["id"]))
        row.status, row.phone_number = "connected", "569123"
        db.commit()
    generate = AsyncMock(return_value=ai.Completion(text="Durable reply"))
    send = AsyncMock(return_value={"external_message_id": "out-1"})
    monkeypatch.setattr(whatsapp_inbound, "run_completion", generate)
    monkeypatch.setattr(worker, "bridge_command", send)
    return client, customer, channel, generate, send


def enqueue(setup, mid="in-1", **kwargs):
    return setup[0].post(f"/api/internal/whatsapp/channels/{setup[2]['id']}/inbound",
        headers={"X-Bridge-Token": get_settings().whatsapp_bridge_token},
        json={"external_message_id": mid, "remote_jid": "5730011@s.whatsapp.net",
              "source_phone_number": "569123", "text": "Hello", **kwargs})


def work():
    with TestingSession() as db:
        return asyncio.run(worker.work_once(db))


def event():
    with TestingSession() as db:
        return db.scalar(select(WhatsAppQREvent))


def test_admission_durable_deduplicated_and_worker_separate(setup):
    assert enqueue(setup).status_code == 200
    assert enqueue(setup).status_code == 200
    assert event().status == "queued"
    setup[3].assert_not_awaited()
    setup[4].assert_not_awaited()
    assert work()
    assert not work()
    assert event().status == "sent"
    assert setup[3].await_count == setup[4].await_count == 1


def test_published_policy_routes_reply_to_target_agent(setup, monkeypatch):
    from app.models import ExecutionTurn
    from test_flows import _mock_routed_completions, _publish_handoff_policy

    client, customer, channel, _generate, send = setup
    specialist = client.post("/api/agents", json={"client_id": customer["id"], "provider": "openai",
        "model": "gpt-4.1-mini", "name": "Specialist", "is_active": True}).json()
    execution_dispatch = _publish_handoff_policy(client, customer["id"], channel["agent_id"], specialist["id"])
    _mock_routed_completions(execution_dispatch, monkeypatch,
        '{"rule_index":0,"reason":"Technical question"}', "Routed QR reply.")
    send.return_value = {"external_message_id": "out-route-1"}

    enqueue(setup, text="I need technical help")
    assert work()
    assert not work()
    assert event().status == "sent"
    with TestingSession() as db:
        message = db.scalar(select(Message).where(Message.role == "assistant"))
        assert message.sender_name == "Specialist"
        assert message.content == "Routed QR reply."
        assert message.external_message_id == "out-route-1"
        turn = db.scalar(select(ExecutionTurn))
        assert turn.status == "completed" and len(turn.transitions) == 1


def test_published_policy_send_failure_marks_turn_uncertain(setup, monkeypatch):
    from app.models import ExecutionTurn
    from test_flows import _mock_routed_completions, _publish_handoff_policy

    client, customer, channel, _generate, send = setup
    specialist = client.post("/api/agents", json={"client_id": customer["id"], "provider": "openai",
        "model": "gpt-4.1-mini", "name": "Specialist", "is_active": True}).json()
    execution_dispatch = _publish_handoff_policy(client, customer["id"], channel["agent_id"], specialist["id"])
    _mock_routed_completions(execution_dispatch, monkeypatch,
        '{"rule_index":0,"reason":"Technical question"}', "Routed reply that will never arrive.")
    send.side_effect = RuntimeError("bridge unreachable")

    enqueue(setup, text="I need technical help")
    assert work()
    assert not work()
    assert event().status == "uncertain"
    with TestingSession() as db:
        assert not list(db.scalars(select(Message).where(Message.role == "assistant")))
        turn = db.scalar(select(ExecutionTurn))
        assert turn.status == "uncertain"


def test_failed_preparation_is_visible_without_replay(setup):
    setup[3].side_effect = RuntimeError("secret-and-private-provider-payload")
    enqueue(setup)
    assert work()
    assert event().status == "needs_review"
    assert not work()
    response = setup[0].get(f"/api/whatsapp/channels/{setup[1]['id']}/events")
    assert response.status_code == 200
    assert response.json()[0]["error_code"] == "preparation_failed"
    assert "secret-and-private" not in response.text
    with TestingSession() as db:
        assert db.scalar(select(func.count(Message.id))) == 1


def test_delivery_timeout_is_uncertain_and_not_replayed(setup):
    setup[4].side_effect = RuntimeError("request-secret")
    enqueue(setup)
    assert work()
    assert event().status == "uncertain"
    assert not work()
    assert setup[4].await_count == 1
    with TestingSession() as db:
        assert db.scalar(select(func.count(Message.id)).where(Message.role == "assistant")) == 0


class SimulatedCrash(BaseException):
    pass


def test_preparation_crash_never_replays_tool_effects(setup):
    setup[3].side_effect = SimulatedCrash()
    enqueue(setup)
    with pytest.raises(SimulatedCrash):
        work()
    assert event().status == "preparing"
    assert work()
    assert event().status == "needs_review"
    assert event().error_code == "preparation_interrupted"
    assert setup[3].await_count == 1
    setup[4].assert_not_awaited()


def test_ready_crash_recovers_without_regeneration(setup, monkeypatch):
    enqueue(setup)
    with TestingSession() as db:
        commit = db.commit
        def crash_after_ready():
            commit()
            if db.scalar(select(WhatsAppQREvent)).status == "ready":
                raise SimulatedCrash()
        monkeypatch.setattr(db, "commit", crash_after_ready)
        with pytest.raises(SimulatedCrash):
            asyncio.run(worker.work_once(db))
    assert event().status == "ready"
    assert work()
    assert event().status == "sent"
    assert setup[3].await_count == setup[4].await_count == 1


def test_sending_crash_never_resends(setup):
    setup[4].side_effect = SimulatedCrash()
    enqueue(setup)
    with pytest.raises(SimulatedCrash):
        work()
    assert event().status == "sending"
    assert work()
    assert event().status == "uncertain"
    assert setup[4].await_count == 1


def test_other_worker_cannot_steal_and_webhook_still_admitted(setup):
    async def generate(*args, **kwargs):
        with TestingSession() as other:
            assert not await worker.work_once(other)
        assert enqueue(setup, mid="in-2").status_code == 200
        return ai.Completion(text="Hello")
    setup[3].side_effect = generate
    enqueue(setup)
    assert work()
    assert event().status in {"sent", "queued"}
    assert setup[4].await_count == 1
    with TestingSession() as db:
        assert db.scalar(select(func.count(WhatsAppQREvent.id))) == 2


def test_events_are_agency_scoped(setup):
    enqueue(setup)
    setup[0].post("/api/auth/register", json={"agency_name":"Other", "name":"Other User", "email":"other@example.com", "password":"other-password"})
    assert setup[0].get(f"/api/whatsapp/channels/{setup[1]['id']}/events").status_code == 404


def test_storage_failure_never_acknowledged(setup, monkeypatch):
    from app.main import app
    from app.database import get_db
    from sqlalchemy.exc import SQLAlchemyError
    def broken_db():
        with TestingSession() as db:
            def fail():
                raise SQLAlchemyError("simulated storage failure")
            db.commit = fail
            yield db
    monkeypatch.setitem(app.dependency_overrides, get_db, broken_db)
    with pytest.raises(SQLAlchemyError):
        enqueue(setup)
    assert event() is None
    setup[3].assert_not_awaited()


def test_changed_destination_requires_review_without_generation(setup):
    from app.models import WhatsAppChannel
    enqueue(setup)
    with TestingSession() as db:
        db.get(WhatsAppChannel, uuid.UUID(setup[2]["id"])).phone_number = "999"
        db.commit()
    assert work()
    assert event().error_code == "destination_changed"
    setup[3].assert_not_awaited()
    setup[4].assert_not_awaited()



def test_disconnected_waits_and_reconnects(setup):
    enqueue(setup)
    with TestingSession() as db:
        row = db.get(WhatsAppChannel, uuid.UUID(setup[2]["id"]))
        row.status = "reconnecting"
        db.commit()
    assert not work()
    assert event().status == "queued"
    setup[3].assert_not_awaited()
    with TestingSession() as db:
        db.get(WhatsAppChannel, uuid.UUID(setup[2]["id"])).status = "connected"
        db.commit()
    assert work()
    assert event().status == "sent"
    assert setup[4].await_args.args[2]["expected_phone_number"] == "569123"


@pytest.mark.parametrize("payload", [
    {"media_base64": "not base64!"},
    {"remote_jid": "123@g.us"},
    {"source_phone_number": ""},
])
def test_invalid_inbound_not_admitted(setup, payload):
    assert enqueue(setup, **payload).status_code == 422
    assert event() is None


def test_missing_media_needs_human_without_hallucinated_reply(setup):
    enqueue(setup, media_kind="image", media_mime="image/jpeg")
    assert work()
    assert event().error_code == "media_unavailable"
    setup[3].assert_not_awaited()
    setup[4].assert_not_awaited()
    with TestingSession() as db:
        assert db.get(Conversation, event().conversation_id).mode == "human"


def test_queue_freshness_is_not_reset_by_reconnection(setup):
    enqueue(setup)
    with TestingSession() as db:
        db.get(WhatsAppQREvent, event().id).received_at = now_utc() - timedelta(hours=25)
        db.commit()
    assert work()
    assert event().error_code == "queue_expired"
    setup[3].assert_not_awaited()
    setup[4].assert_not_awaited()


def test_human_takeover_during_generation_prevents_send(setup):
    async def generate(*args, **kwargs):
        with TestingSession() as db:
            db.scalar(select(Conversation)).mode = "human"
            db.commit()
        return ai.Completion(text="Should not send")
    setup[3].side_effect = generate
    enqueue(setup)
    assert work()
    assert event().status == "ignored"
    setup[4].assert_not_awaited()


@pytest.mark.parametrize("confirmation", [None, "", " "])
def test_missing_confirmation_is_uncertain(setup, confirmation):
    setup[4].return_value = {"external_message_id": confirmation}
    enqueue(setup)
    assert work()
    assert event().status == "uncertain"
    assert not work()
    with TestingSession() as db:
        assert db.scalar(select(func.count(Message.id)).where(Message.role == "assistant")) == 0


def test_disabled_destination_not_generated(setup):
    enqueue(setup)
    with TestingSession() as db:
        db.get(WhatsAppChannel, uuid.UUID(setup[2]["id"])).is_enabled = False
        db.commit()
    assert work()
    assert event().status == "ignored"
    setup[3].assert_not_awaited()


def test_inbound_requires_bridge_authentication(setup):
    response = setup[0].post(f"/api/internal/whatsapp/channels/{setup[2]['id']}/inbound",
        json={"external_message_id": "x", "remote_jid": "1@lid", "source_phone_number": "569123"})
    assert response.status_code == 401
    assert event() is None


def test_ready_reply_waits_for_reconnection_without_regeneration(setup):
    async def generate(*args, **kwargs):
        with TestingSession() as db:
            db.get(WhatsAppChannel, uuid.UUID(setup[2]["id"])).status = "reconnecting"
            db.commit()
        return ai.Completion(text="Prepared")
    setup[3].side_effect = generate
    enqueue(setup)
    assert work()
    assert event().status == "ready"
    assert not work()
    with TestingSession() as db:
        db.get(WhatsAppChannel, uuid.UUID(setup[2]["id"])).status = "connected"
        db.commit()
    assert work()
    assert event().status == "sent"
    assert setup[3].await_count == setup[4].await_count == 1


def test_concurrent_admission_is_unique(setup):
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: enqueue(setup), range(2)))
    assert all(response.status_code == 200 for response in responses)
    assert sorted(response.json()['accepted'] for response in responses) == [False, True]
    with TestingSession() as db:
        assert db.scalar(select(func.count(WhatsAppQREvent.id))) == 1


def test_takeover_after_sending_checkpoint_prevents_external_effect(setup, monkeypatch):
    enqueue(setup)
    with TestingSession() as db:
        commit = db.commit
        takeover = False
        def commit_with_takeover():
            nonlocal takeover
            commit()
            current = db.scalar(select(WhatsAppQREvent))
            if current.status == 'sending' and not takeover:
                takeover = True
                with TestingSession() as other:
                    other.get(Conversation, current.conversation_id).mode = 'human'
                    other.commit()
        monkeypatch.setattr(db, 'commit', commit_with_takeover)
        assert asyncio.run(worker.work_once(db))
    assert event().status == 'ignored'
    setup[4].assert_not_awaited()


def test_overlong_reply_requires_review(setup):
    setup[3].return_value = ai.Completion(text='x' * 4097)
    enqueue(setup)
    assert work()
    assert event().error_code == 'reply_too_long'
    setup[4].assert_not_awaited()


def test_operator_cannot_read_channel_events(setup):
    from app.models import User
    enqueue(setup)
    with TestingSession() as db:
        db.scalar(select(User)).role = 'operator'
        db.commit()
    assert setup[0].get(f"/api/whatsapp/channels/{setup[1]['id']}/events").status_code == 403
