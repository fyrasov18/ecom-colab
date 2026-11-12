import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { listPartnerTrackingOrders } from "@/modules/orders/queries";
import { PartnerTrackingView, type TrackingOrder } from "./tracking-view";

export const metadata: Metadata = {
  title: "Suivi des commandes",
  description: "Suivi logistique et expéditions des commandes partenaires",
};

export const dynamic = "force-dynamic";

export default async function PartnerTrackingPage() {
  const user = await requireSession(["PARTNER"]);

  const rawOrders = await listPartnerTrackingOrders(user.partnerId!);

  const orders: TrackingOrder[] = rawOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    customer: {
      fullName: o.customer.fullName,
      phone: o.customer.phone,
      city: o.customer.city,
      governorate: o.customer.governorate,
    },
    productName: o.items[0]?.productName || `Commande #${o.orderNumber}`,
    quantity: o.items.reduce((sum, i) => sum + i.quantity, 0) || 1,
    shipment: o.shipment
      ? {
          carrier: o.shipment.carrier,
          trackingNumber: o.shipment.trackingNumber,
          shippedAt: o.shipment.shippedAt?.toISOString() ?? null,
          deliveredAt: o.shipment.deliveredAt?.toISOString() ?? null,
        }
      : null,
  }));

  return <PartnerTrackingView initialOrders={orders} />;
}
