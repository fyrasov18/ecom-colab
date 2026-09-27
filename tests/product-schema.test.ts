import { describe, expect, it } from "vitest";
import { productSchema, slugify } from "@/modules/products/schemas";

const validInput = {
  name: "Mini Machine à Laver",
  description: "Compact",
  purchaseCost: 180,
  packagingCost: 2,
  deliveryCost: 7,
  sellingPrice: 320,
  stockQuantity: 45,
  lowStockThreshold: 10,
  status: "ACTIVE" as const,
  commissionType: null,
  commissionValue: null,
};

describe("productSchema", () => {
  it("accepts a valid product", () => {
    expect(productSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a selling price ≤ 0", () => {
    const r = productSchema.safeParse({ ...validInput, sellingPrice: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects a type without a value", () => {
    const r = productSchema.safeParse({
      ...validInput,
      commissionType: "PERCENTAGE",
      commissionValue: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a percentage above 100", () => {
    const r = productSchema.safeParse({
      ...validInput,
      commissionType: "PERCENTAGE",
      commissionValue: 150,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a percentage within bounds", () => {
    const r = productSchema.safeParse({
      ...validInput,
      commissionType: "PERCENTAGE",
      commissionValue: 60,
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative costs", () => {
    const r = productSchema.safeParse({ ...validInput, purchaseCost: -1 });
    expect(r.success).toBe(false);
  });
});

describe("slugify", () => {
  it("normalizes accents and separators", () => {
    expect(slugify("Mini Machine à Laver!")).toBe("mini-machine-a-laver");
    expect(slugify("  Écouteurs  Sans-Fil  ")).toBe("ecouteurs-sans-fil");
  });

  it("never produces empty slugs", () => {
    expect(slugify("???")).toBe("");
  });
});
