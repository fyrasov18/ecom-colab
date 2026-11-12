"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  KeyRound,
  Edit,
  Power,
  X,
  Shield,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAdminAction,
  updateAdminAction,
  toggleAdminStatusAction,
  resetAdminPasswordAction,
} from "./actions";
import type { AdminUserItem } from "@/modules/admin-management/service";
import {
  PERMISSIONS,
  PERMISSION_METADATA,
  type Permission,
  type PermissionCategory,
} from "@/lib/permissions";

export function AdminManagementClient({
  admins,
  activeSuperAdminCount,
}: {
  admins: AdminUserItem[];
  activeSuperAdminCount: number;
}) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminUserItem | null>(null);
  const [resetPwAdmin, setResetPwAdmin] = useState<AdminUserItem | null>(null);

  const [isCreatePending, startCreateTransition] = useTransition();
  const [isUpdatePending, startUpdateTransition] = useTransition();
  const [isResetPending, startResetTransition] = useTransition();

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startCreateTransition(async () => {
      const res = await createAdminAction(null, formData);
      if (res.ok && res.message) {
        toast.success(res.message);
        setCreateOpen(false);
      } else if (!res.ok && res.error) {
        toast.error(res.error);
      }
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startUpdateTransition(async () => {
      const res = await updateAdminAction(null, formData);
      if (res.ok && res.message) {
        toast.success(res.message);
        setEditAdmin(null);
      } else if (!res.ok && res.error) {
        toast.error(res.error);
      }
    });
  };

  const handleResetPwSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startResetTransition(async () => {
      const res = await resetAdminPasswordAction(null, formData);
      if (res.ok && res.message) {
        toast.success(res.message);
        setResetPwAdmin(null);
      } else if (!res.ok && res.error) {
        toast.error(res.error);
      }
    });
  };

  // Handle status toggle
  const handleToggleStatus = async (admin: AdminUserItem) => {
    const newStatus = admin.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (admin.isLastSuperAdmin && newStatus === "DISABLED") {
      toast.error(t("adminManagement.protectLastSuperAdminDisable"));
      return;
    }

    const res = await toggleAdminStatusAction(admin.id, newStatus);
    if (res.ok && res.message) {
      toast.success(res.message);
    } else if (!res.ok && res.error) {
      toast.error(res.error);
    }
  };

  // Group permissions by category for the checkboxes
  const categories: PermissionCategory[] = [
    "Partenaires",
    "Catalogue",
    "Commandes & Logistique",
    "Finance",
    "Statistiques",
    "Configuration",
  ];

  const getCategoryLabel = (cat: PermissionCategory) => {
    switch (cat) {
      case "Partenaires":
        return t("adminManagement.catPartners");
      case "Catalogue":
        return t("adminManagement.catCatalogue");
      case "Commandes & Logistique":
        return t("adminManagement.catOrders");
      case "Finance":
        return t("adminManagement.catFinance");
      case "Statistiques":
        return t("adminManagement.catStats");
      case "Configuration":
        return t("adminManagement.catConfig");
      default:
        return cat;
    }
  };

  const permissionsByCategory: Record<PermissionCategory, Permission[]> = {
    Partenaires: [],
    Catalogue: [],
    "Commandes & Logistique": [],
    Finance: [],
    Statistiques: [],
    Configuration: [],
  };

  (Object.keys(PERMISSION_METADATA) as Permission[]).forEach((p) => {
    const cat = PERMISSION_METADATA[p].category;
    permissionsByCategory[cat].push(p);
  });

  // State for create modal role & permissions
  const [createRole, setCreateRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    PERMISSIONS.VIEW_PARTNERS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_STOCKS,
  ]);

  // State for edit modal role & permissions
  const [editRole, setEditRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");

  const openEditModal = (admin: AdminUserItem) => {
    setEditAdmin(admin);
    setEditRole(admin.role as "ADMIN" | "SUPER_ADMIN");
    setEditStatus(admin.status);
    setEditPermissions(admin.permissions);
  };

  const toggleCreatePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const toggleEditPermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const totalAdmins = admins.length;
  const superAdmins = admins.filter((a) => a.role === "SUPER_ADMIN").length;
  const limitedAdmins = admins.filter((a) => a.role === "ADMIN").length;
  const activeAdmins = admins.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* ── KPIs Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border bg-card/60">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t("adminManagement.totalAdmins")}</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight">{totalAdmins}</p>
          </CardContent>
        </Card>

        <Card className="border border-purple-200/50 bg-purple-50/20 dark:bg-purple-950/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{t("adminManagement.superAdmins")}</span>
              <ShieldAlert className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-purple-900 dark:text-purple-100">
              {superAdmins} <span className="text-xs font-normal text-muted-foreground">({activeSuperAdminCount} {t("adminManagement.activeCount")})</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border border-blue-200/50 bg-blue-50/20 dark:bg-blue-950/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t("adminManagement.limitedAdmins")}</span>
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-blue-900 dark:text-blue-100">
              {limitedAdmins}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200/50 bg-emerald-50/20 dark:bg-emerald-950/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t("adminManagement.activeAdmins")}</span>
              <Power className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
              {activeAdmins}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Table & Actions Header ── */}
      <Card className="border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t("adminManagement.tableTitle")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("adminManagement.tableSubtitle")}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
            <UserPlus className="h-4 w-4" />
            {t("adminManagement.createAdminButton")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminManagement.colAdmin")}</TableHead>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead>{t("adminManagement.colRole")}</TableHead>
                  <TableHead>{t("adminManagement.colStatus")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("adminManagement.colPermissions")}</TableHead>
                  <TableHead className="text-right">{t("adminManagement.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const isSuper = admin.role === "SUPER_ADMIN";
                  const isActive = admin.status === "ACTIVE";

                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {admin.firstName[0]}
                            {admin.lastName[0]}
                          </div>
                          <div>
                            <div>
                              {admin.firstName} {admin.lastName}
                            </div>
                            <div className="text-[11px] text-muted-foreground md:hidden">
                              {admin.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                        {admin.email}
                      </TableCell>
                      <TableCell>
                        {isSuper ? (
                          <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1 text-[11px]">
                            <ShieldAlert className="h-3 w-3" />
                            {t("adminManagement.superAdmins")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-blue-600 border-blue-300 dark:border-blue-800 gap-1 text-[11px]">
                            <ShieldCheck className="h-3 w-3" />
                            {t("adminManagement.limitedAdmins")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge variant="success" className="text-[11px]">{t("common.active")}</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[11px]">{t("common.disabled")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs text-xs text-muted-foreground">
                        {isSuper ? (
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {t("adminManagement.allPermissions")}
                          </span>
                        ) : admin.permissions.length > 0 ? (
                          <span className="truncate block" title={admin.permissions.join(", ")}>
                            {t("adminManagement.permissionsCount", { count: admin.permissions.length })}
                          </span>
                        ) : (
                          <span className="italic">{t("adminManagement.allPermissions")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(admin)}
                            className="h-8 px-2 text-xs"
                            title={t("adminManagement.editTooltip")}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetPwAdmin(admin)}
                            className="h-8 px-2 text-xs"
                            title={t("adminManagement.resetPwTooltip")}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(admin)}
                            disabled={admin.isLastSuperAdmin && isActive}
                            className={`h-8 px-2 text-xs ${
                              isActive
                                ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                            title={
                              admin.isLastSuperAdmin && isActive
                                ? t("adminManagement.protectLastSuperAdminDisable")
                                : isActive
                                ? t("adminManagement.toggleStatusTooltip")
                                : t("adminManagement.toggleStatusTooltip")
                            }
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Modal : Création d'un administrateur ── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {t("adminManagement.createModalTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-fn">{t("account.firstName")}</Label>
                  <Input id="create-fn" name="firstName" required placeholder={t("account.firstNamePlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-ln">{t("account.lastName")}</Label>
                  <Input id="create-ln" name="lastName" required placeholder={t("account.lastNamePlaceholder")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-email">{t("account.email")}</Label>
                <Input
                  id="create-email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@ecom-colab.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-pw">{t("account.newPassword")}</Label>
                <Input
                  id="create-pw"
                  name="password"
                  type="password"
                  required
                  placeholder={t("account.reqMinLength")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-role">{t("adminManagement.roleLabel")}</Label>
                <NativeSelect
                  id="create-role"
                  name="role"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as "ADMIN" | "SUPER_ADMIN")}
                >
                  <option value="ADMIN">{t("adminManagement.roleAdminOption")}</option>
                  <option value="SUPER_ADMIN">{t("adminManagement.roleSuperAdminOption")}</option>
                </NativeSelect>
              </div>

              {/* Granular permissions checklist if ADMIN */}
              {createRole === "ADMIN" ? (
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("adminManagement.granularPermissionsLabel")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPermissions(Object.values(PERMISSIONS))
                      }
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {t("adminManagement.selectAll")}
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    {categories.map((cat) => (
                      <div key={cat} className="space-y-2">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 border-b pb-1">
                          {getCategoryLabel(cat)}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {permissionsByCategory[cat].map((p) => {
                            const meta = PERMISSION_METADATA[p];
                            const isChecked = selectedPermissions.includes(p);

                            return (
                              <label
                                key={p}
                                className="flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-muted/40 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  name="permissions"
                                  value={p}
                                  checked={isChecked}
                                  onChange={() => toggleCreatePermission(p)}
                                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                                />
                                <div className="leading-tight">
                                  <div className="font-medium">{meta.label}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {meta.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 dark:bg-purple-950/30 p-4 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
                  <div>
                    <strong>Super Admin :</strong> {t("adminManagement.superAdminCreateNotice")}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isCreatePending}>
                  {isCreatePending ? t("common.loading") : t("adminManagement.createAdminButton")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal : Modification d'un administrateur ── */}
      {editAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                {t("adminManagement.editModalTitle", { email: editAdmin.email })}
              </h2>
              <button
                type="button"
                onClick={() => setEditAdmin(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <input type="hidden" name="adminId" value={editAdmin.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-fn">{t("account.firstName")}</Label>
                  <Input
                    id="edit-fn"
                    name="firstName"
                    required
                    defaultValue={editAdmin.firstName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-ln">{t("account.lastName")}</Label>
                  <Input
                    id="edit-ln"
                    name="lastName"
                    required
                    defaultValue={editAdmin.lastName}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-role">{t("adminManagement.roleLabel")}</Label>
                  <NativeSelect
                    id="edit-role"
                    name="role"
                    value={editRole}
                    disabled={editAdmin.isLastSuperAdmin}
                    onChange={(e) => setEditRole(e.target.value as "ADMIN" | "SUPER_ADMIN")}
                  >
                    <option value="ADMIN">{t("adminManagement.roleAdminOption")}</option>
                    <option value="SUPER_ADMIN">{t("adminManagement.roleSuperAdminOption")}</option>
                  </NativeSelect>
                  {editAdmin.isLastSuperAdmin && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      {t("adminManagement.protectLastSuperAdminDemote")}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">{t("adminManagement.statusLabel")}</Label>
                  <NativeSelect
                    id="edit-status"
                    name="status"
                    value={editStatus}
                    disabled={editAdmin.isLastSuperAdmin}
                    onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "DISABLED")}
                  >
                    <option value="ACTIVE">{t("adminManagement.statusActive")}</option>
                    <option value="DISABLED">{t("adminManagement.statusDisabled")}</option>
                  </NativeSelect>
                  {editAdmin.isLastSuperAdmin && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      {t("adminManagement.protectLastSuperAdminDisable")}
                    </p>
                  )}
                </div>
              </div>

              {/* Granular permissions checklist if ADMIN */}
              {editRole === "ADMIN" ? (
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("adminManagement.granularPermissionsLabel")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditPermissions(Object.values(PERMISSIONS))
                      }
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {t("adminManagement.selectAll")}
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    {categories.map((cat) => (
                      <div key={cat} className="space-y-2">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 border-b pb-1">
                          {getCategoryLabel(cat)}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {permissionsByCategory[cat].map((p) => {
                            const meta = PERMISSION_METADATA[p];
                            const isChecked = editPermissions.includes(p);

                            return (
                              <label
                                key={p}
                                className="flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-muted/40 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  name="permissions"
                                  value={p}
                                  checked={isChecked}
                                  onChange={() => toggleEditPermission(p)}
                                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                                />
                                <div className="leading-tight">
                                  <div className="font-medium">{meta.label}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {meta.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 dark:bg-purple-950/30 p-4 text-xs text-purple-900 dark:text-purple-200">
                  {t("adminManagement.superAdminNotice")}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditAdmin(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isUpdatePending}>
                  {isUpdatePending ? t("common.loading") : t("common.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal : Réinitialisation du mot de passe ── */}
      {resetPwAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                {t("adminManagement.resetPwModalTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setResetPwAdmin(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              {t("adminManagement.resetPwSubtitle", { email: resetPwAdmin.email })}
            </p>

            <form onSubmit={handleResetPwSubmit} className="space-y-4">
              <input type="hidden" name="adminId" value={resetPwAdmin.id} />

              <div className="space-y-1.5">
                <Label htmlFor="reset-pw">{t("account.newPassword")}</Label>
                <Input
                  id="reset-pw"
                  name="newPassword"
                  type="password"
                  required
                  placeholder={t("account.reqMinLength")}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetPwAdmin(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isResetPending}>
                  {isResetPending ? t("common.loading") : t("adminManagement.resetPwTooltip")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
