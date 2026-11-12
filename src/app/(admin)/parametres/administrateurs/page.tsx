import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { listAdministrators } from "@/modules/admin-management/service";
import { AdminManagementClient } from "./admin-management-client";

export const metadata: Metadata = {
  title: "Gestion des administrateurs",
  description: "Création et gestion des comptes administrateurs et permissions granulaires",
};

export const dynamic = "force-dynamic";

export default async function AdminManagementPage() {
  await requireSession(["SUPER_ADMIN"]);
  const { admins, activeSuperAdminCount } = await listAdministrators();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion des administrateurs</h1>
        <p className="text-sm text-muted-foreground">
          Créez et configurez les comptes administrateurs, attribuez les rôles et définissez les permissions granulaires.
        </p>
      </div>

      <AdminManagementClient
        admins={admins}
        activeSuperAdminCount={activeSuperAdminCount}
      />
    </div>
  );
}
