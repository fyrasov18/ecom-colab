import Link from "next/link";
import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { listProductsWithMarketing } from "@/modules/marketing/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const products = await listProductsWithMarketing();
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  const t = dict.marketing;
  const pDict = dict.products;

  const kindLabels: Record<string, string> = {
    AD_COPY: locale === "ar" ? "نص إعلاني" : locale === "en" ? "Ad Copy" : "Argumentaire",
    HOOK: "Hook",
    CAPTION: "Caption",
    DESCRIPTION: locale === "ar" ? "وصف" : locale === "en" ? "Description" : "Description",
    SCRIPT: "Script",
    FAQ: "FAQ",
    CREATIVE: locale === "ar" ? "تصميم" : locale === "en" ? "Creative" : "Créa",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title={locale === "ar" ? "لا توجد منتجات" : locale === "en" ? "No products" : "Aucun produit"}
          description={locale === "ar" ? "أضف منتجات أولاً لإنشاء مجموعات التسويق." : locale === "en" ? "Add products first to configure marketing kits." : "Ajoutez d'abord des produits."}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{pDict.productName}</TableHead>
                <TableHead>{locale === "ar" ? "الوسائط" : locale === "en" ? "Media" : "Médias"}</TableHead>
                <TableHead>{locale === "ar" ? "عناصر المجموعة" : locale === "en" ? "Kit items" : "Éléments kit"}</TableHead>
                <TableHead>{locale === "ar" ? "الأنواع المتاحة" : locale === "en" ? "Available types" : "Types présents"}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.mediaCount}</TableCell>
                  <TableCell>
                    {p.assetCount === 0 ? (
                      <Badge variant="warning">{locale === "ar" ? "مجموعة فارغة" : locale === "en" ? "Empty kit" : "Kit vide"}</Badge>
                    ) : (
                      <Badge variant="success">{p.assetCount}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.kinds.map((k) => (
                        <Badge key={k} variant="info" className="text-[10px]">
                          {kindLabels[k] ?? k}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/produits/${p.id}#marketing`}>{t.manageKit}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Megaphone className="h-4 w-4 shrink-0 text-primary" />
        {locale === "ar"
          ? "تظهر العناصر المضافة هنا فوراً في كتالوج الشريك المخصص."
          : locale === "en"
          ? "Items added here appear immediately in the assigned partner's catalogue."
          : "Les éléments ajoutés ici apparaissent immédiatement dans le catalogue du partenaire assigné."}
      </div>
    </div>
  );
}
