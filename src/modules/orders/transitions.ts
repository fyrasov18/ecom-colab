import type { OrderStatus, Role } from "@prisma/client";

/**
 * Order state machine — SINGLE source of truth, enforced server-side.
 * The frontend only mirrors these rules; they are never the only guard.
 *
 * CONFIRMED → VALIDATED → PREPARING → PACKAGED → SHIPPED → IN_DELIVERY
 *   → DELIVERED | REFUSED | RETURNED
 * ON_HOLD from any operational stage (resume returns to statusBeforeHold)
 * CANCELLED: Partner only from CONFIRMED; Admin until PACKAGED (restock).
 */

export type ReasonRule = "REQUIRED" | "NONE";

export type Transition = {
  to: OrderStatus;
  roles: Role[];
  reason: ReasonRule;
  /** CANCELLED restocks the product (only before shipping). */
  restock?: boolean;
};

const OPERATOR: Role[] = ["SUPER_ADMIN", "ADMIN"];
const PARTNER_CANCEL: Role[] = ["SUPER_ADMIN", "ADMIN", "PARTNER"];
const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "PARTNER"];

export const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  CONFIRMED: [
    { to: "VALIDATED", roles: OPERATOR, reason: "NONE" },
    { to: "CANCELLED", roles: PARTNER_CANCEL, reason: "REQUIRED", restock: true },
  ],
  VALIDATED: [
    { to: "PREPARING", roles: OPERATOR, reason: "NONE" },
    { to: "ON_HOLD", roles: OPERATOR, reason: "REQUIRED" },
    { to: "CANCELLED", roles: OPERATOR, reason: "REQUIRED", restock: true },
  ],
  ON_HOLD: [
    // resume → dynamic: back to statusBeforeHold (validated below)
    { to: "CANCELLED", roles: OPERATOR, reason: "REQUIRED", restock: true },
  ],
  PREPARING: [
    { to: "PACKAGED", roles: OPERATOR, reason: "NONE" },
    { to: "ON_HOLD", roles: OPERATOR, reason: "REQUIRED" },
    { to: "CANCELLED", roles: OPERATOR, reason: "REQUIRED", restock: true },
  ],
  PACKAGED: [
    { to: "SHIPPED", roles: OPERATOR, reason: "NONE" },
    { to: "ON_HOLD", roles: OPERATOR, reason: "REQUIRED" },
    { to: "CANCELLED", roles: OPERATOR, reason: "REQUIRED", restock: true },
  ],
  SHIPPED: [{ to: "IN_DELIVERY", roles: OPERATOR, reason: "NONE" }],
  IN_DELIVERY: [
    { to: "DELIVERED", roles: OPERATOR, reason: "NONE" },
    { to: "REFUSED", roles: OPERATOR, reason: "REQUIRED" },
    { to: "RETURNED", roles: OPERATOR, reason: "REQUIRED" },
    { to: "ON_HOLD", roles: OPERATOR, reason: "REQUIRED" },
  ],
  // A delivered order can still come back later (the frozen settlement window
  // exists exactly for that). Financial consequences follow the configured
  // return-cost rule — see modules/finance/ledger.ts.
  DELIVERED: [
    { to: "REFUSED", roles: OPERATOR, reason: "REQUIRED" },
    { to: "RETURNED", roles: OPERATOR, reason: "REQUIRED" },
  ],
  REFUSED: [],
  RETURNED: [],
  CANCELLED: [],
};

export type TransitionCheck =
  | { ok: true; transition: Transition | "RESUME" }
  | { ok: false; error: string };

/**
 * Validates a transition for a role. `statusBeforeHold` is required when
 * the order is ON_HOLD (resume target).
 */
export function checkTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: Role,
  statusBeforeHold: OrderStatus | null,
): TransitionCheck {
  // Resume from ON_HOLD → back to the stage it was held from.
  if (from === "ON_HOLD" && statusBeforeHold && to === statusBeforeHold) {
    if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return { ok: false, error: "Action réservée à l'équipe opérations." };
    }
    return { ok: true, transition: "RESUME" };
  }

  const candidates = TRANSITIONS[from] ?? [];
  const match = candidates.find((t) => t.to === to);
  if (!match) {
    return {
      ok: false,
      error: `Transition interdite : ${from} → ${to}.`,
    };
  }
  if (!match.roles.includes(role)) {
    return {
      ok: false,
      error: `Transition ${from} → ${to} non autorisée pour ce rôle.`,
    };
  }
  return { ok: true, transition: match };
}

/** Transitions legally available for a role from a status (for rendering actions). */
export function availableTransitions(
  from: OrderStatus,
  role: Role,
  statusBeforeHold: OrderStatus | null,
): { to: OrderStatus; reason: ReasonRule; restock?: boolean }[] {
  const list: { to: OrderStatus; reason: ReasonRule; restock?: boolean }[] = (
    TRANSITIONS[from] ?? []
  )
    .filter((t) => t.roles.includes(role))
    .map((t) => ({ to: t.to, reason: t.reason, restock: t.restock }));

  if (from === "ON_HOLD" && statusBeforeHold && ["SUPER_ADMIN", "ADMIN"].includes(role)) {
    list.unshift({ to: statusBeforeHold, reason: "NONE" });
  }
  return list;
}

/**
 * Statuses with no outgoing transition at all.
 * DELIVERED is intentionally NOT terminal anymore (Phase 5): an operator may
 * still record REFUSED/RETURNED afterwards, which is exactly why the partner
 * earning stays PENDING during the settlement window.
 */
export const TERMINAL_STATUSES: OrderStatus[] = [
  "REFUSED",
  "RETURNED",
  "CANCELLED",
];

/** Pipeline step labels (partner timeline). */
export const ORDER_STEP_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmée",
  VALIDATED: "Validée",
  PREPARING: "Préparation",
  PACKAGED: "Emballée",
  SHIPPED: "Expédiée",
  IN_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
};

/** Order pipeline in canonical order (for timeline display). */
export const PIPELINE: OrderStatus[] = [
  "CONFIRMED",
  "VALIDATED",
  "PREPARING",
  "PACKAGED",
  "SHIPPED",
  "IN_DELIVERY",
  "DELIVERED",
];

export { ALL };
