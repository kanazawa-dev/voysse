# Voxy accompanies the product; clouds belong to marketing

Voxy (powered by Bloub’s SVG engine) is a small expressive companion, **not a replacement logo or a chatbot feature**. Voysse branding, navigation icons, human avatars and customer logos remain intact. The separate marketing background task replaces both Rivr videos with original generated cloud artwork.

## Where it appears

- Marketing: introduction card, agent feature card and closing CTA.
- Product: page headings, empty states, loading screen, login and admin login.
- Conversations: agent avatars, welcome state, thinking indicator and widget greeting.
- Client portal: access-page companion and empty states; customer colour remains authoritative.

The companion reflects actual loading/error/pending state where available. Decorative appearances are hidden from screen readers; adjacent status text carries the meaning. It never claims to perform an operation or provide support by itself.

## Integration

`components/bloub-avatar.tsx` adapts the framework-free Bloub engine to React. Public moods are `idle`, `thinking`, `success`, `error`, `sleep`, and `listening`. Identity is seeded deterministically; SVG masks use React `useId` for SSR safety.

The engine is vendored unchanged under `lib/bloub/vendor` with its MIT licence, copyright and pinned revision. Marketing and web have isolated Docker build contexts, so each includes an identical engine and adapter. `scripts/ui/bloub-engine.cjs` checks byte parity; update both copies together.

Animations run at 30fps only while visible, the tab is active, and reduced motion is off. Small list avatars are static. There are no visible playback controls, per user request. The retired `voysse.bloub.paused` setting is ignored, so an old stored preference cannot silently freeze Voxy. Device reduced-motion and visibility still control animation. There is no video, Vue, animation-library addition or external avatar request.

## Original cloud artwork

- `apps/marketing/public/media/voysse/cloud-connections-day.png`: pearl/blue cloud valley, quiet central sky and subtle conversation-network filaments.
- `apps/marketing/public/media/voysse/cloud-connections-night.png`: navy twilight version for white CTA text.

Generated specifically for this task with the built-in image tool. `next/image` serves responsive optimised images; the hero is preloaded, the CTA loads lazily. No video assets or playback controls remain. The prior Rivr media-rights TODO in `rivr-ui-review.md` is superseded because those four reference assets were removed.

## Verification

```sh
node scripts/ui/bloub-engine.cjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/ui/rivr-smoke.cjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/ui/bloub-motion.cjs
```

The browser scripts use local development servers (marketing 3102, web 3101, overridable with `MARKETING_URL`/`WEB_URL`) and fixture API responses, never production accounts. The engine script uses the existing web TypeScript dependency. No test dependency was added to the application.

- Engine: 600 deterministic finite frames, rapid state changes, adapter/vendor parity.
- UI smoke: ES switching, FAQ, Cloud dialog, image decoding, zero videos, reduced motion, 3 marketing companions, 11 app routes at desktop/mobile sizes and no document overflow/page errors.
- Motion: changing SVG, no playback controls, Voxy name, legacy pause preference ignored, offscreen pause, live reduced-motion changes, unique masks, login thinking/error and widget thinking/completed state.
- TypeScript, ESLint and webpack builds: run for both applications.

These are frontend tests with fixtures, not backend or delivery-quality guarantees. No commit, push or deployment is part of this change.

## Attribution

Bloub by Jérémy Perret: https://github.com/jeremy-prt/bloub, revision `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`. MIT code attribution is retained in each vendor directory. Upstream notes that its code licence does not confer rights to the x.ai design it recreates; this project does not imply affiliation with x.ai.

## Rollback units

1. Companion: remove avatar imports/usages  in the touched web/marketing components, then remove the two adapters/vendor directories. Branding and API code were not changed.
2. Background: replace `Scene` and the two local cloud images independently of Bloub. The old third-party videos should not be reintroduced without reviewing reuse rights.
3. Tests/documentation: `scripts/ui/bloub-*.cjs`, updated Rivr smoke checks, and this document are review-only tooling.
