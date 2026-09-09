# Reusable solution library API

The API stores agency-owned solutions, immutable versions and independent client
installations. **There is no library UI or live version-update operation yet.**

## Quick path

All endpoints require an active agency administrator session cookie.

1. `POST /api/solutions` with `name` and a complete `settings` object creates version 1.
2. `POST /api/solutions/{id}/installations` with `client_id`, `version_number` and
   agent `name` creates an independent **inactive** agent, with no model selected
   and widget disabled. No channels, keys, knowledge or conversation data are copied.
3. `POST /api/solutions/{id}/versions` with `expected_latest_version` and complete
   `settings` publishes a new immutable version. Existing installations do not change.

```json
{
  "name": "Support starter",
  "settings": {
    "instructions": "Answer approved questions and offer human handoff.",
    "personality": "Clear and friendly",
    "temperature": 0.7,
    "max_tokens": 2048,
    "memory_limit": 30
  }
}
```

Review free text before sharing: instructions can contain client data. There is no
automatic export of an existing agent. Unknown fields and incomplete settings fail validation.

## Read and conflict behavior

- `GET /api/solutions` lists summaries. `/{id}/versions` lists version summaries;
  `/{id}/versions/{number}` returns settings; `/{id}/installations` lists installations.
  List routes accept `limit` (1–100, default 50) and nonnegative `offset`.
- A stale publication returns 409. Row locking serializes concurrent publishers.
- One installation per solution/client is allowed; a duplicate returns 409 without
  retaining an extra agent. Installations remain pinned to the requested version.
- Another agency's IDs return 404; operators cannot access the library. Composite
  foreign keys also reject inconsistent agency, client, agent and version references.
- Installed agents cannot be reassigned to another client. Deleting an agent/client
  removes its installation metadata; deleting an agency removes its library too.
- Versions reject direct SQL UPDATE and DELETE, preventing delete-and-replace.
  Parent cascades still allow owner data erasure. There is no version/solution deletion API.

## Deployment and next boundary

Migration `0039_reusable_solutions` adds tables, parent composite unique constraints
and an immutable-version trigger. Test upgrade/downgrade on a disposable database
before deployment. Downgrade removes library/provenance metadata, **not installed
agents**; a later upgrade cannot reconstruct lost metadata. Back it up first.

[Update planning](reusable-solution-updates.md) is a separate pure foundation.
Live updates still require installation CAS, explicit override provenance, conflict
resolution, behavioral checks and runtime pinning. [Personalization tracking and read-only previews](solution-personalizations.md) now record
effective shared-setting edits and support explicit protection of equal-valued fields.
Removing override intent and applying updates remain unavailable.
