/** Central definition of system settings + defaults. */

export const SETTING_KEYS = {
  SETTLEMENT_PERIOD_HOURS: "finance.settlement_period_hours",
  MIN_WITHDRAWAL_AMOUNT: "finance.min_withdrawal_amount",
  RETURN_COST_RULE: "finance.return_cost_rule",
  GLOBAL_COMMISSION: "finance.global_commission",
  MIN_ORDER_CONTRIBUTION: "finance.min_order_contribution",
  REFERRAL_LEVEL2_THRESHOLD: "referral.level2_threshold",
  REFERRAL_LEVEL3_THRESHOLD: "referral.level3_threshold",
  REFERRAL_LEVEL4_THRESHOLD: "referral.level4_threshold",
  REFERRAL_LEVEL5_THRESHOLD: "referral.level5_threshold",
  REFERRAL_REQUIRED_ORDERS_TO_QUALIFY: "referral.required_orders_to_qualify",
  REFERRAL_LEVEL1_RATE: "referral.level1_rate",
  REFERRAL_LEVEL2_RATE: "referral.level2_rate",
  REFERRAL_LEVEL3_RATE: "referral.level3_rate",
  REFERRAL_LEVEL4_RATE: "referral.level4_rate",
  REFERRAL_LEVEL5_RATE: "referral.level5_rate",
  REFERRAL_AUTO_PROMOTION_ENABLED: "referral.auto_promotion_enabled",
  ANNOUNCEMENT_WELCOME_SETTINGS: "announcements.welcome_settings",
  ANNOUNCEMENT_LEVEL_UP_SETTINGS: "announcements.level_up_settings",
  ADMIN_PERMISSION_GRANTS: "security.admin_permission_grants",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const REFERRAL_SETTING_KEYS = {
  LEVEL2_THRESHOLD: SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD,
  LEVEL3_THRESHOLD: SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD,
  AUTO_PROMOTION_ENABLED: SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED,
} as const;

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
  [SETTING_KEYS.MIN_ORDER_CONTRIBUTION]: 7.00,
  [SETTING_KEYS.GLOBAL_COMMISSION]: {
    commissionType: "PERCENTAGE" as const,
    commissionValue: 30,
  },
  [SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD]: 10,
  [SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD]: 100,
  [SETTING_KEYS.REFERRAL_LEVEL4_THRESHOLD]: 300,
  [SETTING_KEYS.REFERRAL_LEVEL5_THRESHOLD]: 900,
  [SETTING_KEYS.REFERRAL_REQUIRED_ORDERS_TO_QUALIFY]: 3,
  [SETTING_KEYS.REFERRAL_LEVEL1_RATE]: 0.03,
  [SETTING_KEYS.REFERRAL_LEVEL2_RATE]: 0.07,
  [SETTING_KEYS.REFERRAL_LEVEL3_RATE]: 0.15,
  [SETTING_KEYS.REFERRAL_LEVEL4_RATE]: 0.20,
  [SETTING_KEYS.REFERRAL_LEVEL5_RATE]: 0.30,
  [SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED]: false,
  [SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS]: {
    isEnabled: true,
    title: "Bienvenue sur EcomPartner, {partnerName} !",
    message: "Votre compte partenaire a été validé avec succès par notre équipe. Vous avez désormais accès à notre catalogue exclusif de produits gagnants, aux kits marketing prêts à l'emploi et à notre système de commissions accéléré.",
    buttonText: "Découvrir mon espace",
    buttonUrl: "/catalogue",
    badgeText: "Compte validé",
    imageUrl: "",
    themeColor: "indigo",
  },
  [SETTING_KEYS.ADMIN_PERMISSION_GRANTS]: {} as Record<string, string[]>,
  [SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS]: {
    isEnabled: true,
    title: "Félicitations {partnerName} ! Vous passez au Niveau {newLevel} !",
    message: "Grâce à vos performances, votre statut partenaire progresse officiellement. Votre taux de commission de parrainage passe désormais à {commissionRate} % ! Continuez sur cette lancée pour débloquer les paliers supérieurs.",
    buttonText: "Voir mes nouveaux avantages",
    buttonUrl: "/parrainage",
    imageUrl: "",
    themeColor: "amber",
  },
} satisfies Record<SettingKey, unknown>;

export const SETTING_CATEGORIES: Record<string, string> = {
  [SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]: "finance",
  [SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]: "finance",
  [SETTING_KEYS.RETURN_COST_RULE]: "finance",
  [SETTING_KEYS.GLOBAL_COMMISSION]: "finance",
  [SETTING_KEYS.MIN_ORDER_CONTRIBUTION]: "finance",
  [SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL4_THRESHOLD]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL5_THRESHOLD]: "referral",
  [SETTING_KEYS.REFERRAL_REQUIRED_ORDERS_TO_QUALIFY]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL1_RATE]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL2_RATE]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL3_RATE]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL4_RATE]: "referral",
  [SETTING_KEYS.REFERRAL_LEVEL5_RATE]: "referral",
  [SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED]: "referral",
  [SETTING_KEYS.ANNOUNCEMENT_WELCOME_SETTINGS]: "announcements",
  [SETTING_KEYS.ANNOUNCEMENT_LEVEL_UP_SETTINGS]: "announcements",
  [SETTING_KEYS.ADMIN_PERMISSION_GRANTS]: "security",
};

export const SETTING_DESCRIPTIONS: Record<string, string> = {
  [SETTING_KEYS.ADMIN_PERMISSION_GRANTS]:
    "Assignation granulaire des permissions administratives par utilisateur.",
  [SETTING_KEYS.SETTLEMENT_PERIOD_HOURS]:
    "Période de settlement des gains partenaires (heures). Appliquée à la livraison ; modifier ce réglage n'affecte pas les commandes déjà livrées.",
  [SETTING_KEYS.MIN_WITHDRAWAL_AMOUNT]:
    "Montant minimum de retrait (DT).",
  [SETTING_KEYS.RETURN_COST_RULE]:
    "Règle de coût pour les retours/refus (REVERSE_PENDING_EARNING par défaut).",
  [SETTING_KEYS.MIN_ORDER_CONTRIBUTION]:
    "Contribution brute minimale requise pour qu'une commande soit éligible (DT, défaut : 7.00).",
  [SETTING_KEYS.GLOBAL_COMMISSION]:
    "Commission globale par défaut ({ type: PERCENTAGE|FIXED, value }) — fallback de niveau 4 dans la hiérarchie de contribution (défaut : 30%).",
  [SETTING_KEYS.REFERRAL_LEVEL2_THRESHOLD]:
    "Seuil de parrainages directs qualifiés pour le Niveau 2 (défaut : 10).",
  [SETTING_KEYS.REFERRAL_LEVEL3_THRESHOLD]:
    "Seuil de parrainages directs qualifiés pour le Niveau 3 (défaut : 100).",
  [SETTING_KEYS.REFERRAL_LEVEL4_THRESHOLD]:
    "Seuil de parrainages directs qualifiés pour le Niveau 4 (défaut : 300).",
  [SETTING_KEYS.REFERRAL_LEVEL5_THRESHOLD]:
    "Seuil de parrainages directs qualifiés pour le Niveau 5 (défaut : 900).",
  [SETTING_KEYS.REFERRAL_REQUIRED_ORDERS_TO_QUALIFY]:
    "Nombre de commandes livrées et réglées requises pour qualifier un filleul (défaut : 3).",
  [SETTING_KEYS.REFERRAL_LEVEL1_RATE]:
    "Taux de commission Niveau 1 appliqué sur le Pool B (défaut : 0.03 = 3%).",
  [SETTING_KEYS.REFERRAL_LEVEL2_RATE]:
    "Taux de commission Niveau 2 appliqué sur le Pool B (défaut : 0.07 = 7%).",
  [SETTING_KEYS.REFERRAL_LEVEL3_RATE]:
    "Taux de commission Niveau 3 appliqué sur le Pool B (défaut : 0.15 = 15%).",
  [SETTING_KEYS.REFERRAL_LEVEL4_RATE]:
    "Taux de commission Niveau 4 appliqué sur le Pool B (défaut : 0.20 = 20%).",
  [SETTING_KEYS.REFERRAL_LEVEL5_RATE]:
    "Taux de commission Niveau 5 appliqué sur le Pool B (défaut : 0.30 = 30%).",
  [SETTING_KEYS.REFERRAL_AUTO_PROMOTION_ENABLED]:
    "Activer la promotion automatique de niveau de parrainage (défaut : false, requiert confirmation admin).",
};
