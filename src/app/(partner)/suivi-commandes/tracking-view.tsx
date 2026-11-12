"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  Truck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Search,
  Copy,
  Check,
  ChevronRight,
  Globe,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export type TrackingOrder = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  createdAt: string;
  customer: {
    fullName: string;
    phone: string;
    city: string;
    governorate: string;
  };
  productName: string;
  quantity: number;
  shipment: {
    carrier: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
};

type Lang = "fr" | "ar" | "en";

interface TrackingDictionary {
  dir: "ltr" | "rtl";
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  allShipments: string;
  inTransit: string;
  delivered: string;
  processing: string;
  returns: string;
  kpiTotal: string;
  kpiTransit: string;
  kpiDelivered: string;
  kpiReturns: string;
  carrier: string;
  trackingNumber: string;
  noTrackingYet: string;
  viewDetails: string;
  destination: string;
  emptyTitle: string;
  emptyDesc: string;
  copied: string;
  copyTracking: string;
  statusLabels: Record<string, string>;
  steps: {
    confirmed: string;
    preparing: string;
    shipped: string;
    inDelivery: string;
    delivered: string;
  };
}

const DICTIONARY: Record<Lang, TrackingDictionary> = {
  fr: {
    dir: "ltr",
    title: "Suivi des commandes",
    subtitle: "Suivez en temps réel l'acheminement, les transporteurs et le statut de livraison de vos colis.",
    searchPlaceholder: "Rechercher par n° de commande, client, téléphone, transporteur ou n° de suivi...",
    allShipments: "Tous les envois",
    inTransit: "En transit",
    delivered: "Livrées",
    processing: "En préparation",
    returns: "Retours & Refus",
    kpiTotal: "Total commandes",
    kpiTransit: "En cours d'acheminement",
    kpiDelivered: "Livrées avec succès",
    kpiReturns: "Retours & Refus",
    carrier: "Transporteur",
    trackingNumber: "N° de suivi",
    noTrackingYet: "En attente d'attribution",
    viewDetails: "Suivre la commande",
    destination: "Destination",
    emptyTitle: "Aucune commande correspondante",
    emptyDesc: "Aucun envoi ne correspond aux critères de recherche ou de filtre sélectionnés.",
    copied: "Copié !",
    copyTracking: "Copier le n° de suivi",
    statusLabels: {
      CONFIRMED: "Confirmée",
      VALIDATED: "Validée",
      PREPARING: "En préparation",
      PACKAGED: "Emballée",
      SHIPPED: "Expédiée",
      IN_DELIVERY: "En livraison",
      DELIVERED: "Livrée",
      ON_HOLD: "En attente",
      REFUSED: "Refusée",
      RETURNED: "Retournée",
      CANCELLED: "Annulée",
    },
    steps: {
      confirmed: "Confirmée",
      preparing: "Préparation",
      shipped: "Expédiée",
      inDelivery: "En livraison",
      delivered: "Livrée",
    },
  },
  ar: {
    dir: "rtl",
    title: "تتبع الطلبات",
    subtitle: "تابع في الوقت الفعلي مسار الشحنات، شركات الشحن وحالة توصيل طرودك.",
    searchPlaceholder: "البحث برقم الطلب، العميل، الهاتف، شركة الشحن أو رقم التتبع...",
    allShipments: "جميع الشحنات",
    inTransit: "قيد التوصيل",
    delivered: "تم التوصيل",
    processing: "قيد التحضير",
    returns: "المرتجعات والمرفوضة",
    kpiTotal: "إجمالي الطلبات",
    kpiTransit: "في طريقها للعميل",
    kpiDelivered: "تم التوصيل بنجاح",
    kpiReturns: "المرتجعات والمرفوضة",
    carrier: "شركة الشحن",
    trackingNumber: "رقم التتبع",
    noTrackingYet: "في انتظار التعيين",
    viewDetails: "تتبع الطلب",
    destination: "الوجهة",
    emptyTitle: "لا توجد طلبات مطابقة",
    emptyDesc: "لم يتم العثور على أي شحنات تطابق معايير البحث أو الفلتر المحدد.",
    copied: "تم النسخ!",
    copyTracking: "نسخ رقم التتبع",
    statusLabels: {
      CONFIRMED: "مؤكدة",
      VALIDATED: "تمت الموافقة",
      PREPARING: "قيد التجهيز",
      PACKAGED: "مغلفة",
      SHIPPED: "تم الشحن",
      IN_DELIVERY: "قيد التوصيل",
      DELIVERED: "تم التوصيل",
      ON_HOLD: "معلقة",
      REFUSED: "مرفوضة",
      RETURNED: "مرتجعة",
      CANCELLED: "ملغاة",
    },
    steps: {
      confirmed: "مؤكدة",
      preparing: "تجهيز",
      shipped: "مشحونة",
      inDelivery: "توصيل",
      delivered: "مستلمة",
    },
  },
  en: {
    dir: "ltr",
    title: "Order Tracking",
    subtitle: "Track your packages, delivery partners, and shipping status in real-time.",
    searchPlaceholder: "Search by order #, customer, phone, carrier or tracking #...",
    allShipments: "All Shipments",
    inTransit: "In Transit",
    delivered: "Delivered",
    processing: "Processing",
    returns: "Returns & Refused",
    kpiTotal: "Total Orders",
    kpiTransit: "In Transit",
    kpiDelivered: "Delivered Successfully",
    kpiReturns: "Returns & Refused",
    carrier: "Carrier",
    trackingNumber: "Tracking #",
    noTrackingYet: "Pending assignment",
    viewDetails: "Track Order",
    destination: "Destination",
    emptyTitle: "No matching shipments",
    emptyDesc: "No shipments match the selected search or filter criteria.",
    copied: "Copied!",
    copyTracking: "Copy tracking #",
    statusLabels: {
      CONFIRMED: "Confirmed",
      VALIDATED: "Validated",
      PREPARING: "Preparing",
      PACKAGED: "Packaged",
      SHIPPED: "Shipped",
      IN_DELIVERY: "In Delivery",
      DELIVERED: "Delivered",
      ON_HOLD: "On Hold",
      REFUSED: "Refused",
      RETURNED: "Returned",
      CANCELLED: "Cancelled",
    },
    steps: {
      confirmed: "Confirmed",
      preparing: "Preparing",
      shipped: "Shipped",
      inDelivery: "In Delivery",
      delivered: "Delivered",
    },
  },
};

export function PartnerTrackingView({ initialOrders }: { initialOrders: TrackingOrder[] }) {
  const { locale, setLocale } = useI18n();
  const lang = (locale as Lang) in DICTIONARY ? (locale as Lang) : "fr";
  const setLang = setLocale;
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "TRANSIT" | "DELIVERED" | "PREPARING" | "RETURNS">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const t = DICTIONARY[lang];

  // Filter orders
  const filteredOrders = initialOrders.filter((order) => {
    // Tab filter
    if (filterTab === "TRANSIT" && order.status !== "SHIPPED" && order.status !== "IN_DELIVERY") {
      return false;
    }
    if (filterTab === "DELIVERED" && order.status !== "DELIVERED") {
      return false;
    }
    if (
      filterTab === "PREPARING" &&
      !["CONFIRMED", "VALIDATED", "PREPARING", "PACKAGED"].includes(order.status)
    ) {
      return false;
    }
    if (filterTab === "RETURNS" && !["RETURNED", "REFUSED", "CANCELLED"].includes(order.status)) {
      return false;
    }

    // Search query
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchOrderNum = String(order.orderNumber).includes(q);
      const matchName = order.customer.fullName.toLowerCase().includes(q);
      const matchPhone = order.customer.phone.includes(q);
      const matchCarrier = (order.shipment?.carrier || "").toLowerCase().includes(q);
      const matchTracking = (order.shipment?.trackingNumber || "").toLowerCase().includes(q);
      const matchProduct = order.productName.toLowerCase().includes(q);
      const matchCity = order.customer.city.toLowerCase().includes(q);

      if (
        !matchOrderNum &&
        !matchName &&
        !matchPhone &&
        !matchCarrier &&
        !matchTracking &&
        !matchProduct &&
        !matchCity
      ) {
        return false;
      }
    }

    return true;
  });

  // Calculate KPIs
  const totalCount = initialOrders.length;
  const inTransitCount = initialOrders.filter(
    (o) => o.status === "SHIPPED" || o.status === "IN_DELIVERY",
  ).length;
  const deliveredCount = initialOrders.filter((o) => o.status === "DELIVERED").length;
  const returnsCount = initialOrders.filter(
    (o) => o.status === "RETURNED" || o.status === "REFUSED",
  ).length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getProgressLevel = (status: OrderStatus): number => {
    switch (status) {
      case "CONFIRMED":
      case "VALIDATED":
        return 1;
      case "PREPARING":
      case "PACKAGED":
        return 2;
      case "SHIPPED":
        return 3;
      case "IN_DELIVERY":
        return 4;
      case "DELIVERED":
        return 5;
      default:
        return 0; // Cancelled, Refused, Returned
    }
  };

  return (
    <div className={cn("space-y-6", t.dir === "rtl" && "rtl font-sans")} dir={t.dir}>
      {/* ── Page Header with Language Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
              <p className="text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Trilingual Toggle */}
        <div className="flex items-center gap-1 self-start sm:self-center rounded-lg border bg-muted/30 p-1 text-xs">
          <Globe className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-1" />
          <button
            type="button"
            onClick={() => setLang("fr")}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors",
              lang === "fr"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang("ar")}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors",
              lang === "ar"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            العربية
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition-colors",
              lang === "en"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            EN
          </button>
        </div>
      </div>

      {/* ── Tracking Metrics Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border bg-card/60">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t.kpiTotal}</span>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight">{totalCount}</p>
          </CardContent>
        </Card>

        <Card className="border border-blue-200/50 bg-blue-50/20 dark:bg-blue-950/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{t.kpiTransit}</span>
              <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-blue-900 dark:text-blue-100">
              {inTransitCount}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200/50 bg-emerald-50/20 dark:bg-emerald-950/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t.kpiDelivered}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
              {deliveredCount}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-rose-200/50 bg-rose-50/20 dark:bg-rose-950/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{t.kpiReturns}</span>
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-rose-900 dark:text-rose-100">
              {returnsCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9 text-sm"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/40 rounded-xl border">
          <button
            type="button"
            onClick={() => setFilterTab("ALL")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filterTab === "ALL" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.allShipments}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("TRANSIT")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filterTab === "TRANSIT" ? "bg-background text-foreground shadow-xs font-semibold text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.inTransit}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("DELIVERED")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filterTab === "DELIVERED" ? "bg-background text-foreground shadow-xs font-semibold text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.delivered}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("PREPARING")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filterTab === "PREPARING" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.processing}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("RETURNS")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              filterTab === "RETURNS" ? "bg-background text-foreground shadow-xs font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.returns}
          </button>
        </div>
      </div>

      {/* ── Orders Tracking List ── */}
      {filteredOrders.length === 0 ? (
        <EmptyState title={t.emptyTitle} description={t.emptyDesc} />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const level = getProgressLevel(order.status);
            const isTerminal = ["CANCELLED", "REFUSED", "RETURNED"].includes(order.status);

            return (
              <Card key={order.id} className="overflow-hidden border transition-all hover:border-primary/40 hover:shadow-xs">
                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Top Bar: Order Number, Status & Action */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-base sm:text-lg tracking-tight">
                        #{order.orderNumber}
                      </span>
                      <Badge
                        variant={
                          order.status === "DELIVERED"
                            ? "success"
                            : order.status === "SHIPPED" || order.status === "IN_DELIVERY"
                            ? "info"
                            : order.status === "REFUSED" || order.status === "RETURNED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {t.statusLabels[order.status] ?? order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        · {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>

                    <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs shrink-0">
                      <Link href={`/mes-commandes/${order.id}`}>
                        {t.viewDetails}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>

                  {/* Middle Row: Client, Product & Carrier Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                    {/* Customer Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{order.customer.fullName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{order.customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{order.customer.city}, {order.customer.governorate}</span>
                      </div>
                    </div>

                    {/* Product & Quantity */}
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{order.productName}</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Quantité : <strong className="font-semibold text-slate-800 dark:text-slate-200">×{order.quantity}</strong>
                      </p>
                    </div>

                    {/* Carrier & Tracking */}
                    <div className="space-y-1 bg-muted/30 rounded-lg p-2.5 sm:p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t.carrier} :</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {order.shipment?.carrier || "EcomPartner Logistics"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                        <span className="text-muted-foreground">{t.trackingNumber} :</span>
                        {order.shipment?.trackingNumber ? (
                          <div className="flex items-center gap-1 font-mono font-medium text-primary">
                            <span>{order.shipment.trackingNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.shipment!.trackingNumber!, order.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title={t.copyTracking}
                            >
                              {copiedId === order.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">{t.noTrackingYet}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Visual Progress Steps (Non-terminal orders) */}
                  {!isTerminal && (
                    <div className="pt-2">
                      <div className="relative flex items-center justify-between">
                        {/* Connecting line */}
                        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-muted rounded-full -z-0">
                          <div
                            className="h-1 bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${((level - 1) / 4) * 100}%` }}
                          />
                        </div>

                        {/* Step 1: Confirmed */}
                        <div className="relative z-1 flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border-2 transition-colors",
                              level >= 1
                                ? "bg-primary border-primary text-white"
                                : "bg-card border-muted text-muted-foreground",
                            )}
                          >
                            1
                          </div>
                          <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center">
                            {t.steps.confirmed}
                          </span>
                        </div>

                        {/* Step 2: Preparing */}
                        <div className="relative z-1 flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border-2 transition-colors",
                              level >= 2
                                ? "bg-primary border-primary text-white"
                                : "bg-card border-muted text-muted-foreground",
                            )}
                          >
                            2
                          </div>
                          <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center">
                            {t.steps.preparing}
                          </span>
                        </div>

                        {/* Step 3: Shipped */}
                        <div className="relative z-1 flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border-2 transition-colors",
                              level >= 3
                                ? "bg-primary border-primary text-white"
                                : "bg-card border-muted text-muted-foreground",
                            )}
                          >
                            3
                          </div>
                          <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center">
                            {t.steps.shipped}
                          </span>
                        </div>

                        {/* Step 4: In Delivery */}
                        <div className="relative z-1 flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border-2 transition-colors",
                              level >= 4
                                ? "bg-primary border-primary text-white"
                                : "bg-card border-muted text-muted-foreground",
                            )}
                          >
                            4
                          </div>
                          <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center">
                            {t.steps.inDelivery}
                          </span>
                        </div>

                        {/* Step 5: Delivered */}
                        <div className="relative z-1 flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border-2 transition-colors",
                              level >= 5
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-card border-muted text-muted-foreground",
                            )}
                          >
                            ✓
                          </div>
                          <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center">
                            {t.steps.delivered}
                          </span>
                        </div>
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
  );
}
