# Acquisition by any UTM channel

Publish links such as `https://voysse.cl/?utm_source=podcast-42`.
Channels are not an enum: new labels work without code changes. Labels are
trimmed/lowercased and must contain 1–80 ASCII letters, digits, dots, underscores
or hyphens, starting with a letter/digit. Do not put personal data in UTMs.

## Enable and inspect

1. Apply API migration `0036_acquisition_counts` before enabling the collector.
2. Build marketing with `NEXT_PUBLIC_API_URL` pointing to the public API origin.
   Empty disables measurement. Configure API `MARKETING_URL` for CORS and use
   the existing shared PostgreSQL rate limiter in multi-worker deployments.
3. Open a tagged landing link and use a CTA.
4. Sign into the **internal admin** panel, Statistics: **Acquisition channels**.
   Agency accounts cannot access the report.

No third-party analytics service or new dependency is required. This change
does not deploy or alter production configuration.

## Meaning and limits

- Counts: page loads and clicks to App, Docs, GitHub, or opening the booking modal.
  These are **not unique visitors, registrations, completed reservations or sales**.
- A page load without `utm_source` is `direct`. Invalid/empty labels are ignored.
  Other UTM fields are not collected. Attribution applies only to the current
  document URL: no cross-page, cross-domain or user-level persistence.
- Browser opt-out signals DNT/GPC suppress collection. No cookies, visitor IDs,
  IPs, full URLs or referrers are stored in counters; requests omit credentials
  and referrer. Existing security rate limiting is separate.
- Daily UTC counters use atomic increments. Reports default to 30 days (1–90
  accepted), limited to 1000 source/event groups with an explicit truncation flag.
  Old counters are opportunistically removed in batches on ingestion; without
  traffic they remain until collection resumes. Backups follow backup retention.
- Public counts are approximate: bots, blocked requests and reloads affect them.
  Rate limiting reduces abuse but is not authentication or fraud prevention.
  Collector failures never block CTA navigation and are not automatically retried.

## Verification and rollback

`pytest tests/test_acquisition.py -q` runs against a disposable `*_test` database.
`node scripts/ui/acquisition-smoke.cjs` exercises the marketing browser with API
fixtures; configure `MARKETING_URL`/`PLAYWRIGHT_MODULE` as necessary. Run frontend
lint/build, plus migration upgrade/downgrade on a disposable database.

Rollback as one unit: remove the tracker/booking marker, admin report/router/model,
privacy paragraph and documentation; downgrade 0036 only after removing readers
and writers. Downgrade deletes aggregate counters. Do not modify authentication
or unrelated Studio migrations. Keep tests with their corresponding behavior.
