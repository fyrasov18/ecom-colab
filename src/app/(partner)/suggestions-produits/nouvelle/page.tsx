import type { Metadata } from "next";
import { requireSession } from "@/lib/rbac";
import { SuggestionForm } from "@/components/suggestions/suggestion-form";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "Suggérer un nouveau produit — Ecom Partner",
};

export default async function NewProductSuggestionPage() {
  await requireSession(["PARTNER"]);
  const locale = await getServerLocale();
  const dict = getDictionary(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {dict.productSuggestions.newSuggestion}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Proposez un produit prometteur à notre équipe. Si le produit est validé, il sera intégré au catalogue et vous conserverez l&apos;attribution de cette contribution.
        </p>
      </div>

      <SuggestionForm />
    </div>
  );
}
