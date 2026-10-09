import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("referral schema & migration constraint verification", () => {
  const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
  const migrationPath = path.resolve(
    process.cwd(),
    "prisma/migrations/20261009000000_referrals_and_expenses/migration.sql",
  );

  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const migrationContent = fs.readFileSync(migrationPath, "utf-8");

  describe("1. ReferralLink constraints", () => {
    it("enforces unique code constraint in schema.prisma", () => {
      // Model ReferralLink must define `code String @unique`
      expect(schemaContent).toMatch(/model\s+ReferralLink\s*\{[\s\S]*?code\s+String\s+@unique[\s\S]*?\}/);
    });

    it("creates unique index on ReferralLink(code) in migration SQL", () => {
      expect(migrationContent).toContain('CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");');
    });

    it("indexes partnerId on ReferralLink for fast lookups", () => {
      expect(schemaContent).toMatch(/model\s+ReferralLink\s*\{[\s\S]*?@@index\(\[partnerId\]\)[\s\S]*?\}/);
      expect(migrationContent).toContain('CREATE INDEX "ReferralLink_partnerId_idx" ON "ReferralLink"("partnerId");');
    });
  });

  describe("2. ReferralAttribution constraints", () => {
    it("enforces unique referredPartnerId constraint in schema.prisma (anti-duplicate attribution)", () => {
      // Model ReferralAttribution must define `referredPartnerId String @unique`
      expect(schemaContent).toMatch(/model\s+ReferralAttribution\s*\{[\s\S]*?referredPartnerId\s+String\s+@unique[\s\S]*?\}/);
    });

    it("creates unique index on ReferralAttribution(referredPartnerId) in migration SQL", () => {
      expect(migrationContent).toContain(
        'CREATE UNIQUE INDEX "ReferralAttribution_referredPartnerId_key" ON "ReferralAttribution"("referredPartnerId");',
      );
    });

    it("indexes referrerPartnerId and status for downline queries", () => {
      expect(schemaContent).toMatch(
        /model\s+ReferralAttribution\s*\{[\s\S]*?@@index\(\[referrerPartnerId,\s*status\]\)[\s\S]*?\}/,
      );
      expect(migrationContent).toContain(
        'CREATE INDEX "ReferralAttribution_referrerPartnerId_status_idx" ON "ReferralAttribution"("referrerPartnerId", "status");',
      );
    });
  });

  describe("3. ReferralCommission idempotency constraints", () => {
    it("enforces unique idempotencyKey in schema.prisma", () => {
      // Model ReferralCommission must define `idempotencyKey String @unique`
      expect(schemaContent).toMatch(
        /model\s+ReferralCommission\s*\{[\s\S]*?idempotencyKey\s+String\s+@unique[\s\S]*?\}/,
      );
    });

    it("creates unique index on ReferralCommission(idempotencyKey) in migration SQL", () => {
      expect(migrationContent).toContain(
        'CREATE UNIQUE INDEX "ReferralCommission_idempotencyKey_key" ON "ReferralCommission"("idempotencyKey");',
      );
    });

    it("indexes referrerPartnerId and status for commission dashboard queries", () => {
      expect(schemaContent).toMatch(
        /model\s+ReferralCommission\s*\{[\s\S]*?@@index\(\[referrerPartnerId,\s*status\]\)[\s\S]*?\}/,
      );
      expect(migrationContent).toContain(
        'CREATE INDEX "ReferralCommission_referrerPartnerId_status_idx" ON "ReferralCommission"("referrerPartnerId", "status");',
      );
    });
  });
});
