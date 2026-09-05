# Rivr visual redesign

The landing and application now use Rivr's neutral grey canvas, navy type, rounded white cards and pill controls. The landing follows the reference's scenic hero, glass card, documentation corner, bento and closing video. Voysse branding, bilingual copy and existing application logic remain.

## Review locally

- Marketing: `npm --prefix apps/marketing run dev -- --port 3102`
- Dashboard: `npm --prefix apps/web run dev -- --port 3101`
- Browser smoke: `PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/ui/rivr-smoke.cjs`
- Optional `MARKETING_URL` / `WEB_URL` override the local URLs.

The browser harness uses synthetic API responses, **not real sessions or production data**. It verifies ES switching, the FAQ, Cloud dialog opening, reduced-motion video pausing, landing widths 1440/390/320, and 11 application routes at desktop/mobile widths. It writes captures under `/tmp/rivr-*`. It does not validate backend operations or submit Cloud leads.

## Verification (2026-09-04)

- TypeScript, both apps: passed (`tsc --noEmit --incremental false`).
- ESLint, both apps: passed.
- Production compilation, both apps: passed (`npm run build -- --webpack`).
- Browser harness: passed; no page errors or document horizontal overflow.
- Native Turbopack build: environment process/port permission error, also observed after retry with escalation. No build configuration was changed to conceal this.
- Captures of landing and dashboard shown on the nodeterm canvas.

## Scope and rollback

1. Landing unit: `apps/marketing/app/{page.tsx,rivr.css}`, local media. Reverting this unit restores the prior landing composition. Existing Cloud interest submission remains in its original component.
2. Visual system unit: globals/layouts/button primitives in both apps, web shell/navigation/PageHead, dashboard/login decoration and public surface CSS. Revert these files together to restore the old visual system; APIs and authentication are untouched.
3. Review harness: `scripts/ui/rivr-smoke.cjs`; no production runtime dependency was added.

Public portal and widget theme variables are preserved so customer branding continues to take priority. No deployment, commit or push was performed.

## Media provenance — superseded

The later Bloub/cloud iteration removed both Rivr videos and their posters. Marketing now uses two original generated cloud images and no video. See [Bloub companion](bloub-companion.md) for current assets, attribution and verification. Earlier video-specific test notes above describe the initial Rivr iteration, not the current code.
