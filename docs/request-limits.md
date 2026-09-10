# Shared public request limits

Public endpoints use PostgreSQL-backed per-IP quotas by default. Apply migration
`0029_shared_rate_limits` **before** starting the updated API. No Redis is required.
All API processes must share the same database and `SECRET_KEY`.

| Endpoint family | Requests per window |
| --- | --- |
| Login and other credential endpoints using the login limiter | 10 / 60 seconds |
| Web widget messages | 30 / 60 seconds |
| WhatsApp Cloud webhook | 300 / 60 seconds |
| Cloud interest form | 5 / 300 seconds |
| Platform admin login | 10 / 60 seconds |

Limits are shared by limiter name and client address, not by account. The window
starts with the first request; rejected requests do not extend it. Atomic upserts
serialize concurrent requests. Counts are capped, and each request deletes up to
100 expired buckets with skip-locked cleanup. Inactive buckets can remain until
later traffic cleans them; this is not a wall-clock retention guarantee.

## Failure and privacy behavior

- Exhausted quotas return `429` and a rounded-up `Retry-After` header.
- Database errors return `503` with `Retry-After: 5`, never a silent in-memory
  fallback. Lock and statement waits are bounded separately from connection waits.
- Buckets store an HMAC of the limiter/address/settings, not raw addresses. These
  are pseudonymous identifiers, not a promise of anonymization. Rotating
  `SECRET_KEY` resets bucket identity and also affects authentication.
- `RATE_LIMIT_BACKEND=memory` retains the legacy process-local behavior for an
  explicitly single-process setup. `RATE_LIMIT_ENABLED=false` disables protection.
- Quotas use the ASGI client address, not raw `X-Forwarded-For` headers. Direct
  callers cannot select a new quota bucket by changing forwarding headers.

## Trusted ingress setup

Uvicorn resolves forwarding headers only for configured trusted peers. Set
`FORWARDED_ALLOW_IPS` in the API process environment to the actual ingress IPs
or a narrowly scoped proxy network. Do not use `*` for an API reachable by
untrusted callers. The ingress must strip/overwrite caller-supplied forwarding
headers; trust every intermediate proxy only after verifying that boundary.

Without a matching trusted peer, requests behind a proxy share that proxy's
quota. This is intentionally conservative but can throttle unrelated users.
Verify two independent clients receive distinct resolved addresses through your
real ingress before rollout. Do not log raw IPs or change stored bucket privacy.
Docker/Railway ingress configuration and host-level protection require a separate
deployment check; this source fix does not certify those environments.

## Scope and verification

This does **not** implement per-agency spending caps, provider concurrency budgets,
authenticated playground quotas, or exactly-once usage accounting. Q08 remains
partial: shared public request quotas alone cannot prevent every unexpected cost.

`pytest tests/test_shared_rate_limits.py tests/test_ratelimit.py -q` uses a dedicated
`*_test` PostgreSQL database. Tests exercise independent limiter instances under
concurrency, expiration, namespace isolation, private keys and fail-closed errors.

Rollback: deploy the old code or explicitly select the memory backend before
downgrading 0029. Only ephemeral quota counters are dropped; account and message
data are unaffected. Memory fallback loses cross-process protection.
