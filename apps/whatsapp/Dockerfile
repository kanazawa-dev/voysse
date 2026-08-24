FROM node:22.18.0-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

FROM node:22.18.0-bookworm-slim AS runner

ENV NODE_ENV=production \
    WHATSAPP_BRIDGE_HOST=0.0.0.0 \
    WHATSAPP_BRIDGE_PORT=3101

RUN groupadd --gid 10001 nodejs \
    && useradd --uid 10001 --gid nodejs --create-home baileys

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder --chown=baileys:nodejs /app/dist ./dist

USER baileys

EXPOSE 3101

CMD ["node", "dist/src/index.js"]
