"use client";

import { useSyncExternalStore, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  Contact,
  FilePlus2,
  FolderTree,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Menu,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  PieChart,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnreadCount } from "@/modules/notifications/labels";
import { GlobalSearch } from "./global-search";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { NotificationCenterDropdown } from "@/components/notifications/notification-center-dropdown";
import { DynamicBrandLogo } from "@/components/brand/dynamic-brand-logo";
import type { ResolvedBranding } from "@/modules/branding/defaults";
import { PageTransition } from "@/components/ui/page-transition";
import { useI18n } from "@/lib/i18n";

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
  /** Platform or partner brand identity and theme resolution. */
  branding?: ResolvedBranding | null;
  children: React.ReactNode;
};

/* Segment-aware active state, except for /parametres: it is a landing page
   whose children (/parametres/system, /parametres/commission…) are listed
   separately, so it must match exactly or several entries would highlight. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/parametres") return pathname === "/parametres";
  if (href === "/partenaires") {
    if (pathname.startsWith("/partenaires/parrainage")) return false;
  }
  if (href === "/produits") {
    if (pathname.startsWith("/produits/categories")) return false;
    if (pathname.startsWith("/produits/suggestions")) return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getAdminNav(t: (k: string) => string): NavGroup[] {
  return [
    {
      label: t("nav.operations"),
      items: [
        { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
        { href: "/commandes", label: t("nav.orders"), icon: ShoppingCart },
        { href: "/logistique", label: t("nav.logistics"), icon: Truck },
        { href: "/clients", label: t("nav.clients"), icon: Contact },
      ],
    },
    {
      label: t("nav.catalogue"),
      items: [
        { href: "/produits", label: t("nav.products"), icon: Package },
        { href: "/produits/categories", label: t("nav.categories"), icon: FolderTree },
        { href: "/produits/suggestions", label: t("nav.productSuggestions"), icon: Lightbulb },
        { href: "/marketing", label: t("nav.marketing"), icon: Megaphone },
      ],
    },
    {
      label: t("nav.partners"),
      items: [
        { href: "/partenaires", label: t("nav.partnerList"), icon: Users },
        { href: "/partenaires/parrainage", label: t("nav.referrals"), icon: UserPlus },
        { href: "/annonces", label: t("nav.announcements"), icon: Megaphone },
        { href: "/performances", label: t("nav.performances"), icon: BarChart3 },
      ],
    },
    {
      label: t("nav.finance"),
      items: [
        { href: "/finance", label: t("nav.revenue"), icon: Wallet },
        { href: "/parametres/commission", label: t("nav.commissionRules"), icon: Percent },
        { href: "/parametres/settlement", label: t("nav.settlementRules"), icon: CalendarClock },
      ],
    },
    {
      label: t("nav.system"),
      items: [
        { href: "/notifications", label: t("nav.notifications"), icon: Bell },
        { href: "/parametres", label: t("nav.settings"), icon: Settings },
        { href: "/parametres/administrateurs", label: t("nav.administrators"), icon: Users, superAdminOnly: true },
        { href: "/parametres/compte", label: t("nav.myAccount"), icon: User },
        { href: "/parametres/design", label: t("nav.brandDesign"), icon: Palette },
        { href: "/parametres/auth-design", label: t("nav.authDesign"), icon: ShieldCheck },
        { href: "/parametres/system", label: t("nav.systemStatus"), icon: Activity },
        { href: "/audit", label: t("nav.audit"), icon: ScrollText, superAdminOnly: true },
      ],
    },
  ];
}

function getPartnerNav(t: (k: string) => string): NavGroup[] {
  return [
    {
      label: t("nav.salesSpace"),
      items: [
        { href: "/tableau-de-bord", label: t("nav.dashboard"), icon: LayoutDashboard },
        { href: "/catalogue", label: t("nav.products"), icon: Package },
        { href: "/suggestions-produits", label: t("nav.productSuggestions"), icon: Lightbulb },
        { href: "/nouvelle-commande", label: t("nav.newOrder"), icon: FilePlus2 },
        { href: "/mes-commandes", label: t("nav.myOrders"), icon: ShoppingCart },
      ],
    },
    {
      label: t("nav.tracking"),
      items: [
        { href: "/suivi-commandes", label: t("nav.orderTracking"), icon: Truck },
        { href: "/parrainage", label: t("nav.referrals"), icon: UserPlus },
        { href: "/mes-performances", label: t("nav.myPerformances"), icon: PieChart },
        { href: "/portefeuille", label: t("nav.wallet"), icon: Wallet },
        { href: "/mon-entreprise", label: t("nav.myCompany"), icon: Building2 },
        { href: "/mon-compte", label: t("nav.myAccount"), icon: User },
        { href: "/mes-notifications", label: t("nav.myNotifications"), icon: Bell },
      ],
    },
  ];
}

function getPartnerBottom(t: (k: string) => string): NavItem[] {
  return [
    { href: "/tableau-de-bord", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/catalogue", label: t("nav.products"), icon: Package },
    { href: "/nouvelle-commande", label: t("nav.newOrder"), icon: FilePlus2 },
    { href: "/mes-commandes", label: t("nav.myOrders"), icon: ShoppingCart },
    { href: "/mes-performances", label: t("nav.myPerformances"), icon: PieChart },
  ];
}

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
  branding,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  // Derived drawer state: store the pathname at which the drawer was opened.
  // When the route changes (any navigation), openedAtPathname !== pathname so
  // drawerOpen evaluates to false automatically — no useEffect needed, no
  // cascading renders, and the react-hooks/set-state-in-effect rule is satisfied.
  // This covers in-drawer link taps, partner bottom-nav, and programmatic navigation.
  const [openedAtPathname, setOpenedAtPathname] = useState<string | null>(null);
  const drawerOpen = openedAtPathname === pathname;

  function openDrawer() { setOpenedAtPathname(pathname); }
  function closeDrawer() { setOpenedAtPathname(null); }


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

  const { t, isRtl } = useI18n();

  const adminNav = useMemo(() => getAdminNav(t), [t]);
  const partnerNav = useMemo(() => getPartnerNav(t), [t]);
  const partnerBottom = useMemo(() => getPartnerBottom(t), [t]);

  const groups =
    scope === "admin"
      ? adminNav.map((g) => ({
          ...g,
          items: g.items.filter((i) => !i.superAdminOnly || isSuperAdmin),
        }))
      : partnerNav;

  const fullName = `${user.firstName} ${user.lastName}`;
  const badge = formatUnreadCount(unreadCount);
  const notificationsHref = scope === "admin" ? "/notifications" : "/mes-notifications";

  return (
    <div
      className={cn(
        "min-h-screen bg-background transition-[padding] duration-200 ease-out",
        isRtl
          ? (collapsed ? "lg:pr-[76px]" : "lg:pr-60")
          : (collapsed ? "lg:pl-[76px]" : "lg:pl-60"),
      )}
    >
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground",
          isRtl ? "focus:right-4" : "focus:left-4",
        )}
      >
        {t("nav.mainContent")}
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 z-30 hidden flex-col bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          isRtl ? "right-0 border-l border-sidebar-border" : "left-0 border-r border-sidebar-border",
          collapsed ? "w-[76px]" : "w-60",
        )}
        aria-label={t("nav.mobileNav")}
      >
        <Brand scope={scope} compact={collapsed} branding={branding} />
        <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Navigation principale">
          {groups.map((group) => (
            <NavGroupBlock
              key={group.label}
              group={group}
              pathname={pathname}
              collapsedMode={collapsed}
              isRtl={isRtl}
            />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground cursor-pointer",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? t("nav.expandMenu") : t("nav.collapseMenu")}
            title={collapsed ? t("nav.expandMenu") : t("nav.collapseMenu")}
          >
            {collapsed ? (
              <PanelLeftOpen className={cn("h-4 w-4 shrink-0", isRtl && "rotate-180")} aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className={cn("h-4 w-4 shrink-0", isRtl && "rotate-180")} aria-hidden="true" />
                <span>{t("nav.collapseMenu")}</span>
              </>
            )}
          </button>
          <p className={cn("mt-2 text-center text-[10px] text-sidebar-faint", collapsed && "hidden")}>
            {branding?.name || "EcomPartner"} · {branding?.tagline || "Operating System"}
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Dialog.Root open={drawerOpen} onOpenChange={(open) => (open ? openDrawer() : closeDrawer())}>
        <Dialog.Portal>
          <Dialog.Overlay
            forceMount
            className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm data-[state=open]:animate-[shell-fade-in_150ms_ease-out] data-[state=closed]:animate-[shell-fade-out_120ms_ease-in] data-[state=closed]:pointer-events-none"
          />
          <Dialog.Content
            forceMount
            id="mobile-nav-drawer"
            aria-describedby={undefined}
            aria-modal="true"
            className={cn(
              "fixed inset-y-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar outline-none data-[state=open]:animate-[shell-drawer-in_180ms_ease-out] data-[state=closed]:animate-[shell-drawer-out_160ms_ease-in] data-[state=closed]:pointer-events-none",
              isRtl ? "right-0 border-l border-sidebar-border" : "left-0 border-r border-sidebar-border",
            )}
          >
            <Dialog.Title className="sr-only">{t("nav.mobileNav")}</Dialog.Title>
            <div className="relative">
              <Brand scope={scope} branding={branding} />
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "absolute top-4 rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
                    isRtl ? "left-3" : "right-3",
                  )}
                  aria-label={t("common.close")}
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
                  onNavigate={closeDrawer}
                  isRtl={isRtl}
                />
              ))}
            </nav>
            <div className="border-t border-sidebar-border p-3">
              <p className="px-3 text-[10px] text-sidebar-faint">EcomPartner v1.0 · Operating System</p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Topbar + content */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => (drawerOpen ? closeDrawer() : openDrawer())}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label={drawerOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <TodayChip />
            <ThemeToggle />
            <LanguageSelector />
            <NotificationCenterDropdown
              initialUnreadCount={unreadCount}
              notificationsHref={notificationsHref}
            />
            <Link
              href={scope === "admin" ? "/parametres/compte" : "/mon-compte"}
              className={cn(
                "hidden items-center gap-2.5 sm:flex group hover:opacity-90 transition-opacity",
                isRtl ? "border-r pr-3" : "border-l pl-3",
              )}
              title={t("nav.myAccount")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-colors group-hover:bg-primary/20">
                {fullName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className={cn("leading-tight", isRtl ? "text-right" : "text-left")}>
                <div className="text-sm font-medium group-hover:text-primary transition-colors">{fullName}</div>
                <div className="text-[11px] text-muted-foreground">{user.role}</div>
              </div>
            </Link>
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
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Partner mobile bottom navigation */}
      {scope === "partenaire" && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card lg:hidden"
          aria-label="Navigation mobile"
        >
          {partnerBottom.map((item) => {
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
  isRtl = false,
}: {
  group: NavGroup;
  pathname: string;
  collapsedMode?: boolean;
  onNavigate?: () => void;
  isRtl?: boolean;
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
              title={collapsedMode ? item.label : undefined}
              className={cn(
                /* Base */
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                /* Smooth transitions — transform + colors only (GPU) */
                "transition-all duration-150 ease-out",
                /* Collapsed icon-only mode */
                collapsedMode && "justify-center px-0 py-2.5",
                /* Active state */
                active
                  ? [
                      "bg-sidebar-active text-white nav-active-glow",
                      /* Left/Right accent bar */
                      !collapsedMode &&
                        (isRtl
                          ? "before:absolute before:right-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:w-0.5 before:rounded-full before:bg-emerald-300 before:opacity-70"
                          : "before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:w-0.5 before:rounded-full before:bg-emerald-300 before:opacity-70"),
                    ]
                  : [
                      "text-sidebar-muted",
                      isRtl
                        ? "hover:bg-sidebar-hover hover:text-sidebar-foreground hover:-translate-x-0.5"
                        : "hover:bg-sidebar-hover hover:text-sidebar-foreground hover:translate-x-0.5",
                    ],
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-150",
                  active && "scale-110",
                )}
                aria-hidden="true"
              />
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
  branding,
}: {
  scope: "admin" | "partenaire";
  compact?: boolean;
  branding?: ResolvedBranding | null;
}) {
  const homeHref = scope === "admin" ? "/dashboard" : "/tableau-de-bord";
  const brandName = branding?.name || "EcomPartner";

  if (compact) {
    return (
      <Link
        href={homeHref}
        className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border transition-opacity hover:opacity-90"
        title={brandName}
      >
        <DynamicBrandLogo iconOnly theme="dark" branding={branding} className="h-8 w-8" />
      </Link>
    );
  }
  return (
    <Link
      href={homeHref}
      className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4 transition-opacity hover:opacity-95"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <DynamicBrandLogo variant="compact" theme="dark" branding={branding} />
      </div>
      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider shrink-0">
        {scope === "admin" ? "Ops" : "Partner"}
      </span>
    </Link>
  );
}

/** Today's date, formatted on the client to avoid a timezone mismatch at hydration. */
function TodayChip() {
  const hydrated = useHydrated();
  const { locale } = useI18n();
  if (!hydrated) {
    return <div className="hidden h-8 w-44 rounded-lg bg-muted lg:block" aria-hidden="true" />;
  }
  const intlLocale = locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR";
  const label = new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="hidden h-8 items-center rounded-md border bg-card px-3 text-xs font-medium text-muted-foreground lg:flex">
      {label}
    </div>
  );
}

