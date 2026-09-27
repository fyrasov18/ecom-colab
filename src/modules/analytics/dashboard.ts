import { prisma } from "@/lib/prisma";

/**
 * Admin dashboard data — every value comes from a real database query.
 * No hard-coded or fabricated KPIs.
 */
export async function getAdminDashboardData() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    activePartners,
    ordersToday,
    ordersByStatus,
    activeProducts,
    lowStockProducts,
    pendingWithdrawals,
    walletSums,
    recentOrders,
  ] = await Promise.all([
    prisma.partner.count({ where: { status: "ACTIVE" } }),
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({
      where: { status: "ACTIVE", stockQuantity: { lte: prisma.product.fields.lowStockThreshold } },
    }),
    prisma.withdrawal.count({
      where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED"] } },
    }),
    prisma.wallet.aggregate({
      _sum: {
        pendingBalance: true,
        availableBalance: true,
        totalEarned: true,
        totalWithdrawn: true,
      },
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        partner: { select: { displayName: true } },
        customer: { select: { fullName: true } },
      },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    ordersByStatus.map((s) => [s.status, s._count._all]),
  ) as Record<string, number>;

  const totalOrders = ordersByStatus.reduce((acc, s) => acc + s._count._all, 0);

  return {
    activePartners,
    ordersToday,
    activeProducts,
    lowStockProducts,
    pendingWithdrawals,
    totalOrders,
    statusCounts,
    delivered: statusCounts.DELIVERED ?? 0,
    inDelivery: statusCounts.IN_DELIVERY ?? 0,
    refusedOrReturned:
      (statusCounts.REFUSED ?? 0) + (statusCounts.RETURNED ?? 0),
    onHold: statusCounts.ON_HOLD ?? 0,
    awaitingValidation: statusCounts.CONFIRMED ?? 0,
    wallets: {
      pending: walletSums._sum.pendingBalance ?? 0,
      available: walletSums._sum.availableBalance ?? 0,
      totalEarned: walletSums._sum.totalEarned ?? 0,
      totalWithdrawn: walletSums._sum.totalWithdrawn ?? 0,
    },
    recentOrders,
  };
}
