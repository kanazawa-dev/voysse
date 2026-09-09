# Preserve installed-agent personalization intent

Installed agents record effective edits to five shared settings from the agent editor and Studio.

## What counts as a personalization

- Changing instructions, personality, temperature, maximum tokens or memory limit records
  a persistent override and increments the installation revision in the same transaction.
- Saving unchanged fields does not mark them as overrides: existing forms submit full settings.
- Returning an edited value to its baseline does not remove the marker or its intent.
- Ordinary agents without a solution installation keep their existing edit behavior.

Both supported shared-settings write paths lock the agent before the installation. Changes
that fail validation commit neither the settings nor their provenance. This does not add
optimistic concurrency to the legacy agent editor; Studio keeps its existing timestamp check.

## Verification and rollback

API regressions cover both edit paths, validation, unchanged full forms and concurrent edits.
No migration is required. Removing the tracking hooks leaves existing stored markers intact,
but subsequent edits would no longer record personalization provenance.
Explicit equal-valued protection, read-only previews and applying updates are separate work.
