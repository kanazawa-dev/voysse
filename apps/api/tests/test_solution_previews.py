import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select

from app.models import Agent, SolutionInstallation, User
from conftest import TestingSession
from test_solutions import SETTINGS, create
from test_solution_personalizations import installed, metadata  # noqa: F401


def preview_url(solution, row, target=2):
    return f'/api/solutions/{solution}/installations/{row["id"]}/preview?target_version={target}'


def publish(c, solution):
    result = c.post(f'/api/solutions/{solution}/versions', json={
        'expected_latest_version': 1, 'settings': {**SETTINGS, 'instructions': 'Updated shared'}})
    assert result.status_code == 201


def protect(c, solution, row, snapshot, field='personality'):
    return c.post(f'/api/solutions/{solution}/installations/{row["id"]}/protected-fields', json={
        'field': field, 'expected_revision': snapshot['revision'],
        'expected_agent_updated_at': snapshot['agent_updated_at']})


def test_preview_is_read_only_and_reports_conflicts(installed):
    c, solution, _, row = installed
    publish(c, solution)
    agent_url = '/api/agents/' + row['agent_id']
    c.patch(agent_url, json={'instructions': 'Local instructions', 'personality': 'Local tone'})
    before, stored = c.get(agent_url).json(), metadata()
    p = c.get(preview_url(solution, row))
    assert p.status_code == 200
    data = p.json()
    assert data['conflicts'] == ['instructions'] and not data['can_apply']
    assert 'configuration' not in data
    assert data['installed_version'] == 1 and data['target_version'] == 2
    changes = {r['field']: r for r in data['changes']}
    assert changes['instructions']['status'] == 'conflict'
    assert changes['personality']['status'] == 'preserved'
    assert changes['instructions']['baseline'] == SETTINGS['instructions']
    assert changes['instructions']['current'] == 'Local instructions'
    assert changes['instructions']['target'] == 'Updated shared'
    assert c.get(agent_url).json() == before and metadata() == stored
    assert c.post(preview_url(solution, row), json={}).status_code == 405


def test_protection_preserves_equal_baseline_and_stale_tokens_fail(installed):
    c, solution, _, row = installed
    publish(c, solution)
    url = preview_url(solution, row)
    p = c.get(url).json()
    assert next(r for r in p['changes'] if r['field'] == 'instructions')['status'] == 'updated'
    before = c.get('/api/agents/' + row['agent_id']).json()
    assert protect(c, solution, row, p, 'instructions').status_code == 200
    assert metadata() == (['instructions'], 2)
    assert c.get('/api/agents/' + row['agent_id']).json() == before
    assert protect(c, solution, row, p).status_code == 409
    fresh = c.get(url).json()
    assert fresh['conflicts'] == ['instructions']
    assert protect(c, solution, row, fresh, 'instructions').status_code == 200
    assert metadata() == (['instructions'], 2)  # Idempotent with a fresh token.
    c.patch('/api/agents/' + row['agent_id'], json={'name': 'Changed without shared edit'})
    assert protect(c, solution, row, fresh).status_code == 409  # Timestamp, not only revision.
    assert protect(c, solution, row, c.get(url).json(), 'api_key').status_code == 422


def test_preview_detects_legacy_drift_without_writing_it(installed):
    c, solution, _, row = installed
    with TestingSession.begin() as db:
        db.get(Agent, uuid.UUID(row['agent_id'])).personality = 'Legacy drift'
    p = c.get(preview_url(solution, row, 1)).json()
    assert p['local_overrides'] == [] and p['detected_overrides'] == ['personality']
    assert metadata() == ([], 1)
    assert c.get(preview_url(solution, row, 999)).status_code == 404
    with TestingSession.begin() as db:
        db.get(Agent, uuid.UUID(row['agent_id'])).instructions = 'x' * 32001
    assert c.get(preview_url(solution, row, 1)).status_code == 422
    assert metadata() == ([], 1)


def test_preview_and_protection_scope_auth_and_roles(installed):
    c, solution, _, row = installed
    url = preview_url(solution, row, 1)
    p = c.get(url).json()
    other = create(c)
    assert c.get(preview_url(other, row, 1)).status_code == 404
    assert protect(c, other, row, p).status_code == 404
    c.cookies.clear()
    assert c.get(url).status_code == 401 and protect(c, solution, row, p).status_code == 401
    c.post('/api/auth/register', json={'agency_name': 'Other agency', 'name': 'Other',
                                      'email': 'other@example.com', 'password': 'strong-password'})
    assert c.get(url).status_code == 404 and protect(c, solution, row, p).status_code == 404
    c.cookies.clear()
    c.post('/api/auth/login', json={'email': 'ana@prisma.com', 'password': 'contrasena-segura'})
    with TestingSession.begin() as db:
        db.scalar(select(User).where(User.email == 'ana@prisma.com')).role = 'operator'
    assert c.get(url).status_code == 403 and protect(c, solution, row, p).status_code == 403
    with TestingSession.begin() as db:
        user = db.scalar(select(User).where(User.email == 'ana@prisma.com'))
        user.role = 'admin'; user.agency.is_active = False
    assert c.get(url).status_code == 403 and protect(c, solution, row, p).status_code == 403


def test_concurrent_protections_only_accept_one_snapshot(installed):
    c, solution, _, row = installed
    p = c.get(preview_url(solution, row, 1)).json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda f: protect(c, solution, row, p, f).status_code, ['instructions', 'personality']))
    assert sorted(codes) == [200, 409]
    assert metadata()[1] == 2 and len(metadata()[0]) == 1


def test_corrupt_markers_fail_closed_without_changing_agent(installed):
    c, solution, _, row = installed
    url = '/api/agents/' + row['agent_id']
    p = c.get(preview_url(solution, row, 1)).json()
    before = c.get(url).json()
    with TestingSession.begin() as db:
        db.scalar(select(SolutionInstallation)).local_overrides = ['model']
    assert c.get(preview_url(solution, row, 1)).status_code == 409
    assert protect(c, solution, row, p).status_code == 409
    assert c.patch(url, json={'instructions': 'New'}).status_code == 409
    assert c.get(url).json() == before
    assert metadata() == (['model'], 1)
