# syntax=docker/dockerfile:1.7
#
# Собирать из корня монорепозитория (нужен доступ к pnpm-workspace.yaml и
# соседним apps/web, packages/ui package.json для консистентности lockfile):
#   docker build -f apps/api/Dockerfile -t masterqala-api .
#
# Миграции запускаются отдельным release-шагом через build-стадию, а не из
# runtime-образа: последний не содержит prisma CLI (devDependency), см.
# docs/technical/DEPLOYMENT_RUNBOOK.md §10.
#   docker build -f apps/api/Dockerfile --target build -t masterqala-api:build .
#   docker run --rm --env-file apps/api/.env masterqala-api:build \
#     pnpm --filter api exec prisma migrate deploy
#
# Runtime-образ содержит полный node_modules (prod + dev deps), не обрезанный
# pnpm deploy/prune: `pnpm deploy --prod` релинкует @prisma/client из чистого
# content-addressable store и теряет код, который `prisma generate` дописывает
# в node_modules постфактум (enum-объекты вроде DocumentType становятся
# undefined в рантайме — проверено на этом образе). Компромисс: образ крупнее,
# зато Prisma Client работает корректно без хрупких обходов.

FROM node:22.12.0-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS build
# Только package.json всех пакетов workspace — для кэша слоя pnpm install
# отдельно от исходников, которые меняются чаще.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter api...

COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma

RUN useradd --system --uid 1001 --create-home masterqala \
  && mkdir -p /var/lib/masterqala/uploads \
  && chown -R masterqala:masterqala /app /var/lib/masterqala
USER masterqala

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
