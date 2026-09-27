/** Central definition of system settings + defaults. */

export const SETTING_KEYS = {
  SETTLEMENT_PERIOD_HOURS: "finance.settlement_period_hours",
  MIN_WITHDRAWAL_AMOUNT: "finance.min_withdrawal_amount",
  RETURN_COST_RULE: "finance.return_cost_rule",
  GLOBAL_COMMISSION: "finance.global_commission",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/**
 * Return cost rule (validated business decision):
 * default = reverse the partner earning if still PENDING;
 * delivery cost is absorbed by the platform.
 */
export type ReturnCostRule =
  | "REVERSE_PENDING_EARNING" // reverse pending earning only (default)
  | "REVERSE_PLUS_DELIVERY" // reverse earning + charge delivery cost to partner
  | "NO_COST"; // platform absorbs everything

export const SETTING_DEFAULTS = {
  [SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]: 48,
  [SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]: 100,
  [SETTING_KEYS.RETURN_COST_RULE]: "REVERSE_PENDING_EARNING" as ReturnCostRule,
  [SETTING_KEYS.GLOBAL_COMMISSION]: {
    commissionType: "PERCENTAGE" as const,
    commissionValue: 60,
  },
} satisfies Record<SettingKey, unknown>;

export const SETTING_CATEGORIES: Record<string, string> = {
  [SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]: "finance",
  [SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]: "finance",
  [SETTING_KEYS.RETURN_COST_RULE]: "finance",
  [SETTING_KEYS.GLOBAL_COMMISSION]: "finance",
};

export const SETTING_DESCRIPTIONS: Record<string, string> = {
  [SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]:
    "Période de settlement des gains partenaires (heures). Appliquée à la livraison ; modifier ce réglage n'affecte pas les commandes déjà livrées.",
  [SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]:
    "Montant minimum de retrait (DT).",
  [SETTING_KEYS.RETURN_COST_RULE]:
    "Règle de coût pour les retours/refus (REVERSE_PENDING_EARNING par défaut).",
  [SETTING_KEYS.GLOBAL_COMMISSION]:
    "Commission globale par défaut ({ type: PERCENTAGE|FIXED, value }) — fallback quand ni assignment, ni partenaire, ni produit n'en définit une.",
};
