# syntax=docker/dockerfile:1.7
#
# Собирать из корня монорепозитория:
#   docker build -f apps/operator/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://masterqala.kz/api/v1 \
#     -t masterqala-operator .
#
# NEXT_PUBLIC_API_URL встраивается в клиентский бандл на этапе сборки —
# пересобирайте образ при смене адреса API, тот же паттерн, что
# apps/client/Dockerfile и apps/master/Dockerfile.
#
# `output: 'standalone'` (apps/operator/next.config.ts) — рантайм-образ
# несёт только фактически используемые node_modules, Next трассирует сам.
#
# Панель оператора не предназначена для публичного интернета — доступ
# ограничивается на уровне reverse proxy/VPN, не в этом образе.

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
RUN pnpm install --frozen-lockfile --filter operator...

COPY packages/ui packages/ui
COPY apps/operator apps/operator
RUN pnpm --filter @masterqala/ui build

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter operator build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/operator/.next/standalone ./
COPY --from=build /app/apps/operator/.next/static ./apps/operator/.next/static

RUN useradd --system --uid 1001 --create-home masterqala \
  && chown -R masterqala:masterqala /app
USER masterqala

WORKDIR /app/apps/operator
EXPOSE 4400
ENV PORT=4400
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
