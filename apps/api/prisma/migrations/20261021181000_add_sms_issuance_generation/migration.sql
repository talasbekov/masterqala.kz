-- Historical lock order is unknowable; preserve recorded chronology and resolve ties deterministically.
BEGIN;
LOCK TABLE "SmsCode" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "SmsCode" ADD COLUMN "generation" BIGINT;
WITH ranked AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS generation
  FROM "SmsCode"
)
UPDATE "SmsCode" AS target SET "generation" = ranked.generation
FROM ranked WHERE target."id" = ranked."id";
CREATE SEQUENCE "SmsCode_generation_seq" AS BIGINT;
ALTER SEQUENCE "SmsCode_generation_seq" OWNED BY "SmsCode"."generation";
SELECT setval('"SmsCode_generation_seq"'::regclass, COALESCE(MAX("generation"), 0) + 1, false)
FROM "SmsCode";
ALTER TABLE "SmsCode"
  ALTER COLUMN "generation" SET DEFAULT nextval('"SmsCode_generation_seq"'::regclass),
  ALTER COLUMN "generation" SET NOT NULL;
CREATE UNIQUE INDEX "SmsCode_generation_key" ON "SmsCode"("generation");
CREATE INDEX "SmsCode_phone_generation_idx" ON "SmsCode"("phone", "generation");
COMMIT;
