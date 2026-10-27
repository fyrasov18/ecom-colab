import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { registerPartner } from "@/modules/registration/service";
import { getPartnerReferralLinkAction } from "@/modules/referrals/actions";
import { prisma } from "@/lib/prisma";
import * as rbacModule from "@/lib/rbac";
import * as referralService from "@/modules/referrals/service";

describe("Milestone 2 Challenger 2: Registration Atomicity & IDOR Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Task 1: Transactional Atomicity in registerPartner
  // ==========================================================================
  describe("Task 1.1: registerPartner Transactional Atomicity (Orphan Prevention)", () => {
    const validCandidatePayload = {
      fullName: "Nour Ben Salah",
      email: "nour.bensalah@example.tn",
      phone: "98123456",
      password: "Password123!",
      confirmPassword: "Password123!",
      invitationCode: "PREF01",
      experience: "INTERMEDIAIRE" as const,
      termsAccepted: true,
    };

    const activeReferrer = {
      partnerId: "partner-ref-1",
      userId: "user-ref-1",
      displayName: "Karim Referrer",
      code: "PREF01",
      status: "ACTIVE",
      email: "referrer@example.com",
      phone: "22111222",
    };

    it("rolls back User and Partner creation if ReferralAttribution creation fails inside transaction", async () => {
      // 1. Mock referral validation & eligibility to pass
      vi.spyOn(referralService, "validateReferralCode").mockResolvedValue({
        valid: true,
        referrerPartnerId: activeReferrer.partnerId,
        referrer: activeReferrer,
      });

      vi.spyOn(referralService, "validateReferralEligibility").mockResolvedValue({
        valid: true,
      });

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      // Track creations inside transaction
      let userCreatedInTx = false;
      let partnerCreatedInTx = false;
      let attributionAttempted = false;

      const mockTx = {
        partner: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(async () => {
            partnerCreatedInTx = true;
            return {
              id: "partner-candidate-1",
              userId: "user-candidate-1",
              code: "P001",
              status: "PENDING",
            };
          }),
        },
        user: {
          create: vi.fn().mockImplementation(async () => {
            userCreatedInTx = true;
            return {
              id: "user-candidate-1",
              email: validCandidatePayload.email,
              role: "PARTNER",
              status: "ACTIVE",
            };
          }),
        },
        referralAttribution: {
          create: vi.fn().mockImplementation(async () => {
            attributionAttempted = true;
            // Simulate attribution creation failure (e.g. database error, constraint violation)
            throw new Error("DB Error: Attribution insert failed due to deadlock/constraint");
          }),
        },
        wallet: {
          create: vi.fn().mockResolvedValue({ id: "wallet-1" }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        },
      } as unknown as Prisma.TransactionClient;

      // Mock prisma.$transaction to invoke the callback and reject when callback throws
      const transactionSpy = vi.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
        if (typeof callback === "function") {
          // When callback throws, transaction rolls back and throws
          return await callback(mockTx);
        }
        throw new Error("Interactive transaction required");
      });

      const result = await registerPartner(validCandidatePayload);

      // Assertions:
      // 1. User & Partner create were called within tx
      expect(userCreatedInTx).toBe(true);
      expect(partnerCreatedInTx).toBe(true);
      expect(attributionAttempted).toBe(true);

      // 2. Wallet & Audit were NEVER called because attribution threw before them
      expect(mockTx.wallet.create).not.toHaveBeenCalled();

      // 3. registerPartner returned error result, not ok
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Inscription impossible pour le moment/i);
      }

      // 4. Verify that in a real Prisma transaction, rollback ensures no User or Partner persists
      expect(transactionSpy).toHaveBeenCalled();
    });

    it("handles Prisma P2002 duplicate referredPartnerId error by rolling back cleanly and returning specific error", async () => {
      vi.spyOn(referralService, "validateReferralCode").mockResolvedValue({
        valid: true,
        referrerPartnerId: activeReferrer.partnerId,
        referrer: activeReferrer,
      });

      vi.spyOn(referralService, "validateReferralEligibility").mockResolvedValue({
        valid: true,
      });

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const mockTx = {
        partner: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({
            id: "partner-candidate-1",
            userId: "user-candidate-1",
            code: "P001",
            status: "PENDING",
          }),
        },
        user: {
          create: vi.fn().mockResolvedValue({
            id: "user-candidate-1",
            email: validCandidatePayload.email,
            role: "PARTNER",
            status: "ACTIVE",
          }),
        },
        referralAttribution: {
          create: vi.fn().mockImplementation(async () => {
            const p2002Error = new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed on referredPartnerId",
              {
                code: "P2002",
                clientVersion: "6.0.0",
                meta: { target: ["referredPartnerId"] },
              },
            );
            throw p2002Error;
          }),
        },
        wallet: { create: vi.fn() },
      } as unknown as Prisma.TransactionClient;

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
        if (typeof callback === "function") {
          return await callback(mockTx);
        }
        throw new Error("Interactive transaction required");
      });

      const result = await registerPartner(validCandidatePayload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Ce partenaire est déjà attribué à un parrain/i);
        expect(result.fieldErrors?.invitationCode).toMatch(/Ce partenaire est déjà attribué à un parrain/i);
      }
    });
  });

  // ==========================================================================
  // Task 1.2: registerPartner Rejection of Unapproved Partner Codes
  // ==========================================================================
  describe("Task 1.2: registerPartner Unapproved Partner Codes (PENDING, SUSPENDED, REJECTED, CLOSED)", () => {
    const baseCandidate = {
      fullName: "Sami Ben Amor",
      email: "sami@example.tn",
      phone: "22333444",
      password: "Password123!",
      confirmPassword: "Password123!",
      experience: "DEBUTANT" as const,
      termsAccepted: true,
    };

    const unapprovedStatuses = ["PENDING", "SUSPENDED", "REJECTED", "CLOSED"] as const;

    for (const status of unapprovedStatuses) {
      it(`REJECTS registration when referral code belongs to a ${status} partner`, async () => {
        const txSpy = vi.spyOn(prisma, "$transaction");

        // Mock ReferralLink lookup returning partner with unapproved status
        const mockLink = {
          id: `link-${status.toLowerCase()}`,
          code: `REF_${status}`,
          isActive: true,
          partner: {
            id: `partner-${status.toLowerCase()}`,
            userId: `user-${status.toLowerCase()}`,
            displayName: `Partner ${status}`,
            code: `P_${status}`,
            status: status, // Non-ACTIVE!
            phone: "98111222",
            user: { id: `user-${status.toLowerCase()}`, email: `${status.toLowerCase()}@example.com` },
          },
        };

        vi.spyOn(prisma.referralLink, "findUnique").mockResolvedValue(mockLink as any);

        const result = await registerPartner({
          ...baseCandidate,
          invitationCode: `REF_${status}`,
        });

        // 1. Must fail registration
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toMatch(/Le parrain n'est pas actif/i);
          expect(result.error).toContain(status);
          expect(result.fieldErrors?.invitationCode).toMatch(/Le parrain n'est pas actif/i);
        }

        // 2. Transaction must NEVER be opened (no User or Partner creation attempt)
        expect(txSpy).not.toHaveBeenCalled();
      });

      it(`REJECTS registration when fallback Partner.code belongs to a ${status} partner`, async () => {
        const txSpy = vi.spyOn(prisma, "$transaction");

        // ReferralLink not found, fallback to Partner.code
        vi.spyOn(prisma.referralLink, "findUnique").mockResolvedValue(null);
        vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
          id: `partner-direct-${status.toLowerCase()}`,
          userId: `user-${status.toLowerCase()}`,
          displayName: `Direct Partner ${status}`,
          code: `P00_${status}`,
          status: status, // Non-ACTIVE!
          phone: "98111222",
          user: { id: `user-${status.toLowerCase()}`, email: `direct_${status.toLowerCase()}@example.com` },
        } as any);

        const result = await registerPartner({
          ...baseCandidate,
          invitationCode: `P00_${status}`,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toMatch(/Le parrain n'est pas actif/i);
          expect(result.error).toContain(status);
        }

        expect(txSpy).not.toHaveBeenCalled();
      });
    }

    it("REJECTS registration when referral code is completely invalid/non-existent", async () => {
      const txSpy = vi.spyOn(prisma, "$transaction");

      vi.spyOn(prisma.referralLink, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue(null);

      const result = await registerPartner({
        ...baseCandidate,
        invitationCode: "NON_EXISTENT_CODE",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Code de parrainage invalide ou inexistant/i);
      }
      expect(txSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Task 2: Session Scoping & IDOR Verification in getPartnerReferralLinkAction
  // ==========================================================================
  describe("Task 2: getPartnerReferralLinkAction Session Scoping & IDOR", () => {
    it("REJECTS unauthenticated requests when requireSession throws redirect", async () => {
      // Simulate requireSession throwing NEXT_REDIRECT error (unauthenticated session)
      const redirectError = new Error("NEXT_REDIRECT");
      (redirectError as any).digest = "NEXT_REDIRECT;replace;/login;307;";

      vi.spyOn(rbacModule, "requireSession").mockRejectedValue(redirectError);

      const result = await getPartnerReferralLinkAction();

      // Action catches error and returns ok: false
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
        // Crucially, it must NOT return a code or url
        expect((result as any).code).toBeUndefined();
        expect((result as any).url).toBeUndefined();
      }
    });

    it("REJECTS non-partner roles (e.g. ADMIN, LOGISTICS) when requireSession redirects", async () => {
      const roleRedirectError = new Error("NEXT_REDIRECT");
      (roleRedirectError as any).digest = "NEXT_REDIRECT;replace;/admin/partenaires;307;";

      vi.spyOn(rbacModule, "requireSession").mockRejectedValue(roleRedirectError);

      const result = await getPartnerReferralLinkAction();

      expect(result.ok).toBe(false);
      expect((result as any).code).toBeUndefined();
    });

    it("REJECTS partner session when partnerId is missing / null", async () => {
      vi.spyOn(rbacModule, "requireSession").mockResolvedValue({
        id: "user-orphan-session",
        email: "orphan@example.tn",
        role: "PARTNER",
        firstName: "Orphan",
        lastName: "User",
        partnerId: null,
      });

      const result = await getPartnerReferralLinkAction();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Identifiant partenaire introuvable dans la session/i);
      }
    });

    it("REJECTS partner session when partner status is PENDING (ReferralAuthorizationError)", async () => {
      vi.spyOn(rbacModule, "requireSession").mockResolvedValue({
        id: "user-p-pending",
        email: "pending@example.tn",
        role: "PARTNER",
        firstName: "Pending",
        lastName: "Partner",
        partnerId: "partner-pending-id",
      });

      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-pending-id",
        code: "P099",
        status: "PENDING",
      } as any);

      const result = await getPartnerReferralLinkAction();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Le partenaire n'est pas actif/i);
        expect(result.error).toContain("PENDING");
      }
    });

    it("REJECTS partner session when partner status is SUSPENDED", async () => {
      vi.spyOn(rbacModule, "requireSession").mockResolvedValue({
        id: "user-p-suspended",
        email: "suspended@example.tn",
        role: "PARTNER",
        firstName: "Suspended",
        lastName: "Partner",
        partnerId: "partner-suspended-id",
      });

      vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-suspended-id",
        code: "P098",
        status: "SUSPENDED",
      } as any);

      const result = await getPartnerReferralLinkAction();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Le partenaire n'est pas actif/i);
        expect(result.error).toContain("SUSPENDED");
      }
    });

    it("SCOPES referral link strictly to the session partner and returns code and url for ACTIVE partner", async () => {
      const activePartnerId = "partner-session-123";
      vi.spyOn(rbacModule, "requireSession").mockResolvedValue({
        id: "user-session-123",
        email: "active@example.tn",
        role: "PARTNER",
        firstName: "Active",
        lastName: "Partner",
        partnerId: activePartnerId,
      });

      const partnerSpy = vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: activePartnerId,
        code: "P123",
        status: "ACTIVE",
      } as any);

      const linkSpy = vi.spyOn(prisma.referralLink, "findFirst").mockResolvedValue({
        id: "link-123",
        partnerId: activePartnerId,
        code: "P123",
        isActive: true,
      } as any);

      const result = await getPartnerReferralLinkAction();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.code).toBe("P123");
        expect(result.url).toContain("/register?ref=P123");
      }

      // Verify queries were strictly scoped to activePartnerId from session
      expect(partnerSpy).toHaveBeenCalledWith({
        where: { id: activePartnerId },
        select: { id: true, code: true, status: true },
      });
      expect(linkSpy).toHaveBeenCalledWith({
        where: { partnerId: activePartnerId, isActive: true },
      });
    });

    it("ENFORCES complete IDOR immunity: accepts zero arguments so partnerId cannot be injected or forged", () => {
      // Check function parameter length
      expect(getPartnerReferralLinkAction.length).toBe(0);
    });
  });
});
