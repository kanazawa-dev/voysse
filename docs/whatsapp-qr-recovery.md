# Recover WhatsApp QR work without blind resends

QR inbound requests commit a deduplicated PostgreSQL event before acknowledging.
A separate worker prepares and sends replies; the bridge does not send another
reply when the API returns an acknowledgement only.

## Deploy safely

1. Back up the database and encryption keys. Pause incoming QR traffic during
   cutover and let old inline requests finish; do not mix old and new workers.
2. Upgrade the bridge first: it adds the required source phone and checks live
   socket identity before sending queued replies. Its old inline-response path
   remains compatible with the old API.
3. Apply migration `0030_qr_events`, then update API and web. Deploy the required
   `whatsapp-qr-worker` service with the same API image revision. An old bridge
   with the new API is unsupported (inbound validation fails).
4. Check Docker health and the [host monitor](service-monitor.md). The worker
   uses the [progress heartbeat](worker-health.md), not just process liveness.
5. With a controlled account, send text and a supported attachment. Inspect
   Incoming activity and Inbox; confirm externally that only one reply arrived.
   Automated fixtures do not establish real WhatsApp delivery.

## Interpret activity

| State | Action |
| --- | --- |
| `queued` | Wait for a connected channel and healthy worker. |
| `ready` | Reply persisted; reconnecting does not regenerate it. |
| `preparing` | AI/tools may be running; inspect tool effects after interruption. |
| `sending` | An external effect may exist. Do not replay manually. |
| `sent` | Bridge returned a message ID, not a delivery/read receipt. |
| `needs_review` | Inspect account changes, media failures or interrupted preparation. |
| `uncertain` | Check WhatsApp itself before responding again. No automatic resend. |
| `ignored` | Human control or an inactive destination suppressed automation. |

Administrators see the latest 50 events on the QR channel page and an Inbox link
when a conversation exists. Review/uncertain states switch existing conversations
to human mode. Failures before conversation creation have only the event preview;
inspect the original message in WhatsApp. Operators retain Inbox access, not
channel-administration access.

## Safety boundaries and limits

- Per-channel PostgreSQL session advisory locks survive commits. Other workers
  cannot steal work during AI; incoming admission does not acquire that lock.
- Source phone and assigned agent are bound at admission and rechecked before
  sending. The bridge checks the live socket phone, not only database status.
- Messages older than 24 hours since admission require review. This is an
  internal freshness policy, not a QR platform messaging-window claim.
- Base64 is capped at 24 MiB (18 MiB decoded). Missing downloaded media requires
  human review rather than an AI reply about an attachment it never received.
  Existing media interpretation behavior remains; unsupported media is not added.
- Durability begins at database admission. Bridge/API outages before admission,
  upstream replay and QR session-history reconciliation remain unresolved.
  Keep bridge routes private and enforce ingress/body-size limits.
- Payloads include message content and supported media. Protect database access
  and backups; retention/pruning remain separate pending work.
- No automatic recovery of ambiguous tool effects, receipts, exactly-once
  delivery guarantee or real-account validation is implied.

## Rollback

Stop the QR worker before reverting processing behavior. Keep the event table
and inspect queued/ready/review/uncertain work before returning to an inline API;
old code cannot drain it safely. Downgrade 0030 deletes queued payloads: use only
after backup and explicit reconciliation. Do not roll back database state to
try to resend an uncertain message.

## Local verification — 5 September 2026

- Isolated PostgreSQL API suite: **181 passed**, including **27 QR tests** for
  concurrent admission, crash checkpoints, uncertain sends, takeover races,
  account binding, reconnection, media failure and authorization.
- Bridge: **6 tests passed**, TypeScript build passed, including ACK-only versus
  legacy inline behavior and rejection of a changed live socket account.
- Web: lint and webpack production build passed. Fixture browser checks passed
  for QR and Cloud in ES/EN at 1440/390/320 px, including Inbox deep links and no
  hydration errors. QR mobile screenshots inspected.
- Operations: **11 tests passed**; Compose includes the required QR worker.
- Migration round trip: base → 0030 → base → 0030 in a separate disposable DB.

This is local source verification, not a deployment or real-provider send test.
