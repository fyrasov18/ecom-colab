import { describe, expect, it, vi, beforeEach } from "vitest";
import { deleteLogoUpload, verifyImageMagicBytes, validateLogoUpload } from "@/modules/branding/storage";
import { savePartnerCompanyBrandingAction } from "@/app/(partner)/mon-entreprise/actions";
import { savePlatformBrandingAction, saveDashboardDesignAction } from "@/app/(admin)/parametres/design/actions";
import { requireSession } from "@/lib/rbac";
import { requirePermission } from "@/lib/permissions";

// Mock dependencies
vi.mock("@/lib/rbac", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  requirePermission: vi.fn(),
  PERMISSIONS: {
    MANAGE_PLATFORM_BRANDING: "MANAGE_PLATFORM_BRANDING",
    MANAGE_PARTNER_BRANDING: "MANAGE_PARTNER_BRANDING",
  },
}));

vi.mock("@/modules/branding/service", () => ({
  getPartnerBranding: vi.fn().mockResolvedValue(null),
  updatePartnerBranding: vi.fn().mockImplementation((partnerId, input) => {
    return Promise.resolve({ partnerId, ...input });
  }),
  getPlatformBranding: vi.fn().mockResolvedValue({
    platformName: "EcomPartner",
    platformTagline: "",
    platformDescription: "",
    logoLightUrl: null,
    logoDarkUrl: null,
    logoMarkUrl: null,
    faviconUrl: null,
  }),
  updatePlatformBranding: vi.fn().mockResolvedValue({}),
  updateDashboardDesign: vi.fn().mockResolvedValue({}),
}));

describe("Branding Security & IDOR Defense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks partner company update if partnerId is missing in session", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      id: "user-rogue",
      role: "PARTNER",
      partnerId: null, // No partner profile attached
      email: "rogue@example.com",
      firstName: "Rogue",
      lastName: "User",
    });

    const formData = new FormData();
    formData.append("companyName", "Hacked Boutique");

    const result = await savePartnerCompanyBrandingAction(formData);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("introuvable");
    }
  });

  it("enforces session partnerId and prevents IDOR spoofing of other tenants", async () => {
    const authenticPartnerId = "partner-tenant-42";
    vi.mocked(requireSession).mockResolvedValue({
      id: "user-42",
      role: "PARTNER",
      partnerId: authenticPartnerId,
      email: "partner42@example.com",
      firstName: "Partner",
      lastName: "FortyTwo",
    });

    const formData = new FormData();
    formData.append("companyName", "My Legit Boutique");
    // Attacker tries to inject an arbitrary partnerId in formData
    formData.append("partnerId", "partner-victim-99");

    const result = await savePartnerCompanyBrandingAction(formData);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Must be bound to the session partnerId, NOT the formData injected id
      expect((result.data as { partnerId: string }).partnerId).toBe(authenticPartnerId);
    }
  });

  it("blocks unauthorized users from saving platform branding", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new Error("Action non autorisée : permission MANAGE_PLATFORM_BRANDING requise."),
    );

    const formData = new FormData();
    formData.append("platformName", "Compromised");

    const result = await savePlatformBrandingAction(formData);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Action non autorisée");
    }
  });

  it("blocks unauthorized users from updating dashboard design", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new Error("Action non autorisée : permission MANAGE_PLATFORM_BRANDING requise."),
    );

    const result = await saveDashboardDesignAction({
      primaryColor: "#FF0000",
      secondaryColor: "#000000",
      accentColor: "#00FF00",
      sidebarBg: "#111111",
      borderRadius: "10px",
      themeMode: "dark",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Action non autorisée");
    }
  });
});

describe("Storage Path Traversal & File Spoofing Defense", () => {
  it("safely handles path traversal attempts in deleteLogoUpload", async () => {
    // Attempt directory traversal out of uploads root
    await expect(
      deleteLogoUpload("/uploads/branding/../../../../windows/system32/calc.exe"),
    ).resolves.not.toThrow();

    await expect(
      deleteLogoUpload("/etc/passwd"),
    ).resolves.not.toThrow();
  });

  it("rejects disguised executable binaries with PNG extensions via magic byte inspection", () => {
    // Windows PE executable header: "MZ" (4D 5A)
    const peBinary = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const check = verifyImageMagicBytes(peBinary);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.error).toContain("invalide");
    }
  });

  it("rejects malicious file extensions disguised as images", () => {
    const dangerousExtensions = ["script.php", "malware.exe", "page.html", "code.js", "vector.svg"];

    for (const name of dangerousExtensions) {
      const check = validateLogoUpload({
        fileName: name,
        size: 1024,
        mimeType: "application/octet-stream",
      });
      expect(check.ok).toBe(false);
    }
  });
});
