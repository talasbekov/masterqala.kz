# Security audit и retention policy

## Назначение

Этот слой фиксирует критические операции с файлами и ограничивает срок хранения временных и опасных данных.

Покрываются:

- временные `PendingUpload`;
- документы мастеров;
- доказательства споров;
- scan lifecycle ClamAV;
- удаление заражённых и окончательно не проверенных бинарников;
- очистка временной metadata после привязки фотографии;
- срок хранения security audit.

## Неизменяемый audit trail

Таблица `SecurityAuditEvent` содержит:

```text
id
action
severity
outcome
resourceType
resourceId
actorUserId
metadata
createdAt
```

Audit создаётся PostgreSQL-триггерами в той же транзакции, в которой меняется файл или его scan-статус. Это исключает ситуацию, когда приложение обновило статус, но не записало событие.

Строки журнала запрещено обновлять DB trigger `SecurityAuditEvent_immutable`. Retention удаляет истёкшие строки через `DELETE`; после очистки создаётся агрегированное событие `SECURITY_AUDIT_RETENTION_PURGE`.

## События файлов

Основные действия:

```text
FILE_REGISTERED
FILE_SCAN_STARTED
FILE_SCAN_CLEAN
FILE_SCAN_INFECTED
FILE_SCAN_FAILED
FILE_CONSUMED
FILE_BINARY_PURGED
FILE_METADATA_PURGED
PDF_CDR_BYPASSED
PDF_CDR_SANITIZED
PDF_CDR_CDR_FAILED
SECURITY_AUDIT_RETENTION_PURGE
```

Уровни:

- `INFO` — штатные операции;
- `WARNING` — scanner failure;
- `HIGH` — CDR failure;
- `CRITICAL` — обнаружен malware.

Audit не хранит исходное имя файла или полный filesystem path. Ресурс идентифицируется внутренним UUID/ID.

## Операторский API

```http
GET /api/v1/admin/security/events
```

Доступ: только роль `OPERATOR`.

Фильтры:

```text
action
severity
resourceType
resourceId
before
beforeId
limit
```

`limit` допускает 1–100. Pagination использует пару `createdAt + id`, чтобы события с одинаковым timestamp не терялись.

## Retention job

pg-boss job:

```text
security-retention
```

Расписание:

```text
43 3 * * *
```

Worker выполняет:

1. удаление terminal `PendingUpload` после retention;
2. удаление временной metadata использованных upload без удаления фотографии заявки;
3. удаление binary для terminal `MasterDocument` и `DisputeEvidence`;
4. установку `purgedAt` после успешного удаления binary;
5. очистку подробного `scanError` после retention;
6. удаление истёкшего security audit;
7. запись агрегированного события о purge журнала.

## Настройки

```env
SECURITY_AUDIT_RETENTION_DAYS="365"
FILE_QUARANTINE_RETENTION_DAYS="30"
CONSUMED_UPLOAD_METADATA_RETENTION_DAYS="30"
```

Ограничения:

| Переменная | Минимум | Максимум | Default |
|---|---:|---:|---:|
| `SECURITY_AUDIT_RETENTION_DAYS` | 30 | 3650 | 365 |
| `FILE_QUARANTINE_RETENTION_DAYS` | 1 | 365 | 30 |
| `CONSUMED_UPLOAD_METADATA_RETENTION_DAYS` | 1 | 365 | 30 |

## Правила удаления

### PendingUpload

- `CLEAN`, `PENDING_SCAN` и зависший `SCANNING` после TTL удаляются обычным hourly cleanup;
- `INFECTED` и окончательный `SCAN_FAILED` не удаляются обычным TTL cleanup;
- terminal metadata сохраняется на `FILE_QUARANTINE_RETENTION_DAYS`;
- заражённый binary удаляется сразу после scan и получает `purgedAt`;
- после consume удаляется только временная строка `PendingUpload`;
- файл остаётся доступен через `OrderPhoto` или `PlannedOrderPhoto`.

### MasterDocument и DisputeEvidence

- записи не удаляются автоматически;
- заражённый binary удаляется сразу;
- binary окончательного `SCAN_FAILED` удаляется после retention;
- `purgedAt` устанавливается только после успешного удаления из storage;
- подробный `scanError` очищается после retention;
- минимальные status и timestamps остаются для расследования и пользовательского статуса.

## Fail-safe поведение

Если storage временно недоступен:

- DB-запись не получает `purgedAt`;
- worker логирует ошибку;
- следующая retention job повторяет удаление;
- файл не становится доступным, поскольку его статус не `CLEAN`.

## Staging smoke

Проверить:

1. чистый upload создаёт `FILE_REGISTERED`, `FILE_SCAN_STARTED`, `FILE_SCAN_CLEAN`;
2. EICAR создаёт `FILE_SCAN_INFECTED` и `FILE_BINARY_PURGED`;
3. scanner outage создаёт `FILE_SCAN_FAILED`;
4. клиент получает `403` на `/admin/security/events`;
5. оператор фильтрует события по resource ID;
6. `UPDATE SecurityAuditEvent` отклоняется PostgreSQL;
7. consumed upload metadata удаляется без удаления фотографии заказа;
8. terminal binary удаляется, а запись получает `purgedAt`;
9. старый audit удаляется и создаётся summary event;
10. job повторяет purge после временной ошибки storage.

## Ограничения

- audit относится только к security lifecycle файлов, а не ко всем бизнес-действиям;
- прямой DBA с правом отключения trigger может обойти immutability;
- local disk остаётся single-node storage;
- retention job ограничена batch-размером и может потребовать нескольких запусков при большом backlog;
- для compliance-сценариев журнал следует экспортировать в append-only внешнее хранилище или SIEM;
- реальные сроки хранения должны быть согласованы с юридическими требованиями Казахстана и политикой обработки персональных данных.
