# Reusable solution update planner

**Status: pure preview foundation, not a live update API.**
The [library API](solution-library.md) now persists versions and inactive client
installations. This planner remains unconnected to live updates; it has no I/O.

`app.services.solution_updates.plan_update` compares three complete snapshots:
the installed shared baseline, current client settings and a target version.

| Change | Result |
| --- | --- |
| Shared change, no local edit | Include target value in the candidate |
| Local change, unchanged shared value | Preserve local value and override marker |
| Both changed to the same value | Preserve value and local override provenance |
| Both changed differently | Report conflict; return no applicable configuration |
| Explicit local override equals baseline | Still protect it from shared changes |

The caller must preserve returned override markers after a future successful
apply. Equality cannot prove that a client wants to follow future defaults.
Resolving conflicts or removing override intent requires a separate explicit action.

Only instructions, personality and generation limits/settings are accepted.
Snapshots are complete, immutable and strictly validated. Unknown fields are
rejected, not silently filtered. No agent-to-template export exists: even prompt
text can contain private client information and must be deliberately reviewed.

An older target supports the same conservative configuration rollback preview.
It does not reverse sent messages, tool calls or any other external effects.

Before exposing this planner, an integration must implement tenant authorization,
immutable solution versions, installation provenance, explicit conflict resolution,
atomic stale-preview checks and per-client behavioral acceptance. A conflict-free
merge is not proof that an agent responds correctly. Runtime version pinning and
live activation remain separate responsibilities.

## Verification

From `apps/api`, without a database or provider calls:

```sh
.venv/bin/python -m unittest discover -s tests -p test_solution_updates.py -v
```

These tests are also collected by the normal pytest suite, whose existing fixtures
require a disposable PostgreSQL database. No schema migration is needed here.
