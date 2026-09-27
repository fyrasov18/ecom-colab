"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  Package,
  PieChart,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/catalogue", label: "Produits", icon: Package },
  { href: "/nouvelle-commande", label: "Nouvelle commande", icon: FilePlus2 },
  { href: "/mes-commandes", label: "Mes commandes", icon: ShoppingCart },
  { href: "/mes-performances", label: "Performances", icon: PieChart },
  { href: "/portefeuille", label: "Portefeuille", icon: Wallet },
  { href: "/mes-notifications", label: "Notifications", icon: Bell },
];

export function PartnerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          E
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">E-COM COLAB</div>
          <div className="text-[11px] text-muted-foreground">Espace partenaire</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} E-COM COLAB
      </div>
    </aside>
  );
}

/** Mobile bottom navigation for partners (mobile-friendly dashboard). */
export function PartnerMobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}
