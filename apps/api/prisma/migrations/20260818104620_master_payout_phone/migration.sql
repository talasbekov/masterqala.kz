-- Написана вручную, НЕ через `prisma migrate dev`: авто-генерация по этой схеме
-- предлагает дропнуть SecurityAlert/DisputeEvidence и колонки карантина — они
-- существуют только в raw SQL и не отражены в schema.prisma (тот же класс
-- дрифт-детекции, что уже ловился на GIST-индексах Order/MasterPresence.location).

-- Kaspi-номер мастера для выплат (§3.12). Отдельно от User.phone — мастер
-- может выводить не на тот номер, которым логинится.
ALTER TABLE "MasterProfile" ADD COLUMN "payoutPhone" TEXT;

-- Снимок MasterProfile.payoutPhone на момент заявки на вывод — не ссылка на
-- текущее значение, чтобы история выплат не переписывалась задним числом,
-- если мастер сменит реквизиты после отправки заявки.
ALTER TABLE "WithdrawalRequest" ADD COLUMN "payoutPhone" TEXT;
