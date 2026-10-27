import { requireSession } from "@/lib/rbac";
import { countUnread } from "@/modules/notifications/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const unreadCount = await countUnread(user.id);

  return (
    <AppShell
      scope="admin"
      isSuperAdmin={user.role === "SUPER_ADMIN"}
      unreadCount={unreadCount}
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
