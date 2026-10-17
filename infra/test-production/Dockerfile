# syntax=docker/dockerfile:1.7
FROM node:22.12.0-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/client/package.json apps/client/package.json
COPY apps/master/package.json apps/master/package.json
COPY apps/operator/package.json apps/operator/package.json
COPY apps/site/package.json apps/site/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM base AS api
COPY apps/api apps/api
COPY scripts/test-production scripts/test-production
RUN pnpm --filter api build
WORKDIR /app/apps/api
RUN mkdir -p /var/lib/masterqala-test/uploads && chown -R node:node /var/lib/masterqala-test
USER node
CMD ["node", "dist/main.js"]

FROM base AS ui
ARG APP
ENV APP=${APP}
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://127.0.0.1:13000/api/v1
ENV NEXT_PUBLIC_MASTER_APP_URL=http://127.0.0.1:14300
ENV API_URL=http://api:3000/api/v1
ENV APP_URL=http://127.0.0.1:14200
ENV MASTER_APP_URL=http://127.0.0.1:14300
COPY packages/ui packages/ui
COPY apps/client apps/client
COPY apps/master apps/master
COPY apps/operator apps/operator
COPY apps/site apps/site
COPY scripts/test-production scripts/test-production
RUN case "$APP" in client|master|operator|site) ;; *) exit 1 ;; esac \
    && pnpm --filter @masterqala/ui build \
    && if [ "$APP" = site ]; then node scripts/test-production/build-site.cjs; else pnpm --filter "$APP" build; fi \
    && chown -R node:node "/app/apps/$APP/.next"
USER node
CMD ["sh", "-c", "exec node \"/app/apps/$APP/node_modules/next/dist/bin/next\" start \"/app/apps/$APP\" --hostname 0.0.0.0 --port 3000"]
