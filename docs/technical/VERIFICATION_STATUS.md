# Статус проверки бесплатного пилота

Последнее обновление: 24 июля 2026 года.

Этот документ фиксирует фактически выполненные автоматические проверки реализации `feat/free-pilot-mode` и отделяет их от ручных инфраструктурных проверок перед production.

## 1. Проверенная версия

```text
Pull request: #4
Branch: feat/free-pilot-mode
Commit: 0e1232585ef95c174fcecaf587b42e11f30059c7
GitHub Actions workflow: CI
Run number: 9
Conclusion: success
```

## 2. Успешные шаги CI

GitHub Actions успешно выполнил:

1. запуск PostGIS `16-3.4`;
2. установку Node.js `22.12.0`;
3. установку pnpm `9.15.0`;
4. `pnpm install --frozen-lockfile`;
5. `prisma migrate deploy` на чистой test-БД;
6. API build;
7. API unit tests;
8. API e2e tests;
9. сборку workspace-пакета `@masterqala/ui`;
10. web TypeScript/Vite build.

## 3. Ошибка, найденная первым CI run

Первый фактический run прошёл migrations, API build, unit и e2e, но остановился на web build:

```text
Cannot find module '@masterqala/ui'
```

Причина:

- web импортировал workspace-пакет `@masterqala/ui`;
- package exports указывали на `packages/ui/dist`;
- команда `pnpm --filter web build` не собирала UI package заранее.

Исправление в `apps/web/package.json`:

```json
{
  "scripts": {
    "prebuild": "pnpm --filter @masterqala/ui build",
    "build": "tsc -b && vite build"
  }
}
```

После исправления CI run №9 завершился успешно.

## 4. Что доказал CI

Автоматически подтверждено:

- Prisma Client генерируется;
- новая миграция применяется к чистой PostgreSQL/PostGIS базе;
- backend компилируется;
- добавленные unit-тесты выполняются;
- API e2e suite выполняется;
- frontend TypeScript компилируется;
- Vite production build создаётся;
- workspace-зависимость UI собирается воспроизводимо.

## 5. Что CI пока не доказал

Зелёный run не заменяет:

- upgrade migration с реальной схемы до `CommercialMode`;
- production-like deploy;
- reverse proxy/TLS/Socket.IO smoke;
- реальную SMS-доставку;
- сохранность upload volume;
- backup/restore;
- browser e2e полного срочного и планового пути;
- load test;
- security P0 из `SECURITY.md`;
- ручную проверку текстов и финансовой семантики интерфейса.

## 6. Обязательный ручной smoke

### Срочная заявка

- [ ] `GET /api/v1/config/public` показывает `FREE_PILOT`;
- [ ] клиент создаёт заявку;
- [ ] `offer:new` содержит `freePilot=true`, `compensation=0`;
- [ ] оффер не содержит точный адрес и детали доступа;
- [ ] мастер принимает и проходит статусы;
- [ ] HTTP и `order:status` показывают нулевые `calloutPrice/serviceFee`;
- [ ] по заявке нет `PaymentTransaction`;
- [ ] по заявке нет `Accrual`;
- [ ] стоимость работ оплачивается напрямую мастеру.

### Плановая заявка

- [ ] мастер с нулём lead-кредитов откликается на `FREE_PILOT`;
- [ ] `SPEND` не создаётся;
- [ ] после отмены `REFUND` не создаётся;
- [ ] смешанная лента различает `FREE_PILOT` и `PAID_MOCK`;
- [ ] историческая платная заявка продолжает требовать кредит.

### Отключённые операции

- [ ] purchase lead-кредитов возвращает `403`;
- [ ] withdrawal возвращает `403`;
- [ ] packages пусты;
- [ ] wallet balance равен 0;
- [ ] mock withdrawal history не показывается.

## 7. Условие перевода PR #4 из Draft

PR может быть переведён в Ready for review после:

1. успешного CI — выполнено;
2. ручного business smoke — не подтверждено;
3. проверки migration upgrade/rollback на staging — не подтверждено;
4. решения по обязательным security/infrastructure P0 — не подтверждено;
5. независимого code review — не подтверждено.

До выполнения пунктов 2–5 Draft-статус является правильным.
