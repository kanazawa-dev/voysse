# Agent handoffs — staged implementation

Phase two follows the approved [Studio decision](client-studio.md). A handoff must
preserve context, keep one responsible responder and have a bounded path to a
human. Changing `Conversation.agent_id` is not sufficient: it currently also ties
entry/channel behavior and delivery history to an agent.

## First delivery: draft configuration only

`GET /api/studio/<client-id>/handoffs` reads the draft. `PUT` replaces it using
`expected_revision`. Both endpoints require an agency administrator and a client
owned by that agency. Existing public client/portal schemas do not expose drafts.

Example request (replace IDs with agents belonging to this client):

```json
{"expected_revision":0,"max_hops":3,"human_fallback":true,"rules":[
  {"source_agent_id":"<sales-agent-id>","target_agent_id":"<support-agent-id>",
   "condition":"The customer needs technical support"}
]}
```

- Up to 32 rules; conditions are trimmed text of 1–1000 characters. Conditions are
  descriptions, **not executable routing logic** in this delivery.
- Targets must be active agents of the same client, or `null` for human attention.
  Reject self-links, duplicate pairs and directed cycles, including indirect ones.
- `max_hops` is an integer from 1 to 5, default 3. Human fallback cannot be disabled.
- A client-row lock plus revision comparison makes concurrent replacements atomic:
  stale submissions return 409 instead of overwriting another editor.
- Recheck agent membership/activity when reading. Deleted, moved or deactivated
  references make the draft invalid; do not silently delete or activate rules.
- Always return `state: draft` and `runtime_enabled: false`. Saving changes no
  channel assignment, conversation owner, tools or outgoing messages.

Store the whole draft in `Client.handoff_draft` rather than premature execution
records. Migration `0031_handoff_drafts` adds an empty JSON default for existing
clients. This is deliberately a draft schema, not an event journal or runtime lock.

## Subsequent deliveries — still pending

1. Draft editor in Studio and safe routing simulation, with explicit explanations
   of which rule matched and when the human fallback is selected.
2. Durable handoff journal and a separate current responder, preserving entry
   channel identity, context, operator takeover and interrupted/uncertain work.
3. Integrate each transport with bounded hops and revalidated permissions, then
   expose explicit activation. Never draw active execution edges before this exists.

## Deploy and rollback

Back up before applying 0031 on a deployment. No production migration is performed
by this task. Older application code can ignore the added column; prefer retaining
it on rollback. Downgrading 0031 deletes stored drafts, so export/back them up first.
No draft is consumed by current message workers; rollback must not replay messages.

## Verification

13 focused API tests cover persistence, concurrent edits (one 200 and one 409),
tenant/role isolation, unsafe graphs and later agent deactivation. Full API suite:
202 passed. Alembic upgrade → downgrade to base → upgrade passed on disposable
PostgreSQL 17; no real accounts, providers or production database were used.

## Studio draft editor and manual rehearsal

Studio now offers named source/target selectors, descriptive conditions, rule
removal and hop settings. Save uses the draft revision; rejected/conflicting edits
remain visible until the user explicitly reloads. No activation control exists.
The separate rehearsal walks the saved rules: the user chooses a rule explicitly,
then sees the path and human exit. It makes no model calls, evaluates no natural-
language conditions and sends no messages. Editing resets the rehearsal; invalid
or unsaved drafts cannot be rehearsed. Full AI routing simulation, durable runtime,
layout persistence and versioned publication remain pending.

Verification: `scripts/ui/studio-handoffs-smoke.cjs` covers ES/EN, light/dark,
1440/390/320 widths, save/clear, conflict and validation-error preservation, reload
confirmation and zero rehearsal writes. Rollback removes this editor component,
its page entry and styles; persisted drafts and channel assignments stay intact.
