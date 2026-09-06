import uuid
from concurrent.futures import ThreadPoolExecutor
import pytest
from sqlalchemy import select
from app.models import Agent, Client, User
from conftest import TestingSession
from test_studio_handoffs import setup


def test_layout_is_revisioned_and_independent_of_routing(setup):
    c, client, a, draft_url = setup
    url = f'/api/studio/{client}/layout'
    before = c.get(f'/api/studio/{client}').json()
    draft = c.get(draft_url).json()
    assert c.get(url).json() == {'revision': 0, 'positions': {}, 'zoom': 100}
    payload = {'expected_revision': 0, 'zoom': 125, 'positions': {f'agent:{a[0]}': {'x': 600, 'y': 300}, 'channel:whatsapp': {'x': 100, 'y': 70}}}
    result = c.put(url, json=payload)
    assert result.status_code == 200 and result.json()['revision'] == 1
    assert c.get(url).json() == result.json()
    after = c.get(f'/api/studio/{client}').json()
    assert after['layout'] == result.json()
    assert after['agents'] == before['agents'] and after['channels'] == before['channels']
    assert c.get(draft_url).json() == draft
    assert c.put(url, json=payload).status_code == 409
    assert c.put(url, json={'expected_revision': 1}).json() == {'revision': 2, 'positions': {}, 'zoom': 100}


@pytest.mark.parametrize('case', ['node', 'x', 'y', 'bool', 'zoom', 'huge', 'extra'])
def test_invalid_layout_cannot_write(setup, case):
    c, client, a, _ = setup
    url = f'/api/studio/{client}/layout'
    key = f'agent:{a[0]}'
    payload = {'expected_revision': 0, 'positions': {key: {'x': 10, 'y': 100}}}
    if case == 'node': payload['positions'] = {f'agent:{uuid.uuid4()}': {'x': 1, 'y': 100}}
    if case == 'x': payload['positions'][key]['x'] = 4097
    if case == 'y': payload['positions'][key]['y'] = -1
    if case == 'bool': payload['expected_revision'] = True
    if case == 'zoom': payload['zoom'] = 110
    if case == 'huge': payload['positions'] = {str(i): {'x': 1, 'y': 100} for i in range(201)}
    if case == 'extra': payload['runtime_enabled'] = True
    assert c.put(url, json=payload).status_code == 422
    assert c.get(url).json()['revision'] == 0


def test_deleted_or_moved_nodes_are_omitted_and_conflicts_preserve_layout(setup):
    c, client, a, _ = setup
    url = f'/api/studio/{client}/layout'
    body = {'expected_revision': 0, 'positions': {f'agent:{a[0]}': {'x': 10, 'y': 100}}}
    with TestingSession.begin() as db:
        db.scalar(select(Client).where(Client.id == uuid.UUID(client)).with_for_update())
        assert c.put(url, json=body).status_code == 409
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: c.put(url, json=body).status_code, range(2)))
    assert sorted(statuses) == [200, 409]
    other = c.post('/api/clients', json={'name': 'Other'}).json()['id']
    with TestingSession.begin() as db: db.get(Agent, uuid.UUID(a[0])).client_id = uuid.UUID(other)
    assert c.get(url).json() == {'revision': 1, 'positions': {}, 'zoom': 100}


def test_layout_scope_and_admin_boundary(setup):
    c, client, _, _ = setup
    url = f'/api/studio/{client}/layout'
    c.post('/api/auth/register', json={'agency_name': 'Other', 'name': 'Other', 'email': 'other@example.com', 'password': 'long-test-password'})
    assert c.get(url).status_code == 404
    assert c.put(url, json={'expected_revision': 0}).status_code == 404
    with TestingSession.begin() as db:
        for user in db.scalars(select(User)): user.role = 'operator'
    assert c.get(url).status_code == 403
    assert c.put(url, json={'expected_revision': 0}).status_code == 403
    c.post('/api/auth/logout'); assert c.get(url).status_code == 401
