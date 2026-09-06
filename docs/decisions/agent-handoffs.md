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

The draft editor, manual rehearsal and bounded AI chain simulation below are
implemented; none activates live handoffs. Remaining:

1. Adopt the [dormant execution foundation](execution-state.md) in transport
   adapters with published policies and audited recovery, preserving entry
   channel identity, context, operator takeover and interrupted/uncertain work.
2. Integrate each transport with bounded hops and revalidated permissions, then
   expose explicit activation. Never draw active execution edges before this exists.
3. Persistent canvas layouts and versioned publication/rollback.

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
or unsaved drafts cannot be rehearsed. Durable runtime, layout persistence and versioned publication remain pending.

Verification: `scripts/ui/studio-handoffs-smoke.cjs` covers ES/EN, light/dark,
1440/390/320 widths, save/clear, conflict and validation-error preservation, reload
confirmation, late-load protection and zero rehearsal writes. Web lint/build and
all three Studio browser smokes passed. Rollback removes this editor component,
its page entry and styles; persisted drafts and channel assignments stay intact.

## One-step AI simulation

`POST /api/studio/<client-id>/handoffs/simulate` evaluates a test message against
only the saved outgoing rules of the chosen source agent. Requires administrator
access, an active client/agent and the expected draft revision. The UI warns about
provider tokens and uses that agent's configured model/credentials. Input is at
most 4000 characters; one classification call requests at most 256 output tokens.
The shared limiter allows five requests/minute/IP (trusted ingress required); this
is not a tenant spending cap or global provider concurrency limit.

The model returns a strict candidate index and short explanation. Non-candidate or
malformed output proposes human attention with an explicit invalid-response status;
uncertainty/no match also proposes human attention. No outgoing rules means no model
call. Provider failures remain errors, not invented successful evaluations. After a
completion, usage is recorded and access, agent version, draft revision and active
references are rechecked; stale results are rejected. No instructions/tools/RAG,
production history, conversation, channel sends or draft mutations are involved.
The proposal is advisory, one step only, and is not an evaluation of a whole chain.
Runtime handoffs, durable context, layout persistence and publication remain pending.
Rollback removes the simulation router/component; drafts and channels stay intact.

Verification for one-step simulation: 10 focused API tests and the full 212-test
API suite passed on disposable PostgreSQL with mocked providers. Web ESLint,
isolated webpack build and all four Studio browser smokes passed (ES/EN,
1440/390/320, light/dark). No real provider credentials or messages were used.
Closing the UI discards its result but cannot guarantee cancellation of provider
work already admitted; consumed tokens can still be recorded.


## Bounded AI chain simulation

Select **Full chain** to call `/handoffs/simulate-chain`. It follows saved outgoing
rules automatically, using the same original test message and each source agent's
model. It does not simulate agent replies, tools, RAG or evolving conversation
context. The result lists each chosen condition/explanation and the final human
exit. Uncertain/invalid responses and missing rules stop immediately.

The saved `max_hops` (1–5) bounds evaluations; after the last allowed agent step,
human attention is proposed without calling the next model. Visited-agent checks
provide a second cycle guard. Both modes share the same five-runs/minute/IP quota;
a chain can request up to five classifications (256 output tokens requested each).
This is not a tenant spending cap. Each completed call records usage separately.
Every step rechecks permissions and draft revision; changes to earlier agents also
invalidate the whole trace. Errors return no partial successful proposal, but
already incurred usage remains. No production messages or draft mutations occur.

Rollback removes the chain endpoint and mode selector; one-step simulation and all
saved drafts continue to work. Actual handoffs, saved layouts and versioned
publication remain pending.

Chain verification: 7 new tests (17 combined classifier/chain tests) and the full
219-test API suite passed on disposable PostgreSQL with mocked providers. Web lint,
webpack build and four Studio browser smokes passed ES/EN at 1440/390/320 in
light/dark, including mode changes, step traces and hop-limit feedback. No real
provider credentials or production messages were used.

## Current continuation checkpoint

[Studio progress](../studio-progress.md) consolidates the delivered draft/simulation,
dormant durable protocol and administrative review panel, verification and ordered
remaining publication/runtime work. Earlier per-stage pending notes are historical.
