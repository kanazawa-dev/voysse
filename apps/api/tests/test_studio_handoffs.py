import uuid
import pytest
from sqlalchemy import select
from app.models import Agent, Client, User
from conftest import TestingSession


@pytest.fixture
def setup(authenticated_client):
    c = authenticated_client
    client = c.post('/api/clients', json={'name': 'Routing draft'}).json()
    agents = [c.post('/api/agents', json={'client_id': client['id'], 'name': name}).json()['id']
              for name in ['Sales', 'Support', 'Specialist']]
    return c, client['id'], agents, f"/api/studio/{client['id']}/handoffs"


def rule(source, target):
    return {'source_agent_id': source, 'target_agent_id': target, 'condition': 'Needs specialist help'}


def test_persist_revision_and_explicit_draft_only(setup):
    c, client_id, agents, url = setup
    assert c.get(url).json()['revision'] == 0
    payload = {'expected_revision': 0, 'rules': [rule(agents[0], agents[1]), rule(agents[1], None)]}
    response = c.put(url, json=payload)
    assert response.status_code == 200
    data = c.get(url).json()
    assert data['rules'] == payload['rules'] and data['revision'] == 1
    assert data['state'] == 'draft' and data['runtime_enabled'] is True
    assert data['human_fallback'] is True and data['valid'] is True
    assert c.put(url, json=payload).status_code == 409
    assert 'handoff_draft' not in c.get('/api/clients/' + client_id).json()
    with TestingSession() as db:
        assert db.get(Client, uuid.UUID(client_id)).handoff_draft['revision'] == 1
    assert c.put(url, json={'expected_revision': 1, 'rules': []}).json()['revision'] == 2


@pytest.mark.parametrize('case', ['self', 'duplicate', 'cycle', 'foreign', 'blank', 'hops', 'fallback', 'enabled', 'too_many'])
def test_reject_unsafe_rules_without_writing(setup, case):
    c, _, a, url = setup
    rules = [rule(a[0], a[1])]
    payload = {'expected_revision': 0, 'rules': rules}
    if case == 'self': rules[0] = rule(a[0], a[0])
    if case == 'duplicate': rules.append(rule(a[0], a[1]))
    if case == 'cycle': rules += [rule(a[1], a[2]), rule(a[2], a[0])]
    if case == 'foreign': rules[0] = rule(a[0], str(uuid.uuid4()))
    if case == 'blank': rules[0]['condition'] = '   '
    if case == 'hops': payload['max_hops'] = 6
    if case == 'fallback': payload['human_fallback'] = False
    if case == 'enabled': payload['runtime_enabled'] = True
    if case == 'too_many': payload['rules'] = rules * 33
    assert c.put(url, json=payload).status_code == 422
    assert c.get(url).json()['revision'] == 0


def test_agent_scope_and_later_invalidation(setup):
    c, _, a, url = setup
    other = c.post('/api/clients', json={'name': 'Other client'}).json()['id']
    b = c.post('/api/agents', json={'client_id': other, 'name': 'Other'}).json()['id']
    assert c.put(url, json={'expected_revision': 0, 'rules': [rule(a[0], b)]}).status_code == 422
    assert c.put(url, json={'expected_revision': 0, 'rules': [rule(a[0], a[1])]}).status_code == 200
    with TestingSession() as db:
        db.get(Agent, uuid.UUID(a[1])).is_active = False
        db.commit()
    data = c.get(url).json()
    assert not data['valid'] and data['problems'] == ['unavailable_agent']
    assert data['runtime_enabled'] is True and data['revision'] == 1


def test_agency_and_operator_boundaries(setup):
    c, _, _, url = setup
    assert c.post('/api/auth/register', json={'agency_name': 'Other', 'name': 'Other',
        'email': 'other@example.com', 'password': 'long-test-password'}).status_code == 201
    assert c.get(url).status_code == 404
    assert c.put(url, json={'expected_revision': 0}).status_code == 404
    with TestingSession() as db:
        for user in db.scalars(select(User)):
            user.role = 'operator'
        db.commit()
    assert c.get(url).status_code == 403
    assert c.put(url, json={'expected_revision': 0}).status_code == 403
    c.post('/api/auth/logout')
    assert c.get(url).status_code == 401


def test_concurrent_edits_have_one_winner_and_do_not_rebind_channels(setup):
    from concurrent.futures import ThreadPoolExecutor
    c, client_id, a, url = setup
    channel_url = f'/api/whatsapp/channels/{client_id}'
    before = c.put(channel_url, json={'agent_id': a[0]}).json()
    payload = {'expected_revision': 0, 'rules': [rule(a[0], a[1])]}
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: c.put(url, json=payload).status_code, range(2)))
    assert sorted(statuses) == [200, 409]
    assert c.get(url).json()['revision'] == 1
    after = c.get(channel_url).json()
    assert after == before
