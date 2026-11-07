SET LOCAL lock_timeout = '5s';

-- AlterEnum
ALTER TYPE "CommissionSource" ADD VALUE 'PERFORMANCE_LEVEL';

-- AlterTable
ALTER TABLE "Partner" ALTER COLUMN "defaultCommissionValue" DROP NOT NULL;
ALTER TABLE "Partner" ALTER COLUMN "defaultCommissionValue" DROP DEFAULT;
ALTER TABLE "Partner" ALTER COLUMN "defaultCommissionType" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "initialSnapshot" JSONB;
ALTER TABLE "Order" ADD COLUMN "finalSnapshot" JSONB;

