# Preserve client settings before previewing an update

Installed agents record effective edits to shared settings from the agent editor and
Studio. The preview compares the installed baseline, current client value and a chosen
solution version. **It never applies an update or activates an agent.**

## What counts as a personalization

- Changing instructions, personality, temperature, maximum tokens or memory limit records
  a persistent override and increments the installation revision in the same transaction.
- Saving unchanged fields does not mark them as overrides: existing forms submit full settings.
- Returning an edited value to its baseline does not remove the marker or its intent.
- **Protect this client value** explicitly marks a field, including an unchanged baseline value.
  This changes metadata only. Removing protection and resolving conflicts are not available yet.
- Ordinary agents without a solution installation keep their existing edit behavior.

Both supported shared-settings write paths lock the agent before the installation. Changes
that fail validation commit neither the settings nor their provenance. This does not add
optimistic concurrency to the legacy agent editor; Studio keeps its existing timestamp check.

## Preview and protection API

Administrative agency authentication is required. IDs must match agency, solution and client.

| Request | Result |
| --- | --- |
| `GET /api/solutions/{solution}/installations/{installation}/preview?target_version=2` | Baseline/current/target changes and statuses, conflicts, stored/detected overrides, installation revision and agent timestamp. `can_apply` is always false. |
| `POST /api/solutions/{solution}/installations/{installation}/protected-fields` | Add one explicit protection without changing the agent value or installed version. |

Protection body: `field`, `expected_revision`, `expected_agent_updated_at`. A revision or
timestamp mismatch returns409. Unknown fields/extra keys are rejected. An already-protected
field is a no-op when the supplied snapshot is current. After an uncertain response, reread
before retrying. These tokens are **not an authorization or capability to apply a preview**.

Differences from edits made before tracking existed are detected conservatively in previews;
a GET never backfills markers. Equal-valued historical intent cannot be recovered automatically.
Incompatible stored agent settings return422; incompatible published settings or metadata fail
closed. Read-only previews briefly lock rows for a coherent snapshot and release on request end.
They do not guarantee that the agent remains unchanged after the response.

## Browser flow

Open a solution, select a target version, then choose **Preview update** beside an installation.
Compare each field's three values and its status. Protect a value only if the client should
retain it in future updates. Refresh to inspect newer changes. A conflict-free preview is not
a behavioral test, and there is no Apply button. Older versions can be compared but not restored.

## Verification and rollback

API regressions cover both edit paths, concurrent edits/protections, equal-valued markers,
stale snapshots, invalid configuration, tenant/role isolation and read-only legacy drift.
`scripts/ui/solution-preview-smoke.cjs` uses intercepted API responses for ES/EN UI checks;
it does not prove live browser/API integration. Run it with a local preview and Playwright.

No migration is required. Removing this feature's hooks/router/UI leaves existing stored
markers intact, but future legacy edits would no longer record personalization provenance.
Existing-agent update application, release of overrides, behavioral acceptance and selective
rollback remain separate work.
