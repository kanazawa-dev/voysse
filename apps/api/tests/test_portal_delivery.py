import uuid

import pytest
from sqlalchemy import select

from app.models import Client, Conversation, HumanDelivery, Message
from app.security import create_portal_token
from conftest import TestingSession
from test_human_delivery import setup_delivery  # noqa: F401


def portal_session(client, cid):
    with TestingSession() as db:
        conversation = db.get(Conversation, cid)
        customer = db.get(Client, conversation.client_id)
        customer.portal_enabled = True
        db.commit()
        slug, customer_id = customer.portal_slug, customer.id
    client.cookies.set('portal_access_token', create_portal_token(str(customer_id), slug))
    return f'/api/portal/{slug}/conversations/{cid}', customer_id


@pytest.mark.parametrize('platform', ['widget', 'whatsapp', 'whatsapp_cloud', 'instagram', 'messenger'])
def test_portal_confirmation_and_actor(setup_delivery, platform):
    client, _, create, sender = setup_delivery
    cid, key = create(platform), uuid.uuid4()
    url, customer_id = portal_session(client, cid)
    body = {'content': 'Portal response', 'request_id': str(key)}
    first = client.post(url + '/reply', json=body)
    assert first.status_code == 200, first.text
    assert first.json()['deliveries'][0]['status'] == ('published' if platform == 'widget' else 'confirmed')
    assert client.post(url + '/reply', json=body).status_code == 200
    assert sender.await_count == 1
    with TestingSession() as db:
        attempt = db.get(HumanDelivery, key)
        assert attempt.portal_client_id == customer_id
        assert attempt.actor_id is None
    # Agency user must not take over the portal's idempotency key.
    assert client.post(f'/api/conversations/{cid}/reply', json=body).status_code == 409
    assert client.post(url + '/reply', json={**body, 'content': 'Changed'}).status_code == 409
    assert sender.await_count == 1


def test_portal_timeout_is_visible_without_fake_message(setup_delivery):
    client, _, create, sender = setup_delivery
    cid, key = create(), uuid.uuid4()
    url, _ = portal_session(client, cid)
    async def timeout(*args):
        with TestingSession() as db:
            assert db.get(HumanDelivery, key).status == 'sending'
        raise RuntimeError('secret-provider-token')
    sender.side_effect = timeout
    body = {'content': 'Maybe sent', 'request_id': str(key)}
    result = client.post(url + '/reply', json=body)
    assert result.status_code == 200, result.text
    assert result.json()['deliveries'][0]['status'] == 'uncertain'
    assert len(result.json()['messages']) == 1
    assert 'secret-provider' not in result.text
    assert client.post(url + '/reply', json=body).status_code == 200
    assert client.get(url).json()['deliveries'][0]['status'] == 'uncertain'
    assert sender.await_count == 1


def test_portal_client_isolation_and_disabled_access(setup_delivery):
    client, _, create, sender = setup_delivery
    cid, other = create(), create()
    url, customer_id = portal_session(client, cid)
    other_url = url.replace(str(cid), str(other))
    assert client.get(other_url).status_code == 404
    assert client.post(other_url + '/reply', json={'content': 'No'}).status_code == 404
    assert client.patch(other_url + '/mode', json={'mode': 'human'}).status_code == 404
    with TestingSession() as db:
        customer = db.get(Client, customer_id)
        customer.is_active = False
        db.commit()
    assert client.get(url).status_code == 401
    assert client.post(url + '/reply', json={'content': 'No'}).status_code == 401
    sender.assert_not_awaited()


def test_portal_preflight_and_private_tool_traces(setup_delivery):
    client, _, create, sender = setup_delivery
    cid = create()
    url, _ = portal_session(client, cid)
    with TestingSession() as db:
        conv = db.get(Conversation, cid)
        conv.mode = 'ai'
        message = db.scalar(select(Message).where(Message.conversation_id == cid))
        message.tool_calls = [{'arguments': {'secret': 'private-tool-value'}}]
        db.commit()
    result = client.post(url + '/reply', json={'content': 'No human control'})
    assert result.status_code == 200, result.text
    assert result.json()['deliveries'][0]['error_code'] == 'human_control_required'
    for response in [result, client.get(url), client.patch(url + '/mode', json={'mode': 'human'})]:
        assert 'private-tool-value' not in response.text
        assert response.json()['messages'][0]['tool_calls'] is None
    sender.assert_not_awaited()
