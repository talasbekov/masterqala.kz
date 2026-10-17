# syntax=docker/dockerfile:1.7
#
# Собирать из корня монорепозитория:
#   docker build -f apps/site/Dockerfile \
#     --build-arg API_URL=https://masterqala.kz/api/v1 \
#     --build-arg APP_URL=https://app.masterqala.kz \
#     --build-arg CONTACT_PHONE="+7 700 000 00 01" \
#     --build-arg CONTACT_EMAIL=support@masterqala.kz \
#     -t masterqala-site .
#
# `apps/site` тянет категории на этапе сборки (ISR revalidate 24ч, см.
# docs/STATUS.md) — build-стадии нужен доступ к живому API по API_URL.
# `lib/env.ts` читает те же переменные и на каждый ревалидейт после старта
# контейнера — передавайте их и в `docker run -e`/compose `environment:`,
# ARG в runtime-образ не протекает.
#
# `output: 'standalone'` (apps/site/next.config.ts) — рантайм-образ содержит
# только фактически используемые node_modules (Next трассирует зависимости
# сам), не весь workspace `node_modules`.

FROM node:22.12.0-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/site/package.json apps/site/package.json
COPY apps/client/package.json apps/client/package.json
COPY apps/master/package.json apps/master/package.json
COPY apps/operator/package.json apps/operator/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter site...

COPY packages/ui packages/ui
COPY apps/site apps/site
RUN pnpm --filter @masterqala/ui build

ARG API_URL
ARG APP_URL
ARG CONTACT_PHONE
ARG CONTACT_EMAIL
ENV API_URL=${API_URL}
ENV APP_URL=${APP_URL}
ENV CONTACT_PHONE=${CONTACT_PHONE}
ENV CONTACT_EMAIL=${CONTACT_EMAIL}
RUN pnpm --filter site build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/site/.next/standalone ./
COPY --from=build /app/apps/site/.next/static ./apps/site/.next/static

RUN useradd --system --uid 1001 --create-home masterqala \
  && chown -R masterqala:masterqala /app
USER masterqala

WORKDIR /app/apps/site
EXPOSE 4100
ENV PORT=4100
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
