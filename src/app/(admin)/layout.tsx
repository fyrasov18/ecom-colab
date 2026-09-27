import { requireSession } from "@/lib/rbac";
import { countUnread } from "@/modules/notifications/queries";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const unreadCount = await countUnread(user.id);

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar isSuperAdmin={user.role === "SUPER_ADMIN"} />
      <div className="lg:pl-60">
        <AppHeader
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin / Ops",
          }}
          scope="admin"
          unreadCount={unreadCount}
        />
        <main className="mx-auto w-full max-w-7xl p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
