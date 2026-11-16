"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  Award,
  Trophy,
  Star,
  Crown,
  Shield,
  TrendingUp,
  Medal,
  Zap,
  Flame,
  Gem,
  Target,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  History,
  UserCheck,
  Percent,
  Package,
  Layers,
  Sparkles,
  Info,
  Clock,
  User,
  Phone,
  ShieldAlert,
  Loader2,
  Filter,
  ArrowUp,
  ArrowDown,
  Power,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n";
import {
  savePerformanceLevelAction,
  deletePerformanceLevelAction,
  toggleLevelActiveAction,
  reorderLevelsAction,
  manualAssignPartnerLevelAction,
  evaluateAllPartnersAction,
  getPartnerHistoryAction,
} from "./actions";
import {
  parsePerformanceCriteria,
  getLocalizedLevelName,
  getLocalizedLevelDescription,
  validateProgressionRules,
  type PerformanceLevelCriteria,
} from "@/modules/finance/performance-levels";
import type { PartnerPerformanceOverviewDTO } from "@/modules/finance/performance-service";

export type PerformanceLevelItem = {
  id: string;
  name: string;
  description: string | null;
  sharePercentage: number;
  sortOrder: number;
  isActive: boolean;
  criteria: unknown;
  _count?: { partners: number };
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string; label: string }> = {
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800", label: "Ambre / Bronze" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800", label: "Émeraude / Platine" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800", label: "Saphir / Bleu" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", badge: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800", label: "Améthyste / Violet" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30", badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800", label: "Rubis / Rose" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/30", badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700", label: "Argent / Slate" },
  bronze: { bg: "bg-amber-700/10", text: "text-amber-700 dark:text-amber-500", border: "border-amber-700/30", badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-600/40", label: "Bronze classique" },
  gold: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-400 dark:border-yellow-800", label: "Or / Gold" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30", badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800", label: "Indigo / Diamant" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30", badge: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800", label: "Turquoise / Teal" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800", label: "Cyan / Cristal" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", badge: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300 dark:border-orange-800", label: "Orange / Flamme" },
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Award,
  Trophy,
  Star,
  Crown,
  Shield,
  TrendingUp,
  Medal,
  Zap,
  Flame,
  Sparkles,
  Gem,
  Target,
};

function renderLevelBadge(level: { name: string; criteria?: unknown }, locale: string) {
  const criteria = parsePerformanceCriteria(level.criteria);
  const color = COLOR_MAP[criteria.color] ?? COLOR_MAP.blue;
  const IconComponent = ICON_MAP[criteria.icon] ?? Award;
  const displayName = getLocalizedLevelName(level, locale);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color.badge}`}
    >
      <IconComponent className="h-3.5 w-3.5 shrink-0" />
      <span>{displayName}</span>
    </span>
  );
}

export function PerformanceLevelsClient({
  levels: initialLevels,
  partners: initialPartners,
  canManage,
}: {
  levels: PerformanceLevelItem[];
  partners: PartnerPerformanceOverviewDTO[];
  canManage: boolean;
}) {
  const { t, locale, isRtl } = useI18n();
  const [levels, setLevels] = useState(initialLevels);
  const [partners, setPartners] = useState(initialPartners);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [eligibleOnly, setEligibleOnly] = useState(false);

  // Transitions
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [editingLevel, setEditingLevel] = useState<PerformanceLevelItem | null | "NEW">(null);
  const [deletingLevel, setDeletingLevel] = useState<PerformanceLevelItem | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");

  const [assigningPartner, setAssigningPartner] = useState<PartnerPerformanceOverviewDTO | null>(null);
  const [assignTargetLevelId, setAssignTargetLevelId] = useState<string>("");
  const [assignReason, setAssignReason] = useState("");
  const [historyPartner, setHistoryPartner] = useState<PartnerPerformanceOverviewDTO | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Level Form state
  const [formData, setFormData] = useState({
    name: "",
    nameEn: "",
    nameAr: "",
    description: "",
    descriptionEn: "",
    descriptionAr: "",
    sharePercentage: 10,
    sortOrder: 1,
    isActive: true,
    minDeliveredOrders: 0,
    minDeliveryRate: 0,
    minConfirmationRate: 0,
    maxReturnRate: 100,
    minTurnover: 0,
    color: "blue",
    icon: "Award",
    benefits: [] as string[],
  });
  const [newBenefitInput, setNewBenefitInput] = useState("");

  // Progression rule validation
  const progressionValidation = useMemo(() => {
    return validateProgressionRules(levels);
  }, [levels]);

  // KPIs
  const activeLevelsCount = levels.filter((l) => l.isActive).length;
  const partnersWithLevelCount = partners.filter((p) => p.currentLevel !== null).length;
  const eligiblePromotionsCount = partners.filter((p) => p.canPromote).length;
  const avgDeliveryRate = useMemo(() => {
    if (partners.length === 0) return 0;
    const total = partners.reduce((acc, p) => acc + p.metrics.deliveryRate, 0);
    return Math.round(total / partners.length);
  }, [partners]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = p.displayName.toLowerCase().includes(query);
        const matchCode = p.code.toLowerCase().includes(query);
        const matchPhone = p.phone?.toLowerCase().includes(query);
        const matchEmail = p.user.email.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchPhone && !matchEmail) return false;
      }
      if (levelFilter === "NO_LEVEL" && p.currentLevel !== null) return false;
      if (levelFilter !== "ALL" && levelFilter !== "NO_LEVEL" && p.currentLevel?.id !== levelFilter) {
        return false;
      }
      if (eligibleOnly && !p.canPromote) return false;
      return true;
    });
  }, [partners, searchQuery, levelFilter, eligibleOnly]);

  // Open Level Editor
  const openLevelEditor = (lvl?: PerformanceLevelItem) => {
    if (lvl) {
      const criteria = parsePerformanceCriteria(lvl.criteria);
      setFormData({
        name: lvl.name,
        nameEn: criteria.nameEn || "",
        nameAr: criteria.nameAr || "",
        description: lvl.description || "",
        descriptionEn: criteria.descriptionEn || "",
        descriptionAr: criteria.descriptionAr || "",
        sharePercentage: Number(lvl.sharePercentage),
        sortOrder: lvl.sortOrder,
        isActive: lvl.isActive,
        minDeliveredOrders: criteria.minDeliveredOrders || 0,
        minDeliveryRate: criteria.minDeliveryRate || 0,
        minConfirmationRate: criteria.minConfirmationRate || 0,
        maxReturnRate: criteria.maxReturnRate ?? 100,
        minTurnover: criteria.minTurnover || 0,
        color: criteria.color || "blue",
        icon: criteria.icon || "Award",
        benefits: criteria.benefits || [],
      });
      setEditingLevel(lvl);
    } else {
      // Find highest sortOrder currently configured + 1
      const maxSortOrder = levels.reduce((max, l) => Math.max(max, l.sortOrder), 0);
      setFormData({
        name: "",
        nameEn: "",
        nameAr: "",
        description: "",
        descriptionEn: "",
        descriptionAr: "",
        sharePercentage: 15,
        sortOrder: maxSortOrder + 1,
        isActive: true,
        minDeliveredOrders: 20,
        minDeliveryRate: 70,
        minConfirmationRate: 80,
        maxReturnRate: 20,
        minTurnover: 2000,
        color: "blue",
        icon: "Award",
        benefits: [],
      });
      setEditingLevel("NEW");
    }
  };

  // Save Level
  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        id: editingLevel && editingLevel !== "NEW" ? editingLevel.id : undefined,
        ...formData,
      };
      const res = await savePerformanceLevelAction(payload);
      if (res.ok) {
        toast.success(res.message);
        setEditingLevel(null);
        window.location.reload();
      } else {
        toast.error(res.error || "Erreur lors de l'enregistrement.");
      }
    });
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (lvl: PerformanceLevelItem) => {
    startTransition(async () => {
      const res = await toggleLevelActiveAction(lvl.id);
      if (res.ok) {
        toast.success(res.message);
        setLevels((prev) =>
          prev.map((l) => (l.id === lvl.id ? { ...l, isActive: !l.isActive } : l)),
        );
      } else {
        toast.error(res.error || "Erreur lors du changement de statut.");
      }
    });
  };

  // Swap / Reorder levels
  const handleSwapOrder = (indexA: number, indexB: number) => {
    if (indexA < 0 || indexB < 0 || indexA >= levels.length || indexB >= levels.length) return;

    const newLevels = [...levels];
    const orderA = newLevels[indexA].sortOrder;
    const orderB = newLevels[indexB].sortOrder;

    // Swap sortOrders
    newLevels[indexA] = { ...newLevels[indexA], sortOrder: orderB };
    newLevels[indexB] = { ...newLevels[indexB], sortOrder: orderA };

    // Re-sort ladder descending
    newLevels.sort((a, b) => b.sortOrder - a.sortOrder);
    setLevels(newLevels);

    startTransition(async () => {
      const orders = newLevels.map((l) => ({ id: l.id, sortOrder: l.sortOrder }));
      const res = await reorderLevelsAction(orders);
      if (!res.ok) {
        toast.error(res.error || "Erreur lors du réordonnancement.");
        window.location.reload();
      } else {
        toast.success(res.message);
      }
    });
  };

  // Open Delete Modal
  const openDeleteModal = (lvl: PerformanceLevelItem) => {
    setDeletingLevel(lvl);
    setReassignTargetId("");
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingLevel) return;
    startTransition(async () => {
      const res = await deletePerformanceLevelAction(
        deletingLevel.id,
        reassignTargetId || null,
      );
      if (res.ok) {
        toast.success(res.message);
        setDeletingLevel(null);
        window.location.reload();
      } else {
        toast.error(res.error || "Impossible de supprimer ce niveau.");
      }
    });
  };

  // Open Assign Modal
  const openAssignModal = (partner: PartnerPerformanceOverviewDTO) => {
    setAssigningPartner(partner);
    setAssignTargetLevelId(partner.currentLevel?.id ?? "");
    setAssignReason("");
  };

  // Save Assignment
  const handleSaveAssignment = async () => {
    if (!assigningPartner) return;
    startTransition(async () => {
      const res = await manualAssignPartnerLevelAction({
        partnerId: assigningPartner.id,
        performanceLevelId: assignTargetLevelId || null,
        reason: assignReason,
      });
      if (res.ok) {
        toast.success(t("performanceAdmin.assignmentSuccess"));
        setAssigningPartner(null);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  // Quick Promote
  const handlePromotePartner = async (partner: PartnerPerformanceOverviewDTO) => {
    if (!partner.eligibleLevel) return;
    startTransition(async () => {
      const res = await manualAssignPartnerLevelAction({
        partnerId: partner.id,
        performanceLevelId: partner.eligibleLevel!.id,
        reason: "Promotion manuelle validée par l'administrateur",
      });
      if (res.ok) {
        toast.success(t("performanceAdmin.assignmentSuccess"));
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  // Evaluate All
  const handleEvaluateAll = () => {
    startTransition(async () => {
      const res = await evaluateAllPartnersAction();
      if (res.ok) {
        toast.success(res.message);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  // Open History Modal
  const openHistoryModal = async (partner: PartnerPerformanceOverviewDTO) => {
    setHistoryPartner(partner);
    setLoadingHistory(true);
    const res = await getPartnerHistoryAction(partner.id);
    setHistoryLogs(res.history || []);
    setLoadingHistory(false);
  };

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {t("performanceAdmin.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("performanceAdmin.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluateAll}
              disabled={isPending}
              className="gap-2 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t("performanceAdmin.evaluatePromotions")}</span>
              {eligiblePromotionsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-white">
                  {eligiblePromotionsCount}
                </span>
              )}
            </Button>

            <Button
              size="sm"
              onClick={() => openLevelEditor()}
              disabled={isPending}
              className="gap-2 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>{t("performanceAdmin.createLevel")}</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── Progression Consistency Warnings (Advisory) ── */}
      {progressionValidation.warnings.length > 0 && (
        <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Recommandations de cohérence sur l&apos;échelle des niveaux</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
            {progressionValidation.warnings.map((w, idx) => (
              <li key={idx}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("performanceAdmin.kpiActiveLevels")}
              </p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                {activeLevelsCount} <span className="text-xs text-muted-foreground font-normal">/ {levels.length} configurés</span>
              </p>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("performanceAdmin.kpiPartnersWithLevel")}
              </p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                {partnersWithLevelCount} <span className="text-xs text-muted-foreground font-normal">/ {partners.length}</span>
              </p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-lg">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("performanceAdmin.kpiEligiblePromotions")}
              </p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {eligiblePromotionsCount}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("performanceAdmin.kpiAvgDeliveryRate")}
              </p>
              <p className="text-2xl font-bold mt-1 text-foreground">
                {avgDeliveryRate} %
              </p>
            </div>
            <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 1: Dynamic Levels Hierarchy ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("performanceAdmin.levelsHierarchy")} ({levels.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("performanceAdmin.criteriaDescription")}
            </p>
          </div>
        </div>

        {levels.length === 0 ? (
          <EmptyState
            title={t("performanceAdmin.noLevels")}
            description={t("performanceAdmin.noLevelsDesc")}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {levels.map((lvl, index) => {
              const criteria = parsePerformanceCriteria(lvl.criteria);
              const colorConfig = COLOR_MAP[criteria.color] ?? COLOR_MAP.blue;
              const IconComp = ICON_MAP[criteria.icon] ?? Award;
              const displayName = getLocalizedLevelName(lvl, locale);
              const displayDesc = getLocalizedLevelDescription(lvl, locale);

              return (
                <Card
                  key={lvl.id}
                  className={`border transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                    colorConfig.border
                  } ${!lvl.isActive ? "opacity-60 bg-muted/40" : "bg-card"}`}
                >
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-lg border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}
                        >
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                            <span>{displayName}</span>
                            {!lvl.isActive && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                {t("common.inactive")}
                              </Badge>
                            )}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Rang #{lvl.sortOrder}
                          </p>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-0.5">
                          {/* Reorder Up */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={index === 0 || isPending}
                            onClick={() => handleSwapOrder(index, index - 1)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Monter d'un rang"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>

                          {/* Reorder Down */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={index === levels.length - 1 || isPending}
                            onClick={() => handleSwapOrder(index, index + 1)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Descendre d'un rang"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openLevelEditor(lvl)}
                            title={t("performanceAdmin.editLevel")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          {/* Toggle Active */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            onClick={() => handleToggleActive(lvl)}
                            className={`h-7 w-7 ${
                              lvl.isActive
                                ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title={lvl.isActive ? "Désactiver le niveau" : "Activer le niveau"}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            onClick={() => openDeleteModal(lvl)}
                            title={t("performanceAdmin.deleteLevel")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {displayDesc && (
                      <CardDescription className="text-xs mt-2 line-clamp-2">
                        {displayDesc}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-0 space-y-3">
                    {/* Share & Partner count */}
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/40 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          {t("performanceAdmin.sharePercentage")}
                        </span>
                        <span className="font-bold text-sm text-foreground">
                          {Number(lvl.sharePercentage)} %
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          {t("performanceAdmin.partnersWithLevel")}
                        </span>
                        <span className="font-bold text-sm text-foreground">
                          {lvl._count?.partners ?? 0}
                        </span>
                      </div>
                    </div>

                    {/* Criteria Thresholds */}
                    <div className="space-y-1.5 text-xs border-t pt-2.5">
                      <p className="font-medium text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t("performanceAdmin.criteriaSection")}
                      </p>
                      <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
                        <span className="text-muted-foreground">
                          Livraisons : <strong className="text-foreground">≥ {criteria.minDeliveredOrders}</strong>
                        </span>
                        <span className="text-muted-foreground">
                          Taux livr. : <strong className="text-foreground">≥ {criteria.minDeliveryRate}%</strong>
                        </span>
                        <span className="text-muted-foreground">
                          Confirmation : <strong className="text-foreground">≥ {criteria.minConfirmationRate}%</strong>
                        </span>
                        <span className="text-muted-foreground">
                          Taux retour : <strong className="text-foreground">≤ {criteria.maxReturnRate}%</strong>
                        </span>
                        <span className="text-muted-foreground col-span-2">
                          CA : <strong className="text-foreground">≥ {criteria.minTurnover} TND</strong>
                        </span>
                      </div>
                    </div>

                    {/* Benefits preview */}
                    {criteria.benefits && criteria.benefits.length > 0 && (
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {t("performanceAdmin.benefitsSection")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {criteria.benefits.map((b, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-muted text-foreground border"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Partners Performance Overview Table ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("performanceAdmin.partnersTableTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {filteredPartners.length} {t("common.items")}
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("performanceAdmin.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-input bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="text-xs rounded-md border border-input bg-card px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">{t("performanceAdmin.filterAll")}</option>
              <option value="NO_LEVEL">{t("performanceAdmin.filterNoLevel")}</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {getLocalizedLevelName(l, locale)}
                </option>
              ))}
            </select>

            <Button
              variant={eligibleOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setEligibleOnly((prev) => !prev)}
              className="text-xs h-8 gap-1.5"
            >
              <Filter className="h-3 w-3" />
              <span>{t("performanceAdmin.filterEligibleOnly")}</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                <tr>
                  <th className="p-3">{t("performanceAdmin.colPartner")}</th>
                  <th className="p-3">{t("performanceAdmin.colCurrentLevel")}</th>
                  <th className="p-3">{t("performanceAdmin.colScore")}</th>
                  <th className="p-3 text-center">{t("performanceAdmin.colDeliveredOrders")}</th>
                  <th className="p-3 text-center">{t("performanceAdmin.colDeliveryRate")}</th>
                  <th className="p-3 text-center">{t("performanceAdmin.colConfirmationRate")}</th>
                  <th className="p-3 text-center">{t("performanceAdmin.colReturnRate")}</th>
                  <th className="p-3 text-right">{t("performanceAdmin.colTurnover")}</th>
                  <th className="p-3">{t("performanceAdmin.colProgression")}</th>
                  <th className="p-3 text-right">{t("performanceAdmin.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      {t("performanceAdmin.noPartnerMatch")}
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner) => {
                    const score = partner.score;
                    return (
                      <tr key={partner.id} className="hover:bg-muted/30 transition-colors">
                        {/* Partner Details */}
                        <td className="p-3">
                          <div className="font-semibold text-foreground">
                            {partner.displayName}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {partner.code}
                          </div>
                          {partner.phone && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-2.5 w-2.5" />
                              <span>{partner.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Current Level */}
                        <td className="p-3 whitespace-nowrap">
                          {partner.currentLevel ? (
                            renderLevelBadge(partner.currentLevel, locale)
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-muted-foreground bg-muted border">
                              {t("performanceAdmin.noLevelBadge")}
                            </span>
                          )}
                        </td>

                        {/* Performance Score */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 80
                                    ? "bg-emerald-500"
                                    : score >= 50
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                              />
                            </div>
                            <span className="font-bold text-foreground text-xs">
                              {score}/100
                            </span>
                          </div>
                        </td>

                        {/* Delivered orders */}
                        <td className="p-3 text-center font-medium text-foreground">
                          {partner.metrics.deliveredOrders}
                          <span className="text-[10px] text-muted-foreground block">
                            / {partner.metrics.totalOrders} total
                          </span>
                        </td>

                        {/* Delivery rate */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-semibold ${
                              partner.metrics.deliveryRate >= 75
                                ? "text-emerald-600 dark:text-emerald-400"
                                : partner.metrics.deliveryRate >= 50
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {partner.metrics.deliveryRate} %
                          </span>
                        </td>

                        {/* Confirmation rate */}
                        <td className="p-3 text-center font-medium text-foreground">
                          {partner.metrics.confirmationRate} %
                        </td>

                        {/* Return rate */}
                        <td className="p-3 text-center">
                          <span
                            className={`font-medium ${
                              partner.metrics.returnRate <= 15
                                ? "text-emerald-600 dark:text-emerald-400"
                                : partner.metrics.returnRate <= 30
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {partner.metrics.returnRate} %
                          </span>
                        </td>

                        {/* Turnover */}
                        <td className="p-3 text-right font-medium text-foreground whitespace-nowrap">
                          {partner.metrics.turnover.toFixed(2)} TND
                        </td>

                        {/* Progression / Eligibility */}
                        <td className="p-3">
                          {partner.canPromote && partner.eligibleLevel ? (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold gap-1">
                                <Sparkles className="h-3 w-3" />
                                <span>
                                  {t("performanceAdmin.eligibleFor", {
                                    level: getLocalizedLevelName(partner.eligibleLevel, locale),
                                  })}
                                </span>
                              </Badge>
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePromotePartner(partner)}
                                  disabled={isPending}
                                  className="h-6 text-[11px] px-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                                >
                                  {t("performanceAdmin.promote")}
                                </Button>
                              )}
                            </div>
                          ) : partner.nextLevel ? (
                            <div className="space-y-1">
                              <span className="text-[11px] text-muted-foreground block">
                                Vers {getLocalizedLevelName(partner.nextLevel, locale)}
                              </span>
                              {partner.nextLevelProgress && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {t("performanceAdmin.criteriaProgress", {
                                    met: partner.nextLevelProgress.metCount,
                                    total: partner.nextLevelProgress.totalCount,
                                  })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {t("performanceAdmin.highestTierReached")}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAssignModal(partner)}
                                className="h-7 text-xs px-2.5"
                              >
                                {t("performanceAdmin.changeLevel")}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openHistoryModal(partner)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title={t("performanceAdmin.viewHistory")}
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Level Create/Edit Modal ── */}
      {editingLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {editingLevel === "NEW"
                    ? t("performanceAdmin.createLevel")
                    : t("performanceAdmin.editLevel")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("performanceAdmin.levelDetails")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingLevel(null)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleSaveLevel} className="space-y-4 text-xs">
              {/* Names in FR, EN, AR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    {t("performanceAdmin.name")} (FR) *
                  </label>
                  <input
                    required
                    maxLength={80}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("performanceAdmin.namePlaceholder")}
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    {t("performanceAdmin.nameEn")}
                  </label>
                  <input
                    maxLength={80}
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="e.g. Diamond"
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    {t("performanceAdmin.nameAr")}
                  </label>
                  <input
                    maxLength={80}
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    placeholder="مثال: ألماسي"
                    dir="rtl"
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Description in FR, EN, AR */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    {t("performanceAdmin.description")} (FR)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("performanceAdmin.descriptionPlaceholder")}
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    Description (EN)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={formData.descriptionEn}
                    onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                    placeholder="Tier description in English..."
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    الوصف (AR)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={formData.descriptionAr}
                    onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                    placeholder="شرح المستوى بالعربية..."
                    dir="rtl"
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Share, Sort Order, Active */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    {t("performanceAdmin.sharePercentage")} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.sharePercentage}
                    onChange={(e) =>
                      setFormData({ ...formData, sharePercentage: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground">{t("performanceAdmin.shareHelp")}</p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">
                    {t("performanceAdmin.sortOrder")} (Rang unique) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    required
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, sortOrder: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground">{t("performanceAdmin.sortOrderHelp")}</p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground block">
                    {t("performanceAdmin.isActive")}
                  </label>
                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-xs text-foreground">{t("common.active")}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Visual Identity: Color & Icon */}
              <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
                <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
                  {t("performanceAdmin.visualIdentity")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-foreground block mb-1">
                      {t("performanceAdmin.color")}
                    </label>
                    <select
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:outline-none"
                    >
                      {Object.entries(COLOR_MAP).map(([key, cfg]) => (
                        <option key={key} value={key}>
                          {cfg.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-medium text-foreground block mb-1">
                      {t("performanceAdmin.icon")}
                    </label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:outline-none"
                    >
                      {Object.keys(ICON_MAP).map((iconKey) => (
                        <option key={iconKey} value={iconKey}>
                          {iconKey}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Criteria Thresholds */}
              <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
                <div>
                  <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    {t("performanceAdmin.criteriaSection")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("performanceAdmin.criteriaDescription")}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-medium text-foreground">
                      {t("performanceAdmin.minDeliveredOrders")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minDeliveredOrders}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minDeliveredOrders: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-foreground">
                      {t("performanceAdmin.minDeliveryRate")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.minDeliveryRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minDeliveryRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-foreground">
                      {t("performanceAdmin.minConfirmationRate")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.minConfirmationRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minConfirmationRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-foreground">
                      {t("performanceAdmin.maxReturnRate")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.maxReturnRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxReturnRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-medium text-foreground">
                      {t("performanceAdmin.minTurnover")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={formData.minTurnover}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minTurnover: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Benefits list */}
              <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
                <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
                  {t("performanceAdmin.benefitsSection")}
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBenefitInput}
                    onChange={(e) => setNewBenefitInput(e.target.value)}
                    placeholder={t("performanceAdmin.benefitPlaceholder")}
                    className="flex-1 px-3 py-1.5 rounded-md border border-input bg-card text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newBenefitInput.trim()) {
                          setFormData({
                            ...formData,
                            benefits: [...formData.benefits, newBenefitInput.trim()],
                          });
                          setNewBenefitInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newBenefitInput.trim()) {
                        setFormData({
                          ...formData,
                          benefits: [...formData.benefits, newBenefitInput.trim()],
                        });
                        setNewBenefitInput("");
                      }
                    }}
                  >
                    {t("performanceAdmin.addBenefit")}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {formData.benefits.map((b, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-card text-foreground border text-xs"
                    >
                      <span>{b}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            benefits: formData.benefits.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-muted-foreground hover:text-rose-500 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {formData.benefits.length === 0 && (
                    <span className="text-[11px] text-muted-foreground italic">
                      {t("performanceAdmin.noBenefits")}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingLevel(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete with Reassignment Modal ── */}
      {deletingLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Supprimer le niveau « {deletingLevel.name} »
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Action définitive de suppression du palier de performance.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingLevel(null)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {(deletingLevel._count?.partners ?? 0) > 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    Ce niveau est actuellement attribué à{" "}
                    <strong>{deletingLevel._count?.partners} partenaire(s)</strong>.
                    Pour continuer, vous devez sélectionner où réassigner ces partenaires.
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground block">
                    Réassigner les partenaires concernés vers :
                  </label>
                  <select
                    value={reassignTargetId}
                    onChange={(e) => setReassignTargetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">{t("performanceAdmin.noLevelBadge")}</option>
                    {levels
                      .filter((l) => l.id !== deletingLevel.id && l.isActive)
                      .map((lvl) => (
                        <option key={lvl.id} value={lvl.id}>
                          {getLocalizedLevelName(lvl, locale)} ({Number(lvl.sharePercentage)}% commission)
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                {t("performanceAdmin.deleteConfirm")}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingLevel(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isPending}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {(deletingLevel._count?.partners ?? 0) > 0
                  ? "Réassigner et supprimer"
                  : t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Assignment Modal ── */}
      {assigningPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {t("performanceAdmin.assignModalTitle")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("performanceAdmin.assignModalSubtitle", {
                    partner: assigningPartner.displayName,
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAssigningPartner(null)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("performanceAdmin.currentLevelLabel")} :</span>
                  <span className="font-semibold text-foreground">
                    {assigningPartner.currentLevel
                      ? getLocalizedLevelName(assigningPartner.currentLevel, locale)
                      : t("performanceAdmin.noLevelBadge")}
                  </span>
                </div>
                {assigningPartner.currentLevel && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">{t("performanceAdmin.sharePercentage")} :</span>
                    <span className="font-medium text-foreground">
                      {assigningPartner.currentLevel.sharePercentage} %
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground block">
                  {t("performanceAdmin.targetLevelLabel")} *
                </label>
                <select
                  value={assignTargetLevelId}
                  onChange={(e) => setAssignTargetLevelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">{t("performanceAdmin.noLevelBadge")}</option>
                  {levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {getLocalizedLevelName(lvl, locale)} ({Number(lvl.sharePercentage)}% commission)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground block">
                  {t("performanceAdmin.reasonLabel")}
                </label>
                <textarea
                  rows={2}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder={t("performanceAdmin.reasonPlaceholder")}
                  className="w-full px-3 py-1.5 rounded-md border border-input bg-card text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssigningPartner(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveAssignment} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {t("performanceAdmin.saveAssignment")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ── */}
      {historyPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {t("performanceAdmin.historyModalTitle", {
                    partner: historyPartner.displayName,
                  })}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("performanceAdmin.historyModalSubtitle")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistoryPartner(null)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {loadingHistory ? (
              <div className="py-8 flex justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {t("performanceAdmin.noHistory")}
              </div>
            ) : (
              <div className="space-y-3">
                {historyLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-3 border rounded-lg bg-muted/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {log.actorName || t("performanceAdmin.systemActor")}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(log.createdAt).toLocaleString(locale)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs pt-1">
                      <span className="text-muted-foreground">Niveau :</span>
                      <strong className="text-foreground">
                        {log.newLevelName || t("performanceAdmin.noLevelBadge")}
                      </strong>
                    </div>

                    {log.reason && (
                      <div className="text-[11px] text-muted-foreground bg-card p-2 rounded border">
                        <span className="font-medium text-foreground">
                          {t("performanceAdmin.historyReason")} :
                        </span>{" "}
                        {log.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setHistoryPartner(null)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
