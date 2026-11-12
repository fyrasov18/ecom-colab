import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/rbac";
import { getUserAccount } from "@/modules/account/service";
import { AccountSettingsForm } from "@/components/account/account-settings-form";

export const metadata: Metadata = { title: "Paramètres du compte" };
export const dynamic = "force-dynamic";

export default async function PartnerAccountSettingsPage() {
  const user = await requireSession(["PARTNER"]);
  const account = await getUserAccount(user.id);
  if (!account) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres du compte</h1>
        <p className="text-sm text-muted-foreground">
          Gérez vos informations personnelles et les paramètres de sécurité de votre compte partenaire.
        </p>
      </div>

      <AccountSettingsForm user={account} />
    </div>
  );
}
