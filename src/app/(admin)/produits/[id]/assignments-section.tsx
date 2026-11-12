"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Users,
  Award,
  User,
  UserX,
  UserPlus,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Badge } from "@/components/ui/badge";
import { assignProduct, removeAssignment, type ActionState } from "../../partenaires/actions";

export type PartnerOption = {
  id: string;
  displayName: string;
  performanceLevelId?: string | null;
};

export type LevelOption = {
  id: string;
  name: string;
};

type Assigned = {
  partnerId: string;
  commissionType: string | null;
  commissionValue: unknown;
  partner: { displayName: string };
};

type AssignTarget = "ALL" | "BY_LEVEL" | "INDIVIDUAL" | "NO_LEVEL";

const initialState: ActionState = { ok: false };

export function AssignmentsSection({
  productId,
  assigned,
  partners,
  levels = [],
  canEditCommission,
}: {
  productId: string;
  assigned: Assigned[];
  partners: PartnerOption[];
  levels?: LevelOption[];
  canEditCommission: boolean;
}) {
  const { dict, dir } = useI18n();
  const t = dict.products;
  const c = dict.common;
  const p = dict.partners;

  const [targetType, setTargetType] = useState<AssignTarget>("ALL");
  const [selectedLevelId, setSelectedLevelId] = useState<string>(levels[0]?.id ?? "");

  const [state, formAction] = useActionState(assignProduct, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  const assignedIds = new Set(assigned.map((a) => a.partnerId));

  // Compute live breakdown for each target option
  const allEligible = partners;
  const allToAssign = partners.filter((pr) => !assignedIds.has(pr.id));

  const partnersInLevel = partners.filter((pr) => pr.performanceLevelId === selectedLevelId);
  const levelToAssign = partnersInLevel.filter((pr) => !assignedIds.has(pr.id));

  const individualAvailable = partners.filter((pr) => !assignedIds.has(pr.id));

  // Option 4: Partners without performance level (NULL or undefined)
  const partnersWithoutLevel = partners.filter((pr) => !pr.performanceLevelId);
  const noLevelToAssign = partnersWithoutLevel.filter((pr) => !assignedIds.has(pr.id));

  return (
    <section className="space-y-6" id="partenaires">
      <div>
        <h2 className="text-base font-semibold">{t.assignments}</h2>
        <p className="text-sm text-muted-foreground">
          {t.assignedPartnersCount.replace("{count}", String(assigned.length))}
        </p>
      </div>

      {/* Target Type Selector (4 options) */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t.targetType}</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Option 1: All Partners */}
          <button
            type="button"
            onClick={() => setTargetType("ALL")}
            className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition-all ${
              dir === "rtl" ? "text-right" : "text-left"
            } ${
              targetType === "ALL"
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`p-1.5 rounded-md ${
                  targetType === "ALL"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Users className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-foreground">{t.targetAll}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {t.targetAllDesc}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[11px] font-normal">
                {allToAssign.length} / {allEligible.length}
              </Badge>
            </div>
          </button>

          {/* Option 2: By Performance Level */}
          <button
            type="button"
            onClick={() => setTargetType("BY_LEVEL")}
            className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition-all ${
              dir === "rtl" ? "text-right" : "text-left"
            } ${
              targetType === "BY_LEVEL"
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`p-1.5 rounded-md ${
                  targetType === "BY_LEVEL"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Award className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-foreground">{t.targetByLevel}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {t.targetByLevelDesc}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[11px] font-normal">
                {levels.length} {levels.length > 1 ? "niveaux" : "niveau"}
              </Badge>
            </div>
          </button>

          {/* Option 3: Individual Partner */}
          <button
            type="button"
            onClick={() => setTargetType("INDIVIDUAL")}
            className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition-all ${
              dir === "rtl" ? "text-right" : "text-left"
            } ${
              targetType === "INDIVIDUAL"
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`p-1.5 rounded-md ${
                  targetType === "INDIVIDUAL"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <User className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-foreground">{t.targetIndividual}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {t.targetIndividualDesc}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[11px] font-normal">
                {individualAvailable.length} dispo
              </Badge>
            </div>
          </button>

          {/* Option 4: Partners Without Performance Level */}
          <button
            type="button"
            onClick={() => setTargetType("NO_LEVEL")}
            className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition-all ${
              dir === "rtl" ? "text-right" : "text-left"
            } ${
              targetType === "NO_LEVEL"
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`p-1.5 rounded-md ${
                  targetType === "NO_LEVEL"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <UserX className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm text-foreground">{t.targetNoLevel}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {t.targetNoLevelDesc}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[11px] font-normal">
                {noLevelToAssign.length} / {partnersWithoutLevel.length}
              </Badge>
            </div>
          </button>
        </div>
      </div>

      {/* Target Action Form */}
      <form action={formAction} className="rounded-lg border bg-card p-4 space-y-4">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="targetType" value={targetType} />

        {/* ── Mode 1: ALL ── */}
        {targetType === "ALL" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">{t.targetAll}</p>
                <p>{t.targetAllDesc}</p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                  <span>{t.eligiblePartnersCount.replace("{count}", String(allEligible.length))}</span>
                  <span>•</span>
                  <span>{t.alreadyAssignedCount.replace("{count}", String(allEligible.length - allToAssign.length))}</span>
                  <span>•</span>
                  <span className="font-semibold text-foreground">
                    {t.toAssignCount.replace("{count}", String(allToAssign.length))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button type="submit" disabled={allToAssign.length === 0}>
                <Users className="h-4 w-4" />
                {t.assignAllBtn} ({allToAssign.length})
              </Button>
            </div>
          </div>
        )}

        {/* ── Mode 2: BY_LEVEL ── */}
        {targetType === "BY_LEVEL" && (
          <div className="space-y-4">
            {levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noEligiblePartners}</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="as-level">{t.selectPerformanceLevel}</Label>
                    <NativeSelect
                      id="as-level"
                      name="performanceLevelId"
                      value={selectedLevelId}
                      onChange={(e) => setSelectedLevelId(e.target.value)}
                    >
                      {levels.map((lvl) => (
                        <option key={lvl.id} value={lvl.id}>
                          {lvl.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <Award className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{t.targetByLevel}</p>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                      <span>{t.eligiblePartnersCount.replace("{count}", String(partnersInLevel.length))}</span>
                      <span>•</span>
                      <span>{t.alreadyAssignedCount.replace("{count}", String(partnersInLevel.length - levelToAssign.length))}</span>
                      <span>•</span>
                      <span className="font-semibold text-foreground">
                        {t.toAssignCount.replace("{count}", String(levelToAssign.length))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <Button type="submit" disabled={levelToAssign.length === 0 || !selectedLevelId}>
                    <Award className="h-4 w-4" />
                    {t.assignByLevelBtn} ({levelToAssign.length})
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Mode 3: INDIVIDUAL ── */}
        {targetType === "INDIVIDUAL" && (
          <div className="space-y-4">
            {individualAvailable.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.allPartnersAssigned}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-56 flex-1 space-y-1.5">
                    <Label htmlFor="as-partner">{p.partnerList}</Label>
                    <NativeSelect id="as-partner" name="partnerId">
                      {individualAvailable.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.displayName}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="as-ctype">{p.commissionType}</Label>
                    <NativeSelect
                      id="as-ctype"
                      name="commissionType"
                      defaultValue=""
                      className="w-44"
                      disabled={!canEditCommission}
                    >
                      <option value="">{c.status}</option>
                      <option value="PERCENTAGE">{p.percentage}</option>
                      <option value="FIXED">{p.fixed}</option>
                    </NativeSelect>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="as-cvalue">{p.commissionValue}</Label>
                    <Input
                      id="as-cvalue"
                      name="commissionValue"
                      type="number"
                      step="0.001"
                      min="0"
                      className="w-32"
                      placeholder="—"
                      disabled={!canEditCommission}
                    />
                  </div>

                  <Button type="submit">
                    <UserPlus className="h-4 w-4" />
                    {t.assignToPartner}
                  </Button>
                </div>

                {!canEditCommission && (
                  <p className="text-xs text-muted-foreground">
                    Seul un Super Administrateur peut définir une commission personnalisée par partenaire.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Mode 4: NO_LEVEL (Partners without performance level) ── */}
        {targetType === "NO_LEVEL" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-foreground">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {t.targetNoLevel}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {t.noLevelNotice}
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px] text-muted-foreground">
                  <span>{t.eligiblePartnersCount.replace("{count}", String(partnersWithoutLevel.length))}</span>
                  <span>•</span>
                  <span>{t.alreadyAssignedCount.replace("{count}", String(partnersWithoutLevel.length - noLevelToAssign.length))}</span>
                  <span>•</span>
                  <span className="font-semibold text-foreground">
                    {t.toAssignCount.replace("{count}", String(noLevelToAssign.length))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button type="submit" disabled={noLevelToAssign.length === 0}>
                <UserX className="h-4 w-4" />
                {t.assignNoLevelBtn} ({noLevelToAssign.length})
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Assigned partners table/list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t.assignments}</h3>
        {assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.allPartnersAssigned}</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {assigned.map((a) => (
              <li key={a.partnerId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <Link
                    href={`/partenaires/${a.partnerId}`}
                    className="font-medium text-foreground hover:underline text-sm"
                  >
                    {a.partner.displayName}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.commissionType ? (
                      <span className="font-medium text-primary">
                        {p.customCommission} :{" "}
                        {a.commissionType === "PERCENTAGE"
                          ? `${a.commissionValue} %`
                          : `${a.commissionValue} DT`}
                      </span>
                    ) : (
                      <span>{dict.nav.commissionRules}</span>
                    )}
                  </div>
                </div>

                <form action={removeAssignment}>
                  <input type="hidden" name="partnerId" value={a.partnerId} />
                  <input type="hidden" name="productId" value={productId} />
                  <ConfirmSubmit
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    confirmMessage={c.delete}
                  >
                    {c.delete}
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
