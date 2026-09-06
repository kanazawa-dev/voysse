# Book a conversation with Alex

The marketing pricing cards use direct personal booking links:

| Card | Destination | Duration |
| --- | --- | --- |
| Cloud | https://cal.com/voysse/voysse-cloud | 20 minutes |
| Enterprise/project discussion | https://cal.com/voysse/hablemos-de-tu-proyecto | 30 minutes |

Both identify Alex as the person taking the call, with an email alternative at
`alex@voysse.cl`. English and Spanish copy live in the marketing dictionary.
Links open in the same tab using the existing landing action/hover styling.
No Cal.com SDK, iframe, API key, or preliminary lead form is required.

The old lead API and existing lead records are unchanged. Booking does not create
a Voysse account, submit a lead to that API, charge a customer, or activate Cloud.
There is no booking webhook or CRM synchronization. Cal.com handles availability,
confirmations and rescheduling according to Alex's event configuration.

The privacy copy describes the external booking flow and keeps the earlier inquiry
data covered. Cal.com's [privacy policy](https://cal.com/privacy) describes its
processing of booking information. This does not replace legal review of the
existing draft policy. No license, pricing or commercial entitlement was changed.

## Verification and rollback

Run marketing lint/TypeScript/build and `node scripts/ui/cal-booking-smoke.cjs`
with `MARKETING_URL` pointing at the preview. Set `PLAYWRIGHT_MODULE` if Playwright
is installed outside the project. The smoke checks both languages and three
viewport widths, exact destination navigation, keyboard focus and absence of a
lead POST or calendar embed. Cal.com navigation is intercepted: this is not a
real booking or availability test, and sends no messages to Alex.

Rollback the pricing-link/copy/CSS/privacy changes and this smoke/doc together;
the retained `CloudInterestDialog` and unchanged lead API allow the previous flow
to be restored without restoring or deleting customer data.

Local verification (5 September 2026): marketing lint, TypeScript and webpack
production build passed. The booking smoke passed in ES/EN at 1440/390/320px;
the updated Cypon identity smoke passed at 1440/1024/768/390/320px. A mobile Cloud
card screenshot was inspected. No real reservation was submitted and these local
checks do not establish that the changes have been deployed.
