import { describe, expect, it, vi } from "vitest";
import {
  validateReferralEligibility,
  normalizePhoneDigits,
  recordPartnerReferral,
} from "@/modules/referrals/service";
import type { Prisma } from "@prisma/client";

describe("Adversarial Empirical Stress Tests: validateReferralEligibility", () => {
  // Helper to create mock partner
  const createMockPartner = (overrides?: Partial<any>) => ({
    id: "referrer-active-1",
    userId: "user-ref-1",
    code: "PREF01",
    status: "ACTIVE",
    phone: "98123456",
    user: { id: "user-ref-1", email: "referrer@example.com" },
    ...overrides,
  });

  // ==========================================================================
  // 1. Self-Referrals with Subtle Format Variations
  // ==========================================================================
  describe("1. Self-referrals with subtle format differences", () => {
    it("rejects self-referral by exact uppercase email", async () => {
      const referrer = createMockPartner({
        user: { id: "user-1", email: "mohamed.ali@ecomcolab.tn" },
      });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        referrer.id,
        { email: "MOHAMED.ALI@ECOMCOLAB.TN" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Auto-parrainage interdit: même adresse e-mail/i);
    });

    it("rejects self-referral with whitespace and mixed casing in email", async () => {
      const referrer = createMockPartner({
        user: { id: "user-1", email: "partner.test@domain.tn" },
      });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        referrer.id,
        { email: "   PartNer.Test@Domain.TN  \t" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Auto-parrainage interdit: même adresse e-mail/i);
    });

    it("rejects self-referral with +216 prefix vs local 8 digits", async () => {
      const referrer = createMockPartner({ phone: "98123456" });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
      } as unknown as Prisma.TransactionClient;

      const variations = [
        "+21698123456",
        "+216 98 123 456",
        "+216-98-123-456",
        "00216 98 123 456",
        "0021698123456",
        "(+216) 98 123 456",
        "216.98.123.456",
        "98 123 456",
        "98-123-456",
        " 98123456 ",
      ];

      for (const phoneVariation of variations) {
        const res = await validateReferralEligibility(
          referrer.id,
          { phone: phoneVariation },
          mockDb,
        );

        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/Auto-parrainage interdit: même numéro de téléphone/i);
      }
    });

    it("rejects self-referral when referrer has +216 prefix and candidate enters local 8 digits", async () => {
      const referrer = createMockPartner({ phone: "+216 22 999 888" });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        referrer.id,
        { phone: "22999888" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Auto-parrainage interdit: même numéro de téléphone/i);
    });

    it("rejects self-referral when candidate ID is resolved from email matching referrer user", async () => {
      const referrer = createMockPartner({
        id: "partner-self-resolved",
        user: { id: "u-self", email: "resolved@example.com" },
      });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "u-self",
            email: "resolved@example.com",
            partner: { id: "partner-self-resolved" },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      // Candidate provides email (no candidate.id explicitly provided)
      const res = await validateReferralEligibility(
        referrer.id,
        { email: "resolved@example.com" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Auto-parrainage interdit/i);
    });

    it("allows distinct valid candidate with different email and different phone", async () => {
      const referrer = createMockPartner({
        phone: "98123456",
        user: { id: "u1", email: "ref@example.com" },
      });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
        user: { findUnique: vi.fn().mockResolvedValue(null) },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        referrer.id,
        { email: "new.candidate@example.com", phone: "+216 55 444 333" },
        mockDb,
      );

      expect(res.valid).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Direct Cycle (A refers B, B refers A)
  // ==========================================================================
  describe("2. Direct referral cycle (A refers B, B refers A)", () => {
    it("rejects direct cycle when B attempts to refer A (candidate A was inviter of B)", async () => {
      const partnerA = createMockPartner({ id: "partner-A", code: "P-A" });
      const partnerB = createMockPartner({ id: "partner-B", code: "P-B" });

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === "partner-B") return Promise.resolve(partnerB);
            if (where.id === "partner-A") return Promise.resolve(partnerA);
            return Promise.resolve(null);
          }),
        },
        referralAttribution: {
          // Candidate A has no referrer yet (e.g. was admin invited)
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.referredPartnerId === "partner-A") return Promise.resolve(null);
            if (where.referredPartnerId === "partner-B") {
              return Promise.resolve({ referrerPartnerId: "partner-A" });
            }
            return Promise.resolve(null);
          }),
          // Direct cycle check query
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (
              where.referrerPartnerId === "partner-A" &&
              where.referredPartnerId === "partner-B"
            ) {
              return Promise.resolve({
                id: "attr-a-to-b",
                referrerPartnerId: "partner-A",
                referredPartnerId: "partner-B",
              });
            }
            return Promise.resolve(null);
          }),
        },
      } as unknown as Prisma.TransactionClient;

      // B attempts to refer A
      const res = await validateReferralEligibility(
        "partner-B",
        { id: "partner-A" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cycle de parrainage détecté: le candidat a déjà parrainé ce partenaire/i);
    });

    it("rejects direct cycle when candidate A ID is resolved via candidate email", async () => {
      const partnerA = createMockPartner({
        id: "partner-A",
        user: { id: "u-a", email: "partner.a@example.com" },
      });
      const partnerB = createMockPartner({ id: "partner-B" });

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === "partner-B") return Promise.resolve(partnerB);
            return Promise.resolve(null);
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: "u-a",
            email: "partner.a@example.com",
            partner: partnerA,
          }),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue({
            id: "attr-a-b",
            referrerPartnerId: "partner-A",
            referredPartnerId: "partner-B",
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        "partner-B",
        { email: "PARTNER.A@EXAMPLE.COM" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cycle de parrainage détecté: le candidat a déjà parrainé ce partenaire/i);
    });
  });

  // ==========================================================================
  // 3. Multi-Hop Cycles (A -> B -> C -> D -> A, etc.)
  // ==========================================================================
  describe("3. Complex multi-hop cycles", () => {
    it("rejects 4-hop cycle: A -> B -> C -> D -> A", async () => {
      const partnerD = createMockPartner({ id: "partner-D" });

      // Attributions:
      // B was referred by A
      // C was referred by B
      // D was referred by C
      // A has no referrer
      const parentMap: Record<string, string | null> = {
        "partner-D": "partner-C",
        "partner-C": "partner-B",
        "partner-B": "partner-A",
        "partner-A": null,
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === "partner-D") return Promise.resolve(partnerD);
            return Promise.resolve(null);
          }),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            const parent = parentMap[where.referredPartnerId];
            if (parent) {
              return Promise.resolve({ referrerPartnerId: parent });
            }
            return Promise.resolve(null);
          }),
          findFirst: vi.fn().mockResolvedValue(null), // No direct cycle between A and D
        },
      } as unknown as Prisma.TransactionClient;

      // D attempts to refer A
      const res = await validateReferralEligibility(
        "partner-D",
        { id: "partner-A" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cycle de parrainage détecté dans la chaîne de parrainage/i);
    });

    it("rejects intermediate cycle in 4-hop chain: D attempts to refer B (A -> B -> C -> D -> B)", async () => {
      const partnerD = createMockPartner({ id: "partner-D" });

      const parentMap: Record<string, string | null> = {
        "partner-D": "partner-C",
        "partner-C": "partner-B",
        "partner-B": "partner-A",
        "partner-A": null,
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(partnerD),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            // Note: B already has an attribution to A, so if candidate is B,
            // duplicate attribution check will catch it first!
            const parent = parentMap[where.referredPartnerId];
            if (parent) {
              return Promise.resolve({ referrerPartnerId: parent });
            }
            return Promise.resolve(null);
          }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      // D attempts to refer B
      const res = await validateReferralEligibility(
        "partner-D",
        { id: "partner-B" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      // B already has an attribution, so duplicate attribution check rejects B
      expect(res.error).toMatch(/déjà attribué à un parrain/i);
    });

    it("rejects deep 10-hop cycle (A_0 -> A_1 -> ... -> A_9 -> A_0)", async () => {
      const partnerA9 = createMockPartner({ id: "partner-A9" });

      // Chain: A0 -> A1 -> A2 -> A3 -> A4 -> A5 -> A6 -> A7 -> A8 -> A9
      const parentMap: Record<string, string | null> = {};
      for (let i = 1; i <= 9; i++) {
        parentMap[`partner-A${i}`] = `partner-A${i - 1}`;
      }
      parentMap["partner-A0"] = null;

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(partnerA9),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            const parent = parentMap[where.referredPartnerId];
            if (parent) {
              return Promise.resolve({ referrerPartnerId: parent });
            }
            return Promise.resolve(null);
          }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      // A9 attempts to refer A0
      const res = await validateReferralEligibility(
        "partner-A9",
        { id: "partner-A0" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Cycle de parrainage détecté dans la chaîne de parrainage/i);
    });

    it("allows valid referral across disjoint branches (Tree A: Root -> B -> C; Tree D: D refers candidate X)", async () => {
      const partnerC = createMockPartner({ id: "partner-C" });

      // C's ancestors are B -> A -> null
      const parentMap: Record<string, string | null> = {
        "partner-C": "partner-B",
        "partner-B": "partner-A",
        "partner-A": null,
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(partnerC),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.referredPartnerId === "partner-X") {
              return Promise.resolve(null); // X has no referrer
            }
            const parent = parentMap[where.referredPartnerId];
            if (parent) {
              return Promise.resolve({ referrerPartnerId: parent });
            }
            return Promise.resolve(null);
          }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      // C refers completely independent candidate X
      const res = await validateReferralEligibility(
        "partner-C",
        { id: "partner-X", email: "x@example.com" },
        mockDb,
      );

      expect(res.valid).toBe(true);
    });

    it("terminates safely if ancestor graph contains an unexpected existing loop (infinite loop guard)", async () => {
      const partnerD = createMockPartner({ id: "partner-D" });

      // Pathological loop: D -> C -> B -> C (loop between B and C)
      const parentMap: Record<string, string> = {
        "partner-D": "partner-C",
        "partner-C": "partner-B",
        "partner-B": "partner-C", // cyclic!
      };

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(partnerD),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            const parent = parentMap[where.referredPartnerId];
            if (parent) {
              return Promise.resolve({ referrerPartnerId: parent });
            }
            return Promise.resolve(null);
          }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      // Candidate unrelated partner X
      const res = await validateReferralEligibility(
        "partner-D",
        { id: "partner-X" },
        mockDb,
      );

      // Traversal terminates without infinite loop
      expect(res.valid).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Duplicate Attribution Prevention
  // ==========================================================================
  describe("4. Duplicate attribution prevention", () => {
    it("rejects referral when candidate already has an attribution to a different referrer", async () => {
      const referrerY = createMockPartner({ id: "partner-Y" });

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(referrerY),
        },
        referralAttribution: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.referredPartnerId === "partner-candidate-1") {
              return Promise.resolve({
                id: "existing-attr-1",
                referrerPartnerId: "partner-prior-X",
                referredPartnerId: "partner-candidate-1",
              });
            }
            return Promise.resolve(null);
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        "partner-Y",
        { id: "partner-candidate-1" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Ce partenaire est déjà attribué à un parrain/i);
    });

    it("rejects referral when same referrer attempts to attribute the same candidate again", async () => {
      const referrerX = createMockPartner({ id: "partner-X" });

      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(referrerX),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue({
            id: "existing-attr-1",
            referrerPartnerId: "partner-X",
            referredPartnerId: "partner-candidate-1",
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        "partner-X",
        { id: "partner-candidate-1" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Ce partenaire est déjà attribué à un parrain/i);
    });

    it("recordPartnerReferral throws when duplicate attribution is attempted in transaction", async () => {
      const referrer = createMockPartner({ id: "partner-ref-tx" });

      const mockTx = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(referrer),
        },
        referralAttribution: {
          findUnique: vi.fn().mockResolvedValue({
            id: "existing-attr",
            referrerPartnerId: "other-ref",
            referredPartnerId: "candidate-tx",
          }),
          create: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        recordPartnerReferral(mockTx, "partner-ref-tx", "candidate-tx"),
      ).rejects.toThrow(/Ce partenaire est déjà attribué à un parrain/i);

      expect(mockTx.referralAttribution.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 5. Invariant & Edge Cases
  // ==========================================================================
  describe("5. Invariant and edge case stress tests", () => {
    it("rejects when referrer does not exist", async () => {
      const mockDb = {
        partner: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        "ghost-referrer",
        { id: "cand-1" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Partenaire parrain introuvable/i);
    });

    it("rejects when referrer has status SUSPENDED", async () => {
      const referrer = createMockPartner({ status: "SUSPENDED" });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        referrer.id,
        { id: "cand-1" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Le parrain n'est pas actif \(statut: SUSPENDED\)/i);
    });

    it("rejects when referrer has status PENDING", async () => {
      const referrer = createMockPartner({ status: "PENDING" });

      const mockDb = {
        partner: { findUnique: vi.fn().mockResolvedValue(referrer) },
      } as unknown as Prisma.TransactionClient;

      const res = await validateReferralEligibility(
        referrer.id,
        { id: "cand-1" },
        mockDb,
      );

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Le parrain n'est pas actif \(statut: PENDING\)/i);
    });

    it("normalizes phone numbers robustly under extreme input variations", () => {
      expect(normalizePhoneDigits("+216 98 123 456")).toBe("98123456");
      expect(normalizePhoneDigits("00216-98-123-456")).toBe("98123456");
      expect(normalizePhoneDigits("   +216.98.123.456   ")).toBe("98123456");
      expect(normalizePhoneDigits("(216) 98123456")).toBe("98123456");
      expect(normalizePhoneDigits("21698123456")).toBe("98123456");
      expect(normalizePhoneDigits("98123456")).toBe("98123456");
      expect(normalizePhoneDigits("")).toBe("");
      expect(normalizePhoneDigits(null)).toBe("");
      expect(normalizePhoneDigits(undefined)).toBe("");
      expect(normalizePhoneDigits("abc")).toBe("");
      expect(normalizePhoneDigits("123")).toBe("123");
    });
  });
});
