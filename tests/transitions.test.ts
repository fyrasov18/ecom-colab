import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  checkTransition,
  TERMINAL_STATUSES,
  type ReasonRule,
} from "@/modules/orders/transitions";

/**
 * `checkTransition` returns `{ ok: true, transition: Transition | "RESUME" }`.
 * "RESUME" is a dynamic pseudo-transition (ON_HOLD → statusBeforeHold) and has
 * no reason rule, so the tests narrow it out before asserting on `reason`.
 */
function reasonOf(check: ReturnType<typeof checkTransition>): ReasonRule | null {
  if (!check.ok) return null;
  if (check.transition === "RESUME") return null;
  return check.transition.reason;
}

describe("order state machine — spec §4", () => {
  it("allows the canonical happy path for ADMIN", () => {
    const path = [
      "CONFIRMED",
      "VALIDATED",
      "PREPARING",
      "PACKAGED",
      "SHIPPED",
      "IN_DELIVERY",
      "DELIVERED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      const check = checkTransition(path[i], path[i + 1], "ADMIN", null);
      expect(check.ok, `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it("FORBIDS a partner from touching fulfilment statuses (Rule 4)", () => {
    // Partner may only cancel a CONFIRMED order.
    expect(checkTransition("CONFIRMED", "VALIDATED", "PARTNER", null).ok).toBe(false);
    expect(checkTransition("VALIDATED", "PREPARING", "PARTNER", null).ok).toBe(false);
    expect(checkTransition("IN_DELIVERY", "DELIVERED", "PARTNER", null).ok).toBe(false);
    expect(checkTransition("CONFIRMED", "CANCELLED", "PARTNER", null).ok).toBe(true);
    expect(checkTransition("CONFIRMED", "DELIVERED", "PARTNER", null).ok).toBe(false);
  });

  it("forbids skipping stages", () => {
    expect(checkTransition("CONFIRMED", "SHIPPED", "ADMIN", null).ok).toBe(false);
    expect(checkTransition("CONFIRMED", "DELIVERED", "ADMIN", null).ok).toBe(false);
    expect(checkTransition("PREPARING", "IN_DELIVERY", "ADMIN", null).ok).toBe(false);
  });

  it("forbids going backwards in the pipeline", () => {
    expect(checkTransition("PACKAGED", "VALIDATED", "ADMIN", null).ok).toBe(false);
    expect(checkTransition("DELIVERED", "SHIPPED", "ADMIN", null).ok).toBe(false);
  });

  it("requires a reason for ON_HOLD / REFUSED / RETURNED / CANCELLED", () => {
    const hold = checkTransition("VALIDATED", "ON_HOLD", "ADMIN", null);
    expect(reasonOf(hold)).toBe("REQUIRED");
    const refuse = checkTransition("IN_DELIVERY", "REFUSED", "ADMIN", null);
    expect(reasonOf(refuse)).toBe("REQUIRED");
    const cancel = checkTransition("CONFIRMED", "CANCELLED", "PARTNER", null);
    expect(reasonOf(cancel)).toBe("REQUIRED");
    const validate = checkTransition("CONFIRMED", "VALIDATED", "ADMIN", null);
    expect(reasonOf(validate)).toBe("NONE");
  });

  it("resumes ON_HOLD back to the stage it was held from", () => {
    const check = checkTransition("ON_HOLD", "IN_DELIVERY", "ADMIN", "IN_DELIVERY");
    expect(check.ok).toBe(true);
    // …but not to an arbitrary stage
    expect(checkTransition("ON_HOLD", "SHIPPED", "ADMIN", "IN_DELIVERY").ok).toBe(false);
    // Partner cannot resume
    expect(checkTransition("ON_HOLD", "IN_DELIVERY", "PARTNER", "IN_DELIVERY").ok).toBe(false);
  });

  it("terminal states accept no transitions", () => {
    for (const t of TERMINAL_STATUSES) {
      expect(availableTransitions(t, "ADMIN", null)).toHaveLength(0);
      expect(availableTransitions(t, "SUPER_ADMIN", null)).toHaveLength(0);
    }
    // DELIVERED left the terminal set in Phase 5 (operator can still return it).
    expect(TERMINAL_STATUSES).not.toContain("DELIVERED");
  });

  it("admin cancellation is only possible before shipping (restock ≤ PACKAGED)", () => {
    expect(checkTransition("PACKAGED", "CANCELLED", "ADMIN", null).ok).toBe(true);
    expect(checkTransition("SHIPPED", "CANCELLED", "ADMIN", null).ok).toBe(false);
    expect(checkTransition("IN_DELIVERY", "CANCELLED", "ADMIN", null).ok).toBe(false);
  });

  it("partner available transitions from CONFIRMED = cancel only", () => {
    const list = availableTransitions("CONFIRMED", "PARTNER", null);
    expect(list.map((t) => t.to)).toEqual(["CANCELLED"]);
  });

  it("allows an operator to convert a DELIVERED order into REFUSED/RETURNED (Phase 5 extension)", () => {
    // Documented extension: the settlement window exists precisely because a
    // delivered order can still come back — this is the only way in.
    const refuse = checkTransition("DELIVERED", "REFUSED", "ADMIN", null);
    expect(refuse.ok).toBe(true);
    expect(reasonOf(refuse)).toBe("REQUIRED");
    const returned = checkTransition("DELIVERED", "RETURNED", "ADMIN", null);
    expect(reasonOf(returned)).toBe("REQUIRED");

    expect(
      availableTransitions("DELIVERED", "ADMIN", null)
        .map((t) => t.to)
        .sort(),
    ).toEqual(["REFUSED", "RETURNED"]);

    // Partners can never trigger a return/refusal themselves.
    expect(checkTransition("DELIVERED", "REFUSED", "PARTNER", null).ok).toBe(false);
    expect(checkTransition("DELIVERED", "RETURNED", "PARTNER", null).ok).toBe(false);
  });
});
