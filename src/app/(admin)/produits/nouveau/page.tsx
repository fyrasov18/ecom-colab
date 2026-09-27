import type { Metadata } from "next";
import { ProductForm } from "../product-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Nouveau produit" };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajouter un produit</h1>
        <p className="text-sm text-muted-foreground">
          Les coûts et le prix de vente serviront de base au calcul financier des
          commandes (snapshot figé à la création de chaque commande).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations produit</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
