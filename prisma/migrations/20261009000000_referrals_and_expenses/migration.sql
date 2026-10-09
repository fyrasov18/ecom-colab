-- Reconcile schema drift for PartnerStatus enum
ALTER TYPE "PartnerStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "PartnerStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- CreateEnum: Reconcile drift for EcommerceExperience
DO $$ BEGIN
    CREATE TYPE "EcommerceExperience" AS ENUM ('DEBUTANT', 'INTERMEDIAIRE', 'EXPERT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Reconcile drift for Partner
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "experienceLevel" "EcommerceExperience";
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "invitedByUserId" TEXT;

-- AddForeignKey: Reconcile drift for Partner.invitedByUserId
DO $$ BEGIN
    ALTER TABLE "Partner" ADD CONSTRAINT "Partner_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: Milestone 1 Referral and Expense enums
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ReferralType" AS ENUM ('PARTNER', 'SALES');
CREATE TYPE "ReferralAttributionStatus" AS ENUM ('PENDING_QUALIFICATION', 'QUALIFIED', 'REJECTED');
CREATE TYPE "ReferralCommissionStatus" AS ENUM ('PENDING_VERIFICATION', 'ELIGIBLE', 'APPROVED_FOR_PAYMENT', 'PAID', 'REVERSED', 'REJECTED');

-- CreateTable: Expense
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "period" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReferralLink
CREATE TABLE "ReferralLink" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReferralAttribution
CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "referrerPartnerId" TEXT NOT NULL,
    "referredPartnerId" TEXT NOT NULL,
    "type" "ReferralType" NOT NULL DEFAULT 'PARTNER',
    "status" "ReferralAttributionStatus" NOT NULL DEFAULT 'PENDING_QUALIFICATION',
    "qualifyingOrderId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReferralCommission
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "referrerPartnerId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "status" "ReferralCommissionStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "idempotencyKey" TEXT NOT NULL,
    "calculationDetails" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_status_period_idx" ON "Expense"("status", "period");
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");
CREATE INDEX "ReferralLink_partnerId_idx" ON "ReferralLink"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_referredPartnerId_key" ON "ReferralAttribution"("referredPartnerId");
CREATE INDEX "ReferralAttribution_referrerPartnerId_status_idx" ON "ReferralAttribution"("referrerPartnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_idempotencyKey_key" ON "ReferralCommission"("idempotencyKey");
CREATE INDEX "ReferralCommission_referrerPartnerId_status_idx" ON "ReferralCommission"("referrerPartnerId", "status");
CREATE INDEX "ReferralCommission_attributionId_idx" ON "ReferralCommission"("attributionId");
CREATE INDEX "ReferralCommission_orderId_idx" ON "ReferralCommission"("orderId");

-- AddForeignKey
ALTER TABLE "ReferralLink" ADD CONSTRAINT "ReferralLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerPartnerId_fkey" FOREIGN KEY ("referrerPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredPartnerId_fkey" FOREIGN KEY ("referredPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "ReferralAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerPartnerId_fkey" FOREIGN KEY ("referrerPartnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
