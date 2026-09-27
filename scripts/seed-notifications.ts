/**
 * Demo helper: produce a realistic notification history by driving the REAL
 * services (status transitions, settlement, withdrawal lifecycle) rather than
 * inserting rows by hand. This keeps the audit trail and the ledger honest —
 * every notification below corresponds to a genuine business event.
 *
 * Usage: npx tsx scripts/seed-notifications.ts
 * Idempotent-ish: it only advances orders that are still early in the pipeline.
 */
import { PrismaClient, type OrderStatus } from "@prisma/client";
import { changeOrderStatus, StatusError } from "../src/modules/orders/status";
import { settleDueEarnings } from "../src/modules/finance/ledger";
import {
  approveWithdrawal,
  payWithdrawal,
  rejectWithdrawal,
  WithdrawalError,
} from "../src/modules/finance/withdrawals";

const prisma = new PrismaClient();

const ADMIN: { id: string; role: "SUPER_ADMIN" | "ADMIN" } = { id: "", role: "ADMIN" };

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@ecomcolab.tn" },
    select: { id: true, role: true },
  });
  ADMIN.id = admin.id;
  ADMIN.role = admin.role as "SUPER_ADMIN" | "ADMIN";

  // ── 1. Advance a few in-flight orders so partners get ORDER_STATUS events ──
  const inFlight = await prisma.order.findMany({
    where: { status: { in: ["CONFIRMED", "VALIDATED", "PREPARING", "IN_DELIVERY"] } },
    select: { id: true, status: true, orderNumber: true },
    orderBy: { createdAt: "asc" },
    take: 14,
  });

  const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
    CONFIRMED: "VALIDATED",
    VALIDATED: "PREPARING",
    PREPARING: "PACKAGED",
    PACKAGED: "SHIPPED",
    SHIPPED: "IN_DELIVERY",
    IN_DELIVERY: "DELIVERED",
  };

  let moved = 0;
  for (const order of inFlight) {
    const to = NEXT[order.status];
    if (!to) continue;
    try {
      await changeOrderStatus({ orderId: order.id, to, actorId: admin.id, role: admin.role });
      moved += 1;
    } catch (e) {
      if (!(e instanceof StatusError)) throw e;
    }
  }
  console.log(`order transitions applied: ${moved}/${inFlight.length}`);

  // ── 2. Drive one withdrawal through approve + pay, reject another ──
  const withdrawals = await prisma.withdrawal.findMany({
    where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED"] } },
    select: { id: true, status: true, amount: true },
    orderBy: { requestedAt: "asc" },
    take: 3,
  });

  for (const w of withdrawals) {
    try {
      if (w.status === "REQUESTED") {
        await approveWithdrawal({ withdrawalId: w.id, actorId: admin.id, role: admin.role });
        console.log(`withdrawal approved: ${w.amount.toFixed(3)} DT`);
      }
      if (w.status === "REQUESTED" || w.status === "UNDER_REVIEW") {
        await payWithdrawal({
          withdrawalId: w.id,
          actorId: admin.id,
          role: admin.role,
          transactionReference: `VIR-DEMO-${w.id.slice(-6)}`,
        });
        console.log(`withdrawal paid: ${w.amount.toFixed(3)} DT`);
      } else if (w.status === "APPROVED") {
        await payWithdrawal({
          withdrawalId: w.id,
          actorId: admin.id,
          role: admin.role,
          transactionReference: `VIR-DEMO-${w.id.slice(-6)}`,
        });
        console.log(`withdrawal paid: ${w.amount.toFixed(3)} DT`);
      }
    } catch (e) {
      if (!(e instanceof WithdrawalError)) throw e;
      console.log(`withdrawal skipped: ${e.message}`);
    }
  }

  // ── 3. Release due earnings -> SETTLEMENT notifications ──
  const settled = await settleDueEarnings();
  console.log(`settlement: ${settled.settled} entries for ${settled.partners.length} partners`);

  // ── Report ──
  const total = await prisma.notification.count();
  const byType = await prisma.notification.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  console.log(`\nTOTAL notifications: ${total}`);
  for (const row of byType) {
    console.log(`  ${row.type}: ${row._count._all}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
