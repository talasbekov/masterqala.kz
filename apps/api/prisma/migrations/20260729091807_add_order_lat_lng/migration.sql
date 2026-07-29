/*
  Warnings:
  Note: this migration intentionally does NOT drop "MasterPresence_location_idx" /
  "Order_location_idx" even though Prisma's diff engine proposed dropping them.
  Those GIST indexes were created via raw SQL in migration
  20260715072332_stage2_urgent_orders because Prisma cannot express indexes on
  Unsupported("geography(...)") columns in schema.prisma. Since they're invisible
  to the schema, every future `prisma migrate dev` will keep proposing to drop them;
  they are load-bearing for the ST_DWithin/ST_Distance queries in
  src/orders/matching.service.ts, so we preserve them here.
*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;
