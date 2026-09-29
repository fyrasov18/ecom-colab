import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_CLASSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/modules/orders/labels";
import type { OrderStatus } from "@prisma/client";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      variant={ORDER_STATUS_TONES[status] ?? "secondary"}
      className={ORDER_STATUS_CLASSES[status]}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
