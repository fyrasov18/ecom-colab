import { describe, it, expect } from "vitest";

describe("Order Tracking Navigation & Independent Icon (Requirement 2)", () => {
  it("verifies PARTNER_NAV has separate entries and icons for 'Mes commandes' and 'Suivi des commandes'", async () => {
    // Read app-shell directly to verify navigation structure
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/components/layout/app-shell.tsx"),
      "utf-8"
    );

    // Verify ShoppingCart is preserved for Mes commandes (literal or localized via t)
    expect(content).toMatch(
      /\{\s*href:\s*["']\/mes-commandes["'],\s*label:\s*(?:["']Mes commandes["']|t\(["']nav\.myOrders["']\)),\s*icon:\s*ShoppingCart\s*\}/
    );

    // Verify Truck icon is used for Suivi des commandes (literal or localized via t)
    expect(content).toMatch(
      /\{\s*href:\s*["']\/suivi-commandes["'],\s*label:\s*(?:["']Suivi des commandes["']|t\(["']nav\.orderTracking["']\)),\s*icon:\s*Truck\s*\}/
    );

    // Verify Suivi des commandes is located under the 'Suivi' group (or t("nav.tracking"))
    const suiviGroupMatch = content.match(/label:\s*(?:["']Suivi["']|t\(["']nav\.tracking["']\))[\s\S]*?items:\s*\[([\s\S]*?)\]/);
    expect(suiviGroupMatch).not.toBeNull();
    expect(suiviGroupMatch![1]).toContain("/suivi-commandes");
  });

  it("verifies the page file exists and requires PARTNER role", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pageContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/(partner)/suivi-commandes/page.tsx"),
      "utf-8"
    );

    expect(pageContent).toContain('requireSession(["PARTNER"])');
    expect(pageContent).toContain("PartnerTrackingView");
  });

  it("verifies tracking-view supports trilingual dictionaries (FR, AR, EN)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const viewContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/(partner)/suivi-commandes/tracking-view.tsx"),
      "utf-8"
    );

    expect(viewContent).toContain('fr: {');
    expect(viewContent).toContain('ar: {');
    expect(viewContent).toContain('en: {');
    expect(viewContent).toContain('title: "Suivi des commandes"');
    expect(viewContent).toContain('title: "تتبع الطلبات"');
    expect(viewContent).toContain('title: "Order Tracking"');
    expect(viewContent).toContain('dir: "rtl"');
  });
});
