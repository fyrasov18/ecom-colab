import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildReferralUrl, getReferralBaseUrl } from "@/modules/referrals/service";

describe("Referral URL generation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("generates production referral URL for code P001 by default", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.AUTH_URL;

    const url = buildReferralUrl("P001");
    expect(url).toBe("https://ecom-colab.vercel.app/register?ref=P001");
  });

  it("dynamically supports any unique partner code", () => {
    const url = buildReferralUrl("P999_PARTNER");
    expect(url).toBe("https://ecom-colab.vercel.app/register?ref=P999_PARTNER");
  });

  it("uses NEXT_PUBLIC_APP_URL when configured", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://custom-domain.com";
    expect(getReferralBaseUrl()).toBe("https://custom-domain.com");
    expect(buildReferralUrl("P001")).toBe("https://custom-domain.com/register?ref=P001");
  });

  it("safely strips trailing slashes to prevent duplicate slashes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ecom-colab.vercel.app/";
    const url = buildReferralUrl("P001");
    expect(url).toBe("https://ecom-colab.vercel.app/register?ref=P001");
    expect(url).not.toContain("//register");
  });

  it("ignores localhost NEXTAUTH_URL in favor of production domain", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    const url = buildReferralUrl("P001");
    expect(url).toBe("https://ecom-colab.vercel.app/register?ref=P001");
  });

  it("handles whitespace in referral codes cleanly", () => {
    const url = buildReferralUrl("  P123  ");
    expect(url).toBe("https://ecom-colab.vercel.app/register?ref=P123");
  });
});
