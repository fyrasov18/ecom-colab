-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "partnerSharePercentage" DECIMAL(5,2),
ADD COLUMN     "performanceLevelName" TEXT;

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "performanceLevelId" TEXT;

-- CreateTable
CREATE TABLE "PerformanceLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sharePercentage" DECIMAL(5,2) NOT NULL,
    "criteria" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceLevel_name_key" ON "PerformanceLevel"("name");

-- CreateIndex
CREATE INDEX "PerformanceLevel_isActive_sortOrder_idx" ON "PerformanceLevel"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_performanceLevelId_fkey" FOREIGN KEY ("performanceLevelId") REFERENCES "PerformanceLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
