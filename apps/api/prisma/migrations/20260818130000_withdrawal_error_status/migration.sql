-- Написана вручную (тот же приём, что и 20260818104620_master_payout_phone):
-- `prisma migrate dev` на этой схеме предлагает дропнуть SecurityAlert/
-- DisputeEvidence/колонки карантина, живущие вне schema.prisma.

-- AlterEnum
ALTER TYPE "WithdrawalStatus" ADD VALUE 'ERROR';
ALTER TYPE "AuditTargetType" ADD VALUE 'WITHDRAWAL';

-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN "errorMessage" TEXT;
