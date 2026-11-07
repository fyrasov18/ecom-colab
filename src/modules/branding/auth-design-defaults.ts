export type AuthMarketingContent = {
  loginBadge: string;
  loginHeadline: string;
  loginSubtitle: string;
  registerBadge: string;
  registerHeadline: string;
  registerSubtitle: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  trustStat1Value: string;
  trustStat1Label: string;
  trustStat2Value: string;
  trustStat2Label: string;
  footerText: string;
};

export type AuthPagesDesign = {
  branding: {
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
    logoMarkUrl: string | null;
  };
  colors: {
    primaryColor: string;
    accentColor: string;
    buttonBg: string;
    buttonText: string;
    marketingBg: string;
  };
  layout: {
    showMarketingPanel: boolean;
    showFeatureCards: boolean;
    showTrustBadges: boolean;
    showPlatformMockup: boolean;
  };
  content: {
    fr: AuthMarketingContent;
    ar: AuthMarketingContent;
    en: AuthMarketingContent;
  };
};

export const DEFAULT_AUTH_MARKETING_FR: AuthMarketingContent = {
  loginBadge: "Système Opérationnel E-commerce",
  loginHeadline: "L'infrastructure de votre E-commerce en Tunisie.",
  loginSubtitle:
    "Du sourcing des produits gagnants à l'expédition express et l'encaissement de vos commissions : développez vos ventes en toute sérénité.",
  registerBadge: "Rejoindre le Réseau Partenaires",
  registerHeadline: "Vendez sans stock. Encaissez vos gains chaque semaine.",
  registerSubtitle:
    "Rejoignez le réseau leader de vendeurs et spécialistes e-commerce en Tunisie. Accès immédiat au catalogue exclusif et suivi en temps réel.",
  feature1Title: "Catalogue Produits Validés",
  feature1Desc: "Produits gagnants sourcés, testés et prêts à la vente avec marge garantie.",
  feature2Title: "Confirmation & Expédition 24/48h",
  feature2Desc: "Call-center dédié pour confirmer vos commandes et livraison sur toute la Tunisie.",
  feature3Title: "Paiements Rapides & Sécurisés",
  feature3Desc: "Vos gains crédités automatiquement avec règlements hebdomadaires fiables.",
  trustStat1Value: "24/24",
  trustStat1Label: "Gouvernorats desservis",
  trustStat2Value: "7j/7",
  trustStat2Label: "Support partenaires",
  footerText: "Plateforme EcomPartner · Tous droits réservés.",
};

export const DEFAULT_AUTH_MARKETING_AR: AuthMarketingContent = {
  loginBadge: "نظام التجارة الإلكترونية المتكامل",
  loginHeadline: "البنية التحتية لتجارتك الإلكترونية في تونس.",
  loginSubtitle:
    "من توفير المنتجات المربحة إلى التوصيل السريع وتحصيل العمولات : طوّر مبيعاتك بكل ثقة وأمان.",
  registerBadge: "انضم إلى شبكة الشركاء",
  registerHeadline: "بع دون رأس مال أو مخزون. استلم أرباحك أسبوعياً.",
  registerSubtitle:
    "انضم إلى الشبكة الرائدة للمسوقين ورواد التجارة الإلكترونية في تونس. وصول فوري إلى الكتالوج ومتابعة فورية للأرباح.",
  feature1Title: "منتجات مربحة وحصرية",
  feature1Desc: "منتجات جاهزة للبيع بهوامش ربح مضمونة ومخزون متوفر دائماً.",
  feature2Title: "تأكيد فوري وشحن 24/48 ساعة",
  feature2Desc: "مركز اتصالات لتأكيد الطلبيات وتوصيل سريع في كامل ولايات تونس.",
  feature3Title: "دفعات سريعة ومضمونة",
  feature3Desc: "تحويل تلقائي لأرباحك ومتابعة دقيقة لمحفظتك المالية.",
  trustStat1Value: "24/24",
  trustStat1Label: "ولاية مشمولة بالتوصيل",
  trustStat2Value: "7/7",
  trustStat2Label: "دعم ومتابعة مستمرة",
  footerText: "منصة EcomPartner · جميع الحقوق محفوظة.",
};

export const DEFAULT_AUTH_MARKETING_EN: AuthMarketingContent = {
  loginBadge: "E-commerce Operating System",
  loginHeadline: "The Infrastructure for Your E-commerce Business.",
  loginSubtitle:
    "From product sourcing to express COD delivery and seamless payouts: scale your e-commerce operations with ease.",
  registerBadge: "Join the Partner Network",
  registerHeadline: "Sell Without Inventory. Collect Weekly Payouts.",
  registerSubtitle:
    "Join Tunisia's leading partner network for e-commerce marketers. Get instant access to winning products and live sales tracking.",
  feature1Title: "Verified Winning Products",
  feature1Desc: "Pre-sourced and tested products with high margins and guaranteed stock.",
  feature2Title: "24h Call Center & Fast Delivery",
  feature2Desc: "Dedicated confirmation team and nation-wide COD shipping within 24-48h.",
  feature3Title: "Guaranteed Fast Settlements",
  feature3Desc: "Earnings credited automatically with transparent wallet tracking and weekly payouts.",
  trustStat1Value: "24/24",
  trustStat1Label: "Governorates Covered",
  trustStat2Value: "7/7",
  trustStat2Label: "Dedicated Support",
  footerText: "EcomPartner Platform · All rights reserved.",
};

export const DEFAULT_AUTH_PAGES_DESIGN: AuthPagesDesign = {
  branding: {
    logoLightUrl: null,
    logoDarkUrl: null,
    logoMarkUrl: null,
  },
  colors: {
    primaryColor: "#10B981",
    accentColor: "#A3E635",
    buttonBg: "#10B981",
    buttonText: "#FFFFFF",
    marketingBg: "#0B1220",
  },
  layout: {
    showMarketingPanel: true,
    showFeatureCards: true,
    showTrustBadges: true,
    showPlatformMockup: true,
  },
  content: {
    fr: DEFAULT_AUTH_MARKETING_FR,
    ar: DEFAULT_AUTH_MARKETING_AR,
    en: DEFAULT_AUTH_MARKETING_EN,
  },
};
