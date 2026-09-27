import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";

const prisma = new PrismaClient();

async function main() {
  const partner = await prisma.partner.findFirstOrThrow({
    where: { user: { email: "nour@partner.tn" } },
  });

  const assigned = await prisma.partnerProduct.findFirst({
    where: { partnerId: partner.id, status: "ACTIVE" },
    orderBy: { assignedAt: "asc" },
  });

  const unassigned = await prisma.product.findFirst({
    where: {
      status: { in: ["ACTIVE", "OUT_OF_STOCK"] },
      NOT: {
        partnerAssignations: {
          some: { partnerId: partner.id, status: "ACTIVE" },
        },
      },
    },
  });

  // Phase3: order ids for isolation checks
  const ownOrder = await prisma.order.findFirst({
    where: { partnerId: partner.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const otherOrder = await prisma.order.findFirst({
    where: { NOT: { partnerId: partner.id } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const lines = [
    `partnerId=${partner.id}`,
    `assigned=${assigned?.productId ?? ""}`,
    `unassigned=${unassigned?.id ?? ""}`,
    `ownOrder=${ownOrder?.id ?? ""}`,
    `otherOrder=${otherOrder?.id ?? ""}`,
  ];
  await writeFile("ids.txt", lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
