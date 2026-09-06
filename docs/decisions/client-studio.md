# Decision: Voysse Studio, a canvas per client

Accepted by Alex on 6 September 2026. Deliver in independently tested stages.

## Phase one — operational connections

- A client owns its canvas. Only agency administrators may configure it; existing
  operator and portal permissions are not expanded.
- Show real channels → agents and each agent's web widget. One agent per channel;
  multiple channels may share an agent. Never allow connections across clients.
- Select nodes, connect using a button or drag/drop, inspect settings, try saved
  agent behavior and preview widget appearance without leaving Studio.
- Connection/settings edits require explicit confirmation. Reassigning a channel
  preserves its credentials, connection state and enabled flag. Version checks
  reject stale changes instead of silently overwriting another administrator.
- Credential enrollment remains in existing channel setup screens; Studio does
  not imply OAuth certification or establish a provider connection by drawing a line.
- Preview uses the real configured model and knowledge (provider costs apply), but
  no tools, channel sends or production conversation history. Temporary test chat
  stays in page memory; token usage is recorded. This is not a production-delivery test.
- Widget preview is a visual mock using draft appearance, not a live public iframe.

## Technical and delivery choices

Reuse existing client/channel/agent records; no duplicate workflow database or
migration. Provide a secret-free scoped graph API, narrow version-checked writes
and a tool-free preview endpoint. Use React, semantic HTML and SVG for the bounded
channel map; no extra graph library or arbitrary execution engine in phase one.
Canvas zoom/scroll and drag/drop are enhancements; keyboard/button controls and
mobile stacked layout must work without dragging. Layout is presentation only.

Deliver: (1) scoped API + safety tests; (2) readable canvas + navigation/browser
checks; (3) inline settings, connection confirmation and safe preview + tests.
Each PR carries its docs/tests and remains under 400 changed lines.

## Phase two — draft foundation only

Agent → agent handoff with explicit routing rules, transferred context, one clear
conversation owner, a human exit and bounded hops/cycle detection. Do not show
working handoff connectors before a durable, audited runtime exists.
The [draft foundation](agent-handoffs.md) now persists validated configuration;
it does not execute handoffs or expose an activation switch.

Rollback: remove Studio entry points and routes; existing channel setup, agents,
queues and conversations continue to work. No queued messages are replayed.

## Canvas delivery evidence

The initial view is at `/clients/<id>/studio`, linked from client details. It derives
connections from the scoped API, supports selection/zoom/scroll and a keyboard-
accessible mobile card layout. Empty clients and failed loads do not expose a
previous client's graph. This stage is read-only; inline writes follow separately.
Local web lint/webpack build and ES/EN browser smoke at 1440/390/320px passed,
including edges, keyboard selection, zoom, empty/error cases and zero write requests.

## Inline controls delivery

Studio now supports new agents and inline name/description/instructions/widget
settings. Select a channel and choose its agent, or drag its card onto an agent;
confirm the old → new assignment before applying. Drawing a connection never
implicitly enables a channel. Refresh after a conflict or uncertain network error;
there is no automatic retry or optimistic success. Background refresh responses
cannot replace a newer confirmed write.

The test panel uses saved settings; unsaved appearance is a labeled local mock.
Model/provider setup, knowledge/tools and credential enrollment link to the existing
scoped screens. Temporary test history resets on agent/version change or leaving
Studio. These controls do not implement arbitrary tools/documents as canvas nodes,
shared layout persistence, infinite pan, agent handoffs or a publish/version runtime.

Verification: isolated web lint/webpack build; read-only and edit browser smokes
in ES/EN at 1440/390/320px, including real drag/drop, cancel/confirm, stale-write
conflicts, settings, preview-only requests, creation, keyboard, overflow and errors.
Backend verification: 189 tests passed with a disposable PostgreSQL database.
No real provider send, production deploy or account certification was performed.
