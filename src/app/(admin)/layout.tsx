import { requireSession } from "@/lib/rbac";
import { countUnread } from "@/modules/notifications/queries";
import { AppShell } from "@/components/layout/app-shell";
import { resolveBrandingContext } from "@/modules/branding/service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const [unreadCount, branding] = await Promise.all([
    countUnread(user.id),
    resolveBrandingContext({ scope: "admin" }),
  ]);

  return (
    <AppShell
      scope="admin"
      isSuperAdmin={user.role === "SUPER_ADMIN"}
      unreadCount={unreadCount}
      branding={branding}
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin / Ops",
      }}
    >
      {children}
    </AppShell>
  );
}
