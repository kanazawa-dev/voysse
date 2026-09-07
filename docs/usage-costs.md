# Estimated token spend

Home shows USD beside tokens, per model and per current client. Each client's
Usage tab shows the same calculation for its selected period. Small nonzero
amounts are never displayed as zero. A dash means unavailable, not free.

Both custom rates in Settings override the catalog for all providers/models.
Otherwise these standard text USD/1M rates apply (verified 2026-09-07):

| OpenAI model | Input | Output |
| --- | ---: | ---: |
| [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1) | 2 | 8 |
| [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) | 0.4 | 1.6 |
| [GPT-4.1 nano](https://developers.openai.com/api/docs/models/gpt-4.1-nano) | 0.1 | 0.4 |

Exact aliases and their 2025-04-14 snapshots only; never infer rates from prefixes.
Unknown models make the affected subtotal/total unavailable, not an understated
sum. Known model/client rows remain visible. Empty usage costs zero.

## Limits

This is **not an invoice or billing ledger**. Rates are applied at report time,
including to past tokens; changing custom/catalog rates changes estimates.
Stored usage lacks cached-token breakdowns, so all input uses the uncached rate.
Taxes, provider discounts and unrecorded embeddings/media/tools are excluded.
Clients follow current agent assignments, not historical ownership; deleted or
unassigned agents remain in the agency total under Unassigned. No migration,
provider request, credential access, billing change or payment is involved.

## Verification and rollback

Run API `pytest -q tests/test_usage_cost.py` on disposable PostgreSQL and the web
lint/build plus `scripts/ui/usage-cost-smoke.cjs` against a local production build.
Revert this reporting unit together; it never changes stored usage or balances.
