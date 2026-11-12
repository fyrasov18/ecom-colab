import { cn } from "@/lib/utils";
import type { ProductSuggestionStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  ProductSuggestionStatus,
  { labelFr: string; labelEn: string; labelAr: string; classes: string }
> = {
  PENDING: {
    labelFr: "En attente",
    labelEn: "Pending",
    labelAr: "قيد الانتظار",
    classes: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  UNDER_REVIEW: {
    labelFr: "En cours d'examen",
    labelEn: "Under Review",
    labelAr: "قيد المراجعة",
    classes: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  ACCEPTED: {
    labelFr: "Acceptée",
    labelEn: "Accepted",
    labelAr: "مقبول",
    classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  REJECTED: {
    labelFr: "Refusée",
    labelEn: "Rejected",
    labelAr: "مرفوض",
    classes: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  PRODUCT_CREATED: {
    labelFr: "Produit créé",
    labelEn: "Product Created",
    labelAr: "تم إنشاء المنتج",
    classes: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  },
};

export function SuggestionStatusBadge({
  status,
  lang = "fr",
  className,
}: {
  status: ProductSuggestionStatus;
  lang?: string;
  className?: string;
}) {
  const conf = STATUS_CONFIG[status] || {
    labelFr: status,
    labelEn: status,
    labelAr: status,
    classes: "bg-muted text-muted-foreground border-border",
  };

  const label = lang === "ar" ? conf.labelAr : lang === "en" ? conf.labelEn : conf.labelFr;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
        conf.classes,
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
