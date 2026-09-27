"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveShipmentInfo, type LogisticsState } from "@/app/(admin)/logistique/actions";

type ShipmentInfo = {
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
} | null;

const initialState: LogisticsState = { ok: false };

export function ShipmentCard({
  orderId,
  shipment,
}: {
  orderId: string;
  shipment: ShipmentInfo;
}) {
  const [state, formAction, pending] = useActionState(
    saveShipmentInfo,
    initialState,
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  const fr = (d: Date | null) =>
    d
      ? d.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <section id="livraison" className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Truck className="h-4 w-4 text-primary" /> Livraison / colis
      </h2>
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex flex-wrap gap-6 text-xs text-muted-foreground">
          <span>Expédiée : {fr(shipment?.shippedAt ?? null)}</span>
          <span>Livrée : {fr(shipment?.deliveredAt ?? null)}</span>
        </div>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="orderId" value={orderId} />
          <div className="min-w-44 space-y-1.5">
            <Label htmlFor="carrier" className="text-xs">
              Transporteur
            </Label>
            <Input
              id="carrier"
              name="carrier"
              defaultValue={shipment?.carrier ?? ""}
              maxLength={80}
              placeholder="Yalidine, Poste Tunisienne…"
            />
          </div>
          <div className="min-w-48 space-y-1.5">
            <Label htmlFor="trackingNumber" className="text-xs">
              N° de suivi
            </Label>
            <Input
              id="trackingNumber"
              name="trackingNumber"
              defaultValue={shipment?.trackingNumber ?? ""}
              maxLength={80}
              placeholder="TRK-000123"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </form>
      </div>
    </section>
  );
}
