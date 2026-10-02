import { requireSession } from "@/lib/rbac";
import { countUnread } from "@/modules/notifications/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession(["PARTNER"]);
  const unreadCount = await countUnread(user.id);

  return (
    <AppShell
      scope="partenaire"
      unreadCount={unreadCount}
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        role: "Partenaire",
      }}
    >
      {children}
    </AppShell>
  );
}
