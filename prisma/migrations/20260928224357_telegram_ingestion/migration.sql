-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('ADMIN', 'TELEGRAM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketingAssetKind" ADD VALUE 'OFFER';
ALTER TYPE "MarketingAssetKind" ADD VALUE 'SELLING_POINT';
ALTER TYPE "MarketingAssetKind" ADD VALUE 'OBJECTION_ANSWER';

-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "ingestedFrom" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "source" "ProductSource" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "supplierRef" TEXT;

-- CreateTable
CREATE TABLE "TelegramAuthorizedUser" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "authorizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramAuthorizedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramSession" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'IDLE',
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "kind" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAuthorizedUser_telegramUserId_key" ON "TelegramAuthorizedUser"("telegramUserId");

-- CreateIndex
CREATE INDEX "TelegramAuthorizedUser_status_idx" ON "TelegramAuthorizedUser"("status");

-- CreateIndex
CREATE INDEX "TelegramSession_telegramUserId_status_idx" ON "TelegramSession"("telegramUserId", "status");

-- CreateIndex
CREATE INDEX "TelegramSession_expiresAt_idx" ON "TelegramSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramUpdate_updateId_key" ON "TelegramUpdate"("updateId");

-- CreateIndex
CREATE INDEX "TelegramUpdate_telegramUserId_idx" ON "TelegramUpdate"("telegramUserId");

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
