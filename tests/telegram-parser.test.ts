import { describe, it, expect } from "vitest";
import {
  isOptionalStep,
  parseCommand,
  parseCompactProduct,
  stepAfter,
  validateProductEconomics,
  validateStepInput,
  type TelegramStep,
} from "@/modules/telegram/parser";

describe("parseCommand", () => {
  it("parses the MVP commands", () => {
    expect(parseCommand("/start")?.command).toBe("start");
    expect(parseCommand("/newproduct")?.command).toBe("newproduct");
    expect(parseCommand("/cancel")?.command).toBe("cancel");
    expect(parseCommand("/help")?.command).toBe("help");
  });

  it("accepts the @botname suffix Telegram appends in groups", () => {
    expect(parseCommand("/newproduct@EcomColabBot")?.command).toBe("newproduct");
  });

  it("is case-insensitive and recognises /done as the confirm alias", () => {
    expect(parseCommand("/HELP")?.command).toBe("help");
    expect(parseCommand("/done")?.command).toBe("done");
  });

  it("captures inline args", () => {
    expect(parseCommand("/newproduct Nom: Lampe Prix: 50")?.args).toBe(
      "Nom: Lampe Prix: 50",
    );
  });

  it("returns null for plain text or unknown commands", () => {
    expect(parseCommand("bonjour")).toBeNull();
    expect(parseCommand("/products")).toBeNull();
    expect(parseCommand("/drop table")).toBeNull();
  });
});

describe("stepAfter — wizard ordering", () => {
  it("walks the full sequence and ends on IDLE", () => {
    let step: TelegramStep = "NAME";
    const seen: TelegramStep[] = [step];
    for (let i = 0; i < 8; i += 1) {
      step = stepAfter(step);
      seen.push(step);
    }
    expect(seen).toEqual([
      "NAME",
      "DESCRIPTION",
      "PURCHASE_COST",
      "SELLING_PRICE",
      "STOCK",
      "SKU",
      "CATEGORY",
      "SUPPLIER_REF",
      "CONFIRM",
    ]);
    expect(stepAfter("CONFIRM")).toBe("IDLE");
  });

  it("marks only SKU/CATEGORY/SUPPLIER_REF as optional", () => {
    expect(isOptionalStep("SKU")).toBe(true);
    expect(isOptionalStep("CATEGORY")).toBe(true);
    expect(isOptionalStep("SUPPLIER_REF")).toBe(true);
    expect(isOptionalStep("NAME")).toBe(false);
    expect(isOptionalStep("SELLING_PRICE")).toBe(false);
  });
});

describe("validateStepInput — money & stock (injection-resistant)", () => {
  it("accepts a plain amount", () => {
    expect(validateStepInput("PURCHASE_COST", "20")).toEqual({
      ok: true,
      value: "20",
      number: 20,
    });
  });

  it("accepts decimals and French decimal commas", () => {
    expect(validateStepInput("SELLING_PRICE", "49.990")).toMatchObject({
      number: 49.99,
    });
    expect(validateStepInput("SELLING_PRICE", "49,99")).toMatchObject({
      number: 49.99,
    });
  });

  it("rejects free text, scripts and negative values", () => {
    expect(validateStepInput("PURCHASE_COST", "abc").ok).toBe(false);
    expect(validateStepInput("PURCHASE_COST", "-5").ok).toBe(false);
    expect(validateStepInput("PURCHASE_COST", "0").ok).toBe(false);
    expect(
      validateStepInput("PURCHASE_COST", "<script>alert(1)</script>").ok,
    ).toBe(false);
    expect(validateStepInput("PURCHASE_COST", "20; DROP TABLE").ok).toBe(false);
  });

  it("rejects absurd amounts and >3-decimal precision", () => {
    expect(validateStepInput("SELLING_PRICE", "99999999").ok).toBe(false);
    expect(validateStepInput("SELLING_PRICE", "12.3456").ok).toBe(false);
  });

  it("validates stock as a non-negative integer", () => {
    expect(validateStepInput("STOCK", "150")).toMatchObject({ number: 150 });
    expect(validateStepInput("STOCK", "0")).toMatchObject({ number: 0 });
    expect(validateStepInput("STOCK", "-3").ok).toBe(false);
    expect(validateStepInput("STOCK", "10.5").ok).toBe(false);
  });

  it("requires a name and bounds its length", () => {
    expect(validateStepInput("NAME", "Lampe").ok).toBe(true);
    expect(validateStepInput("NAME", "   ").ok).toBe(false);
    expect(validateStepInput("NAME", "x".repeat(300)).ok).toBe(false);
  });

  it("lets optional steps be skipped with a blank answer", () => {
    expect(validateStepInput("SKU", "")).toEqual({ ok: true, value: "" });
    expect(validateStepInput("NAME", "").ok).toBe(false);
  });
});
describe("parseCompactProduct", () => {
  it("parses the documented compact format", () => {
    const r = parseCompactProduct(
      "Nom: Lampe LED\nCost: 20\nPrix: 50\nStock: 12\nDescription: Belle lampe",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.product).toMatchObject({
        name: "Lampe LED",
        purchaseCost: 20,
        sellingPrice: 50,
        stock: 12,
        description: "Belle lampe",
      });
    }
  });

  it("parses optional fields when present", () => {
    const r = parseCompactProduct(
      "Nom: X\nCost: 1\nPrix: 2\nStock: 3\nSKU: AB-1\nCategorie: Maison\nFournisseur: F1",
    );
    expect(r.ok && r.product).toMatchObject({
      sku: "AB-1",
      category: "Maison",
      supplierRef: "F1",
    });
  });

  it("reports exactly which required field is missing", () => {
    const r = parseCompactProduct("Nom: X\nCost: 1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("sellingPrice");
  });

  it("refuses free text that has no Key: value lines", () => {
    // Guards against reading a price out of a sentence.
    const r = parseCompactProduct("je voudrais un produit à 50 dinars");
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid value and points at the field", () => {
    const r = parseCompactProduct("Nom: X\nCost: abc\nPrix: 10\nStock: 1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("purchaseCost");
  });
});

describe("validateProductEconomics", () => {
  it("accepts a sane price", () => {
    expect(
      validateProductEconomics({ purchaseCost: 20, sellingPrice: 50 }).ok,
    ).toBe(true);
  });

  it("flags a selling price below the product cost", () => {
    const r = validateProductEconomics({ purchaseCost: 50, sellingPrice: 20 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("inférieur au coût");
  });

  it("rejects a non-positive selling price", () => {
    expect(
      validateProductEconomics({ purchaseCost: 10, sellingPrice: 0 }).ok,
    ).toBe(false);
  });
});
