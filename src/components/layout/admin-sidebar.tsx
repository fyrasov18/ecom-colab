"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Contact,
  LayoutDashboard,
  Megaphone,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/commandes", label: "Commandes", icon: ShoppingCart },
  { href: "/produits", label: "Produits", icon: Package },
  { href: "/partenaires", label: "Partenaires", icon: Users },
  { href: "/clients", label: "Clients", icon: Contact },
  { href: "/logistique", label: "Logistique", icon: Truck },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/performances", label: "Performances", icon: BarChart3 },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/parametres", label: "Paramètres", icon: Settings },
  { href: "/parametres/system", label: "État du système", icon: Activity },
  { href: "/audit", label: "Audit", icon: ScrollText, superAdminOnly: true },
];

export function AdminSidebar({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          E
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">E-COM COLAB</div>
          <div className="text-[11px] text-muted-foreground">Opérations</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          // Segment-aware nesting, except for /parametres: it is a landing page
          // whose children (/parametres/system) are listed separately, so it
          // must match exactly or both entries would highlight at once.
          const active =
            item.href === "/parametres"
              ? pathname === "/parametres"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
