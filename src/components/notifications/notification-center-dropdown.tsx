"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  Boxes,
  Megaphone,
  UserPlus,
  UserCheck,
  Package,
  ArrowRight,
  ArrowLeft,
  Loader2,
  BellOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  fetchRecentNotificationsAction,
  markAllNotificationsReadDirect,
  markNotificationReadDirect,
} from "@/modules/notifications/actions";
import {
  formatRelativeTime,
  formatUnreadCount,
  isReferralOrPartnerNotification,
} from "@/modules/notifications/labels";
import type { NotificationType } from "@prisma/client";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

interface NotificationCenterDropdownProps {
  initialUnreadCount?: number;
  notificationsHref: string;
}

function getNotificationIcon(n: NotificationItem): {
  Icon: LucideIcon;
  bgColor: string;
  textColor: string;
} {
  const isReferral = isReferralOrPartnerNotification(n);

  if (isReferral) {
    const text = `${n.title} ${n.body}`.toLowerCase();
    if (text.includes("validé") || text.includes("approved") || text.includes("موافقة")) {
      return { Icon: UserCheck, bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20", textColor: "text-emerald-600 dark:text-emerald-400" };
    }
    return { Icon: UserPlus, bgColor: "bg-violet-500/10 dark:bg-violet-500/20", textColor: "text-violet-600 dark:text-violet-400" };
  }

  switch (n.type) {
    case "ORDER_STATUS":
      return { Icon: Package, bgColor: "bg-blue-500/10 dark:bg-blue-500/20", textColor: "text-blue-600 dark:text-blue-400" };
    case "EARNING":
      return { Icon: TrendingUp, bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20", textColor: "text-emerald-600 dark:text-emerald-400" };
    case "SETTLEMENT":
      return { Icon: Receipt, bgColor: "bg-indigo-500/10 dark:bg-indigo-500/20", textColor: "text-indigo-600 dark:text-indigo-400" };
    case "WITHDRAWAL":
      return { Icon: ArrowUpRight, bgColor: "bg-amber-500/10 dark:bg-amber-500/20", textColor: "text-amber-600 dark:text-amber-400" };
    case "STOCK":
      return { Icon: Boxes, bgColor: "bg-rose-500/10 dark:bg-rose-500/20", textColor: "text-rose-600 dark:text-rose-400" };
    case "ANNOUNCEMENT":
      return { Icon: Megaphone, bgColor: "bg-purple-500/10 dark:bg-purple-500/20", textColor: "text-purple-600 dark:text-purple-400" };
    case "SYSTEM":
    default:
      return { Icon: Bell, bgColor: "bg-sky-500/10 dark:bg-sky-500/20", textColor: "text-sky-600 dark:text-sky-400" };
  }
}

export function NotificationCenterDropdown({
  initialUnreadCount = 0,
  notificationsHref,
}: NotificationCenterDropdownProps) {
  const router = useRouter();
  const { dict, locale, isRtl } = useI18n();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync unread count if parent prop changes
  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  // Load recent notifications when dropdown is opened
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchRecentNotificationsAction(8);
      setItems(res.items);
      setUnreadCount(res.unread);
      setHasLoaded(true);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !hasLoaded) {
      loadNotifications();
    }
  };

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Mark single item read and navigate
  const handleItemClick = async (item: NotificationItem) => {
    const isUnread = item.readAt === null;

    if (isUnread) {
      // Optimistic update
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Server update
      startTransition(async () => {
        await markNotificationReadDirect(item.id);
      });
    }

    setOpen(false);
    if (item.link) {
      router.push(item.link);
    } else {
      router.push(notificationsHref);
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    // Optimistic update
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt || new Date().toISOString() })));
    setUnreadCount(0);

    // Server update
    startTransition(async () => {
      await markAllNotificationsReadDirect();
    });
  };

  const badgeText = formatUnreadCount(unreadCount);
  const now = new Date();

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "relative rounded-lg p-2 text-muted-foreground transition-all duration-150 cursor-pointer",
          "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          open && "bg-accent text-accent-foreground shadow-2xs",
        )}
        aria-label={
          unreadCount > 0
            ? `${dict.notifications.title} (${badgeText} ${dict.notifications.unreadBadge})`
            : dict.notifications.title
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200"
          >
            {badgeText}
          </span>
        )}
      </button>

      {/* Modern Notification Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          role="dialog"
          aria-label={dict.notifications.title}
          className={cn(
            "absolute z-50 mt-2 w-[340px] sm:w-[380px] max-w-[calc(100vw-24px)] rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150",
            isRtl ? "left-0" : "right-0",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                {dict.notifications.title}
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {unreadCount} {dict.notifications.unreadBadge}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                title={dict.notifications.markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{dict.notifications.markAllRead}</span>
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="max-h-[360px] sm:max-h-[400px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
            {isLoading && !hasLoaded ? (
              <div className="p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs">Chargement...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-2">
                  <BellOff className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {dict.notifications.noNotifications}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[240px]">
                  {dict.notifications.noNotificationsDesc}
                </p>
              </div>
            ) : (
              items.map((item) => {
                const isUnread = item.readAt === null;
                const { Icon, bgColor, textColor } = getNotificationIcon(item);
                const relTime = formatRelativeTime(item.createdAt, now, locale);

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleItemClick(item);
                      }
                    }}
                    className={cn(
                      "flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer group",
                      isRtl && "text-right",
                      isUnread
                        ? "bg-primary/[0.04] dark:bg-primary/[0.08] hover:bg-primary/[0.07]"
                        : "hover:bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                        bgColor,
                        textColor,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            "text-xs leading-snug line-clamp-1",
                            isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
                          )}
                        >
                          {item.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground/80 shrink-0 font-normal">
                          {relTime}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>
                    </div>

                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-label="Non lue"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 p-2 bg-muted/20 text-center">
            <Link
              href={notificationsHref}
              onClick={() => setOpen(false)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <span>{dict.notifications.viewAll}</span>
              {isRtl ? (
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
