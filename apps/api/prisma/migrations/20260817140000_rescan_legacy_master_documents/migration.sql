-- Документы мастеров, загруженные ДО карантина, задним числом помечены проверенными.
--
-- Миграция 20260724080000_quarantine_persistent_documents добавила колонку
-- "scanStatus" с DEFAULT 'CLEAN' и лишь затем сменила дефолт на 'PENDING_SCAN'.
-- В результате все ранее существовавшие строки получили статус CLEAN, хотя ClamAV
-- их никогда не видел: до карантина загрузка валидировалась только по клиентскому
-- Content-Type, без проверки magic-byte. Такие файлы проходят гейт в
-- AdminService.getDocumentStream (он требует scanStatus = 'CLEAN') и отдаются
-- оператору как проверенные.
--
-- Легаси-строки отличимы точно: markMasterDocumentClean() всегда проставляет
-- "scannedAt", поэтому CLEAN без "scannedAt" может появиться только из того DEFAULT.
--
-- Возвращаем их в очередь. Свип PERSISTENT_FILE_SCAN_SWEEP ('*/5 * * * *',
-- persistent-file-scans.service.ts) отбирает строки в PENDING_SCAN с
-- "purgedAt" IS NULL и scanAttempts < лимита, поэтому восстановление
-- самостоятельное — ручных действий не требуется.
--
-- Побочный эффект, принятый осознанно: пока свип не отработает, оператор не сможет
-- скачать эти документы (гейт вернёт отказ). Окно — минуты, альтернатива — и дальше
-- отдавать непроверенные файлы под видом проверенных.

UPDATE "MasterDocument"
SET "scanStatus" = 'PENDING_SCAN'
WHERE "scanStatus" = 'CLEAN'
  AND "scannedAt" IS NULL
  AND "purgedAt" IS NULL;
