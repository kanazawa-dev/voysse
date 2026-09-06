# Single-responder execution foundation

**Dormant backend protocol, not activated handoffs.** Migration 0032 adds durable
ownership and turn records. No router, widget or worker calls this service yet;
existing message behavior is unchanged. Draft saving and simulation never call it.

## Identity and context

`Conversation.agent_id` remains the entry/channel agent. `ConversationRuntime`
stores a separate current responder, monotonic revision and active turn. Messages
stay in the original conversation; a turn pins an existing user-message ID without
copying private history. Deleting a responder leaves it unavailable, never silently
switching back to the entry agent. Conversation deletion cascades to these records.

## Internal transaction contract

1. A trusted transport adapter must authenticate/revalidate access, admit/dedupe the
   incoming message, and obtain an explicitly activated policy. This service does
   **not** publish policies or decide whether a routing rule is authorized.
2. `claim` locks the conversation, validates agency/client/responder and context,
   and returns `(turn, created)`. **Commit before any external work.** Only a new
   claim may run providers/tools. Replayed keys return `created=false`, including
   completed/uncertain turns; another key cannot reclaim the same context message.
3. `transfer` requires the active turn and expected revision. It validates same-
   client agents, configuration version, cycles and hop bound; a UUID-keyed journal
   makes repeated transitions no-ops. Human fallback remains possible at the hop
   limit and stops the turn, without changing entry identity or sending messages.
4. `settle` checks ownership/version and human takeover. Only `true` authorizes a
   successful local completion: the adapter must append the reply **in this same
   transaction**, then commit. External sends still require the transport's durable
   outbox and immediate permission/ownership revalidation; this is not exactly-once
   external delivery and does not fence a provider/tool call by itself.
5. Failed/ambiguous work becomes `uncertain` and retains the active claim. There is
   no automatic expiry, retry, lease stealing or release. Recovery needs an explicit
   audited workflow; do not clear a claim just because its process disappeared.

Callers own transactions and must roll back errors. Conversation and responder locks use NOWAIT
(409 on contention), never waiting behind external work. Claims serialize only adapters
that use this protocol; existing workers do not yet participate. Agent tools may
already have side effects when interrupted, so never replay them blindly.

## Deployment and remaining work

Back up before migration 0032. Its empty tables do not activate anything. Downgrade
removes ownership/journal data: export first, and never downgrade once adapters use
it without stopping those adapters and reconciling in-flight work.
Next: audited uncertain-turn recovery, activated/versioned policy snapshots,
transport adapters and UI, then production acceptance. Canvas layout persistence
and versioned publication also remain pending. No production migration was run.

Verification: 13 focused protocol tests and the full 232-test API suite passed on
isolated PostgreSQL, including concurrent claims and responder-lock contention.
Migration base → 0032 → base → 0032 passed on that disposable database. No UI or
network behavior changed; live transport acceptance is still pending.

## Administrative review (no activation)

Agency administrators can inspect `GET /studio/{client_id}/execution` (25 rows by
default, maximum 50, offset capped at 10000). Results expose turn status, timestamps,
transition journal and **current** runtime ownership/revision, not messages, provider
credentials or tool results. Pagination is a live view, not a historical snapshot.
`runtime_enabled: false` remains explicit: current transports still ignore this ledger.

To quarantine a stranded `running` or `uncertain` turn, use
`POST /studio/{client_id}/execution/{conversation_id}/{turn_id}/review-human` with
`request_id` UUID, `expected_revision`, a nonblank `reason` (maximum 500 characters),
and `acknowledge_external_effects: true`. Verify provider/channel logs first.

- Under the conversation NOWAIT lock, validate client/agency, administrator session,
  active turn and revision. Stale/closed owners return 409; scope mismatches return 404.
- Record actor, reason, timestamp, previous status and request identity in the journal.
  Set `reviewed_human`, increment revision, clear responder/active claim and set human mode.
- Identical request replay returns the original audit entry with `applied: false`;
  changed input or a second review key returns 409. Entry agent/messages stay untouched.
- This only fences future commits by **adapted** producers. It cannot cancel a provider
  call, tool or delivery already in flight; it neither retries nor compensates effects.
  There is no automatic expiry or AI resume. Existing legacy mode routes/workers do
  not consume this protocol yet; do not treat this endpoint as their cancellation API.

Verification: 26 focused tests passed (13 new); full suite 244 passed before the final
pagination/lock test, then focused suite passed again. Tests cover running/uncertain
review, replay/conflict/concurrency,
late completion rejection, unchanged history, authorization/scope and bounded listing
on disposable PostgreSQL. Browser N/A: this unit adds no UI. Rollback: remove the
`studio_execution` router registration/module and its tests; retain the audit rows and
0032 schema. The Studio review panel and producer adoption remain separate stages.
