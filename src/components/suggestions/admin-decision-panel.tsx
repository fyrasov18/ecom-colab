"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  CheckCircle2,
  Lock,
  MessageSquare,
  Sparkles,
  Link as LinkIcon,
  PackagePlus,
  AlertCircle,
  ExternalLink,
  Loader2,
  Layers,
  ArrowRight,
  PackageCheck,
} from "lucide-react";
import {
  updateSuggestionStatusAction,
  linkSuggestionToProductAction,
  createProductFromSuggestionAction,
} from "@/app/(admin)/produits/suggestions/actions";
import type { AdminSuggestionDetail } from "@/modules/suggestions/types";
import type { ProductSuggestionStatus } from "@prisma/client";

export function AdminDecisionPanel({
  suggestion,
  categories,
  availableProducts,
}: {
  suggestion: AdminSuggestionDetail;
  categories: { id: string; name: string }[];
  availableProducts: { id: string; name: string; sku: string | null }[];
}) {
  const router = useRouter();
  const { dict, isRtl } = useI18n();
  const [activeAction, setActiveAction] = useState<"status" | "create" | "link">("status");
  const [isPending, startTransition] = useTransition();

  // Status form states
  const [status, setStatus] = useState<ProductSuggestionStatus>(
    suggestion.status === "PRODUCT_CREATED" ? "ACCEPTED" : suggestion.status,
  );
  const [partnerFeedback, setPartnerFeedback] = useState(suggestion.partnerFeedback || "");
  const [internalNotes, setInternalNotes] = useState(suggestion.internalNotes || "");

  // Create Product form states
  const [productName, setProductName] = useState(suggestion.name);
  const [description, setDescription] = useState(suggestion.description || "");
  const [sellingPrice, setSellingPrice] = useState(String(suggestion.estimatedSellingPrice));
  const [purchaseCost, setPurchaseCost] = useState(
    suggestion.estimatedPurchasePrice ? String(suggestion.estimatedPurchasePrice) : "0",
  );
  const [packagingCost, setPackagingCost] = useState("1");
  const [deliveryCost, setDeliveryCost] = useState("7");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [categoryId, setCategoryId] = useState("");
  const [autoAssign, setAutoAssign] = useState(true);
  const [createInternalNotes, setCreateInternalNotes] = useState("");

  // Link Product form states
  const [selectedProductId, setSelectedProductId] = useState("");
  const [linkInternalNotes, setLinkInternalNotes] = useState("");

  // Handler: Update Status
  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("suggestionId", suggestion.id);
    formData.append("status", status);
    formData.append("partnerFeedback", partnerFeedback);
    formData.append("internalNotes", internalNotes);

    startTransition(async () => {
      const res = await updateSuggestionStatusAction(null, formData);
      if (res.ok) {
        toast.success(res.message || "Statut mis à jour avec succès.");
        router.refresh();
      } else {
        toast.error(res.error || "Erreur lors de la mise à jour.");
      }
    });
  };

  // Handler: Create Product
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("suggestionId", suggestion.id);
    formData.append("name", productName);
    formData.append("description", description);
    formData.append("sellingPrice", sellingPrice);
    formData.append("purchaseCost", purchaseCost);
    formData.append("packagingCost", packagingCost);
    formData.append("deliveryCost", deliveryCost);
    formData.append("stockQuantity", stockQuantity);
    formData.append("lowStockThreshold", lowStockThreshold);
    if (categoryId) formData.append("categoryId", categoryId);
    formData.append("autoAssignToPartner", autoAssign ? "true" : "false");
    if (createInternalNotes) formData.append("internalNotes", createInternalNotes);

    startTransition(async () => {
      const res = await createProductFromSuggestionAction(null, formData);
      if (res.ok) {
        toast.success(res.message || "Produit créé avec succès !");
        router.refresh();
      } else {
        toast.error(res.error || "Erreur lors de la création du produit.");
      }
    });
  };

  // Handler: Link to existing product
  const handleLinkProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error("Veuillez sélectionner un produit du catalogue.");
      return;
    }
    const formData = new FormData();
    formData.append("suggestionId", suggestion.id);
    formData.append("productId", selectedProductId);
    if (linkInternalNotes) formData.append("internalNotes", linkInternalNotes);

    startTransition(async () => {
      const res = await linkSuggestionToProductAction(null, formData);
      if (res.ok) {
        toast.success(res.message || "Suggestion liée au produit avec succès.");
        router.refresh();
      } else {
        toast.error(res.error || "Erreur lors de la liaison.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* If already created / linked */}
      {suggestion.status === "PRODUCT_CREATED" && suggestion.linkedProduct && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-primary/10 to-transparent border border-purple-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-600 text-white shadow-sm">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                {dict.productSuggestions.productCreated}
              </div>
              <h3 className="text-base font-bold text-foreground">
                {suggestion.linkedProduct.name}
              </h3>
            </div>
          </div>

          <Link
            href={`/produits/${suggestion.linkedProduct.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm transition-all"
          >
            <span>{dict.productSuggestions.viewInCatalog}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Action Selector Tabs */}
      <div className="p-1 rounded-2xl bg-muted border flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveAction("status")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeAction === "status"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {dict.productSuggestions.statusUpdateTitle}
        </button>

        {suggestion.status !== "PRODUCT_CREATED" && (
          <>
            <button
              type="button"
              onClick={() => setActiveAction("create")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeAction === "create"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {dict.productSuggestions.createOfficialProduct}
            </button>

            <button
              type="button"
              onClick={() => setActiveAction("link")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeAction === "link"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {dict.productSuggestions.linkToProduct}
            </button>
          </>
        )}
      </div>

      {/* TAB 1: UPDATE STATUS & FEEDBACK */}
      {activeAction === "status" && (
        <form onSubmit={handleStatusUpdate} className="p-6 rounded-2xl border bg-card shadow-sm space-y-5">
          <div className="border-b pb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {dict.productSuggestions.statusUpdateTitle}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dict.productSuggestions.adminFeedback}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                {dict.common.status}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductSuggestionStatus)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="PENDING">{dict.statuses.suggestion.PENDING} (PENDING)</option>
                <option value="UNDER_REVIEW">{dict.statuses.suggestion.UNDER_REVIEW} (UNDER_REVIEW)</option>
                <option value="ACCEPTED">{dict.statuses.suggestion.ACCEPTED} (ACCEPTED)</option>
                <option value="REJECTED">{dict.statuses.suggestion.REJECTED} (REJECTED)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>{dict.productSuggestions.adminFeedback}</span>
              </label>
              <textarea
                rows={3}
                value={partnerFeedback}
                onChange={(e) => setPartnerFeedback(e.target.value)}
                placeholder={dict.productSuggestions.adminFeedback}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <label className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{dict.productSuggestions.internalNotesTitle}</span>
              </label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder={dict.productSuggestions.internalNotesNotice}
                className="w-full px-3 py-2 rounded-lg border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                🔒 {dict.productSuggestions.internalNotesNotice}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/95 transition-all disabled:opacity-50 shadow-sm"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{dict.productSuggestions.saveStatus}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CREATE PRODUCT */}
      {activeAction === "create" && suggestion.status !== "PRODUCT_CREATED" && (
        <form onSubmit={handleCreateProduct} className="p-6 rounded-2xl border bg-card shadow-sm space-y-5">
          <div className="border-b pb-3">
            <div className="flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {dict.productSuggestions.createOfficialProduct}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dict.productSuggestions.productCreatedDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-foreground">{dict.products.productName} *</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{dict.products.sellingPrice} *</label>
              <input
                type="number"
                step="0.01"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{dict.products.purchaseCost} *</label>
              <input
                type="number"
                step="0.01"
                required
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{dict.products.packagingCost}</label>
              <input
                type="number"
                step="0.01"
                value={packagingCost}
                onChange={(e) => setPackagingCost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{dict.products.deliveryCost}</label>
              <input
                type="number"
                step="0.01"
                value={deliveryCost}
                onChange={(e) => setDeliveryCost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{dict.products.stock}</label>
              <input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{dict.products.lowStockThreshold}</label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-foreground">{dict.products.category}</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs"
              >
                <option value="">{dict.products.allCategories}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-foreground">{dict.products.description}</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="autoAssign"
                checked={autoAssign}
                onChange={(e) => setAutoAssign(e.target.checked)}
                className="rounded border text-primary focus:ring-primary w-4 h-4"
              />
              <label htmlFor="autoAssign" className="text-xs font-semibold text-foreground cursor-pointer">
                {dict.products.assignToPartner}: {suggestion.partner.displayName}
              </label>
            </div>

            <div className="sm:col-span-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <label className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{dict.productSuggestions.internalNotesTitle}</span>
              </label>
              <input
                type="text"
                value={createInternalNotes}
                onChange={(e) => setCreateInternalNotes(e.target.value)}
                placeholder={dict.productSuggestions.internalNotesNotice}
                className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{dict.productSuggestions.createOfficialProduct}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: LINK TO EXISTING PRODUCT */}
      {activeAction === "link" && suggestion.status !== "PRODUCT_CREATED" && (
        <form onSubmit={handleLinkProduct} className="p-6 rounded-2xl border bg-card shadow-sm space-y-5">
          <div className="border-b pb-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {dict.productSuggestions.linkToProduct}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dict.productSuggestions.attributionNotice}
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">
                {dict.products.productName} *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-background text-xs font-medium"
              >
                <option value="">{dict.products.noProductsFound}</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <label className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{dict.productSuggestions.internalNotesTitle}</span>
              </label>
              <input
                type="text"
                value={linkInternalNotes}
                onChange={(e) => setLinkInternalNotes(e.target.value)}
                placeholder={dict.productSuggestions.internalNotesNotice}
                className="w-full px-2.5 py-1.5 rounded-lg border bg-background text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/95 transition-all disabled:opacity-50 shadow-sm"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{dict.common.confirm}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
