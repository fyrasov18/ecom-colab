"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resumeOrder, type LogisticsState } from "./actions";

const initialState: LogisticsState = { ok: false };

export function ResumeButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(resumeOrder, initialState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <History className="h-3.5 w-3.5" /> Reprendre
      </Button>
    </form>
  );
}
