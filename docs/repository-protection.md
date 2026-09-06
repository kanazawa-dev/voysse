# Protected main

Changes reach `main` through a pull request with passing checks and an up-to-date
branch. Protection also applies to administrators; force pushes and branch
deletion are disabled. Conversations must be resolved before merging.

## Required checks

| Check | GitHub App ID |
| --- | --- |
| api | 15368 |
| frontend (web) | 15368 |
| frontend (marketing) | 15368 |
| operations | 15368 |
| whatsapp | 15368 |
| GitGuardian Security Checks | 46505 |

These names and app IDs were verified against actual PR check runs before enabling
protection on 5 September 2026. If workflows change, reconcile protection with the
new checks before removing old jobs; do not bypass failing checks.

## Solo-maintainer workflow

A PR is required, but zero external approvals are required so the sole maintainer
can merge their own work after CI passes. This is **not** independent human review.
Stale approvals are dismissed when new commits arrive. Merge commits remain allowed.
An approved linked issue and exactly one `type:*` label remain contribution conventions.

Verify the live settings (the GitHub configuration is not managed by this file):

```sh
gh api repos/kanazawa-dev/voysse/branches/main/protection
```

Changing protection requires an explicit maintainer decision. Reverting this
document or a code commit does not change GitHub settings.

## Dependency follow-up

Both frontend locks now resolve `qs` 6.16.0 without upgrading unrelated packages.
Run `node scripts/ui/qs-security-smoke.cjs` after installing both frontends and
`npm --prefix apps/web audit` / `npm --prefix apps/marketing audit`.
The smoke checks hostile constructor keys and ordinary serialization locally;
it does not claim an exploitable production route existed.

References: [GitHub branch protection API](https://docs.github.com/en/rest/branches/branch-protection)
and [qs advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).
