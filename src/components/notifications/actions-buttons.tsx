"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  markEveryNotificationRead,
  markNotificationRead,
  type NotificationActionState,
} from "@/modules/notifications/actions";

const initialState: NotificationActionState = { ok: false };

/** Mark a single notification read. Mounted inside the server-rendered feed. */
export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [state, formAction, pending] = useActionState(
    markNotificationRead,
    initialState,
  );

  useEffect(() => {
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="notificationId" value={notificationId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="text-xs">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Marquer lu
      </Button>
    </form>
  );
}

/** Clear the whole unread queue for the current user. */
export function MarkAllReadButton() {
  const [state, formAction, pending] = useActionState(
    markEveryNotificationRead,
    initialState,
  );

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <CheckCheck className="mr-1.5 h-4 w-4" />
        )}
        Tout marquer comme lu
      </Button>
    </form>
  );
}
