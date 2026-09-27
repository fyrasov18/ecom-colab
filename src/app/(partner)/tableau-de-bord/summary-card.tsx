import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";

type WalletKpis = {
  totalEarned: number;
  totalWithdrawn: number;
  assignedProductsCount: number;
};

export function PartnerFinancialSummary({ data }: { data: WalletKpis }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-medium">Bilan financier</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between border-b pb-2 text-sm">
          <span className="text-muted-foreground">Gains cumulés</span>
          <span className="font-semibold">{formatPrice(data.totalEarned)} DT</span>
        </div>
        <div className="flex justify-between border-b pb-2 text-sm">
          <span className="text-muted-foreground">Retiré</span>
          <span className="font-semibold">{formatPrice(data.totalWithdrawn)} DT</span>
        </div>
        <div className="flex justify-between pt-1 text-sm">
          <span className="text-muted-foreground">Produits assignés</span>
          <span className="font-semibold">{data.assignedProductsCount}</span>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/portefeuille">Voir mon portefeuille</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
