# Security observability

## Назначение

Этот документ описывает эксплуатационный контур безопасности MasterQala.kz поверх файлового quarantine, audit trail и retention policy.

Контур решает четыре задачи:

1. отделяет liveness приложения от readiness внешних зависимостей;
2. превращает важные audit events в persistent alerts;
3. даёт оператору единый security dashboard;
4. фиксирует подтверждение и разрешение инцидентов в audit trail.

## Health endpoints

### Liveness

```http
GET /api/v1/health/live
```

Liveness отвечает только на вопрос: процесс API работает и способен обработать HTTP-запрос.

Он не зависит от PostgreSQL, pg-boss или ClamAV и подходит для restart probe.

Пример:

```json
{
  "status": "alive",
  "checkedAt": "2026-07-24T12:00:00.000Z"
}
```

### Readiness

```http
GET /api/v1/health/ready
```

Readiness проверяет:

- PostgreSQL через `SELECT 1`;
- runtime-состояние pg-boss;
- ClamAV через TCP-команду `PING` и ответ `PONG`.

В production API готов принимать трафик только когда все три зависимости доступны.

В development/test допускаются:

- `PGBOSS_DISABLED=1`;
- `FILE_SCAN_MODE=DISABLED`.

Публичный readiness намеренно не возвращает:

- connection strings;
- host/port ClamAV;
- тексты внутренних ошибок;
- scan backlog;
- количество security alerts.

При деградации endpoint возвращает HTTP `503` и только сокращённые статусы компонентов.

## Production fail-fast

В production запрещено:

```env
PGBOSS_DISABLED="1"
```

Это правило проверяется во время bootstrap. Без workers не выполняются:

- scan jobs;
- retry sweep;
- cleanup;
- retention;
- другие фоновые процессы заявок.

## Security alerts

Таблица `SecurityAlert` хранит рабочее состояние инцидента отдельно от append-only `SecurityAuditEvent`.

Поля:

```text
id
ruleKey
severity
title
resourceType
resourceId
sourceEventId
status
occurrenceCount
firstSeenAt
lastSeenAt
acknowledgedAt
acknowledgedByUserId
resolvedAt
resolvedByUserId
operatorNote
createdAt
updatedAt
```

### Состояния

```text
OPEN -> ACKNOWLEDGED -> RESOLVED
OPEN -----------------> RESOLVED
```

Возврат из `RESOLVED` в `OPEN` не поддерживается. Повторное событие после acknowledge/resolve создаёт новый открытый alert.

### Уровни

```text
WARNING
HIGH
CRITICAL
```

### Правила первой версии

| Audit action | Alert rule | Severity |
|---|---|---|
| `FILE_SCAN_INFECTED` | `MALWARE_DETECTED` | `CRITICAL` |
| `FILE_SCAN_FAILED` | `FILE_SCAN_FAILED` | не ниже `WARNING` |
| `PDF_CDR_CDR_FAILED` | `PDF_CDR_FAILED` | `HIGH` |
| `SECURITY_RETENTION_PARTIAL_FAILURE` | `RETENTION_PARTIAL_FAILURE` | `HIGH` |
| `SECURITY_DEPENDENCY_DOWN` | `DEPENDENCY_UNAVAILABLE` | `CRITICAL` |

Alert создаётся PostgreSQL trigger после вставки audit event.

Повторные события с одинаковыми `ruleKey + resourceType + resourceId` объединяются в один `OPEN` alert:

- увеличивается `occurrenceCount`;
- обновляется `lastSeenAt`;
- сохраняется последний `sourceEventId`;
- severity может только повышаться.

## Operator API

Все endpoints защищены `JwtAuthGuard`, `RolesGuard` и ролью `OPERATOR`.

### Dashboard

```http
GET /api/v1/admin/security/dashboard
```

Возвращает:

- полную readiness-диагностику;
- scan backlog;
- предупреждения;
- метрики за последние 24 часа;
- до десяти открытых alerts;
- последние audit events.

### Список alerts

```http
GET /api/v1/admin/security/alerts
```

Фильтры:

```text
status
severity
ruleKey
before
beforeId
limit
```

Pagination использует `lastSeenAt + id`.

### Подтверждение

```http
PATCH /api/v1/admin/security/alerts/:id
Content-Type: application/json

{
  "status": "ACKNOWLEDGED",
  "note": "Инцидент принят в работу"
}
```

### Разрешение

```http
PATCH /api/v1/admin/security/alerts/:id
Content-Type: application/json

{
  "status": "RESOLVED",
  "note": "Заражённый файл удалён, источник проверен"
}
```

Изменение alert и audit event `SECURITY_ALERT_ACKNOWLEDGED` или `SECURITY_ALERT_RESOLVED` сохраняются в одной PostgreSQL-транзакции.

## Web dashboard

Маршрут:

```text
/admin/security
```

Экран показывает:

- PostgreSQL, pg-boss и ClamAV status;
- readiness API;
- pending/failed/stale scans;
- открытые alerts по severity;
- заражения и scan failures за 24 часа;
- последние audit events;
- действия acknowledge/resolve.

Dashboard обновляется каждые 15 секунд и может быть обновлён вручную.

## Kubernetes / reverse proxy probes

Рекомендуемые paths:

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/live
    port: 3000

readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 3000
```

Readiness не следует использовать как публичный status page. Для внешнего мониторинга endpoint должен быть ограничен ingress/network policy.

## Staging smoke

Перед переводом PR из Draft проверить:

1. `health/live` остаётся `200`, когда остановлен ClamAV;
2. `health/ready` становится `503`, когда остановлен ClamAV;
3. после запуска ClamAV readiness возвращается в `200`;
4. остановка pg-boss/API database connection отражается как `not_ready`;
5. EICAR создаёт один `CRITICAL` alert;
6. повторный EICAR для того же resource увеличивает `occurrenceCount`;
7. клиент получает `403` для operator endpoints;
8. acknowledge и resolve создают audit events;
9. dashboard не показывает внутренние данные обычному пользователю;
10. production bootstrap отклоняет `PGBOSS_DISABLED=1`.

## Ограничения

- Health endpoint не заменяет внешний uptime monitoring.
- Недоступность самой PostgreSQL не может быть сохранена в PostgreSQL audit trail.
- Если pg-boss полностью остановлен, внутренний scheduled monitor также не сможет создать alert; это должен обнаруживать внешний мониторинг.
- Alert rules пока покрывают файловый security lifecycle, а не все бизнес-события.
- Нет отправки alerts в Telegram, email, Slack или SIEM.
- Нет SLA/escalation timers и назначения конкретного ответственного оператора.
- UI первой версии предназначен для операционного контроля, а не для полноценного SOC.
