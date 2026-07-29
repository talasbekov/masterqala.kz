# syntax=docker/dockerfile:1.7
#
# Собирать из корня монорепозитория:
#   docker build -f apps/web/Dockerfile \
#     --build-arg VITE_API_URL=https://masterqala.kz/api/v1 \
#     -t masterqala-web .
#
# VITE_API_URL встраивается в статику на этапе сборки (Vite env — compile-time,
# не runtime) — пересобирайте образ при смене адреса API.
#
# Контейнер отдаёт только статику и SPA fallback. TLS, HSTS, CSP и остальные
# security-заголовки — зона ответственности внешнего reverse proxy перед этим
# контейнером, см. docs/technical/DEPLOYMENT_RUNBOOK.md §12.

FROM node:22.12.0-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter web...

COPY packages/ui packages/ui
COPY apps/web apps/web

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @masterqala/ui build
RUN pnpm --filter web build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
