"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarClock,
  Contact,
  FilePlus2,
  LayoutDashboard,
  Megaphone,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  PieChart,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnreadCount } from "@/modules/notifications/labels";
import { GlobalSearch } from "./global-search";
import { LogoutButton } from "./logout-button";

type NavItem = { href: string; label: string; icon: LucideIcon; superAdminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

export type AppShellProps = {
  /** Which nav set to render; also drives content width and mobile nav. */
  scope: "admin" | "partenaire";
  user: { firstName: string; lastName: string; role: string };
  /** Unread notifications for this user; drives the bell pill. */
  unreadCount?: number;
  /** Admin only — gates the Audit entry. */
  isSuperAdmin?: boolean;
  children: React.ReactNode;
};

/* Segment-aware active state, except for /parametres: it is a landing page
   whose children (/parametres/system, /parametres/commission…) are listed
   separately, so it must match exactly or several entries would highlight. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/parametres") return pathname === "/parametres";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: "Opérations",
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/logistique", label: "Logistique", icon: Truck },
      { href: "/clients", label: "Clients", icon: Contact },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/produits", label: "Produits", icon: Package },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
    ],
  },
  {
    label: "Partenaires",
    items: [
      { href: "/partenaires", label: "Partenaires", icon: Users },
      { href: "/performances", label: "Performances", icon: BarChart3 },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/finance", label: "Revenus & règlements", icon: Wallet },
      { href: "/parametres/commission", label: "Règles de commission", icon: Percent },
      { href: "/parametres/settlement", label: "Règles de settlement", icon: CalendarClock },
    ],
  },
  {
    label: "Système",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/parametres", label: "Paramètres", icon: Settings },
      { href: "/parametres/system", label: "État du système", icon: Activity },
      { href: "/audit", label: "Audit", icon: ScrollText, superAdminOnly: true },
    ],
  },
];

const PARTNER_NAV: NavGroup[] = [
  {
    label: "Espace de vente",
    items: [
      { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/catalogue", label: "Produits", icon: Package },
      { href: "/nouvelle-commande", label: "Nouvelle commande", icon: FilePlus2 },
      { href: "/mes-commandes", label: "Mes commandes", icon: ShoppingCart },
    ],
  },
  {
    label: "Suivi",
    items: [
      { href: "/mes-performances", label: "Performances", icon: PieChart },
      { href: "/portefeuille", label: "Portefeuille", icon: Wallet },
      { href: "/mes-notifications", label: "Notifications", icon: Bell },
    ],
  },
];

/** Mobile bottom navigation for partners (mobile-first dashboard). */
const PARTNER_BOTTOM: NavItem[] = [
  { href: "/tableau-de-bord", label: "Bord", icon: LayoutDashboard },
  { href: "/catalogue", label: "Produits", icon: Package },
  { href: "/nouvelle-commande", label: "Commande", icon: FilePlus2 },
  { href: "/mes-commandes", label: "Commandes", icon: ShoppingCart },
  { href: "/mes-performances", label: "Perf.", icon: PieChart },
];

const STORAGE_KEY = "ecc:shell:collapsed";

/* Client-only state is read through useSyncExternalStore rather than an effect
   that calls setState: the server snapshot is rendered during SSR *and* during
   hydration, then React re-renders with the browser value. Same output as an
   effect, minus the cascading render. */

/** Stable snapshots — inline arrows would be a new reference on every render. */
function snapshotFalse(): boolean {
  return false;
}
function snapshotTrue(): boolean {
  return true;
}

/** The snapshots above never change on their own, so there is nothing to watch. */
function subscribeNothing(): () => void {
  return () => {};
}

/** Stored collapse preference. Returns a boolean so the snapshot stays stable. */
function readCollapsedPref(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage can be unavailable (private mode) — the shell still works.
    return false;
  }
}

/** Keeps the preference in sync across tabs; same-tab writes are optimistic. */
function subscribeCollapsedPref(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

/** False on the server and during hydration, true once React is client-side. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, snapshotTrue, snapshotFalse);
}

/**
 * The app shell owns the chrome: sidebar (collapsible on desktop, drawer on
 * mobile), topbar and the content region. Layouts stay server components and
 * pass session data in — this component never fetches anything itself.
 */
export function AppShell({
  scope,
  user,
  unreadCount = 0,
  isSuperAdmin = false,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Server snapshot = expanded, so SSR and the first client render match, then
  // React applies the saved preference on its own.
  const storedCollapsed = useSyncExternalStore(
    subscribeCollapsedPref,
    readCollapsedPref,
    snapshotFalse,
  );
  // The local toggle wins over the store so the button reacts instantly.
  const [toggledCollapsed, setToggledCollapsed] = useState<boolean | null>(null);
  const collapsed = toggledCollapsed ?? storedCollapsed;

  function toggleCollapsed() {
    const next = !collapsed;
    setToggledCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Ignore quota/private-mode failures; the state still toggles.
    }
  }

  const groups =
    scope === "admin"
      ? ADMIN_NAV.map((g) => ({
          ...g,
          items: g.items.filter((i) => !i.superAdminOnly || isSuperAdmin),
        }))
      : PARTNER_NAV;

  const fullName = `${user.firstName} ${user.lastName}`;
  const badge = formatUnreadCount(unreadCount);
  const notificationsHref = scope === "admin" ? "/notifications" : "/mes-notifications";

  return (
    <div
      className={cn(
        "min-h-screen bg-background transition-[padding] duration-200 ease-out",
        collapsed ? "lg:pl-[76px]" : "lg:pl-60",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[76px]" : "w-60",
        )}
        aria-label="Navigation latérale"
      >
        <Brand scope={scope} compact={collapsed} />
        <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Navigation principale">
          {groups.map((group) => (
            <NavGroupBlock
              key={group.label}
              group={group}
              pathname={pathname}
              collapsedMode={collapsed}
            />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Replier le menu</span>
              </>
            )}
          </button>
          <p className={cn("mt-2 text-center text-[10px] text-sidebar-faint", collapsed && "hidden")}>
            Version 0.1.0
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm data-[state=open]:animate-[shell-fade-in_150ms_ease-out] data-[state=closed]:animate-[shell-fade-out_120ms_ease-in]" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar outline-none data-[state=open]:animate-[shell-drawer-in_180ms_ease-out] data-[state=closed]:animate-[shell-drawer-out_160ms_ease-in]"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div className="relative">
              <Brand scope={scope} />
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="absolute right-3 top-4 rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
                  aria-label="Fermer le menu"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Navigation principale">
              {groups.map((group) => (
                <NavGroupBlock
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  onNavigate={() => setDrawerOpen(false)}
                />
              ))}
            </nav>
            <div className="border-t border-sidebar-border p-3">
              <p className="px-3 text-[10px] text-sidebar-faint">Version 0.1.0</p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Topbar + content */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label="Ouvrir la navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <TodayChip />
            <Link
              href={notificationsHref}
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label={
                unreadCount > 0 ? `Notifications (${badge} non lues)` : "Notifications"
              }
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
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

        <main
          id="main-content"
          className={cn(
            "mx-auto w-full flex-1 p-4 lg:p-6",
            scope === "admin" ? "max-w-7xl" : "max-w-6xl pb-24 lg:pb-6",
          )}
        >
          {children}
        </main>
      </div>

      {/* Partner mobile bottom navigation */}
      {scope === "partenaire" && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card lg:hidden"
          aria-label="Navigation mobile"
        >
          {PARTNER_BOTTOM.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** One labelled section of nav links (divider instead of a label when collapsed). */
function NavGroupBlock({
  group,
  pathname,
  collapsedMode = false,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  collapsedMode?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div>
      {collapsedMode ? (
        <div className="mx-2 mb-2 border-t border-sidebar-border" aria-hidden="true" />
      ) : (
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-faint">
          {group.label}
        </p>
      )}
      <div className="space-y-1">
        {group.items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              // Native tooltip when collapsed (never clipped by nav overflow).
              title={collapsedMode ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsedMode && "justify-center px-0 py-2.5",
                active
                  ? "bg-sidebar-active text-white"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsedMode && <span className="truncate">{item.label}</span>}
              <span className={collapsedMode ? "sr-only" : "hidden"}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Logo block; compact = icon only (collapsed sidebar). */
function Brand({
  scope,
  compact = false,
}: {
  scope: "admin" | "partenaire";
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-active text-sm font-bold text-white">
          E
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-active text-sm font-bold text-white">
        E
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold text-white">E-COM COLAB</div>
        <div className="truncate text-[11px] text-sidebar-faint">
          {scope === "admin" ? "Opérations" : "Espace partenaire"}
        </div>
      </div>
    </div>
  );
}

/** Today's date, formatted on the client to avoid a timezone mismatch at hydration. */
function TodayChip() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return <div className="hidden h-8 w-44 rounded-lg bg-muted lg:block" aria-hidden="true" />;
  }
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="hidden h-8 items-center rounded-lg border bg-card px-3 text-xs font-medium text-muted-foreground lg:flex">
      {label}
    </div>
  );
}

