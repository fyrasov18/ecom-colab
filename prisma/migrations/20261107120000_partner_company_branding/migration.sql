SET LOCAL lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN "companyName" TEXT,
ADD COLUMN "companyLogoUrl" TEXT,
ADD COLUMN "companyLogoDarkUrl" TEXT,
ADD COLUMN "companyMarkUrl" TEXT,
ADD COLUMN "brandColorPrimary" TEXT,
ADD COLUMN "brandColorSecondary" TEXT,
ADD COLUMN "companyDescription" TEXT,
ADD COLUMN "supportEmail" TEXT,
ADD COLUMN "supportPhone" TEXT,
ADD COLUMN "websiteUrl" TEXT;
