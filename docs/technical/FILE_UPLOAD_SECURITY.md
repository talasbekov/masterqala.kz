# Безопасность загрузки файлов

## Назначение

Документ фиксирует текущий security baseline файлов бесплатного пилота MasterQala.kz.

Он покрывает:

- фотографии срочных и плановых заявок;
- документы заявки мастера;
- доказательства в споре;
- magic-byte validation;
- закрытое локальное storage;
- ownership, TTL и одноразовую привязку фотографий;
- fail-closed quarantine lifecycle;
- ClamAV scanning;
- явную PDF/CDR policy.

## Классы файлов

| Контекст | Форматы | Максимальный размер | Модель metadata |
|---|---|---:|---|
| Фото заявки | JPEG, PNG | 10 МБ | `PendingUpload` |
| Доказательство спора | JPEG, PNG | 10 МБ | `DisputeEvidence` |
| Документ мастера | JPEG, PNG, PDF | 10 МБ | `MasterDocument` |

## Проверка типа до сохранения

API не доверяет только `Content-Type`, переданному клиентом. Одновременно проверяются:

1. сигнатура первых байтов;
2. заявленный MIME;
3. последнее расширение исходного имени;
4. allowlist конкретного endpoint;
5. максимальный размер.

Поддерживаемые сигнатуры:

- JPEG: `FF D8 FF`;
- PNG: `89 50 4E 47 0D 0A 1A 0A`;
- PDF: `%PDF-`.

Несоответствие возвращает `400 Bad Request` до создания бизнес-записи.

## Имена и пути

Имя пользователя не используется как имя файла на диске. Storage создаёт канонический путь:

```text
<random UUID>.<canonical extension>
```

Исходное имя документа мастера сохраняется только как очищенные metadata:

- удаляются `/` и `\`;
- удаляются управляющие и bidi-символы;
- опасные символы заменяются;
- длина ограничивается;
- пустое имя заменяется на безопасное имя.

## Закрытое storage

`LocalDiskStorage`:

- создаёт каталог с режимом `0700`;
- создаёт файлы с режимом `0600`;
- использует exclusive create;
- не перезаписывает существующий файл;
- блокирует пустой путь и path traversal;
- принимает только каноническое расширение;
- умеет проверять наличие и удалять файл.

`UPLOAD_DIR` должен находиться вне frontend static root. Nginx не должен публиковать этот каталог напрямую.

Чтение выполняется только через авторизованные API endpoints после проверки владельца, участника заявки или роли оператора.

## Единая quarantine state machine

Для новых файлов применяются состояния:

```text
PENDING_SCAN
SCANNING
CLEAN
INFECTED
SCAN_FAILED
```

Переходы:

```text
PENDING_SCAN -> SCANNING -> CLEAN
PENDING_SCAN -> SCANNING -> INFECTED
PENDING_SCAN -> SCANNING -> SCAN_FAILED
SCAN_FAILED  -> SCANNING
SCANNING     -> SCAN_FAILED  # истёк scan lease
```

Правила:

- только `CLEAN` может использоваться бизнес-функциями;
- `INFECTED` является terminal-статусом, файл удаляется;
- `SCAN_FAILED` остаётся fail-closed и допускает retry;
- число попыток ограничено `UPLOAD_SCAN_MAX_ATTEMPTS`;
- duplicate jobs не сканируют одну запись одновременно;
- `scanError` ограничивается по длине и не возвращается обычному пользователю.

## Scanner configuration

```env
FILE_SCAN_MODE="CLAMAV"
CLAMAV_HOST="clamav"
CLAMAV_PORT="3310"
CLAMAV_TIMEOUT_MS="15000"
UPLOAD_SCAN_MAX_ATTEMPTS="3"
```

Режимы:

- `DISABLED` — только development/test, scanner синхронно возвращает `CLEAN`;
- `CLAMAV` — обязательный production-режим.

Production startup отклоняет отсутствующий режим или `DISABLED`.

Допустимые пределы:

- ClamAV port: 1–65535;
- timeout: 1–120 секунд;
- scan attempts: 1–10.

## ClamAV protocol

`ClamAvScanner` использует TCP `INSTREAM`:

1. открывает соединение с `clamd`;
2. отправляет `zINSTREAM\0`;
3. передаёт файл чанками с 4-byte big-endian length;
4. завершает поток chunk длины zero;
5. принимает `OK` или `<signature> FOUND`;
6. timeout, network error и неизвестный ответ считаются ошибкой scan.

Scanner получает абсолютный путь только от доверенного storage adapter.

## Фотографии заявок: PendingUpload

`POST /api/v1/uploads` создаёт `PendingUpload` с:

```text
id
userId
path
mimeType
sizeBytes
expiresAt
consumedAt
scanStatus
scanAttempts
scannedAt
scanError
createdAt
```

### Ownership и TTL

- `userId` берётся из проверенного JWT;
- `path` уникален;
- default TTL — 24 часа;
- `UPLOAD_TTL_HOURS` допускает 1–168;
- после TTL path нельзя использовать;
- чужой, истёкший, заражённый и использованный path возвращают одинаковую безопасную ошибку.

### Привязка к заявке

`photoPaths` допускает только:

- максимум пять уникальных значений;
- `UUID.jpg` или `UUID.png`;
- запись владельца заявки;
- `scanStatus = CLEAN`;
- действующий TTL;
- `consumedAt IS NULL`;
- существующий файл.

PostgreSQL `BEFORE INSERT` triggers на `OrderPhoto` и `PlannedOrderPhoto` атомарно выставляют `consumedAt` в транзакции создания заявки. Это закрывает повторное использование и race между API precheck и insert.

### Status API

```http
GET /api/v1/uploads/:path/status
```

Endpoint доступен только владельцу. Для чужого UUID возвращается `404`.

## Документы мастера: MasterDocument

Новые `MasterDocument` создаются с:

```text
scanStatus = PENDING_SCAN
scanAttempts = 0
cdrStatus = NOT_REQUIRED | BYPASSED
```

Security metadata:

```text
scanStatus
scanAttempts
scannedAt
scanError
cdrStatus
```

Исторические документы при миграции сохраняют доступность:

- изображения получают `CLEAN` и `NOT_REQUIRED`;
- PDF получают `CLEAN` и `BYPASSED`.

Это осознанная migration policy: старые файлы не пересканируются автоматически.

### Owner status API

```http
GET /api/v1/masters/application/documents/:id/status
```

Endpoint доступен только владельцу `MasterProfile`.

### Operator gates

Оператор не может скачать документ, если:

- `scanStatus != CLEAN`;
- `cdrStatus` не входит в `NOT_REQUIRED`, `SANITIZED`, `BYPASSED`;
- файл отсутствует.

Решение по заявке мастера также блокируется, пока хотя бы один документ не прошёл security gate.

## PDF и CDR policy

```env
PDF_CDR_MODE="BYPASS"
# или
PDF_CDR_MODE="REQUIRED"
```

### BYPASS

- PDF проходит magic-byte validation и ClamAV;
- после `CLEAN` доступен оператору;
- `cdrStatus = BYPASSED` явно фиксирует, что active content не обезвреживался.

### REQUIRED

- PDF отклоняется до записи на диск;
- API возвращает `503 Service Unavailable`;
- изображения JPEG/PNG продолжают работать;
- режим предназначен для production, где PDF нельзя принимать без CDR provider.

CDR provider в текущем PR не реализован. Статус `SANITIZED` зарезервирован для следующего слоя.

## Доказательства спора: DisputeEvidence

Evidence больше не публикуется напрямую в `Dispute.evidenceDocIds`.

Сначала создаётся запись:

```text
id
disputeId
uploadedByUserId
path
mimeType
sizeBytes
scanStatus
scanAttempts
scannedAt
scanError
createdAt
```

Только после атомарного перехода в `CLEAN` worker добавляет path в legacy-массив `Dispute.evidenceDocIds`.

Следствия:

- pending evidence не отображается участникам и оператору;
- infected evidence никогда не попадает в спор;
- старый API чтения остаётся совместимым;
- повторный clean update не дублирует path.

### Participant status API

```http
GET /api/v1/disputes/:id/evidence/:evidenceId/status
```

Endpoint доступен только клиенту или мастеру соответствующей заявки. Посторонний пользователь получает `403`.

Upload response сохраняет прежний объект спора и добавляет:

```text
evidenceId
path
mimeType
sizeBytes
scanStatus
scannedAt
statusPath
```

Поле `id` остаётся ID спора для обратной совместимости.

## Queue workers

### Временные фотографии

```text
pending-upload-scan
pending-upload-scan-sweep
pending-upload-cleanup
```

### Постоянные файлы

```text
master-document-scan
dispute-evidence-scan
persistent-file-scan-sweep
```

Оба sweep выполняются каждые пять минут:

```text
*/5 * * * *
```

Sweep:

1. переводит stale `SCANNING` старше пяти минут в `SCAN_FAILED`;
2. выбирает pending/failed записи до лимита попыток;
3. повторно ставит их в соответствующую очередь.

При `PGBOSS_DISABLED=1` автоматический scan/retry не выполняется. Этот режим допустим только в test/local workflows.

## Frontend polling

Общий `apiUpload` распознаёт response с `scanStatus`.

Для временного upload status endpoint вычисляется по path. Для master documents и evidence API возвращает entity-specific `statusPath`.

Frontend:

- ожидает `CLEAN`;
- завершает upload при `INFECTED`;
- показывает retry-сообщение при `SCAN_FAILED`;
- прекращает polling через 30 секунд;
- не передаёт pending path в следующий бизнес-запрос.

## Ошибки и orphan files

Если business metadata не создались, уже записанный файл удаляется компенсирующим cleanup.

Если metadata созданы, но scanner временно недоступен, файл сохраняется fail-closed для retry.

Filesystem и PostgreSQL не образуют общую физическую транзакцию. Авария процесса между записью файла и insert metadata всё ещё может оставить filesystem orphan без строки БД.

## HTTP Content-Type

Content-Type определяется по каноническому расширению сохранённого path:

- `.jpg` → `image/jpeg`;
- `.png` → `image/png`;
- `.pdf` → `application/pdf`.

Неизвестное расширение не выдаётся. PDF документов мастера скачивается как `attachment`.

## Оставшиеся ограничения

ClamAV не гарантирует обнаружение:

- zero-day malware;
- сложных polyglot-файлов;
- parser exploits;
- image decompression bombs;
- неизвестного active content в PDF;
- embedded files и JavaScript, не распознанных сигнатурами.

Текущий `PDF_CDR_MODE=REQUIRED` только запрещает PDF. Фактическая sanitization/CDR ещё не реализована.

Local disk остаётся single-node storage. Для нескольких API replicas нужен private S3-compatible bucket или общее защищённое storage.

Отдельно требуется retention policy для:

- consumed `PendingUpload` metadata;
- infected/failed `MasterDocument`;
- infected/failed `DisputeEvidence`;
- security audit events.

## Staging smoke

Проверить:

1. production startup требует `FILE_SCAN_MODE=CLAMAV`;
2. production startup требует явный `PDF_CDR_MODE`;
3. чистый PNG фотографии получает `CLEAN`;
4. чистый документ мастера получает `CLEAN` и доступен оператору;
5. clean evidence после scan появляется в `evidenceDocIds`;
6. EICAR для каждого endpoint получает `INFECTED` и удаляется;
7. остановленный clamd приводит к `SCAN_FAILED`;
8. stale `SCANNING` возвращается в retry sweep;
9. pending master document нельзя скачать или одобрить;
10. pending evidence нельзя скачать;
11. `PDF_CDR_MODE=REQUIRED` отклоняет PDF до записи;
12. `PDF_CDR_MODE=BYPASS` фиксирует `cdrStatus=BYPASSED`.
