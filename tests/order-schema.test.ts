import { describe, expect, it } from "vitest";
import {
  CONFIRMATION_TEXT,
  createOrderSchema,
  normalizePhone,
} from "@/modules/orders/schemas";

const validInput = {
  productId: "prod1",
  quantity: "2",
  sellingPrice: "50",
  customerFullName: "Ahmed Ben Ali",
  phone: "+216 22 333 444",
  governorate: "Tunis",
  city: "Ariana",
  address: "10 rue de Paris",
  notes: "",
  confirmed: "on" as const,
};

describe("phone normalization (dedup key)", () => {
  it("strips +216 and separators", () => {
    expect(normalizePhone("+216 22 333 444")).toBe("22333444");
    expect(normalizePhone("22 333 444")).toBe("22333444");
    expect(normalizePhone("0021622333444")).toBe("22333444");
    expect(normalizePhone("22333444")).toBe("22333444");
  });
});

describe("createOrderSchema — CRITICAL confirmation checkbox (spec §33.2)", () => {
  it("accepts a fully valid order with confirmation", () => {
    const r = createOrderSchema.safeParse(validInput);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("22333444");
  });

  it("REJECTS when the confirmation checkbox is missing", () => {
    const { confirmed: _omitted, ...rest } = validInput;
    const r = createOrderSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain(
        "client a accepté la commande",
      );
    }
  });

  it("REJECTS an empty (unchecked) confirmation", () => {
    const r = createOrderSchema.safeParse({ ...validInput, confirmed: "" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid Tunisian phone", () => {
    const r = createOrderSchema.safeParse({ ...validInput, phone: "12345" });
    expect(r.success).toBe(false);
  });

  it("rejects quantity < 1", () => {
    const r = createOrderSchema.safeParse({ ...validInput, quantity: "0" });
    expect(r.success).toBe(false);
  });

  it("exposes the exact confirmation wording", () => {
    expect(CONFIRMATION_TEXT).toBe(
      "Je confirme que le client a accepté la commande et les conditions de livraison.",
    );
  });
});
