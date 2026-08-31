# Voysse brand migration

The product display name is **Voysse**. This first migration phase changes
customer-visible branding, documentation, API metadata, and commercial
validation artifacts without breaking existing installations.

## Current boundary

| Surface | Current rule |
|---|---|
| Product name shown to people | Use `Voysse` |
| Repository and GitHub coordinates | Moved: `kanazawa-dev/voysse`. GitHub redirects the old `kanazawa-dev/openvoiss` coordinates. |
| Package, image, container, database, and environment names | Keep existing `openvoiss` / `OPENVOISS_*` identifiers |
| Existing domain and email addresses | Keep `openvoiss.com` until replacement Voysse endpoints are verified |
| Source component filenames and exported symbols | Keep existing names to avoid unrelated import churn |
| Alembic revision IDs, filenames, and historical text | Never rewrite migration history |

## Contributor rule

Use **Voysse** for new user-facing text. Do not introduce a new technical
`voysse` identifier until its compatibility, deployment, and rollback plan is
specified. Legacy identifiers are intentional, not missed replacements.

## Next migration

A separate work unit may move domains, email, repository coordinates, packages,
images, containers, database defaults, and source identifiers after replacement
assets are available. It must preserve redirects or aliases where external
installations depend on the old names.
