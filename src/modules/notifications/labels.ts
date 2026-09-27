import type { NotificationType } from "@prisma/client";

/**
 * Presentation layer for notifications — pure maps, no Prisma and no React,
 * so the wording/severity rules are unit-testable on their own.
 */

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ORDER_STATUS: "Commande",
  EARNING: "Gain",
  SETTLEMENT: "Règlement",
  WITHDRAWAL: "Retrait",
  STOCK: "Stock",
  SYSTEM: "Système",
};

type Tone = "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "info";

/** Severity drives the badge colour in the list. */
export const NOTIFICATION_TYPE_TONES: Record<NotificationType, Tone> = {
  ORDER_STATUS: "info",
  EARNING: "success",
  SETTLEMENT: "success",
  WITHDRAWAL: "warning",
  STOCK: "destructive",
  SYSTEM: "secondary",
};

/** A notification is unread until it carries a read timestamp. */
export function isUnread(n: { readAt: Date | null }): boolean {
  return n.readAt === null;
}

/** Cap the header pill so it stays readable (99+ rather than 1 284). */
export function formatUnreadCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  return count > 99 ? "99+" : String(count);
}

/** "Aujourd'hui / Hier / 12 mars 2026" — day grouping for the notification feed. */
export function dayBucket(date: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
