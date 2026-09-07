import uuid
from concurrent.futures import ThreadPoolExecutor
import pytest
from sqlalchemy import select
from app.models import Agent, Client, Conversation, PolicyRevision, User
from conftest import TestingSession
from test_studio_handoffs import setup, rule


def post(c, url, action='publish', revision=0, **kw):
    body = {'request_id': str(uuid.uuid4()), 'action': action, 'expected_revision': revision, 'reason': 'Reviewed routing', **kw}
    if action == 'publish': body.setdefault('draft_revision', 1)
    return c.post(url.replace('/handoffs', '/policies'), json=body), body


def test_publish_snapshot_restore_and_unpublish_are_separate_from_draft(setup):
    c, client, a, url = setup
    c.put(url, json={'expected_revision': 0, 'rules': [rule(a[0], a[1])]})
    conv = c.post('/api/conversations', json={'agent_id': a[0]}).json()['id']
    response, body = post(c, url)
    assert response.status_code == 200 and response.json()['runtime_enabled'] is True
    first = response.json()['version']; assert first['revision'] == 1 and first['actor_id']
    assert c.post(url.replace('/handoffs', '/policies'), json=body).json()['applied'] is False
    c.put(url, json={'expected_revision': 1, 'rules': [rule(a[0], None)]})
    assert post(c, url, revision=1, draft_revision=2)[0].status_code == 200
    restored = post(c, url, 'restore', 2, restore_revision=1)[0].json()['version']
    assert restored['revision'] == 3 and restored['policy'] == first['policy']
    assert c.get(url).json()['revision'] == 2 and c.get(url).json()['rules'][0]['target_agent_id'] is None
    assert post(c, url, 'unpublish', 3)[0].json()['version']['policy'] is None
    rows = c.get(url.replace('/handoffs', '/policies') + '?limit=2').json()
    assert rows['has_more'] and [r['revision'] for r in rows['items']] == [4, 3]
    older = c.get(url.replace('/handoffs', '/policies') + '?before_revision=3').json()
    assert older['items'][-1] == first
    with TestingSession() as db:
        assert db.get(Conversation, uuid.UUID(conv)).agent_id == uuid.UUID(a[0])
        assert db.get(Conversation, uuid.UUID(conv)).mode == 'ai'


@pytest.mark.parametrize('case', ['stale_draft', 'stale_policy', 'blank', 'enabled', 'foreign', 'inactive', 'bad_restore', 'extra_revision', 'bool_revision'])
def test_reject_invalid_publication_without_journal_write(setup, case):
    c, client, a, url = setup
    c.put(url, json={'expected_revision': 0, 'rules': [rule(a[0], a[1])]})
    kw = {}; expected = 422; action = 'publish'
    if case == 'stale_draft': kw['draft_revision'] = 0; expected = 409
    if case == 'stale_policy': kw['revision'] = 1; expected = 409
    if case == 'blank': kw['reason'] = ' '
    if case == 'enabled': kw['runtime_enabled'] = True
    if case == 'foreign': url = url.replace(client, str(uuid.uuid4())); expected = 404
    if case == 'inactive':
        with TestingSession.begin() as db: db.get(Agent, uuid.UUID(a[1])).is_active = False
    if case == 'bad_restore': action = 'restore'; kw['restore_revision'] = 99; expected = 404
    if case == 'extra_revision': kw['restore_revision'] = 1
    if case == 'bool_revision': kw['expected_revision'] = True
    assert post(c, url, action, **kw)[0].status_code == expected
    with TestingSession() as db: assert not db.scalars(select(PolicyRevision)).all()


def test_restore_revalidates_and_unpublish_works_with_inactive_client(setup):
    c, client, a, url = setup
    c.put(url, json={'expected_revision': 0, 'rules': [rule(a[0], a[1])]})
    assert post(c, url)[0].status_code == 200
    with TestingSession.begin() as db: db.get(Agent, uuid.UUID(a[1])).is_active = False
    assert post(c, url, 'restore', 1, restore_revision=1)[0].status_code == 422
    with TestingSession.begin() as db: db.get(Client, uuid.UUID(client)).is_active = False
    assert post(c, url, revision=1)[0].status_code == 409
    assert post(c, url, 'unpublish', 1)[0].status_code == 200
    assert post(c, url, 'restore', 2, restore_revision=2)[0].status_code == 409


def test_concurrency_key_reuse_and_resource_contention(setup):
    c, client, a, url = setup
    c.put(url, json={'expected_revision': 0, 'rules': [rule(a[0], a[1])]})
    with TestingSession.begin() as db:
        db.scalar(select(Agent).where(Agent.id == uuid.UUID(a[0])).with_for_update())
        assert post(c, url)[0].status_code == 409
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: post(c, url), range(2)))
    assert sorted(r.status_code for r, _ in results) == [200, 409]
    body = next(b for r, b in results if r.status_code == 200)
    endpoint = url.replace('/handoffs', '/policies')
    assert c.post(endpoint, json=body).json()['applied'] is False
    assert c.post(endpoint, json={**body, 'reason': 'Changed'}).status_code == 409
    with TestingSession() as db: assert len(db.scalars(select(PolicyRevision)).all()) == 1


def test_scope_roles_and_revoked_session_under_lock(setup, monkeypatch):
    from app.routers import studio_policies
    c, _, _, url = setup
    c.put(url, json={'expected_revision': 0})
    original = studio_policies.lock
    changed = False
    def revoke(db, query):
        nonlocal changed
        if not changed:
            changed = True
            with TestingSession.begin() as other:
                other.scalar(select(User)).session_version += 1
        return original(db, query)
    monkeypatch.setattr(studio_policies, 'lock', revoke)
    assert post(c, url)[0].status_code == 403
    monkeypatch.setattr(studio_policies, 'lock', original)
    c.post('/api/auth/register', json={'agency_name': 'Other', 'name': 'Other', 'email': 'other@example.com', 'password': 'long-test-password'})
    assert c.get(url.replace('/handoffs', '/policies')).status_code == 404
    assert post(c, url)[0].status_code == 404
    with TestingSession.begin() as db:
        for user in db.scalars(select(User)): user.role = 'operator'
    assert c.get(url.replace('/handoffs', '/policies')).status_code == 403
    assert post(c, url)[0].status_code == 403
    c.post('/api/auth/logout'); assert post(c, url)[0].status_code == 401


def test_moved_reference_and_missing_snapshot_cannot_restore(setup):
    c, client, a, url = setup
    c.put(url, json={'expected_revision': 0, 'rules': [rule(a[0], a[1])]})
    assert post(c, url)[0].status_code == 200
    other = c.post('/api/clients', json={'name': 'Other'}).json()['id']
    with TestingSession.begin() as db: db.get(Agent, uuid.UUID(a[1])).client_id = uuid.UUID(other)
    assert post(c, url, 'restore', 1, restore_revision=1)[0].status_code == 422
    assert post(c, url, 'unpublish', 1)[0].status_code == 200
    assert post(c, url, 'restore', 2, restore_revision=2)[0].status_code == 404
    with TestingSession.begin() as db:
        db.scalar(select(Client).where(Client.id == uuid.UUID(client)).with_for_update())
        assert post(c, url, 'unpublish', 2)[0].status_code == 409
