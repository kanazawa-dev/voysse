"""Provenance is atomic with both supported shared-settings edit paths."""
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select

from app.models import SolutionInstallation
from conftest import TestingSession
from test_solutions import SETTINGS, create, customer, install


@pytest.fixture
def installed(authenticated_client):
    c = authenticated_client
    solution, client = create(c), customer(c)
    row = install(c, solution, client).json()
    return c, solution, client, row


def metadata():
    with TestingSession() as db:
        row = db.scalar(select(SolutionInstallation))
        return row.local_overrides, row.revision


def test_effective_changes_track_and_return_to_baseline_keeps_intent(installed):
    c, _, _, row = installed
    url = '/api/agents/' + row['agent_id']
    assert c.patch(url, json={**SETTINGS, 'name': 'Renamed'}).status_code == 200
    assert metadata() == ([], 1)
    assert c.patch(url, json={'personality': 'Local'}).status_code == 200
    assert metadata() == (['personality'], 2)
    assert c.patch(url, json={'personality': SETTINGS['personality']}).status_code == 200
    assert metadata() == (['personality'], 3)
    assert c.patch(url, json={'personality': SETTINGS['personality']}).status_code == 200
    assert metadata() == (['personality'], 3)


def test_studio_records_only_changed_shared_fields_and_rejects_stale(installed):
    c, _, client, row = installed
    agent = c.get('/api/agents/' + row['agent_id']).json()
    body = {key: agent[key] for key in ['name', 'description', 'instructions', 'widget_greeting', 'widget_color', 'widget_enabled']}
    body.update(expected_updated_at=agent['updated_at'], instructions='Local studio instructions')
    url = f'/api/studio/{client}/agents/{agent["id"]}'
    assert c.patch(url, json=body).status_code == 200
    assert metadata() == (['instructions'], 2)
    assert c.patch(url, json=body).status_code == 409
    assert metadata() == (['instructions'], 2)


def test_failed_validation_does_not_record_provenance(installed):
    c, _, _, row = installed
    url = '/api/agents/' + row['agent_id']
    before = c.get(url).json()
    for body in [{'instructions': None}, {'personality': 'x' * 8001}, {'instructions': 'x' * 32001}]:
        assert c.patch(url, json=body).status_code == 422
        assert c.get(url).json() == before
        assert metadata() == ([], 1)


def test_ordinary_agents_keep_legacy_behavior(authenticated_client):
    c = authenticated_client
    agent = c.post('/api/agents', json={'client_id': customer(c), 'name': 'Ordinary'}).json()
    assert c.patch('/api/agents/' + agent['id'], json={'instructions': 'Ordinary edit'}).status_code == 200
    with TestingSession() as db:
        assert db.scalar(select(SolutionInstallation)) is None


def test_concurrent_disjoint_edits_keep_both_markers(installed):
    c, _, _, row = installed
    url = '/api/agents/' + row['agent_id']
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda body: c.patch(url, json=body).status_code,
                                [{'instructions': 'Local'}, {'personality': 'Local tone'}]))
    assert results == [200, 200]
    assert metadata() == (['instructions', 'personality'], 3)
    agent = c.get(url).json()
    assert agent['instructions'] == 'Local' and agent['personality'] == 'Local tone'
