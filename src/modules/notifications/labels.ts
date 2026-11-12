import type { NotificationType } from "@prisma/client";

/**
 * Presentation layer for notifications — pure maps, no Prisma and no React,
 * so the wording/severity rules are unit-testable on their own.
 */

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ANNOUNCEMENT: "Annonce",
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
  ANNOUNCEMENT: "info",
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

/** Formats a timestamp into relative time e.g. "À l'instant", "Il y a 5 min", "5m ago", "منذ 5 د". */
export function formatRelativeTime(
  dateOrIso: Date | string,
  now: Date = new Date(),
  locale: "fr" | "en" | "ar" = "fr",
): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    if (locale === "ar") return "الآن";
    if (locale === "en") return "Just now";
    return "À l'instant";
  }

  if (diffMin < 60) {
    if (locale === "ar") return `منذ ${diffMin} د`;
    if (locale === "en") return `${diffMin}m ago`;
    return `Il y a ${diffMin} min`;
  }

  if (diffHours < 24) {
    if (locale === "ar") return `منذ ${diffHours} س`;
    if (locale === "en") return `${diffHours}h ago`;
    return `Il y a ${diffHours} h`;
  }

  if (diffDays < 7) {
    if (locale === "ar") return `منذ ${diffDays} ي`;
    if (locale === "en") return `${diffDays}d ago`;
    return `Il y a ${diffDays} j`;
  }

  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";
  return date.toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "short",
  });
}

/** Detects if a notification is referral or partner approval related for dedicated icons/branding. */
export function isReferralOrPartnerNotification(n: { type: string; title: string; body?: string }): boolean {
  const text = `${n.title} ${n.body ?? ""}`.toLowerCase();
  return (
    text.includes("parrain") ||
    text.includes("referral") ||
    text.includes("إحالة") ||
    text.includes("partenaire") ||
    text.includes("شريك")
  );
}
