import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [users, partners, products, orders, notifications, auditLogs, wallets] =
    await Promise.all([
      prisma.user.count(),
      prisma.partner.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.notification.count(),
      prisma.auditLog.count(),
      prisma.wallet.count(),
    ]);

  console.log(`users=${users}`);
  console.log(`partners=${partners}`);
  console.log(`products=${products}`);
  console.log(`orders=${orders}`);
  console.log(`notifications=${notifications}`);
  console.log(`auditLogs=${auditLogs}`);
  console.log(`wallets=${wallets}`);

  const accounts = await prisma.user.findMany({
    select: { email: true, role: true, status: true },
    orderBy: { role: "asc" },
  });
  for (const a of accounts) {
    console.log(`account: ${a.email} | ${a.role} | ${a.status}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
