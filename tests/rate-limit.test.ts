import { describe, it, expect, beforeEach } from "vitest";
import {
  RATE_LIMITS,
  __resetRateLimit,
  checkRateLimit,
  clientIpFrom,
  rateLimitKey,
  rateLimitMessage,
} from "@/lib/rate-limit";

beforeEach(() => {
  __resetRateLimit();
});

describe("checkRateLimit — fixed window", () => {
  it("allows calls up to the limit", async () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    for (let i = 1; i <= RATE_LIMITS.WITHDRAWAL_REQUEST.limit; i += 1) {
      const d = await checkRateLimit("WITHDRAWAL_REQUEST", "p1", now);
      expect(d.allowed).toBe(true);
      expect(d.remaining).toBe(RATE_LIMITS.WITHDRAWAL_REQUEST.limit - i);
    }
  });

  it("blocks the call that exceeds the limit", async () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    for (let i = 0; i < RATE_LIMITS.WITHDRAWAL_REQUEST.limit; i += 1) {
      await checkRateLimit("WITHDRAWAL_REQUEST", "p1", now);
    }
    const blocked = await checkRateLimit("WITHDRAWAL_REQUEST", "p1", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("keeps identities independent (no cross-user leakage)", async () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    for (let i = 0; i < RATE_LIMITS.WITHDRAWAL_REQUEST.limit; i += 1) {
      await checkRateLimit("WITHDRAWAL_REQUEST", "p1", now);
    }
    expect((await checkRateLimit("WITHDRAWAL_REQUEST", "p1", now)).allowed).toBe(
      false,
    );
    // A different partner must be completely unaffected.
    expect((await checkRateLimit("WITHDRAWAL_REQUEST", "p2", now)).allowed).toBe(
      true,
    );
  });

  it("keeps kinds independent for the same identity", async () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    for (let i = 0; i < RATE_LIMITS.WITHDRAWAL_REQUEST.limit; i += 1) {
      await checkRateLimit("WITHDRAWAL_REQUEST", "same", now);
    }
    expect(
      (await checkRateLimit("SEARCH", "same", now)).allowed,
    ).toBe(true);
  });

  it("resets once the window rolls over", async () => {
    const start = new Date("2026-01-01T10:00:00.000Z");
    for (let i = 0; i < RATE_LIMITS.WITHDRAWAL_REQUEST.limit; i += 1) {
      await checkRateLimit("WITHDRAWAL_REQUEST", "p1", start);
    }
    expect(
      (await checkRateLimit("WITHDRAWAL_REQUEST", "p1", start)).allowed,
    ).toBe(false);

    // Move past the window.
    const later = new Date(
      start.getTime() + RATE_LIMITS.WITHDRAWAL_REQUEST.windowSeconds * 1000 + 1,
    );
    expect((await checkRateLimit("WITHDRAWAL_REQUEST", "p1", later)).allowed).toBe(
      true,
    );
  });

  it("reports a positive retryAfterSeconds", async () => {
    const d = await checkRateLimit(
      "SEARCH",
      "x",
      new Date("2026-01-01T10:00:00.000Z"),
    );
    expect(d.retryAfterSeconds).toBeGreaterThan(0);
    expect(d.retryAfterSeconds).toBeLessThanOrEqual(
      RATE_LIMITS.SEARCH.windowSeconds,
    );
  });
});

describe("clientIpFrom", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIpFrom(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("returns 'unknown' when nothing is present (never throws)", () => {
    expect(clientIpFrom(new Headers())).toBe("unknown");
    expect(clientIpFrom(undefined)).toBe("unknown");
  });
});

describe("rateLimitKey", () => {
  it("namespaces by kind so buckets cannot collide", () => {
    expect(rateLimitKey("LOGIN", "1.2.3.4")).not.toBe(
      rateLimitKey("LOGIN_ACCOUNT", "1.2.3.4"),
    );
  });
});

describe("rateLimitMessage", () => {
  it("uses seconds for short waits and minutes otherwise", async () => {
    const short = {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
    };
    expect(rateLimitMessage(short)).toContain("30 secondes");

    const long = {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 300,
    };
    expect(rateLimitMessage(long)).toContain("minute");
  });
});
