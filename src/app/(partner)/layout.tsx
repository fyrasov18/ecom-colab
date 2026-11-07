import { requireSession } from "@/lib/rbac";
import { countUnread } from "@/modules/notifications/queries";
import { AppShell } from "@/components/layout/app-shell";
import { getPendingPartnerPopup } from "@/modules/announcements/service";
import { FullscreenPopupModal } from "@/components/announcements/fullscreen-popup-modal";
import { resolveBrandingContext } from "@/modules/branding/service";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession(["PARTNER"]);
  const [unreadCount, pendingPopup, branding] = await Promise.all([
    countUnread(user.id),
    getPendingPartnerPopup(user.partnerId!, user),
    resolveBrandingContext({ scope: "partenaire", partnerId: user.partnerId }),
  ]);

  return (
    <AppShell
      scope="partenaire"
      unreadCount={unreadCount}
      branding={branding}
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        role: "Partenaire",
      }}
    >
      <FullscreenPopupModal
        initialPopup={pendingPopup}
        partnerId={user.partnerId!}
      />
      {children}
    </AppShell>
  );
}
