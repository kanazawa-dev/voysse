import uuid
import pytest
from sqlalchemy import func, select
from app.models import Agent, Conversation, UsageRecord
from app.routers import studio_simulation as sim
from app.services.ai import Completion
from conftest import TestingSession
from test_studio_simulation import setup  # noqa: F401


def test_chain_uses_saved_rules_and_accounts_each_step(setup):
    c, url, a, mock, body = setup
    before = c.get(url).json()
    mock.side_effect = [Completion('{"rule_index":0,"reason":"Technical"}', 10, 3), Completion('{"rule_index":1,"reason":"Human"}', 20, 4)]
    response = c.post(url + '/simulate-chain', json=body)
    assert response.status_code == 200
    data = response.json()
    assert data['outcome'] == 'human_rule' and data['target_agent_id'] is None and data['simulation_only']
    assert [s['source_agent_id'] for s in data['steps']] == a
    assert [s['rule_index'] for s in data['steps']] == [0, 1]
    assert all(body['message'] in call.args[4][1]['content'] for call in mock.call_args_list)
    assert c.get(url).json() == before
    with TestingSession() as db:
        assert db.scalar(select(func.count()).select_from(Conversation)) == 0
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 2


def test_hop_limit_stops_before_next_provider(setup):
    c, url, a, mock, body = setup
    draft = c.get(url).json()
    c.put(url, json={'expected_revision': 1, 'max_hops': 1, 'rules': draft['rules']})
    data = c.post(url + '/simulate-chain', json={**body, 'expected_revision': 2}).json()
    assert data['outcome'] == 'hop_limit' and len(data['steps']) == 1
    assert data['steps'][0]['target_agent_id'] == a[1] and data['target_agent_id'] is None
    assert mock.await_count == 1


@pytest.mark.parametrize('answer,outcome', [('bad json', 'invalid_response'), ('{"rule_index":null,"reason":"Unclear"}', 'human_fallback')])
def test_unsafe_or_uncertain_step_stops_chain(setup, answer, outcome):
    c, url, _, mock, body = setup
    mock.return_value = Completion(answer)
    data = c.post(url + '/simulate-chain', json=body).json()
    assert data['outcome'] == outcome and len(data['steps']) == 1 and mock.await_count == 1


def test_empty_rules_make_no_provider_calls(setup):
    c, url, _, mock, body = setup
    c.put(url, json={'expected_revision': 1, 'rules': []})
    data = c.post(url + '/simulate-chain', json={**body, 'expected_revision': 2}).json()
    assert data['outcome'] == 'no_rules'
    mock.assert_not_called()


def test_earlier_agent_change_invalidates_whole_trace(setup):
    c, url, a, mock, body = setup
    count = 0
    async def completion(*args, **kwargs):
        nonlocal count
        count += 1
        if count == 2:
            with TestingSession() as db:
                db.get(Agent, uuid.UUID(a[0])).name = 'Changed earlier agent'
                db.commit()
        return Completion('{"rule_index":' + str(count - 1) + ',"reason":"Match"}', 1, 1)
    mock.side_effect = completion
    response = c.post(url + '/simulate-chain', json=body)
    assert response.status_code == 409 and 'earlier agent' in response.json()['detail']
    with TestingSession() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 2


def test_quota_is_shared_by_both_modes():
    routes = {route.path: route for route in sim.router.routes}
    single = routes['/studio/{client_id}/handoffs/simulate'].dependencies[0].dependency
    chain = routes['/studio/{client_id}/handoffs/simulate-chain'].dependencies[0].dependency
    assert single is chain and chain.times == 5 and chain.seconds == 60
