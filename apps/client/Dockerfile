# syntax=docker/dockerfile:1.7
#
# Собирать из корня монорепозитория:
#   docker build -f apps/client/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://masterqala.kz/api/v1 \
#     -t masterqala-client .
#
# NEXT_PUBLIC_API_URL встраивается в клиентский бандл на этапе сборки
# (Next.js инлайнит NEXT_PUBLIC_* в код при `next build`, не читает их
# заново в рантайме) — пересобирайте образ при смене адреса API, тот же
# паттерн, что VITE_API_URL в apps/web/Dockerfile.
#
# `output: 'standalone'` (apps/client/next.config.ts) — рантайм-образ несёт
# только фактически используемые node_modules, Next трассирует сам.

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
RUN pnpm install --frozen-lockfile --filter client...

COPY packages/ui packages/ui
COPY apps/client apps/client
RUN pnpm --filter @masterqala/ui build

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter client build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/client/.next/standalone ./
COPY --from=build /app/apps/client/.next/static ./apps/client/.next/static

RUN useradd --system --uid 1001 --create-home masterqala \
  && chown -R masterqala:masterqala /app
USER masterqala

WORKDIR /app/apps/client
EXPOSE 4200
ENV PORT=4200
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
