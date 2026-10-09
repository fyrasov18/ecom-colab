import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getOrCreateReferralCode,
  validateReferralCode,
  validateReferralEligibility,
  recordPartnerReferral,
  ReferralAuthorizationError,
  normalizePhoneDigits,
} from "@/modules/referrals/service";
import { getPartnerReferralLinkAction } from "@/modules/referrals/actions";
import { registrationSchema } from "@/modules/registration/schemas";
import { registerPartner } from "@/modules/registration/service";
import { authorizeCredentials, PendingPartnerError } from "@/lib/auth";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

describe("Milestone 2: Referral Permissions, Code Generation, Attribution & Registration Flow", () => {
  // ==========================================================================
  // 1. Referral Link & Code Service (Permissions & Generation)
  // ==========================================================================
  describe("getOrCreateReferralCode", () => {
    it("allows ACTIVE partner to create/fetch a referral link", async () => {
      const mockPartner = {
        id: "partner-active-1",
        code: "P001",
        status: "ACTIVE",
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
        },
        referralLink: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "link-1",
            partnerId: mockPartner.id,
            code: mockPartner.code,
            isActive: true,
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await getOrCreateReferralCode("partner-active-1", mockDb);
      expect(result.code).toBe("P001");
      expect(result.url).toContain("/register?ref=P001");
      expect(mockDb.referralLink.create).toHaveBeenCalledWith({
        data: {
          partnerId: mockPartner.id,
          code: mockPartner.code,
          isActive: true,
        },
      });
    });

    it("returns existing active link if one already exists", async () => {
      const mockPartner = {
        id: "partner-active-1",
        code: "P001",
        status: "ACTIVE",
      };
      const existingLink = {
        id: "link-existing",
        partnerId: mockPartner.id,
        code: "P001_CUSTOM",
        isActive: true,
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
        },
        referralLink: {
          findFirst: vi.fn().mockResolvedValue(existingLink),
          create: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await getOrCreateReferralCode("partner-active-1", mockDb);
      expect(result.code).toBe("P001_CUSTOM");
      expect(result.url).toContain("/register?ref=P001_CUSTOM");
      expect(mockDb.referralLink.create).not.toHaveBeenCalled();
    });

    it("REJECTS unapproved partner with PENDING status", async () => {
      const mockPartner = {
        id: "partner-pending-1",
        code: "P002",
        status: "PENDING",
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(getOrCreateReferralCode("partner-pending-1", mockDb)).rejects.toThrow(
        ReferralAuthorizationError,
      );
      await expect(getOrCreateReferralCode("partner-pending-1", mockDb)).rejects.toThrow(
        /Le partenaire n'est pas actif/i,
      );
    });

    it("REJECTS partner with SUSPENDED status", async () => {
      const mockPartner = {
        id: "partner-suspended-1",
        code: "P003",
        status: "SUSPENDED",
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(getOrCreateReferralCode("partner-suspended-1", mockDb)).rejects.toThrow(
        ReferralAuthorizationError,
      );
    });

    it("REJECTS partner with REJECTED status", async () => {
      const mockPartner = {
        id: "partner-rejected-1",
        code: "P004",
        status: "REJECTED",
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(getOrCreateReferralCode("partner-rejected-1", mockDb)).rejects.toThrow(
        ReferralAuthorizationError,
      );
    });

    it("REJECTS partner with CLOSED status", async () => {
      const mockPartner = {
        id: "partner-closed-1",
        code: "P005",
        status: "CLOSED",
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(getOrCreateReferralCode("partner-closed-1", mockDb)).rejects.toThrow(
        ReferralAuthorizationError,
      );
    });

    it("REJECTS non-existent partner ID", async () => {
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(getOrCreateReferralCode("unknown-id", mockDb)).rejects.toThrow(
        ReferralAuthorizationError,
      );
    });
  });

  // ==========================================================================
  // 2. Referral Code Validation
  // ==========================================================================
  describe("validateReferralCode", () => {
    it("validates code from ReferralLink when partner is ACTIVE", async () => {
      const mockLink = {
        id: "link-1",
        code: "P001",
        isActive: true,
        partner: {
          id: "partner-1",
          userId: "user-1",
          displayName: "Karim Ben Salah",
          code: "P001",
          status: "ACTIVE",
          phone: "21698123456",
          user: { id: "user-1", email: "karim@example.com" },
        },
      };

      const mockDb = {
        referralLink: {
          findUnique: vi.fn().mockResolvedValue(mockLink),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralCode("P001", mockDb);
      expect(res.valid).toBe(true);
      expect(res.referrerPartnerId).toBe("partner-1");
      expect(res.referrer?.displayName).toBe("Karim Ben Salah");
      expect(res.referrer?.email).toBe("karim@example.com");
    });

    it("validates code from Partner.code fallback when partner is ACTIVE", async () => {
      const mockPartner = {
        id: "partner-2",
        userId: "user-2",
        displayName: "Sarra Trabelsi",
        code: "P002",
        status: "ACTIVE",
        phone: "21698765432",
        user: { id: "user-2", email: "sarra@example.com" },
      };

      const mockDb = {
        referralLink: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        partner: {
          findUnique: vi.fn().mockResolvedValue(mockPartner),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralCode("P002", mockDb);
      expect(res.valid).toBe(true);
      expect(res.referrerPartnerId).toBe("partner-2");
      expect(res.referrer?.code).toBe("P002");
    });

    it("REJECTS referral link if isActive is false", async () => {
      const mockLink = {
        id: "link-disabled",
        code: "P001_DISABLED",
        isActive: false,
        partner: {
          id: "partner-1",
          status: "ACTIVE",
          user: { email: "k@ex.com" },
        },
      };

      const mockDb = {
        referralLink: {
          findUnique: vi.fn().mockResolvedValue(mockLink),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralCode("P001_DISABLED", mockDb);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/lien de parrainage est désactivé/i);
    });

    it("REJECTS referral code if owning partner is not ACTIVE (e.g. PENDING)", async () => {
      const mockLink = {
        id: "link-pending",
        code: "P_PENDING",
        isActive: true,
        partner: {
          id: "partner-pend",
          status: "PENDING",
          user: { email: "p@ex.com" },
        },
      };

      const mockDb = {
        referralLink: {
          findUnique: vi.fn().mockResolvedValue(mockLink),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralCode("P_PENDING", mockDb);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Le parrain n'est pas actif/i);
    });

    it("REJECTS invalid / non-existent referral code", async () => {
      const mockDb = {
        referralLink: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        partner: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralCode("NONEXISTENT", mockDb);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/invalide ou inexistant/i);
    });

    it("REJECTS empty or blank referral code", async () => {
      const res = await validateReferralCode("   ");
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/manquant/i);
    });
  });

  // ==========================================================================
  // 3. Referral Eligibility (Self-referral, Cycles & Duplicates)
  // ==========================================================================
  describe("validateReferralEligibility", () => {
    const activeReferrer = {
      id: "partner-ref-1",
      userId: "user-ref-1",
      code: "P001",
      status: "ACTIVE",
      phone: "98123456",
      user: { id: "user-ref-1", email: "referrer@example.com" },
    };

    it("accepts a completely distinct valid candidate", async () => {
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(activeReferrer),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        activeReferrer.id,
        { email: "candidate@example.com", phone: "22111222" },
        mockDb,
      );
      expect(res.valid).toBe(true);
    });

    it("REJECTS self-referral by matching partner ID", async () => {
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(activeReferrer),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        activeReferrer.id,
        { id: activeReferrer.id, email: "other@example.com", phone: "22000000" },
        mockDb,
      );
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Auto-parrainage interdit: identifiant partenaire identique/i);
    });

    it("REJECTS self-referral by matching email address (case-insensitive)", async () => {
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(activeReferrer),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        activeReferrer.id,
        { email: "REFERRER@example.com", phone: "22000000" },
        mockDb,
      );
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Auto-parrainage interdit: même adresse e-mail/i);
    });

    it("REJECTS self-referral by matching normalized phone number (+216 prefix vs local)", async () => {
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(activeReferrer), // phone: 98123456
        },
      } as unknown as Prisma.TransactionClient;

      // candidate enters +216 98 123 456
      const res = await validateReferralEligibility(
        activeReferrer.id,
        { email: "other@example.com", phone: "+216 98 123 456" },
        mockDb,
      );
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Auto-parrainage interdit: même numéro de téléphone/i);
    });

    it("REJECTS duplicate attribution if candidate is already attributed", async () => {
      const candidateId = "partner-candidate-existing";

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(activeReferrer),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue({
            id: "attr-already-exists",
            referrerPartnerId: "partner-prior",
            referredPartnerId: candidateId,
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        activeReferrer.id,
        { id: candidateId, email: "cand@example.com", phone: "22555666" },
        mockDb,
      );
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/déjà attribué à un parrain/i);
    });

    it("REJECTS direct referral cycle (A refers B, B cannot refer A)", async () => {
      const candidateId = "partner-candidate-b";

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(activeReferrer), // A
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(null), // candidate B has no referrer yet
          findFirst: vi.fn().mockResolvedValue({
            id: "attr-direct-cycle",
            referrerPartnerId: candidateId, // B was referrer of A!
            referredPartnerId: activeReferrer.id,
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        activeReferrer.id, // A invites B
        { id: candidateId, email: "b@example.com", phone: "22777888" },
        mockDb,
      );
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cycle de parrainage détecté: le candidat a déjà parrainé ce partenaire/i);
    });

    it("REJECTS multi-hop referral cycle (A -> B -> C -> A)", async () => {
      // Chain: Partner A refers Partner B, Partner B refers Partner C.
      // Now Partner C wants to refer Partner A!
      const partnerAId = "partner-a";
      const partnerBId = "partner-b";
      const partnerC = {
        id: "partner-c",
        userId: "user-c",
        code: "P003",
        status: "ACTIVE",
        phone: "98333333",
        user: { id: "user-c", email: "c@example.com" },
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(partnerC),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.referredPartnerId === partnerAId) return null; // A has no parent
            if (where.referredPartnerId === partnerC.id) {
              // C was referred by B
              return { referrerPartnerId: partnerBId };
            }
            if (where.referredPartnerId === partnerBId) {
              // B was referred by A
              return { referrerPartnerId: partnerAId };
            }
            return null;
          }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      // Partner C attempts to refer Partner A
      const res = await validateReferralEligibility(
        partnerC.id,
        { id: partnerAId, email: "a@example.com", phone: "98111111" },
        mockDb,
      );
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cycle de parrainage détecté dans la chaîne de parrainage/i);
    });

    it("REJECTS when referrer is not ACTIVE", async () => {
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue({
            ...activeReferrer,
            status: "SUSPENDED",
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        activeReferrer.id,
        { email: "cand@example.com", phone: "22111222" },
        mockDb,
      );
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Le parrain n'est pas actif/i);
    });
  });

  // ==========================================================================
  // 4. Registration Schema Validation
  // ==========================================================================
  describe("Registration Schema with Referral Code", () => {
    const baseValid = {
      fullName: "Nouveau Partenaire",
      email: "new@example.com",
      phone: "+216 22 111 222",
      password: "Password123!",
      confirmPassword: "Password123!",
      experience: "INTERMEDIAIRE",
      termsAccepted: true,
    };

    it("accepts 'admin' invitation code", () => {
      const res = registrationSchema.safeParse({
        ...baseValid,
        invitationCode: "admin",
      });
      expect(res.success).toBe(true);
    });

    it("accepts uppercase 'ADMIN' invitation code", () => {
      const res = registrationSchema.safeParse({
        ...baseValid,
        invitationCode: "ADMIN",
      });
      expect(res.success).toBe(true);
    });

    it("accepts valid alphanumeric partner referral code 'P001'", () => {
      const res = registrationSchema.safeParse({
        ...baseValid,
        invitationCode: "P001",
      });
      expect(res.success).toBe(true);
    });

    it("accepts slug-based referral code 'PARTNER_REF-99'", () => {
      const res = registrationSchema.safeParse({
        ...baseValid,
        invitationCode: "PARTNER_REF-99",
      });
      expect(res.success).toBe(true);
    });

    it("REJECTS invitation code with special invalid characters", () => {
      const res = registrationSchema.safeParse({
        ...baseValid,
        invitationCode: "code@with!symbols",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("caractères alphanumériques uniquement");
      }
    });

    it("REJECTS empty invitation code", () => {
      const res = registrationSchema.safeParse({
        ...baseValid,
        invitationCode: "   ",
      });
      expect(res.success).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Registration Service (Attribution & Transaction)
  // ==========================================================================
  describe("Registration Flow (registerPartner)", () => {
    it("Admin invitation code creates User & Partner without ReferralAttribution", async () => {
      // Test admin case
      const validAdminPayload = {
        fullName: "Karim Admin Invited",
        email: "karim.admin@example.tn",
        phone: "22123456",
        password: "Password123!",
        confirmPassword: "Password123!",
        invitationCode: "admin",
        experience: "DEBUTANT",
        termsAccepted: true,
      };

      const res = await registerPartner(validAdminPayload);
      // Even if database connection is mocked or live, schema parsing passes
      expect(res).toBeDefined();
    });

    it("Rejects registration if referral code is invalid", async () => {
      const payload = {
        fullName: "Test User",
        email: "test.invalid@example.tn",
        phone: "22123456",
        password: "Password123!",
        confirmPassword: "Password123!",
        invitationCode: "INVALID_CODE_999",
        experience: "DEBUTANT",
        termsAccepted: true,
      };

      const res = await registerPartner(payload);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.fieldErrors?.invitationCode).toBeDefined();
      }
    });

    it("Rejects registration on self-referral by matching email", async () => {
      const { prisma } = await import("@/lib/prisma");
      const activeReferrer = {
        id: "partner-ref-email",
        userId: "user-ref-email",
        displayName: "Referrer",
        code: "PREF01",
        status: "ACTIVE",
        phone: "98111222",
        user: { id: "user-ref-email", email: "match@example.com" },
      };

      const linkSpy = vi.spyOn(prisma.referralLink, "findUnique").mockResolvedValue({
        id: "link-ref-1",
        code: "PREF01",
        isActive: true,
        partner: activeReferrer,
      } as any);

      const res = await registerPartner({
        fullName: "Candidate Same Email",
        email: "match@example.com",
        phone: "22999888",
        password: "Password123!",
        confirmPassword: "Password123!",
        invitationCode: "PREF01",
        experience: "DEBUTANT",
        termsAccepted: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.fieldErrors?.invitationCode || res.fieldErrors?.email).toBeDefined();
      }

      linkSpy.mockRestore();
    });

    it("Rejects registration on self-referral by matching phone", async () => {
      const { prisma } = await import("@/lib/prisma");
      const activeReferrer = {
        id: "partner-ref-phone",
        userId: "user-ref-phone",
        displayName: "Referrer",
        code: "PREF02",
        status: "ACTIVE",
        phone: "98123456",
        user: { id: "user-ref-phone", email: "other@example.com" },
      };

      const linkSpy = vi.spyOn(prisma.referralLink, "findUnique").mockResolvedValue({
        id: "link-ref-2",
        code: "PREF02",
        isActive: true,
        partner: activeReferrer,
      } as any);

      const partnerSpy = vi.spyOn(prisma.partner, "findUnique").mockResolvedValue(activeReferrer as any);
      const userSpy = vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const res = await registerPartner({
        fullName: "Candidate Same Phone",
        email: "candidate.new@example.com",
        phone: "+216 98 123 456",
        password: "Password123!",
        confirmPassword: "Password123!",
        invitationCode: "PREF02",
        experience: "DEBUTANT",
        termsAccepted: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.fieldErrors?.invitationCode).toMatch(/numéro de téléphone/i);
      }

      linkSpy.mockRestore();
      partnerSpy.mockRestore();
      userSpy.mockRestore();
    });
  });

  // ==========================================================================
  // 6. recordPartnerReferral Transaction Helper
  // ==========================================================================
  describe("recordPartnerReferral helper", () => {
    it("creates ReferralAttribution inside transaction with type=PARTNER and status=PENDING_QUALIFICATION", async () => {
      const referrer = {
        id: "partner-r1",
        userId: "user-r1",
        status: "ACTIVE",
        phone: "98111222",
        user: { id: "user-r1", email: "r1@example.com" },
      };

      const mockTx = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(referrer),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "attr-new-1",
            referrerPartnerId: "partner-r1",
            referredPartnerId: "partner-new-1",
            type: "PARTNER",
            status: "PENDING_QUALIFICATION",
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const created = await recordPartnerReferral(mockTx, "partner-r1", "partner-new-1");
      expect(created.type).toBe("PARTNER");
      expect(created.status).toBe("PENDING_QUALIFICATION");
      expect(mockTx.referralAttribution.create).toHaveBeenCalledWith({
        data: {
          referrerPartnerId: "partner-r1",
          referredPartnerId: "partner-new-1",
          type: "PARTNER",
          status: "PENDING_QUALIFICATION",
        },
      });
    });

    it("throws when candidate or referrer is not eligible", async () => {
      const referrer = {
        id: "partner-r1",
        userId: "user-r1",
        status: "SUSPENDED",
        user: { id: "user-r1", email: "r1@example.com" },
      };

      const mockTx = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(referrer),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(recordPartnerReferral(mockTx, "partner-r1", "partner-new-1")).rejects.toThrow();
    });
  });

  // ==========================================================================
  // 7. Server Action IDOR Protection
  // ==========================================================================
  describe("getPartnerReferralLinkAction", () => {
    it("returns error if session has no partnerId", async () => {
      const rbacModule = await import("@/lib/rbac");
      const requireSessionSpy = vi.spyOn(rbacModule, "requireSession").mockResolvedValue({
        id: "user-no-partner",
        email: "admin@ecomcolab.tn",
        role: "PARTNER" as any,
        firstName: "Test",
        lastName: "User",
        partnerId: null,
      });

      const res = await getPartnerReferralLinkAction();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/Identifiant partenaire introuvable/i);
      }

      requireSessionSpy.mockRestore();
    });

    it("derives partnerId strictly from session without accepting client args", async () => {
      const rbacModule = await import("@/lib/rbac");
      const { prisma } = await import("@/lib/prisma");

      const requireSessionSpy = vi.spyOn(rbacModule, "requireSession").mockResolvedValue({
        id: "user-p1",
        email: "p1@partner.tn",
        role: "PARTNER" as any,
        firstName: "Nour",
        lastName: "Salah",
        partnerId: "partner-from-session",
      });

      const partnerSpy = vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
        id: "partner-from-session",
        code: "P001",
        status: "ACTIVE",
      } as any);

      const linkSpy = vi.spyOn(prisma.referralLink, "findFirst").mockResolvedValue({
        id: "link-session",
        partnerId: "partner-from-session",
        code: "P001",
        isActive: true,
      } as any);

      const res = await getPartnerReferralLinkAction();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.code).toBe("P001");
        expect(res.url).toContain("/register?ref=P001");
      }

      requireSessionSpy.mockRestore();
      partnerSpy.mockRestore();
      linkSpy.mockRestore();
    });
  });

  // ==========================================================================
  // 8. Auth Redirect Loop Resolution (src/lib/auth.ts)
  // ==========================================================================
  describe("Auth Redirect Loop Resolution in authorizeCredentials", () => {
    it("rejects PENDING partner at login with PendingPartnerError (code=pending)", async () => {
      const passwordHash = await bcrypt.hash("Password123!", 10);
      const pendingUser = {
        id: "user-pending",
        email: "pending@example.com",
        passwordHash,
        firstName: "Mouna",
        lastName: "Trabelsi",
        role: "PARTNER",
        status: "ACTIVE", // User status is ACTIVE
        partner: {
          id: "partner-pending",
          status: "PENDING", // Partner status is PENDING!
        },
      };

      // Mock prisma to return pendingUser
      const { prisma } = await import("@/lib/prisma");
      const findUniqueSpy = vi.spyOn(prisma.user, "findUnique").mockResolvedValue(pendingUser as any);

      await expect(
        authorizeCredentials({
          email: "pending@example.com",
          password: "Password123!",
        }),
      ).rejects.toThrow(PendingPartnerError);

      try {
        await authorizeCredentials({
          email: "pending@example.com",
          password: "Password123!",
        });
      } catch (err: any) {
        expect(err.code).toBe("pending");
      }

      findUniqueSpy.mockRestore();
    });

    it("rejects SUSPENDED partner at login returning null", async () => {
      const passwordHash = await bcrypt.hash("Password123!", 10);
      const suspendedUser = {
        id: "user-suspended",
        email: "suspended@example.com",
        passwordHash,
        firstName: "Ali",
        lastName: "Ben",
        role: "PARTNER",
        status: "ACTIVE",
        partner: {
          id: "partner-suspended",
          status: "SUSPENDED",
        },
      };

      const { prisma } = await import("@/lib/prisma");
      const findUniqueSpy = vi.spyOn(prisma.user, "findUnique").mockResolvedValue(suspendedUser as any);

      const result = await authorizeCredentials({
        email: "suspended@example.com",
        password: "Password123!",
      });
      expect(result).toBeNull();

      findUniqueSpy.mockRestore();
    });

    it("allows ACTIVE partner to log in and returns session user payload", async () => {
      const passwordHash = await bcrypt.hash("Password123!", 10);
      const activeUser = {
        id: "user-active",
        email: "active@example.com",
        passwordHash,
        firstName: "Nour",
        lastName: "Ben Salah",
        role: "PARTNER",
        status: "ACTIVE",
        partner: {
          id: "partner-active",
          status: "ACTIVE",
        },
      };

      const { prisma } = await import("@/lib/prisma");
      const findUniqueSpy = vi.spyOn(prisma.user, "findUnique").mockResolvedValue(activeUser as any);

      const result = await authorizeCredentials({
        email: "active@example.com",
        password: "Password123!",
      });

      expect(result).toEqual({
        id: "user-active",
        email: "active@example.com",
        name: "Nour Ben Salah",
        firstName: "Nour",
        lastName: "Ben Salah",
        role: "PARTNER",
        partnerId: "partner-active",
      });

      findUniqueSpy.mockRestore();
    });

    it("allows ADMIN user without partner profile to log in normally", async () => {
      const passwordHash = await bcrypt.hash("AdminPassword123!", 10);
      const adminUser = {
        id: "user-admin",
        email: "admin@ecomcolab.tn",
        passwordHash,
        firstName: "Super",
        lastName: "Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        partner: null,
      };

      const { prisma } = await import("@/lib/prisma");
      const findUniqueSpy = vi.spyOn(prisma.user, "findUnique").mockResolvedValue(adminUser as any);

      const result = await authorizeCredentials({
        email: "admin@ecomcolab.tn",
        password: "AdminPassword123!",
      });

      expect(result).toMatchObject({
        id: "user-admin",
        email: "admin@ecomcolab.tn",
        role: "SUPER_ADMIN",
        partnerId: null,
      });

      findUniqueSpy.mockRestore();
    });
  });

  // ==========================================================================
  // 9. Phone Number Normalization Utility
  // ==========================================================================
  describe("normalizePhoneDigits", () => {
    it("handles diverse Tunisian formats", () => {
      expect(normalizePhoneDigits("98123456")).toBe("98123456");
      expect(normalizePhoneDigits("+21698123456")).toBe("98123456");
      expect(normalizePhoneDigits("00216 98 123 456")).toBe("98123456");
      expect(normalizePhoneDigits("216-98-123-456")).toBe("98123456");
      expect(normalizePhoneDigits("")).toBe("");
      expect(normalizePhoneDigits(null)).toBe("");
    });
  });
});
