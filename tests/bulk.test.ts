import { describe, expect, it } from "vitest";
import { BULK_ALLOWED_TARGETS, isBulkTargetAllowed } from "@/modules/logistics/bulk";

describe("bulk operations safety (spec §19)", () => {
  it("allows forward pipeline moves in bulk", () => {
    for (const to of ["VALIDATED", "PREPARING", "PACKAGED", "SHIPPED", "IN_DELIVERY", "DELIVERED"]) {
      expect(isBulkTargetAllowed(to)).toBe(true);
    }
  });

  it("FORBIDS bulk for transitions needing individual reasons", () => {
    for (const to of ["ON_HOLD", "REFUSED", "RETURNED", "CANCELLED", "CONFIRMED"]) {
      expect(isBulkTargetAllowed(to)).toBe(false);
    }
  });

  it("never lets bulk target exceed the forward list", () => {
    expect(BULK_ALLOWED_TARGETS).not.toContain("CANCELLED" as never);
    expect(BULK_ALLOWED_TARGETS.length).toBe(6);
  });
});
