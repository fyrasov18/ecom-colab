"use client";

import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_CLASSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/modules/orders/labels";
import type { OrderStatus } from "@prisma/client";
import { useI18n } from "@/lib/i18n";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { dict } = useI18n();
  const label = dict.statuses?.order?.[status] ?? ORDER_STATUS_LABELS[status] ?? status;

  return (
    <Badge
      variant={ORDER_STATUS_TONES[status] ?? "secondary"}
      className={ORDER_STATUS_CLASSES[status]}
    >
      {label}
    </Badge>
  );
}
