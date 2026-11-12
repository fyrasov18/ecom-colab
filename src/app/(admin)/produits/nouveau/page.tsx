import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { listActiveCategories } from "@/modules/categories/service";
import { ProductForm } from "../product-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  await requireSession(["SUPER_ADMIN", "ADMIN"]);
  const categories = await listActiveCategories();

  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.products;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.addProduct}</h1>
        <p className="text-sm text-muted-foreground">
          {locale === "ar"
            ? "ستُستخدم التكاليف وسعر البيع كأساس للحساب المالي للطلبات (لقطة مجمدة عند إنشاء كل طلب)."
            : locale === "en"
            ? "Costs and selling price will serve as the basis for financial calculations (frozen snapshot on order creation)."
            : "Les coûts et le prix de vente serviront de base au calcul financier des commandes (snapshot figé à la création de chaque commande)."}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {locale === "ar" ? "بيانات المنتج" : locale === "en" ? "Product Information" : "Informations produit"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
