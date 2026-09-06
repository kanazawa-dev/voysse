# Roadmap

A living list of what the team wants to build next — not a committed
timeline. Status tags:

- **Planned** — scoped, on the near-term list.
- **Exploring** — we agree it's worth doing, still figuring out the approach.
- **Idea** — worth considering, not yet scoped.

Have an opinion or a use case for any of these? Open a
[Discussion](https://github.com/kanazawa-dev/voysse/discussions) or an
[Issue](https://github.com/kanazawa-dev/voysse/issues).

## Channels

- **Instagram DM** — Manual connection, signed webhooks and durable processing
  are implemented. Guided OAuth, supported media coverage and authorized-account
  validation remain planned. See [setup and limitations](social-channels-setup.md).
- **Facebook Messenger** — Manual connection and durable processing are
  implemented, with the same remaining validation boundaries. Neither channel
  should be described as production-certified without a real account test.
- **Telegram** — Idea.
- **SMS / RCS** — Idea. Useful for agencies whose clients' customers don't use
  WhatsApp or Messenger.

## Voice

- **Voice agents on WhatsApp** — Exploring. Agents already transcribe
  incoming voice notes (audio recognition); replying *with a spoken voice
  note* (text-to-speech) instead of text-only is the natural next step.
- **Inbound/outbound phone calls** — Exploring. A telephony channel (e.g. via
  a provider like Twilio) so an agent can answer or place real phone calls,
  not just chat channels.
- **Real-time voice in the web widget** — Idea. Let a website visitor talk to
  the agent with their microphone instead of typing.

## Agency operations

- **Team roles & invites** — Admin/operator roles and revocable, expiring manual
  invitation links are implemented. Automated invitation email and finer-grained
  per-client permissions remain future work. See [team setup](auth-team-setup.md).
- **Proactive / scheduled messaging** — Idea. Reminders, appointment
  confirmations, broadcast campaigns — sending the first message instead of
  only replying.
- **First-class booking/calendar tool** — Idea. Custom HTTP/MCP tools already
  let an agent call any API, but a built-in calendar/booking integration
  would save every agency wiring the same thing themselves.
- **Agent-to-agent handoff** — Idea. A front-desk agent that routes a
  conversation to a specialist agent (billing, support, sales) instead of one
  agent trying to do everything.
- **Deeper conversation analytics** — Idea. Beyond the current
  clients/agents/conversations/tokens metrics: tagging, search, and quality
  signals (e.g. CSAT) across the Inbox.

## Platform

- **Usage-based billing for Voysse Cloud** — Exploring. The self-hosted
  product stays bring-your-own-key; Cloud needs real plan enforcement on top
  of the token usage already tracked per agent/model.
- **Agent template marketplace** — Idea. The new-agent wizard already ships a
  handful of starter templates; a shareable, community-contributed gallery is
  a natural extension.
- **More dashboard languages** — Idea. The i18n system supports English and
  Spanish today; adding a language is mostly translation work, not
  architecture work.
