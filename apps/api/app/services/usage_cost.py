"""Reporting estimates, never a billing ledger. See docs/usage-costs.md."""
from decimal import Decimal
from sqlalchemy import and_, func, select
from ..models import Agent, Client, UsageRecord

# Standard text USD / 1M tokens, verified 2026-09-07 against official model pages.
RATES = {"gpt-4.1": ("2", "8"), "gpt-4.1-mini": ("0.4", "1.6"), "gpt-4.1-nano": ("0.1", "0.4")}
RATES.update({f"{model}-2025-04-14": rates for model, rates in list(RATES.items())})


def estimate(agency, provider, model, inputs, outputs):
    if inputs + outputs == 0:
        return Decimal(0)
    rates = (agency.cost_per_million_input_tokens, agency.cost_per_million_output_tokens)
    if None in rates:
        rates = RATES.get(model) if provider == "openai" else None
    if rates is None:
        return None
    return (Decimal(inputs) * Decimal(str(rates[0])) + Decimal(outputs) * Decimal(str(rates[1]))) / 1_000_000


def usage_report(db, agency, since, client_id=None):
    # Outer joins preserve deleted/unassigned agents. Never join another tenant.
    query = (select(Client.id, Client.name, UsageRecord.provider, UsageRecord.model,
        func.sum(UsageRecord.input_tokens), func.sum(UsageRecord.output_tokens))
        .select_from(UsageRecord)
        .outerjoin(Agent, and_(Agent.id == UsageRecord.agent_id, Agent.agency_id == agency.id))
        .outerjoin(Client, and_(Client.id == Agent.client_id, Client.agency_id == agency.id))
        .where(UsageRecord.agency_id == agency.id, UsageRecord.created_at >= since)
        .group_by(Client.id, Client.name, UsageRecord.provider, UsageRecord.model))
    if client_id is not None:
        query = query.where(Client.id == client_id)
    models, clients = {}, {}
    for cid, name, provider, model, inputs, outputs in db.execute(query):
        cost = estimate(agency, provider, model, inputs, outputs)
        for target, key, identity in [(models, (provider, model), {"provider": provider, "model": model}),
                                      (clients, cid, {"client_id": cid, "name": name})]:
            row = target.setdefault(key, {**identity, "input_tokens": 0, "output_tokens": 0, "estimated_cost_usd": Decimal(0)})
            row["input_tokens"] += inputs
            row["output_tokens"] += outputs
            row["estimated_cost_usd"] = None if cost is None or row["estimated_cost_usd"] is None else row["estimated_cost_usd"] + cost
    rows = sorted(models.values(), key=lambda r: (-(r["input_tokens"] + r["output_tokens"]), r["provider"], r["model"]))
    costs = [r["estimated_cost_usd"] for r in rows]
    return {"tokens_in": sum(r["input_tokens"] for r in rows), "tokens_out": sum(r["output_tokens"] for r in rows),
            "usage_by_model": rows, "estimated_cost_usd": None if None in costs else sum(costs, Decimal(0)),
            "usage_by_client": sorted(clients.values(), key=lambda r: (r["name"] or "", str(r["client_id"])))}
