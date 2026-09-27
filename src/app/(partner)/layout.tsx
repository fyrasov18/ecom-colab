import { requireSession } from "@/lib/rbac";
import { countUnread } from "@/modules/notifications/queries";
import {
  PartnerMobileNav,
  PartnerSidebar,
} from "@/components/layout/partner-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession(["PARTNER"]);
  const unreadCount = await countUnread(user.id);

  return (
    <div className="min-h-screen bg-background">
      <PartnerSidebar />
      <div className="lg:pl-60">
        <AppHeader
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            role: "Partenaire",
          }}
          scope="partenaire"
          unreadCount={unreadCount}
        />
        <main className="mx-auto w-full max-w-6xl p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>
      <PartnerMobileNav />
    </div>
  );
}
