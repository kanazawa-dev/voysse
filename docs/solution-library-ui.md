# Reuse a solution across clients

Agency administrators can open **Solutions** (`/solutions`) to create shared behavior,
publish immutable versions, and install a selected version for an active client.
The interface supports Spanish and English. Operators remain restricted to Inbox.

## Quick path

1. Choose **New solution**, name it, and enter the shared settings.
2. Review the content for client-specific data or credentials before saving.
3. Open the solution and choose a version. Publishing a version does not update existing installations.
4. Select an active client, name the new agent, and confirm installation.
5. Follow **Review agent** to configure the inactive agent before any activation.

Only instructions, personality, temperature, maximum response tokens, and conversation
memory limit are shared. Installation does not copy credentials, knowledge, models,
or channels. The content review is a human confirmation, not an automated secret scanner.

## Recovery rules

| Situation | Behavior |
| --- | --- |
| Another administrator published first | Keep the draft, inspect the latest published settings, explicitly accept the new concurrency base, then publish. No automatic retry. |
| A write has an uncertain result | Block submission. Copy the draft and reload the library to check whether it saved before creating anything again. |
| Installation already exists or client changed | Refresh installations before retrying; the API enforces one installation per solution/client. |
| A read fails | Show a localized error and a retry/refresh action. |

Library and installation lists use 50-row pages. Selecting an older version explicitly
uses that version as the publication draft or installation source. Existing installations
are unchanged; update previews/application and rollback are not exposed yet.

## Verification

Run frontend lint, TypeScript checking, and the production build in `apps/web`.
With a local preview running, execute from the repository root:

```sh
WEB_URL=http://127.0.0.1:3144 node scripts/ui/solutions-smoke.cjs
```

Requires Playwright and its Chromium browser; set `PLAYWRIGHT_MODULE` to an installed
module path if it is not resolvable from the script. The smoke test intercepts every API
request: it verifies browser behavior and payloads, **not live API integration or delivery**.
Backend isolation and persistence have separate tests described in [the API contract](solution-library.md).
