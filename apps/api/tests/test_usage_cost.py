import uuid
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
import pytest
from app.models import Agent, UsageRecord, now_utc
from app.services.usage_cost import estimate
from conftest import TestingSession


@pytest.mark.parametrize('provider,model,expected', [('openai', 'gpt-4.1-mini', '2'),
    ('openai', 'gpt-4.1-nano-2025-04-14', '0.5'), ('openai', 'gpt-4.1', '10'),
    ('anthropic', 'gpt-4.1-mini', None), ('openai', 'gpt-4.1-mini-unknown', None)])
def test_exact_provider_model_rates(provider, model, expected):
    agency = SimpleNamespace(cost_per_million_input_tokens=None, cost_per_million_output_tokens=None)
    assert estimate(agency, provider, model, 1_000_000, 1_000_000) == (Decimal(expected) if expected else None)
    agency.cost_per_million_input_tokens = 0
    agency.cost_per_million_output_tokens = 0
    assert estimate(agency, provider, model, 1, 1) == 0


def test_reports_costs_scopes_periods_and_orphans(authenticated_client):
    c = authenticated_client
    ids = [c.post('/api/clients', json={'name': name}).json()['id'] for name in ['Hotel', 'Shop']]
    agents = [uuid.UUID(c.post('/api/agents', json={'name': 'Test', 'client_id': cid}).json()['id']) for cid in ids]
    with TestingSession.begin() as db:
        agency = db.get(Agent, agents[0]).agency_id
        for aid, model, tokens, created in [(agents[0], 'gpt-4.1-mini', 1000, now_utc()),
            (agents[1], 'gpt-4.1-nano', 2000, now_utc()), (None, 'gpt-4.1', 100, now_utc()),
            (agents[0], 'unknown', 900000, now_utc() - timedelta(days=31))]:
            db.add(UsageRecord(agency_id=agency, agent_id=aid, provider='openai', model=model,
                               input_tokens=tokens, output_tokens=tokens, created_at=created))
    metrics = c.get('/api/dashboard/metrics?days=30').json()
    assert metrics['estimated_cost_usd'] == pytest.approx(.004)
    assert metrics['tokens_in'] == 3100
    assert sum(row['estimated_cost_usd'] for row in metrics['usage_by_client']) == pytest.approx(.004)
    assert any(row['client_id'] is None for row in metrics['usage_by_client'])
    hotel = c.get(f'/api/clients/{ids[0]}/usage?days=30').json()
    assert hotel['estimated_cost_usd'] == pytest.approx(.002)
    assert hotel['tokens_in'] == 1000
    assert c.get('/api/dashboard/metrics?days=90').json()['estimated_cost_usd'] is None
    with TestingSession.begin() as db:
        db.delete(db.get(Agent, agents[1]))
    assert c.get('/api/dashboard/metrics?days=30').json()['estimated_cost_usd'] == pytest.approx(.004)
    c.post('/api/auth/register', json={'agency_name': 'Other', 'name': 'Other', 'email': 'other-cost@test.cl', 'password': 'test-password-strong'})
    assert c.get('/api/dashboard/metrics').json()['estimated_cost_usd'] == 0
    assert c.get(f'/api/clients/{ids[0]}/usage').status_code == 404


def test_custom_rates_and_tiny_costs_are_not_rounded_away():
    agency = SimpleNamespace(cost_per_million_input_tokens=2, cost_per_million_output_tokens=3)
    assert estimate(agency, 'anthropic', 'custom', 1000, 2000) == Decimal('.008')
    agency.cost_per_million_input_tokens = None
    assert estimate(agency, 'anthropic', 'custom', 1, 1) is None
    assert estimate(agency, 'openai', 'gpt-4.1-mini', 1, 1) == Decimal('.000002')
