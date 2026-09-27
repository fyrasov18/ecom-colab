import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Dev/seed credentials — development only, never reuse in production. */
export const SEED_USERS = {
  superAdmin: { email: "admin@ecomcolab.tn", password: "Admin123!" },
  admin: { email: "ops@ecomcolab.tn", password: "Ops12345!" },
  partner: { email: "nour@partner.tn", password: "Partner123!" },
};

const PARTNERS = [
  "Nour Ben Salah",
  "Rania Gharbi",
  "Malek Jlassi",
  "Yassine Trabelsi",
  "Amira Khelifi",
  "Houssem Mansour",
  "Selma Bouzid",
  "Oussama Ferchichi",
  "Ghada Ayari",
  "Aziz Hamdi",
];

type ProductSeed = {
  name: string;
  purchaseCost: number;
  packagingCost: number;
  deliveryCost: number;
  sellingPrice: number;
  stockQuantity: number;
  description: string;
};

const PRODUCTS: ProductSeed[] = [
  { name: "Mini Machine à Laver", purchaseCost: 180, packagingCost: 2, deliveryCost: 7, sellingPrice: 320, stockQuantity: 45, description: "Mini lave-linge 11L compact pour petits espaces." },
  { name: "Blendeuse de Cru", purchaseCost: 45, packagingCost: 1.5, deliveryCost: 6, sellingPrice: 89, stockQuantity: 120, description: "Blendeuse 1200W avec lame inox, idéale smoothies et soupes." },
  { name: "Fer à Repasser Vapeur", purchaseCost: 60, packagingCost: 1.5, deliveryCost: 6, sellingPrice: 110, stockQuantity: 80, description: "Fer vapeur vertical 1800W, anti-calcaire." },
  { name: "Robot Pâtissier 5L", purchaseCost: 210, packagingCost: 3, deliveryCost: 8, sellingPrice: 389, stockQuantity: 30, description: "Robot pâtissier multifonction 1000W, bol inox 5L." },
  { name: "Purificateur d'Air", purchaseCost: 130, packagingCost: 2, deliveryCost: 7, sellingPrice: 249, stockQuantity: 25, description: "Purificateur HEPA avec détecteur de qualité d'air." },
  { name: "Aspirateur Balai 2-en-1", purchaseCost: 150, packagingCost: 2, deliveryCost: 7, sellingPrice: 279, stockQuantity: 40, description: "Aspirateur balai sans fil, autonomie 40 min." },
  { name: "Montre Connectée Sport", purchaseCost: 55, packagingCost: 1, deliveryCost: 5, sellingPrice: 129, stockQuantity: 200, description: "Montre connectée GPS, étanche IP68, cardio." },
  { name: "Écouteurs Sans Fil Pro", purchaseCost: 35, packagingCost: 1, deliveryCost: 5, sellingPrice: 79, stockQuantity: 150, description: "Earbuds Bluetooth 5.3 ANC, boîtier 30h." },
  { name: "Lampe LED Bureau", purchaseCost: 28, packagingCost: 1, deliveryCost: 5, sellingPrice: 65, stockQuantity: 90, description: "Lampe LED réglable 3 températures, port USB." },
  { name: "Set de Couteaux Inox", purchaseCost: 40, packagingCost: 1.5, deliveryCost: 6, sellingPrice: 85, stockQuantity: 110, description: "12 couteaux japonais + support bois." },
  { name: "Machine à Café Dolce", purchaseCost: 95, packagingCost: 2, deliveryCost: 7, sellingPrice: 189, stockQuantity: 55, description: "Machine à café capsules, 19 bars." },
  { name: "Tapis de Yoga antidérapant", purchaseCost: 18, packagingCost: 1, deliveryCost: 5, sellingPrice: 49, stockQuantity: 140, description: "Tapis TPE 6mm deux faces, sangle de transport." },
  { name: "Ventilateur Colonne", purchaseCost: 70, packagingCost: 2, deliveryCost: 7, sellingPrice: 139, stockQuantity: 60, description: "Ventilateur colonne silencieux, télécommande." },
  { name: "Sèche-cheveux Ionique", purchaseCost: 50, packagingCost: 1.5, deliveryCost: 6, sellingPrice: 99, stockQuantity: 95, description: "Sèche-cheveux 2200W ions négatifs, 3 embouts." },
  { name: "Boxe de Rangement Vaccum", purchaseCost: 22, packagingCost: 1, deliveryCost: 5, sellingPrice: 55, stockQuantity: 0, description: "8 sacs à vide compressés, valve universelle." },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("🌱 Seed E-COM COLAB (dev)…");

  // ── Default system settings ──
  const defaultSettings: {
    key: string;
    value: Prisma.InputJsonValue;
    category: string;
    description: string;
  }[] = [
    {
      key: "finance.settlement_period_hours",
      value: 48,
      category: "finance",
      description:
        "Période de settlement des gains partenaires (heures). Appliquée à la livraison ; modifier ce réglage n'affecte pas les commandes déjà livrées.",
    },
    {
      key: "finance.min_withdrawal_amount",
      value: 100,
      category: "finance",
      description: "Montant minimum de retrait (DT).",
    },
    {
      key: "finance.return_cost_rule",
      value: "REVERSE_PENDING_EARNING",
      category: "finance",
      description:
        "Règle de coût pour les retours/refus (REVERSE_PENDING_EARNING par défaut).",
    },
  ];
  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value },
    });
  }

  // ── Users ──
  const passwordHash = (pw: string) => bcrypt.hashSync(pw, 12);

  await prisma.user.upsert({
    where: { email: SEED_USERS.superAdmin.email },
    create: {
      email: SEED_USERS.superAdmin.email,
      passwordHash: passwordHash(SEED_USERS.superAdmin.password),
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: SEED_USERS.admin.email },
    create: {
      email: SEED_USERS.admin.email,
      passwordHash: passwordHash(SEED_USERS.admin.password),
      firstName: "Équipe",
      lastName: "Opérations",
      role: "ADMIN",
    },
    update: {},
  });

  const partnerEmails = [
    SEED_USERS.partner.email,
    ...PARTNERS.slice(1).map((n) =>
      `${n.split(" ")[0].toLowerCase()}@partner.tn`,
    ),
  ];

  const partners = [];
  for (let i = 0; i < PARTNERS.length; i++) {
    const fullName = PARTNERS[i];
    const [firstName, ...rest] = fullName.split(" ");
    const email = partnerEmails[i];
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: passwordHash(SEED_USERS.partner.password),
        firstName,
        lastName: rest.join(" "),
        role: "PARTNER",
      },
      update: {},
    });
    const partner = await prisma.partner.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        code: `P${String(i + 1).padStart(3, "0")}`,
        displayName: fullName,
        defaultCommissionType: "PERCENTAGE",
        defaultCommissionValue: 60,
      },
      update: {},
    });
    await prisma.wallet.upsert({
      where: { partnerId: partner.id },
      create: { partnerId: partner.id },
      update: {},
    });
    partners.push(partner);
  }

  // ── Products ──
  const products = [];
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: slugify(p.name) },
      create: {
        name: p.name,
        slug: slugify(p.name),
        description: p.description,
        purchaseCost: p.purchaseCost,
        packagingCost: p.packagingCost,
        deliveryCost: p.deliveryCost,
        sellingPrice: p.sellingPrice,
        stockQuantity: p.stockQuantity,
        lowStockThreshold: 10,
        status: p.stockQuantity === 0 ? "OUT_OF_STOCK" : "ACTIVE",
      },
      update: {},
    });
    products.push(product);
  }

  // ── Partner ↔ Product assignments (deterministic spread) ──
  for (let i = 0; i < partners.length; i++) {
    const count = 4 + (i % 3); // 4..6 products per partner
    for (let j = 0; j < count; j++) {
      const product = products[(i * 3 + j) % products.length];
      await prisma.partnerProduct.upsert({
        where: {
          partnerId_productId: {
            partnerId: partners[i].id,
            productId: product.id,
          },
        },
        create: { partnerId: partners[i].id, productId: product.id },
        update: {},
      });
    }
  }

  // ── Marketing kits (demo content, idempotent) ──
  for (const product of products) {
    const existing = await prisma.productMarketingAsset.count({
      where: { productId: product.id },
    });
    if (existing > 0) continue;
    await prisma.productMarketingAsset.createMany({
      data: [
        {
          productId: product.id,
          kind: "AD_COPY",
          title: `Argumentaire — ${product.name}`,
          content: `${product.name} : ${product.description}\n\nLivraison partout en Tunisie, paiement à la réception.\nQualité garantie + échange sous 7 jours.\nCommandez maintenant, stock limité !`,
        },
        {
          productId: product.id,
          kind: "HOOK",
          title: "Hook vidéo",
          content: `Arrêtez de chercher — le ${product.name.toLowerCase()} que tout le monde teste en ce moment est arrivé en Tunisie. Regardez ce qu'il fait en 10 secondes…`,
        },
        {
          productId: product.id,
          kind: "CAPTION",
          title: "Caption Instagram/Facebook",
          content: `${product.name} 🔥\n✅ ${product.description}\n✅ Livraison rapide partout en Tunisie\n✅ Paiement à la réception\n👉 Envoyez-nous « OUI » en message privé pour commander !`,
        },
        {
          productId: product.id,
          kind: "FAQ",
          title: "Questions fréquentes",
          content: `Q : Livrez-vous partout en Tunisie ?\nO : Oui, 24/48h selon la région.\nQ : Paiement ?\nO : À la réception, vous vérifiez avant de payer.\nQ : Et si le produit ne me convient pas ?\nO : Échange ou retour sous 7 jours.`,
        },
      ],
    });
  }

  // ── Social accounts for the first partners (demo, idempotent) ──
  const platforms = [
    { platform: "FACEBOOK" as const, label: "Page principale", url: "https://facebook.com/" },
    { platform: "INSTAGRAM" as const, label: "Compte Insta", url: "https://instagram.com/" },
  ];
  for (let i = 0; i < Math.min(5, partners.length); i++) {
    for (const acc of platforms) {
      const count = await prisma.partnerSocialAccount.count({
        where: { partnerId: partners[i].id, platform: acc.platform },
      });
      if (count > 0) continue;
      await prisma.partnerSocialAccount.create({
        data: {
          partnerId: partners[i].id,
          platform: acc.platform,
          label: acc.label,
          url: `${acc.url}${partners[i].code.toLowerCase()}`,
        },
      });
    }
  }

  console.log("✅ Seed terminé :");
  console.log(
    `   SUPER_ADMIN  ${SEED_USERS.superAdmin.email} / ${SEED_USERS.superAdmin.password}`,
  );
  console.log(
    `   ADMIN        ${SEED_USERS.admin.email} / ${SEED_USERS.admin.password}`,
  );
  console.log(
    `   PARTNER      ${SEED_USERS.partner.email} / ${SEED_USERS.partner.password}`,
  );
  console.log(`   ${partners.length} partenaires, ${products.length} produits.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


