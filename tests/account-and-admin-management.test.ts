import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getUserAccount,
  updateAccountProfile,
  changeAccountPassword,
} from "@/modules/account/service";
import {
  listAdministrators,
  createAdministrator,
  updateAdministrator,
  toggleAdminStatus,
  resetAdminPassword,
} from "@/modules/admin-management/service";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { SETTING_KEYS } from "@/modules/settings/defaults";

type TransactionCallback = (tx: unknown) => Promise<unknown>;

describe("Account Settings & Administrator Management", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* =========================================================================
   * 1. Account Settings (Profile & Password)
   * ========================================================================= */
  describe("Account Settings (Profile & Security)", () => {
    it("getUserAccount retrieves profile info and phone (from partner or setting) without exposing passwordHash", async () => {
      const mockAdminUser = {
        id: "admin_1",
        email: "admin@ecompartner.tn",
        firstName: "Super",
        lastName: "Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        createdAt: new Date("2025-01-01T10:00:00Z"),
        partner: null,
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockAdminUser as never);
      vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue({
        id: "s1",
        key: "user.phone.admin_1",
        value: "+216 98 123 456",
        category: "security",
        description: "",
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const account = await getUserAccount("admin_1");
      expect(account).not.toBeNull();
      expect(account?.id).toBe("admin_1");
      expect(account?.email).toBe("admin@ecompartner.tn");
      expect(account?.phone).toBe("+216 98 123 456");
      expect((account as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it("updateAccountProfile updates first name, last name, phone and records audit log without modifying email", async () => {
      const mockPartnerUser = {
        id: "partner_user_1",
        email: "partner@test.tn",
        firstName: "Karim",
        lastName: "Salah",
        role: "PARTNER",
        partner: {
          id: "p_1",
          displayName: "Karim Salah",
          phone: "12345678",
        },
      };

      const mockTx = {
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockPartnerUser),
          update: vi.fn().mockResolvedValue({}),
        },
        partner: {
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      const res = await updateAccountProfile("partner_user_1", {
        firstName: "Karim Junior",
        lastName: "Ben Salah",
        phone: "+216 20 999 888",
      });

      expect(res.success).toBe(true);

      // Verify User update: email is NEVER updated
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: "partner_user_1" },
        data: {
          firstName: "Karim Junior",
          lastName: "Ben Salah",
        },
      });

      // Verify Partner update: displayName & phone updated
      expect(mockTx.partner.update).toHaveBeenCalledWith({
        where: { id: "p_1" },
        data: {
          displayName: "Karim Junior Ben Salah",
          phone: "+216 20 999 888",
        },
      });

      // Verify Audit Log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: "partner_user_1",
            action: "USER_PROFILE_UPDATED",
            entityType: "User",
            entityId: "partner_user_1",
          }),
        }),
      );
    });

    it("updateAccountProfile validates input and rejects short names", async () => {
      await expect(
        updateAccountProfile("user_1", {
          firstName: "A", // too short
          lastName: "Test",
          phone: "",
        }),
      ).rejects.toThrow();
    });

    it("changeAccountPassword rejects if current password is incorrect", async () => {
      const currentHash = await bcrypt.hash("OldPass123!", 10);
      const mockUser = {
        id: "user_1",
        passwordHash: currentHash,
      };

      const mockTx = {
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockUser),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      await expect(
        changeAccountPassword("user_1", {
          currentPassword: "WrongPassword999!",
          newPassword: "NewSecretPassword2026!",
          confirmPassword: "NewSecretPassword2026!",
        }),
      ).rejects.toThrow("Le mot de passe actuel est incorrect.");
    });

    it("changeAccountPassword rejects weak new passwords or mismatching confirmation", async () => {
      // Missing uppercase / number / too short
      await expect(
        changeAccountPassword("user_1", {
          currentPassword: "CurrentPassword1!",
          newPassword: "weak",
          confirmPassword: "weak",
        }),
      ).rejects.toThrow();

      // Mismatching confirmation
      await expect(
        changeAccountPassword("user_1", {
          currentPassword: "CurrentPassword1!",
          newPassword: "ValidNewPass123!",
          confirmPassword: "DifferentNewPass123!",
        }),
      ).rejects.toThrow();
    });

    it("changeAccountPassword hashes new password and records audit on success", async () => {
      const currentHash = await bcrypt.hash("CurrentPassword1!", 10);
      const mockUser = {
        id: "user_1",
        passwordHash: currentHash,
      };

      const mockTx = {
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockUser),
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      const res = await changeAccountPassword("user_1", {
        currentPassword: "CurrentPassword1!",
        newPassword: "BrandNewSecurePassword2026!",
        confirmPassword: "BrandNewSecurePassword2026!",
      });

      expect(res.success).toBe(true);
      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user_1" },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
          }),
        }),
      );

      // Verify the new hash is valid
      const updatedHash = mockTx.user.update.mock.calls[0][0].data.passwordHash;
      const isMatch = await bcrypt.compare("BrandNewSecurePassword2026!", updatedHash);
      expect(isMatch).toBe(true);

      // Verify audit log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: "user_1",
            action: "USER_PASSWORD_CHANGED",
            entityType: "User",
          }),
        }),
      );
    });
  });

  /* =========================================================================
   * 2. Administrator Management & Granular Permissions
   * ========================================================================= */
  describe("Administrator Management & Role Safeguards", () => {
    it("listAdministrators lists admins and flags isLastSuperAdmin accurately", async () => {
      const mockUsers = [
        {
          id: "super_1",
          email: "super@platform.tn",
          firstName: "Super",
          lastName: "Admin",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "admin_limited_1",
          email: "catalogue.admin@platform.tn",
          firstName: "Catalog",
          lastName: "Manager",
          role: "ADMIN",
          status: "ACTIVE",
          createdAt: new Date("2025-02-01"),
        },
      ];

      vi.spyOn(prisma.user, "findMany").mockResolvedValue(mockUsers as never);
      vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue({
        value: {
          admin_limited_1: ["VIEW_PRODUCTS", "MANAGE_PRODUCTS"],
        },
      } as never);

      const result = await listAdministrators();
      expect(result.admins).toHaveLength(2);
      expect(result.activeSuperAdminCount).toBe(1);

      // Since activeSuperAdminCount is 1, super_1 is marked as isLastSuperAdmin
      const superAdminItem = result.admins.find((a) => a.id === "super_1");
      expect(superAdminItem?.isLastSuperAdmin).toBe(true);
      expect(superAdminItem?.permissions.length).toBeGreaterThan(5);

      // Limited admin has granular permissions
      const limitedAdmin = result.admins.find((a) => a.id === "admin_limited_1");
      expect(limitedAdmin?.isLastSuperAdmin).toBe(false);
      expect(limitedAdmin?.permissions).toEqual(["VIEW_PRODUCTS", "MANAGE_PRODUCTS"]);
    });

    it("createAdministrator rejects duplicate email", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "existing_user",
        email: "existing@test.tn",
      } as never);

      await expect(
        createAdministrator("actor_super", {
          firstName: "Jean",
          lastName: "Dupont",
          email: "existing@test.tn",
          password: "SecurePassword123!",
          role: "ADMIN",
          permissions: ["VIEW_PRODUCTS"],
        }),
      ).rejects.toThrow("Un compte existe déjà avec cette adresse e-mail.");
    });

    it("createAdministrator creates ADMIN with granular permissions in settings and records audit", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const mockTx = {
        user: {
          create: vi.fn().mockResolvedValue({
            id: "new_admin_id",
            email: "new.admin@platform.tn",
            role: "ADMIN",
          }),
        },
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      const res = await createAdministrator("actor_super", {
        firstName: "Marc",
        lastName: "Logistics",
        email: "marc@platform.tn",
        password: "ValidAdminPassword123!",
        role: "ADMIN",
        permissions: ["VIEW_ORDERS", "MANAGE_ORDERS"],
      });

      expect(res.id).toBe("new_admin_id");
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "marc@platform.tn",
            role: "ADMIN",
            status: "ACTIVE",
          }),
        }),
      );

      // Check permissions saved in setting
      expect(mockTx.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS },
          create: expect.objectContaining({
            value: {
              new_admin_id: ["VIEW_ORDERS", "MANAGE_ORDERS"],
            },
          }),
        }),
      );

      // Check audit log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: "actor_super",
            action: "ADMIN_USER_CREATED",
            entityId: "new_admin_id",
          }),
        }),
      );
    });

    it("updateAdministrator prevents demoting or disabling the last active Super Admin", async () => {
      const mockTarget = {
        id: "only_super_admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        firstName: "Root",
        lastName: "Admin",
      };

      const mockTx = {
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockTarget),
          count: vi.fn().mockResolvedValue(1), // Only 1 active super admin!
          update: vi.fn(),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      // Attempt demotion to ADMIN
      await expect(
        updateAdministrator("actor_super", {
          adminId: "only_super_admin",
          firstName: "Root",
          lastName: "Admin",
          role: "ADMIN",
          status: "ACTIVE",
          permissions: [],
        }),
      ).rejects.toThrow("Impossible de rétrograder le dernier Super Admin actif de la plateforme.");

      // Attempt deactivation
      await expect(
        updateAdministrator("actor_super", {
          adminId: "only_super_admin",
          firstName: "Root",
          lastName: "Admin",
          role: "SUPER_ADMIN",
          status: "DISABLED",
          permissions: [],
        }),
      ).rejects.toThrow("Impossible de désactiver le dernier Super Admin actif de la plateforme.");
    });

    it("toggleAdminStatus prevents suspending the last active Super Admin", async () => {
      const mockTarget = {
        id: "only_super_admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      };

      const mockTx = {
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockTarget),
          count: vi.fn().mockResolvedValue(1),
          update: vi.fn(),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      await expect(
        toggleAdminStatus("actor_super", "only_super_admin", "DISABLED"),
      ).rejects.toThrow("Impossible de désactiver le dernier Super Admin actif de la plateforme.");
    });

    it("toggleAdminStatus successfully suspends an admin when safe and records audit", async () => {
      const mockTarget = {
        id: "regular_admin",
        role: "ADMIN",
        status: "ACTIVE",
      };

      const mockTx = {
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockTarget),
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      const res = await toggleAdminStatus("actor_super", "regular_admin", "DISABLED");
      expect(res.success).toBe(true);
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: "regular_admin" },
        data: { status: "DISABLED" },
      });
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ADMIN_STATUS_CHANGED",
            entityId: "regular_admin",
          }),
        }),
      );
    });

    it("resetAdminPassword validates strength and updates password hash", async () => {
      // Reject weak password
      await expect(
        resetAdminPassword("actor_super", "admin_1", "weak"),
      ).rejects.toThrow("Le mot de passe doit comporter au moins 8 caractères.");

      const mockTx = {
        user: {
          update: vi.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: unknown) => {
        return (callback as TransactionCallback)(mockTx) as never;
      });

      const res = await resetAdminPassword("actor_super", "admin_1", "NewSuperAdminPass2026!");
      expect(res.success).toBe(true);

      const updatedHash = mockTx.user.update.mock.calls[0][0].data.passwordHash;
      const isMatch = await bcrypt.compare("NewSuperAdminPass2026!", updatedHash);
      expect(isMatch).toBe(true);
    });
  });

  /* =========================================================================
   * 3. Permissions Evaluation Engine (hasPermission)
   * ========================================================================= */
  describe("Granular Permissions Evaluation Engine", () => {
    it("SUPER_ADMIN always has all permissions", async () => {
      const superAdminUser = {
        id: "super_admin_id",
        email: "super@platform.tn",
        role: "SUPER_ADMIN" as const,
      };

      for (const perm of Object.values(PERMISSIONS)) {
        const allowed = await hasPermission(superAdminUser, perm);
        expect(allowed).toBe(true);
      }
    });

    it("ADMIN has only explicitly granted permissions from system settings", async () => {
      const adminUser = {
        id: "admin_catalog_id",
        email: "catalog@platform.tn",
        role: "ADMIN" as const,
      };

      vi.spyOn(prisma.systemSetting, "findUnique").mockResolvedValue({
        key: SETTING_KEYS.ADMIN_PERMISSION_GRANTS,
        value: {
          admin_catalog_id: ["VIEW_PRODUCTS", "MANAGE_PRODUCTS"],
        },
      } as never);

      const canViewProducts = await hasPermission(adminUser, "VIEW_PRODUCTS");
      const canManageProducts = await hasPermission(adminUser, "MANAGE_PRODUCTS");
      const canManageFinance = await hasPermission(adminUser, "MANAGE_FINANCE");
      const canViewSettings = await hasPermission(adminUser, "MANAGE_SETTINGS");

      expect(canViewProducts).toBe(true);
      expect(canManageProducts).toBe(true);
      expect(canManageFinance).toBe(false);
      expect(canViewSettings).toBe(false);
    });
  });
});
