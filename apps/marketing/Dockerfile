FROM node:22.18.0-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.18.0-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Empty by default: CTAs link to a relative "/login", resolved same-origin.
# Set this only when the dashboard (apps/web) is deployed on a different
# origin than this marketing site, e.g. https://app.openvoiss.com.
ARG NEXT_PUBLIC_APP_URL=
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run lint && npm run build

FROM node:22.18.0-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --gid 10001 nodejs \
    && useradd --uid 10001 --gid nodejs --create-home nextjs

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
