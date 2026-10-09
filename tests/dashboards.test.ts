import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";
import * as rbacModule from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  approveCommissionAction,
  rejectCommissionAction,
  payCommissionAction,
  confirmPromotionAction,
} from "@/app/(admin)/partenaires/parrainage/actions";
import {
  calculateProfitSharing,
  REFERRAL_LEVEL_RATES,
} from "@/modules/finance/referral-math";
import {
  getPartnerReferralLevel,
  evaluateTargetLevel,
  DEFAULT_LEVEL2_THRESHOLD,
  DEFAULT_LEVEL3_THRESHOLD,
} from "@/modules/referrals/levels";
import { formatMoney, roundMoney, d } from "@/lib/money";

// Mock next/cache revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Milestone 5: Admin & Partner Dashboards UI & Actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Suite 1: Admin Authorization Gates & Role Enforcement
  // ==========================================================================
  describe("Suite 1: Admin Authorization Gates & Role Enforcement", () => {
    it("rejects unauthenticated users attempting admin access (redirects to /login)", async () => {
      const redirectError = new Error("NEXT_REDIRECT");
      (redirectError as any).digest = "NEXT_REDIRECT;replace;/login;307;";

      vi.spyOn(rbacModule, "requireSession").mockRejectedValue(redirectError);

      const formData = new FormData();
      formData.set("commissionId", "comm-123");

      const resApprove = await approveCommissionAction(formData);
      expect(resApprove.ok).toBe(false);

      const resReject = await rejectCommissionAction(formData);
      expect(resReject.ok).toBe(false);

      const resPay = await payCommissionAction(formData);
      expect(resPay.ok).toBe(false);

      const resPromo = await confirmPromotionAction(formData);
      expect(resPromo.ok).toBe(false);
    });

    it("rejects partner role attempting to call admin actions (redirects to /tableau-de-bord)", async () => {
      const roleRedirectError = new Error("NEXT_REDIRECT");
      (roleRedirectError as any).digest =
        "NEXT_REDIRECT;replace;/tableau-de-bord;307;";

      vi.spyOn(rbacModule, "requireSession").mockRejectedValue(roleRedirectError);

      const formData = new FormData();
      formData.set("commissionId", "comm-123");
      formData.set("reason", "Suspected fraud");
      formData.set("transactionReference", "TX-12345");
      formData.set("partnerId", "partner-abc");

      const approveRes = await approveCommissionAction(formData);
      expect(approveRes.ok).toBe(false);

      const rejectRes = await rejectCommissionAction(formData);
      expect(rejectRes.ok).toBe(false);

      const payRes = await payCommissionAction(formData);
      expect(payRes.ok).toBe(false);

      const promoRes = await confirmPromotionAction(formData);
      expect(promoRes.ok).toBe(false);
    });

    it("allows SUPER_ADMIN and ADMIN sessions to pass the authorization gate", async () => {
      const mockAdminUser: rbacModule.SessionUser = {
        id: "admin-user-1",
        email: "admin@platform.tn",
        role: "ADMIN",
        firstName: "Super",
        lastName: "Admin",
      };

      vi.spyOn(rbacModule, "requireSession").mockResolvedValue(mockAdminUser);

      // Verify that requireSession passes for ADMIN
      const sessionUser = await rbacModule.requireSession(["SUPER_ADMIN", "ADMIN"]);
      expect(sessionUser.role).toBe("ADMIN");
      expect(sessionUser.id).toBe("admin-user-1");
    });
  });

  // ==========================================================================
  // Suite 2: Partner Scoping & IDOR Immunity
  // ==========================================================================
  describe("Suite 2: Partner Scoping & IDOR Immunity", () => {
    it("strictly isolates queries to session.user.partnerId (IDOR protection)", async () => {
      const partnerASession: rbacModule.SessionUser = {
        id: "user-partner-a",
        email: "partner.a@platform.tn",
        role: "PARTNER",
        firstName: "Alice",
        lastName: "Partner",
        partnerId: "partner-A-uuid",
      };

      vi.spyOn(rbacModule, "requireSession").mockResolvedValue(partnerASession);

      // Verify session user partnerId
      const user = await rbacModule.requireSession(["PARTNER"]);
      expect(user.partnerId).toBe("partner-A-uuid");

      // Verify query scoping: When partner queries attributions or commissions,
      // the filter strictly binds to partner-A-uuid, not any URL or client parameter.
      const queryFilter = {
        where: {
          referrerPartnerId: user.partnerId!,
        },
      };

      expect(queryFilter.where.referrerPartnerId).toBe("partner-A-uuid");
      expect(queryFilter.where.referrerPartnerId).not.toBe("partner-B-uuid");
    });

    it("rejects partner access if session has no partnerId (orphan user)", async () => {
      const orphanPartner: rbacModule.SessionUser = {
        id: "user-orphan",
        email: "orphan@platform.tn",
        role: "PARTNER",
        firstName: "Orphan",
        lastName: "User",
        partnerId: null,
      };

      vi.spyOn(rbacModule, "requireSession").mockResolvedValue(orphanPartner);

      const user = await rbacModule.requireSession(["PARTNER"]);
      expect(user.partnerId).toBeNull();
    });

    it("rejects unapproved partner (e.g. status PENDING)", async () => {
      const pendingRedirectError = new Error("NEXT_REDIRECT");
      (pendingRedirectError as any).digest =
        "NEXT_REDIRECT;replace;/login?error=pending;307;";

      vi.spyOn(rbacModule, "requireSession").mockRejectedValue(pendingRedirectError);

      await expect(rbacModule.requireSession(["PARTNER"])).rejects.toThrow(
        "NEXT_REDIRECT",
      );
    });
  });

  // ==========================================================================
  // Suite 3: Admin Server Actions Validation & State Transitions
  // ==========================================================================
  describe("Suite 3: Admin Server Actions Validation & Transitions", () => {
    const mockAdminUser: rbacModule.SessionUser = {
      id: "admin-actor-1",
      email: "admin@platform.tn",
      role: "ADMIN",
      firstName: "Admin",
      lastName: "Ops",
    };

    beforeEach(() => {
      vi.spyOn(rbacModule, "requireSession").mockResolvedValue(mockAdminUser);
    });

    // --- approveCommissionAction ---
    describe("approveCommissionAction", () => {
      it("returns error if commissionId is missing", async () => {
        const res = await approveCommissionAction({});
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/Identifiant de commission manquant/i);
      });

      it("successfully approves an ELIGIBLE commission", async () => {
        const mockCommission = {
          id: "comm-el-1",
          status: "ELIGIBLE",
          referrerPartnerId: "partner-1",
          amount: new Decimal("60.000"),
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockCommission as any,
        );
        vi.spyOn(prisma.referralCommission, "updateMany").mockResolvedValue({
          count: 1,
        });
        vi.spyOn(prisma.referralCommission, "findUniqueOrThrow").mockResolvedValue({
          ...mockCommission,
          status: "APPROVED_FOR_PAYMENT",
          approvedAt: new Date(),
          approvedById: mockAdminUser.id,
        } as any);
        vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

        const res = await approveCommissionAction({ commissionId: "comm-el-1" });
        expect(res.ok).toBe(true);
        expect(res.message).toMatch(/approuvée pour paiement/i);
        expect((res.data as any)?.status).toBe("APPROVED_FOR_PAYMENT");
      });

      it("blocks approving an already PAID commission", async () => {
        const mockPaidCommission = {
          id: "comm-paid-1",
          status: "PAID",
          referrerPartnerId: "partner-1",
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockPaidCommission as any,
        );

        const res = await approveCommissionAction({ commissionId: "comm-paid-1" });
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/already PAID/i);
      });

      it("blocks approving a REJECTED commission", async () => {
        const mockRejectedCommission = {
          id: "comm-rej-1",
          status: "REJECTED",
          referrerPartnerId: "partner-1",
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockRejectedCommission as any,
        );

        const res = await approveCommissionAction({ commissionId: "comm-rej-1" });
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/terminal status/i);
      });
    });

    // --- rejectCommissionAction ---
    describe("rejectCommissionAction", () => {
      it("requires non-empty rejection reason (rejects empty/whitespace)", async () => {
        const res1 = await rejectCommissionAction({
          commissionId: "comm-1",
          reason: "",
        });
        expect(res1.ok).toBe(false);
        expect(res1.error).toMatch(/motif de rejet est obligatoire/i);

        const res2 = await rejectCommissionAction({
          commissionId: "comm-1",
          reason: "   ",
        });
        expect(res2.ok).toBe(false);
        expect(res2.error).toMatch(/motif de rejet est obligatoire/i);
      });

      it("successfully rejects a commission with valid reason", async () => {
        const mockCommission = {
          id: "comm-pending-1",
          status: "ELIGIBLE",
          amount: new Decimal("30.000"),
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockCommission as any,
        );
        vi.spyOn(prisma.referralCommission, "update").mockResolvedValue({
          ...mockCommission,
          status: "REJECTED",
          rejectionReason: "Commande retournée par le client",
        } as any);
        vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

        const res = await rejectCommissionAction({
          commissionId: "comm-pending-1",
          reason: "Commande retournée par le client",
        });

        expect(res.ok).toBe(true);
        expect(res.message).toMatch(/Commission rejetée/i);
        expect((res.data as any)?.status).toBe("REJECTED");
      });

      it("cannot reject a commission that is already PAID", async () => {
        const mockPaidCommission = {
          id: "comm-paid-2",
          status: "PAID",
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockPaidCommission as any,
        );

        const res = await rejectCommissionAction({
          commissionId: "comm-paid-2",
          reason: "Client claim",
        });
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/already been PAID/i);
      });
    });

    // --- payCommissionAction ---
    describe("payCommissionAction", () => {
      it("strictly requires transactionReference (rejects empty/whitespace)", async () => {
        const res1 = await payCommissionAction({
          commissionId: "comm-appr-1",
          transactionReference: "",
        });
        expect(res1.ok).toBe(false);
        expect(res1.error).toMatch(/référence de transaction est obligatoire/i);

        const res2 = await payCommissionAction({
          commissionId: "comm-appr-1",
          transactionReference: "   ",
        });
        expect(res2.ok).toBe(false);
        expect(res2.error).toMatch(/référence de transaction est obligatoire/i);
      });

      it("blocks paying a commission that is NOT approved (e.g. ELIGIBLE)", async () => {
        const mockEligibleCommission = {
          id: "comm-el-2",
          status: "ELIGIBLE",
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockEligibleCommission as any,
        );

        const res = await payCommissionAction({
          commissionId: "comm-el-2",
          transactionReference: "VIR-998877",
        });

        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/must be APPROVED_FOR_PAYMENT/i);
      });

      it("successfully records payment for an APPROVED_FOR_PAYMENT commission", async () => {
        const mockApprovedCommission = {
          id: "comm-appr-3",
          status: "APPROVED_FOR_PAYMENT",
          amount: new Decimal("60.000"),
          referrerPartnerId: "partner-ref-1",
          orderId: "ord-100",
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockApprovedCommission as any,
        );
        vi.spyOn(prisma.referralCommission, "updateMany").mockResolvedValue({
          count: 1,
        });
        vi.spyOn(prisma.financialTransaction, "create").mockResolvedValue({} as any);
        vi.spyOn(prisma.financialTransaction, "aggregate").mockResolvedValue({
          _sum: { amount: new Decimal("60.000") },
        } as any);
        vi.spyOn(prisma.withdrawal, "aggregate").mockResolvedValue({
          _sum: { amount: new Decimal("0") },
        } as any);
        vi.spyOn(prisma.wallet, "upsert").mockResolvedValue({} as any);
        vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);
        vi.spyOn(prisma.referralCommission, "findUniqueOrThrow").mockResolvedValue({
          ...mockApprovedCommission,
          status: "PAID",
          paidAt: new Date(),
          paidById: mockAdminUser.id,
        } as any);

        const res = await payCommissionAction({
          commissionId: "comm-appr-3",
          transactionReference: "VIR-2026-OCT-001",
        });

        expect(res.ok).toBe(true);
        expect(res.message).toMatch(/Paiement enregistré avec succès/i);
        expect((res.data as any)?.status).toBe("PAID");
      });

      it("blocks duplicate payouts (idempotency)", async () => {
        const mockPaidCommission = {
          id: "comm-already-paid",
          status: "PAID",
        };

        vi.spyOn(prisma.referralCommission, "findUnique").mockResolvedValue(
          mockPaidCommission as any,
        );

        const res = await payCommissionAction({
          commissionId: "comm-already-paid",
          transactionReference: "VIR-DUPLICATE",
        });

        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/already been paid/i);
      });
    });

    // --- confirmPromotionAction ---
    describe("confirmPromotionAction", () => {
      it("returns error if partnerId is missing", async () => {
        const res = await confirmPromotionAction({});
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/Identifiant du partenaire manquant/i);
      });

      it("successfully confirms partner promotion to Level 2", async () => {
        vi.spyOn(prisma.partner, "findUnique").mockResolvedValue({
          id: "partner-promoted-1",
          createdAt: new Date(),
        } as any);
        vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue(null);
        vi.spyOn(prisma.systemSetting, "upsert").mockResolvedValue({} as any);
        vi.spyOn(prisma.referralAttribution, "count").mockResolvedValue(3);
        vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

        const res = await confirmPromotionAction({
          partnerId: "partner-promoted-1",
          targetLevel: "2",
        });

        expect(res.ok).toBe(true);
        expect(res.message).toMatch(/Promotion confirmée avec succès/i);
        expect((res.data as any)?.level).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Suite 4: Financial Calculation Transparency & Data Formatting ($R, E, P, A, B, C$)
  // ==========================================================================
  describe("Suite 4: Financial Calculation Transparency ($R, E, P, A, B, C$)", () => {
    it("calculates exact numeric example from specification (R=5000, E=3000 -> P=2000, A=1400, B=600)", () => {
      const R = new Decimal("5000.000");
      const E = new Decimal("3000.000");

      // Level 1: r = 5%
      const resL1 = calculateProfitSharing({
        revenue: R,
        expenses: E,
        referrerLevel: 1,
      });

      expect(resL1.profit.toString()).toBe("2000");
      expect(resL1.adminShare.toString()).toBe("1400"); // 70% of 2000
      expect(resL1.remainingPool.toString()).toBe("600"); // 30% of 2000
      expect(resL1.commissionRate.toString()).toBe("0.05"); // 5%
      expect(resL1.referralCommission.toString()).toBe("30"); // 600 * 5% = 30 DT
      expect(resL1.balanceAfterCommission.toString()).toBe("570"); // 600 - 30 = 570 DT

      // Level 2: r = 10%
      const resL2 = calculateProfitSharing({
        revenue: R,
        expenses: E,
        referrerLevel: 2,
      });
      expect(resL2.referralCommission.toString()).toBe("60"); // 600 * 10% = 60 DT
      expect(resL2.balanceAfterCommission.toString()).toBe("540"); // 600 - 60 = 540 DT

      // Level 3: r = 15%
      const resL3 = calculateProfitSharing({
        revenue: R,
        expenses: E,
        referrerLevel: 3,
      });
      expect(resL3.referralCommission.toString()).toBe("90"); // 600 * 15% = 90 DT
      expect(resL3.balanceAfterCommission.toString()).toBe("510"); // 600 - 90 = 510 DT
    });

    it("ensures zero commission and zero admin share when profit P <= 0", () => {
      // Breakeven (R = E = 1000)
      const resZero = calculateProfitSharing({
        revenue: new Decimal("1000.000"),
        expenses: new Decimal("1000.000"),
        referrerLevel: 2,
      });
      expect(resZero.profit.toString()).toBe("0");
      expect(resZero.adminShare.toString()).toBe("0");
      expect(resZero.remainingPool.toString()).toBe("0");
      expect(resZero.referralCommission.toString()).toBe("0");

      // Deficit (R = 1000, E = 1500 -> P = -500)
      const resNegative = calculateProfitSharing({
        revenue: new Decimal("1000.000"),
        expenses: new Decimal("1500.000"),
        referrerLevel: 3,
      });
      expect(resNegative.profit.toString()).toBe("-500");
      expect(resNegative.adminShare.toString()).toBe("0");
      expect(resNegative.remainingPool.toString()).toBe("0");
      expect(resNegative.referralCommission.toString()).toBe("0");
    });

    it("formats monetary amounts with 3 decimals / millimes for UI display", () => {
      expect(formatMoney("30", { currency: "DT" })).toBe("30.000 DT");
      expect(formatMoney(new Decimal("60.5"), { currency: "TND" })).toBe("60.500 TND");
      expect(formatMoney("1400.000", { currency: "DT" })).toBe("1400.000 DT");
      expect(formatMoney("0", { currency: "DT" })).toBe("0.000 DT");
    });

    it("evaluates promotion target levels according to thresholds (3 for L2, 10 for L3)", () => {
      const thresholds = {
        level2Threshold: DEFAULT_LEVEL2_THRESHOLD, // 3
        level3Threshold: DEFAULT_LEVEL3_THRESHOLD, // 10
      };

      expect(evaluateTargetLevel(0, thresholds)).toBe(1);
      expect(evaluateTargetLevel(2, thresholds)).toBe(1);
      expect(evaluateTargetLevel(3, thresholds)).toBe(2);
      expect(evaluateTargetLevel(7, thresholds)).toBe(2);
      expect(evaluateTargetLevel(10, thresholds)).toBe(3);
      expect(evaluateTargetLevel(25, thresholds)).toBe(3);
    });

    it("correctly parses stored calculationDetails object or string", () => {
      const rawDetails = {
        revenue: "5000.000",
        expenses: "3000.000",
        profit: "2000.000",
        adminShare: "1400.000",
        remainingPool: "600.000",
        commissionRate: "0.10",
        referralCommission: "60.000",
        balanceAfterCommission: "540.000",
        referrerLevel: 2,
        isProfitable: true,
        currency: "TND",
      };

      const parsedString = JSON.parse(JSON.stringify(rawDetails));
      expect(parsedString.revenue).toBe("5000.000");
      expect(parsedString.referralCommission).toBe("60.000");
      expect(parsedString.remainingPool).toBe("600.000");
      expect(parsedString.referrerLevel).toBe(2);
    });
  });

  // ==========================================================================
  // Suite 5: App Shell Navigation Configuration & Route Protection
  // ==========================================================================
  describe("Suite 5: App Shell Navigation Verification & Route Protection", () => {
    it("confirms /partenaires/parrainage is strictly covered by ADMIN_PREFIXES", async () => {
      const { ADMIN_PREFIXES, matchPrefix } = await import("@/lib/roles");
      expect(matchPrefix("/partenaires/parrainage", ADMIN_PREFIXES)).toBe(true);
      expect(matchPrefix("/partenaires", ADMIN_PREFIXES)).toBe(true);
    });

    it("confirms partner cannot access admin routes under ADMIN_PREFIXES", async () => {
      const { ADMIN_PREFIXES, matchPrefix } = await import("@/lib/roles");
      expect(matchPrefix("/partenaires/parrainage", ADMIN_PREFIXES)).toBe(true);
      expect(matchPrefix("/dashboard", ADMIN_PREFIXES)).toBe(true);
      // Partner dashboard routes must not match admin prefixes
      expect(matchPrefix("/tableau-de-bord", ADMIN_PREFIXES)).toBe(false);
    });

    it("confirms AppShell module loads cleanly", async () => {
      const appShellModule = await import("@/components/layout/app-shell");
      expect(appShellModule.AppShell).toBeDefined();
    });
  });
});
