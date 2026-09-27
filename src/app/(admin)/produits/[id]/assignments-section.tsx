"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { assignProduct, removeAssignment, type ActionState } from "../../partenaires/actions";

type PartnerOption = { id: string; displayName: string };
type Assigned = {
  partnerId: string;
  commissionType: string | null;
  commissionValue: unknown;
  partner: { displayName: string };
};

const initialState: ActionState = { ok: false };

export function AssignmentsSection({
  productId,
  assigned,
  partners,
  canEditCommission,
}: {
  productId: string;
  assigned: Assigned[];
  partners: PartnerOption[];
  canEditCommission: boolean;
}) {
  const [state, formAction] = useActionState(assignProduct, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  const available = partners.filter(
    (p) => !assigned.some((a) => a.partnerId === p.id),
  );

  return (
    <section className="space-y-4" id="partenaires">
      <h2 className="text-base font-semibold">Partenaires assignés</h2>

      {available.length > 0 ? (
        <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <input type="hidden" name="productId" value={productId} />
          <div className="min-w-52 flex-1 space-y-1.5">
            <Label htmlFor="as-partner">Partenaire</Label>
            <NativeSelect id="as-partner" name="partnerId">
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-ctype">Commission</Label>
            <NativeSelect id="as-ctype" name="commissionType" defaultValue="" className="w-44">
              <option value="">Règle par défaut</option>
              <option value="PERCENTAGE">Pourcentage (%)</option>
              <option value="FIXED">Fixe (DT)</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-cvalue">Valeur</Label>
            <Input id="as-cvalue" name="commissionValue" type="number" step="0.001" min="0" className="w-32" placeholder="—" />
          </div>
          <Button type="submit" variant="outline">
            <UserPlus className="h-4 w-4" /> Assigner
          </Button>
          {!canEditCommission && (
            <p className="w-full text-xs text-muted-foreground">
              La commission par défaut s&apos;applique : la surcharge nécessite un Super Admin.
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Tous les partenaires sont déjà assignés.</p>
      )}

      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun partenaire assigné à ce produit.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {assigned.map((a) => (
            <li key={a.partnerId} className="flex items-center justify-between gap-3 p-3">
              <div>
                <Link
                  href={`/partenaires/${a.partnerId}`}
                  className="font-medium hover:underline"
                >
                  {a.partner.displayName}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {a.commissionType
                    ? `Commission personnalisée : ${a.commissionType === "PERCENTAGE" ? `${a.commissionValue} %` : `${a.commissionValue} DT`}`
                    : "Règle par défaut (partenaire/global)"}
                </div>
              </div>
              <form action={removeAssignment}>
                <input type="hidden" name="partnerId" value={a.partnerId} />
                <input type="hidden" name="productId" value={productId} />
                <ConfirmSubmit
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  confirmMessage="Désassigner ce produit de ce partenaire ?"
                >
                  Désassigner
                </ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
