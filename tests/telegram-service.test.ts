import { describe, it, expect, beforeEach, vi } from "vitest";

const prismaMock = {
  telegramAuthorizedUser: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    telegramAuthorizedUser: {
      findUnique: (...args: unknown[]) =>
        prismaMock.telegramAuthorizedUser.findUnique(...args),
    },
  },
}));

// Mock audit and notifications to avoid unneeded imports
vi.mock("@/modules/audit/service", () => ({
  recordAudit: vi.fn(),
}));

vi.mock("@/modules/notifications/service", () => ({
  notifyBackOffice: vi.fn(),
}));

import { isAuthorized } from "@/modules/telegram/service";

describe("Telegram service — isAuthorized resolution logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TELEGRAM_ADMIN_IDS;
  });

  it("returns true when database row has status ACTIVE", async () => {
    prismaMock.telegramAuthorizedUser.findUnique.mockResolvedValue({
      status: "ACTIVE",
    });

    const result = await isAuthorized("98764677");
    expect(result).toBe(true);
    expect(prismaMock.telegramAuthorizedUser.findUnique).toHaveBeenCalledWith({
      where: { telegramUserId: "98764677" },
      select: { status: true },
    });
  });

  it("returns false when database row has status DISABLED", async () => {
    prismaMock.telegramAuthorizedUser.findUnique.mockResolvedValue({
      status: "DISABLED",
    });

    const result = await isAuthorized("98764677");
    expect(result).toBe(false);
  });

  it("denies access when DB row is DISABLED even if ID is listed in TELEGRAM_ADMIN_IDS (revocation takes precedence)", async () => {
    process.env.TELEGRAM_ADMIN_IDS = "98764677, 26460677";
    prismaMock.telegramAuthorizedUser.findUnique.mockResolvedValue({
      status: "DISABLED",
    });

    const result = await isAuthorized("98764677");
    expect(result).toBe(false);
  });

  it("falls back to TELEGRAM_ADMIN_IDS when no DB record exists", async () => {
    process.env.TELEGRAM_ADMIN_IDS = "98764677, 26460677";
    prismaMock.telegramAuthorizedUser.findUnique.mockResolvedValue(null);

    const result1 = await isAuthorized("98764677");
    const result2 = await isAuthorized("26460677");
    const result3 = await isAuthorized("99999999");

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(false);
  });

  it("returns false when no DB record exists and TELEGRAM_ADMIN_IDS is unset or empty", async () => {
    prismaMock.telegramAuthorizedUser.findUnique.mockResolvedValue(null);

    expect(await isAuthorized("98764677")).toBe(false);

    process.env.TELEGRAM_ADMIN_IDS = "";
    expect(await isAuthorized("98764677")).toBe(false);

    process.env.TELEGRAM_ADMIN_IDS = "   ";
    expect(await isAuthorized("98764677")).toBe(false);
  });

  it("safely ignores malformed tokens in TELEGRAM_ADMIN_IDS", async () => {
    process.env.TELEGRAM_ADMIN_IDS = "not-a-number, 98764677, , abc123";
    prismaMock.telegramAuthorizedUser.findUnique.mockResolvedValue(null);

    expect(await isAuthorized("98764677")).toBe(true);
    expect(await isAuthorized("not-a-number")).toBe(false);
    expect(await isAuthorized("abc123")).toBe(false);
  });
});
