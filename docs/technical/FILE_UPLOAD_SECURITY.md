# Безопасность загрузки файлов

## Назначение

Документ фиксирует security baseline файлов бесплатного пилота MasterQala.kz.

Он покрывает:

- фотографии срочных и плановых заявок;
- документы заявки мастера;
- доказательства в споре;
- локальное закрытое storage;
- ownership, TTL и одноразовую привязку фотографий;
- quarantine lifecycle и malware scanning фотографий заявок.

## Разрешённые форматы

| Контекст | Форматы | Максимальный размер |
|---|---|---:|
| Фото заявки | JPEG, PNG | 10 МБ |
| Доказательство спора | JPEG, PNG | 10 МБ |
| Документ мастера | JPEG, PNG, PDF | 10 МБ |

Тип определяется не только по `Content-Type` клиента. API сверяет:

1. фактическую сигнатуру первых байтов;
2. заявленный MIME;
3. последнее расширение исходного имени;
4. allowlist endpoint.

Проверяемые сигнатуры:

- JPEG: `FF D8 FF`;
- PNG: `89 50 4E 47 0D 0A 1A 0A`;
- PDF: `%PDF-`.

Несоответствие возвращает `400 Bad Request`.

## Имена и пути

Исходное имя пользователя не используется как имя файла на диске. Файл сохраняется как:

```text
<random UUID>.<canonical extension>
```

Исходное имя документа мастера хранится только как очищенные метаданные:

- удаляются `/` и `\`;
- удаляются управляющие и bidi-символы;
- опасные символы заменяются;
- длина ограничивается 180 символами;
- пустое имя заменяется на `file.<ext>`.

## Закрытое storage

`LocalDiskStorage`:

- создаёт каталог с режимом `0700`;
- создаёт файлы с режимом `0600`;
- использует `writeFile(..., { flag: "wx" })`;
- не перезаписывает существующий файл;
- принимает только короткое alphanumeric-расширение;
- блокирует пустой путь и path traversal;
- умеет безопасно проверять наличие и удалять файл.

`UPLOAD_DIR` должен находиться вне frontend static root и не должен напрямую публиковаться Nginx.

Файлы выдаются только через авторизованный API после проверки участника заявки или роли оператора.

## PendingUpload

Каждая фотография из `POST /api/v1/uploads` получает запись `PendingUpload`.

Базовые поля:

```text
id
userId
path
mimeType
sizeBytes
expiresAt
consumedAt
createdAt
```

Quarantine-поля, добавленные миграцией:

```text
scanStatus
scanAttempts
scannedAt
scanError
```

`userId` берётся только из проверенного JWT. `path` уникален.

## TTL

- default TTL — 24 часа;
- `UPLOAD_TTL_HOURS` допускает 1–168;
- после `expiresAt` путь нельзя привязать;
- истёкшие непривязанные файлы удаляет cleanup;
- API не раскрывает, является путь чужим, истёкшим, заражённым или использованным.

## Quarantine state machine

Допустимые состояния:

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
SCANNING     -> SCAN_FAILED   # истёк scan lease
```

Только `CLEAN` может быть привязан к заявке.

`INFECTED` не повторяется автоматически. Файл удаляется из storage, а запись остаётся для расследования до TTL cleanup.

`SCAN_FAILED` является fail-closed: файл не доступен заявке и может быть повторно поставлен в scan queue до достижения лимита попыток.

## Scanner modes

```env
FILE_SCAN_MODE="DISABLED" # development/test only
FILE_SCAN_MODE="CLAMAV"   # production
```

В `production` API не запускается с `DISABLED` или без корректного режима.

Параметры ClamAV:

```env
CLAMAV_HOST="clamav"
CLAMAV_PORT="3310"
CLAMAV_TIMEOUT_MS="15000"
UPLOAD_SCAN_MAX_ATTEMPTS="3"
```

Допустимые пределы:

- порт: 1–65535;
- timeout: 1–120 секунд;
- попытки: 1–10.

## ClamAV protocol

`ClamAvScanner` использует TCP `INSTREAM`:

1. открывает соединение с `clamd`;
2. отправляет `zINSTREAM\0`;
3. передаёт файл чанками с 4-byte big-endian length;
4. завершает поток нулевой длиной;
5. принимает `OK` или `<signature> FOUND`;
6. неизвестный ответ, timeout и network error считаются `SCAN_FAILED`.

Сканер получает только абсолютный путь, сформированный доверенным storage adapter.

## Worker и retry sweep

`PendingUploadsService` регистрирует pg-boss worker:

```text
pending-upload-scan
```

Атомарный claim выполняется условным `UPDATE`:

- запись не использована;
- TTL не истёк;
- статус `PENDING_SCAN` или `SCAN_FAILED`;
- число попыток меньше лимита.

Claim переводит запись в `SCANNING` и увеличивает `scanAttempts`. Дублирующиеся jobs не сканируют один файл одновременно.

Каждые пять минут выполняется sweep:

```text
*/5 * * * *
```

Sweep:

1. переводит `SCANNING` старше пяти минут в `SCAN_FAILED`;
2. выбирает pending/failed записи до лимита попыток;
3. повторно ставит их в очередь.

## Development/test режим

При `FILE_SCAN_MODE=DISABLED` используется scanner, возвращающий `CLEAN` синхронно.

Этот режим нужен для локальной разработки и hermetic CI. В production он запрещён environment validation.

## API-контракт

`POST /api/v1/uploads` возвращает:

```json
{
  "path": "UUID.png",
  "mimeType": "image/png",
  "sizeBytes": 12345,
  "expiresAt": "2026-07-25T06:00:00.000Z",
  "scanStatus": "PENDING_SCAN",
  "scannedAt": null
}
```

Статус владельца:

```http
GET /api/v1/uploads/:path/status
```

Чужой пользователь получает `404`, чтобы endpoint не был oracle для чужих UUID.

Frontend `apiUpload` автоматически опрашивает status endpoint до:

- `CLEAN` — upload возвращается странице;
- `INFECTED` — показывается отклонение безопасности;
- `SCAN_FAILED` — предлагается повторная загрузка;
- 30 секунд — показывается timeout проверки.

## Привязка к заявке

`photoPaths` ограничен:

- максимум пятью значениями;
- уникальными значениями;
- форматом `UUID.jpg` или `UUID.png`;
- upload-записью текущего пользователя;
- `scanStatus = CLEAN`;
- неистёкшим TTL;
- `consumedAt = null`;
- существующим файлом в storage.

API guard выполняет предварительную проверку и возвращает понятный `400`.

## Атомарное одноразовое consume

Окончательное правило обеспечивает PostgreSQL trigger для `OrderPhoto` и `PlannedOrderPhoto`.

Trigger одним условным `UPDATE` выставляет `consumedAt`. Условие включает:

- владельца заявки;
- `scanStatus = CLEAN`;
- `consumedAt IS NULL`;
- действующий TTL.

Consume выполняется в транзакции создания заявки. Rollback автоматически откатывает `consumedAt`. Два параллельных запроса не могут использовать один path.

## Cleanup

Каждый час на 17-й минуте:

```text
17 * * * *
```

Cleanup:

1. выбирает до 100 истёкших записей с `consumedAt = null`;
2. удаляет файл, если он существует;
3. условно удаляет запись;
4. логирует ошибку и продолжает.

При отключённом pg-boss scan, retry и cleanup не выполняются. В production `PGBOSS_DISABLED` использовать нельзя.

## Откат и orphan files

Если создание `PendingUpload` не удалось, уже записанный файл удаляется.

Если запись создана, но scanner или queue временно недоступны, файл сохраняется fail-closed для retry.

Файловая система и PostgreSQL не образуют одну физическую транзакцию. Аварийное завершение между disk write и DB insert всё ещё может оставить orphan, который не имеет записи БД.

## Content-Type при скачивании

HTTP `Content-Type` определяется по каноническому сохранённому расширению:

- `.jpg` → `image/jpeg`;
- `.png` → `image/png`;
- `.pdf` → `application/pdf`.

Неизвестное расширение не выдаётся. PDF документов мастера скачивается как `attachment`.

## Оставшиеся ограничения

ClamAV снижает риск известного malware, но не гарантирует обнаружение:

- неизвестных zero-day образцов;
- сложных polyglot-файлов;
- parser exploits;
- image decompression bombs;
- вредоносной логики в PDF, не распознанной сигнатурами;
- embedded files и JavaScript в PDF.

Для документов мастеров и доказательств споров ещё требуется распространить единый quarantine lifecycle. Для PDF высокого риска следует рассмотреть CDR и удаление active content.

Local disk остаётся single-node решением. Для нескольких API replicas нужен private S3-compatible bucket или общее защищённое storage.

## Staging smoke

Проверить:

1. API production не запускается с `FILE_SCAN_MODE=DISABLED`;
2. EICAR получает `INFECTED`, файл удаляется;
3. чистый PNG получает `CLEAN`;
4. при остановленном clamd статус становится `SCAN_FAILED`;
5. до `CLEAN` заявка возвращает `400`;
6. после `CLEAN` заявка создаётся и выставляет `consumedAt`;
7. прямой INSERT фотографии с не-CLEAN path отклоняется trigger;
8. чужой status endpoint возвращает `404`;
9. stale `SCANNING` возвращается в retry через пять минут;
10. истёкший непривязанный файл удаляется cleanup.
