import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit tests for `isAuthorized` (Telegram user authorisation).
 *
 * Covers the resolution order defined in spec §55:
 *  1. DB row ACTIVE  → authorised
 *  2. DB row DISABLED → denied (explicit revocation beats env var)
 *  3. TELEGRAM_ADMIN_IDS env var → authorised (bootstrap / DR fallback)
 *  4. No match → denied
 */

const findUniqueMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    telegramAuthorizedUser: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
    },
  },
}));

vi.stubGlobal("fetch", vi.fn());

import { isAuthorized } from "@/modules/telegram/service";

function setEnv(ids: string | undefined) {
  if (ids === undefined) {
    delete process.env.TELEGRAM_ADMIN_IDS;
  } else {
    process.env.TELEGRAM_ADMIN_IDS = ids;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TELEGRAM_ADMIN_IDS;
});

describe("isAuthorized — DB row wins", () => {
  it("authorises when DB row is ACTIVE (no env var)", async () => {
    findUniqueMock.mockResolvedValue({ status: "ACTIVE" });
    expect(await isAuthorized("98764677")).toBe(true);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { telegramUserId: "98764677" },
      select: { status: true },
    });
  });

  it("denies when DB row is DISABLED (explicit revocation)", async () => {
    findUniqueMock.mockResolvedValue({ status: "DISABLED" });
    expect(await isAuthorized("98764677")).toBe(false);
  });

  it("denies when DB row is DISABLED even if user is in TELEGRAM_ADMIN_IDS", async () => {
    setEnv("98764677,26460677");
    findUniqueMock.mockResolvedValue({ status: "DISABLED" });
    expect(await isAuthorized("98764677")).toBe(false);
  });
});

describe("isAuthorized — no DB row, falls back to env var", () => {
  beforeEach(() => {
    findUniqueMock.mockResolvedValue(null);
  });

  it("authorises when TELEGRAM_ADMIN_IDS contains the user id", async () => {
    setEnv("98764677,26460677");
    expect(await isAuthorized("98764677")).toBe(true);
    expect(await isAuthorized("26460677")).toBe(true);
  });

  it("denies when TELEGRAM_ADMIN_IDS does not contain the user id", async () => {
    setEnv("98764677");
    expect(await isAuthorized("11111111")).toBe(false);
  });

  it("denies when TELEGRAM_ADMIN_IDS is empty", async () => {
    setEnv("");
    expect(await isAuthorized("98764677")).toBe(false);
  });

  it("denies when TELEGRAM_ADMIN_IDS is unset", async () => {
    setEnv(undefined);
    expect(await isAuthorized("98764677")).toBe(false);
  });

  it("ignores whitespace around comma-separated ids", async () => {
    setEnv(" 98764677 , 26460677 ");
    expect(await isAuthorized("98764677")).toBe(true);
    expect(await isAuthorized("26460677")).toBe(true);
  });

  it("rejects non-numeric segments in TELEGRAM_ADMIN_IDS", async () => {
    setEnv("abc,98764677");
    expect(await isAuthorized("98764677")).toBe(true);
    expect(await isAuthorized("abc")).toBe(false);
  });

  it("treats ids as strings (leading zeros preserved)", async () => {
    setEnv("098764677");
    expect(await isAuthorized("098764677")).toBe(true);
    expect(await isAuthorized("98764677")).toBe(false);
  });
});

describe("isAuthorized — unknown user with no env fallback", () => {
  beforeEach(() => {
    findUniqueMock.mockResolvedValue(null);
    setEnv(undefined);
  });

  it("denies a user never added through the admin panel", async () => {
    expect(await isAuthorized("123456789")).toBe(false);
  });

  it("denies /start for an unapproved user", async () => {
    expect(await isAuthorized("555")).toBe(false);
  });
});
