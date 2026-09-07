# First-time product tour

The **Getting started** button in the authenticated workspace header opens a
minimal Voxy-guided tour. It opens automatically until the user first advances or
dismisses it. Progress is personal, persisted in the database, and available on
another device. Existing accounts receive the tour once after rollout too.

Administrators get eight short steps covering agency identity and provider keys,
clients, agents and knowledge, testing, Studio/channels, Inbox and client portals.
Operators get three Inbox-oriented steps without administrative setup actions.
**Open setup** saves progress and navigates to the existing configuration screen;
it does not create resources or automatically activate a channel. Resume through
the header button after configuring that screen. Completed tours can be repeated.

## Safety and persistence

- `/api/onboarding` requires an active agency-user session. It reads/writes only
  that user's `onboarding_state`, never accepts a target user/agency ID, and uses
  revision checks to reject conflicting writes from another tab.
- Finishing the tour means the guide was completed, not that the account is ready
  for production. Provider costs, real channel verification and human escalation
  still need validation. The tour makes no AI or external transport calls.
- Dismissal never blocks the workspace if saving fails. Reopen and reload progress
  to recover after an error; a failed save may cause the tour to appear again.
- Migration `0037_user_onboarding` adds a JSON column with an empty default.
  Downgrading to `0036_acquisition_counts` removes only tour progress. Roll back
  application code together with that migration; never downgrade under new code.

Verification: API tests cover persistence, revision conflicts, role restrictions
and tenant isolation. `scripts/ui/onboarding-smoke.cjs` covers ES/EN, desktop/mobile,
focus, configuration navigation, dismissal, completion, repeat and failed saves.
