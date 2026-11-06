import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const INITIAL_CATEGORIES = [
  {
    name: "Maison & Électroménager",
    nameAr: "المنزل والأجهزة الكهرومنزلية",
    slug: "maison-electromenager",
    description: "Équipements et accessoires pratiques pour améliorer le quotidien à la maison.",
    icon: "Home",
    displayOrder: 1,
    isActive: true,
  },
  {
    name: "High-Tech & Accessoires",
    nameAr: "التكنولوجيا والإكسسوارات",
    slug: "high-tech-accessoires",
    description: "Produits électroniques innovants, montres et accessoires connectés.",
    icon: "Smartphone",
    displayOrder: 2,
    isActive: true,
  },
  {
    name: "Cuisine & Art de la table",
    nameAr: "المطبخ وأواني الطهي",
    slug: "cuisine-art-de-la-table",
    description: "Robots, ustensiles et appareils électroménagers pour une cuisine efficace.",
    icon: "Utensils",
    displayOrder: 3,
    isActive: true,
  },
  {
    name: "Beauté & Bien-être",
    nameAr: "الجمال والعناية الشخصية",
    slug: "beaute-bien-etre",
    description: "Soins, beauté et solutions de bien-être personnel au quotidien.",
    icon: "Sparkles",
    displayOrder: 4,
    isActive: true,
  },
  {
    name: "Sport & Loisirs",
    nameAr: "الرياضة والأنشطة",
    slug: "sport-loisirs",
    description: "Articles pour le fitness, la relaxation et le mode de vie actif.",
    icon: "Flame",
    displayOrder: 5,
    isActive: true,
  },
  {
    name: "Général",
    nameAr: "منتجات متنوعة",
    slug: "general",
    description: "Produits divers et nouveautés sélectionnées.",
    icon: "Package",
    displayOrder: 6,
    isActive: true,
  },
];

async function seedCategoriesAndMigrateProducts() {
  console.log('Seeding initial categories...');
  const catMap = new Map();

  for (const cat of INITIAL_CATEGORIES) {
    const upserted = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        nameAr: cat.nameAr,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
      },
      create: cat,
    });
    catMap.set(cat.slug, upserted.id);
    console.log(`- Category [${cat.name}] ID: ${upserted.id}`);
  }

  console.log('\nAssigning categories to existing products...');
  const products = await prisma.product.findMany();
  console.log(`Found ${products.length} products to categorize.`);

  for (const p of products) {
    let catSlug = 'general';
    const n = p.name.toLowerCase();

    if (n.includes('blendeuse') || n.includes('robot') || n.includes('couteau') || n.includes('café') || n.includes('repasser')) {
      catSlug = n.includes('repasser') ? 'maison-electromenager' : 'cuisine-art-de-la-table';
    } else if (n.includes('air') || n.includes('aspirateur') || n.includes('lampe') || n.includes('ventilateur') || n.includes('boîte') || n.includes('boxe') || n.includes('organisateur') || n.includes('machine à laver')) {
      catSlug = 'maison-electromenager';
    } else if (n.includes('montre') || n.includes('écouteurs') || n.includes('pro')) {
      catSlug = 'high-tech-accessoires';
    } else if (n.includes('sèche-cheveux') || n.includes('taches') || n.includes('قلم') || n.includes('بقع')) {
      catSlug = 'beaute-bien-etre';
    } else if (n.includes('yoga') || n.includes('tapis') || n.includes('sport')) {
      catSlug = 'sport-loisirs';
    }

    const catId = catMap.get(catSlug) || catMap.get('general');

    // Winning, New, Recommended sample flags
    let isWinning = p.isWinning;
    let isNew = p.isNew;
    let isRecommended = p.isRecommended;

    if (n.includes('blendeuse') || n.includes('machine à laver')) {
      isWinning = true;
    }
    if (n.includes('قلم') || n.includes('montre')) {
      isNew = true;
    }
    if (n.includes('blendeuse') || n.includes('aspirateur')) {
      isRecommended = true;
    }

    await prisma.product.update({
      where: { id: p.id },
      data: {
        categoryId: catId,
        category: INITIAL_CATEGORIES.find(c => c.slug === catSlug)?.name || 'Général',
        isWinning,
        isNew,
        isRecommended,
      },
    });

    console.log(`- Product "${p.name}" -> Category [${catSlug}] (Winning: ${isWinning}, New: ${isNew}, Recommended: ${isRecommended})`);
  }

  console.log('\nMigration complete! All products successfully preserved and categorized.');
}

seedCategoriesAndMigrateProducts()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
