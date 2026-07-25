-- Режим фиксируется на момент создания заявки и не зависит от последующего
-- переключения окружения. Исторические записи относятся к PAID_MOCK, так как
-- до этой миграции код всегда использовал mock-платёжный контур.
CREATE TYPE "CommercialMode" AS ENUM ('FREE_PILOT', 'PAID_MOCK', 'PAID_LIVE');

ALTER TABLE "Order"
ADD COLUMN "commercialMode" "CommercialMode" NOT NULL DEFAULT 'PAID_MOCK';

ALTER TABLE "PlannedOrder"
ADD COLUMN "commercialMode" "CommercialMode" NOT NULL DEFAULT 'PAID_MOCK';

CREATE INDEX "Order_commercialMode_createdAt_idx"
ON "Order"("commercialMode", "createdAt");

CREATE INDEX "PlannedOrder_commercialMode_createdAt_idx"
ON "PlannedOrder"("commercialMode", "createdAt");
