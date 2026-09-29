import Link from "next/link";
import { Bell } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { GlobalSearch } from "./global-search";
import { formatUnreadCount } from "@/modules/notifications/labels";

export function AppHeader({
  user,
  scope,
  unreadCount = 0,
}: {
  user: { firstName: string; lastName: string; role: string };
  scope: "admin" | "partenaire";
  /** Unread notifications for this user; drives the bell pill. */
  unreadCount?: number;
}) {
  const notificationsHref =
    scope === "admin" ? "/notifications" : "/mes-notifications";
  const fullName = `${user.firstName} ${user.lastName}`;
  const badge = formatUnreadCount(unreadCount);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-3">
        <Link
          href={notificationsHref}
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={
            unreadCount > 0
              ? `Notifications (${badge} non lues)`
              : "Notifications"
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {badge}
            </span>
          )}
        </Link>
        <div className="hidden items-center gap-2.5 border-l pl-3 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {fullName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">{fullName}</div>
            <div className="text-[11px] text-muted-foreground">{user.role}</div>
          </div>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
