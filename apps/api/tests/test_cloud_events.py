import asyncio
import json
import uuid
from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select, func

from app.models import Conversation, Message, WhatsAppCloudEvent, now_utc
from app.services import whatsapp_cloud_worker as worker, whatsapp_inbound, ai
from conftest import TestingSession
from test_whatsapp_cloud import _setup_channel, _post_signed, _webhook_payload, _sign


@pytest.fixture
def setup(authenticated_client, monkeypatch):
    client = authenticated_client
    customer, agent, channel = _setup_channel(client)
    generate = AsyncMock(return_value=ai.Completion(text="Durable reply"))
    send = AsyncMock(return_value="out-1")
    monkeypatch.setattr(whatsapp_inbound, "run_completion", generate)
    monkeypatch.setattr(worker, "send_text", send)
    return client, customer, channel, generate, send


def enqueue(setup, mid="in-1", **kwargs):
    client, _, channel, _, _ = setup
    message = {"from":"5730011", "id":mid, "type":"text", "text":{"body":"Hello"}, **kwargs}
    return _post_signed(client, channel["id"], _webhook_payload([message]), drain=False)


def work():
    with TestingSession() as db:
        return asyncio.run(worker.work_once(db))


def event():
    with TestingSession() as db:
        return db.scalar(select(WhatsAppCloudEvent))


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


def test_failed_preparation_is_visible_without_replay(setup):
    setup[3].side_effect = RuntimeError("secret-and-private-provider-payload")
    enqueue(setup)
    assert work()
    assert event().status == "needs_review"
    assert not work()
    response = setup[0].get(f"/api/whatsapp-cloud/channels/{setup[1]['id']}/events")
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
            if db.scalar(select(WhatsAppCloudEvent)).status == "ready":
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
        assert db.scalar(select(func.count(WhatsAppCloudEvent.id))) == 2


def test_expired_provider_timestamp_not_reopened_by_arrival(setup):
    enqueue(setup, timestamp=str(int((now_utc() - timedelta(hours=25)).timestamp())))
    assert work()
    assert event().error_code == "reply_window_closed"
    setup[3].assert_not_awaited()
    setup[4].assert_not_awaited()
    with TestingSession() as db:
        visitor = db.scalar(select(Message))
        assert visitor.created_at > now_utc() - timedelta(minutes=1)
        assert visitor.external_received_at < now_utc() - timedelta(hours=24)


def test_foreign_destination_not_accepted(setup):
    payload = _webhook_payload([{"from":"5730011","id":"wrong","type":"text","text":{"body":"Hi"}}])
    payload["entry"][0]["changes"][0]["value"]["metadata"]["phone_number_id"] = "other-number"
    assert _post_signed(setup[0], setup[2]["id"], payload, drain=False).status_code == 200
    assert event() is None


def test_events_are_agency_scoped(setup):
    enqueue(setup)
    setup[0].post("/api/auth/register", json={"agency_name":"Other", "name":"Other User", "email":"other@example.com", "password":"other-password"})
    assert setup[0].get(f"/api/whatsapp-cloud/channels/{setup[1]['id']}/events").status_code == 404


def test_bad_signed_json_and_oversize_are_rejected(setup):
    client, _, channel, _, _ = setup
    for raw, expected in ((b"not-json",400), (b"x"*(1024*1024+1),413), (b"[]",400)):
        response = client.post(f"/api/public/whatsapp-cloud/channels/{channel['id']}/webhook", content=raw,
            headers={"X-Hub-Signature-256":_sign(raw)})
        assert response.status_code == expected
    assert event() is None


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
    from app.models import WhatsAppCloudChannel
    enqueue(setup)
    with TestingSession() as db:
        db.get(WhatsAppCloudChannel, uuid.UUID(setup[2]["id"])).phone_number_id = "new-number"
        db.commit()
    assert work()
    assert event().error_code == "destination_changed"
    setup[3].assert_not_awaited()
    setup[4].assert_not_awaited()


def test_missing_timestamp_requires_review(setup):
    payload = _webhook_payload([{"from":"5730011","id":"missing-time","type":"text","text":{"body":"Hello"}}])
    del payload["entry"][0]["changes"][0]["value"]["messages"][0]["timestamp"]
    assert _post_signed(setup[0], setup[2]["id"], payload, drain=False).status_code == 200
    assert work()
    assert event().error_code == "reply_window_closed"
    setup[3].assert_not_awaited()
