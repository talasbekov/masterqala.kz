-- Additive classification only. No historical commercial mode, amounts, status,
-- bids, credit transactions or timestamps are rewritten.
CREATE TYPE "PlannedLifecycleModel" AS ENUM ('LEGACY', 'PLATFORM_V1_RESERVED');
ALTER TABLE "PlannedOrder"
  ADD COLUMN "lifecycleModel" "PlannedLifecycleModel" NOT NULL DEFAULT 'LEGACY';
