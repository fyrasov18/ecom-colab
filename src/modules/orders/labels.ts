import type { OrderStatus } from "@prisma/client";

/** French labels + badge variants shared by admin and partner UIs. */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CONFIRMED: "Confirmée",
  VALIDATED: "Validée",
  ON_HOLD: "En attente",
  PREPARING: "Préparation",
  PACKAGED: "Emballée",
  SHIPPED: "Expédiée",
  IN_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  REFUSED: "Refusée",
  RETURNED: "Retournée",
  CANCELLED: "Annulée",
};

export type BadgeTone = "success" | "secondary" | "warning" | "destructive" | "info";

/**
 * Semantic colour per status. Each operational stage gets its OWN colour so an
 * operator can read the pipeline at a glance instead of seeing seven blues.
 * (CONFIRMED blue / VALIDATED indigo / PREPARING purple / PACKAGED cyan /
 *  SHIPPED brand / IN_DELIVERY orange / DELIVERED green / ON_HOLD amber /
 *  REFUSED + RETURNED red / CANCELLED grey.)
 */
export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  CONFIRMED: "info",
  VALIDATED: "info",
  ON_HOLD: "warning",
  PREPARING: "info",
  PACKAGED: "info",
  SHIPPED: "info",
  IN_DELIVERY: "warning",
  DELIVERED: "success",
  REFUSED: "destructive",
  RETURNED: "destructive",
  CANCELLED: "secondary",
};

/**
 * Per-status class overrides so each stage is visually distinct rather than
 * collapsing onto the generic `info` badge. Kept next to the tone map so the
 * two never drift apart.
 */
export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  CONFIRMED: "border-transparent bg-info-100 text-info-700",
  VALIDATED: "border-transparent bg-brand-100 text-brand-800",
  ON_HOLD: "border-transparent bg-warning-100 text-warning-700",
  PREPARING: "border-transparent bg-violet-100 text-violet-700",
  PACKAGED: "border-transparent bg-cyan-100 text-cyan-700",
  SHIPPED: "border-transparent bg-brand-100 text-brand-700",
  IN_DELIVERY: "border-transparent bg-orange-100 text-orange-700",
  DELIVERED: "border-transparent bg-success-100 text-success-700",
  REFUSED: "border-transparent bg-danger-100 text-danger-700",
  RETURNED: "border-transparent bg-danger-100 text-danger-700",
  CANCELLED: "border-transparent bg-ink-100 text-ink-600",
};

export const ORDER_FILTER_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "VALIDATED",
  "ON_HOLD",
  "PREPARING",
  "PACKAGED",
  "SHIPPED",
  "IN_DELIVERY",
  "DELIVERED",
  "REFUSED",
  "RETURNED",
  "CANCELLED",
];

/**
 * Plain-language body for the partner notification raised on a status change.
 * Pure so the wording rules stay unit-testable and free of service coupling.
 */
export function buildStatusBody(
  to: OrderStatus,
  from: OrderStatus,
  reason?: string,
): string {
  const move = `Statut : ${ORDER_STATUS_LABELS[from] ?? from} → ${ORDER_STATUS_LABELS[to] ?? to}.`;

  switch (to) {
    case "DELIVERED":
      return `${move} Votre gain est calculé et sera disponible après la période de règlement.`;
    case "REFUSED":
    case "RETURNED":
      return `${move} Le traitement financier du retour a été appliqué.${reason ? ` Motif : ${reason}.` : ""}`;
    case "ON_HOLD":
      return `${move} La commande est suspendue par l'opérateur.${reason ? ` Motif : ${reason}.` : ""}`;
    case "CANCELLED":
      return `${move} Le stock a été réintégré.${reason ? ` Motif : ${reason}.` : ""}`;
    case "SHIPPED":
      return `${move} Le colis a été pris en charge par le transporteur.`;
    default:
      return move;
  }
}

/**
 * Body for the EARNING notification raised when a return-cost rule reverses
 * (and possibly charges) a partner earning. Amounts arrive already formatted
 * to 3 decimals by the caller.
 */
export function buildEarningReversalBody(
  originalEarning: string,
  reversedEarning: string,
  totalCharged: string,
  rule: string,
): string {
  const reversal = `Votre gain de ${originalEarning} DT a été annulé (${reversedEarning} DT repris).`;
  const charge = Number(totalCharged) > 0
    ? ` Frais de retour appliqués : ${totalCharged} DT.`
    : "";
  return `${reversal}${charge} Règle appliquée : ${rule}.`;
}

/** Tunisian governorates (for order/customer forms). */
export const GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Kef",
  "Mahdia",
  "Manouba",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;
