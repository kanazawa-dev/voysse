# Portal design parity

The client portal now uses dashboard typography, semantic light/dark tokens,
shared buttons and matching 36px theme/language controls. Its authentication stays
separate from agency administration. Loading and unavailable screens retain the
controls, and the shell does not add a duplicate theme switch.

Agency colors decorate identity; readable text and surfaces use semantic tokens.
Responsive inbox, login, empty and error states were checked at 1440/768/390/320px
in both themes. Keyboard focus, language/theme persistence and human-mode composer
behavior passed the fixture browser smoke. Web lint and isolated webpack build
passed. No real account, message send or production deployment was involved.

Verify with `node scripts/ui/portal-design-smoke.cjs` against a local web preview
(`WEB_URL` and `PLAYWRIGHT_MODULE` are configurable). Roll back the portal CSS/page
and shell duplicate-control exclusion together; do not change portal auth routes.
