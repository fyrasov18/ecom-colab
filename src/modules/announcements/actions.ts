"use server";

import { requireSession } from "@/lib/rbac";
import {
  getPendingPartnerPopup,
  recordPopupDismissed,
  recordPopupDisplayed,
  type PartnerPopupPayload,
} from "./service";

export async function fetchPendingPartnerPopupAction(): Promise<PartnerPopupPayload | null> {
  try {
    const session = await requireSession(["PARTNER"]);
    if (!session.partnerId) return null;
    return await getPendingPartnerPopup(session.partnerId, {
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
    });
  } catch {
    return null;
  }
}

export async function trackPopupDisplayedAction(popupEventId: string): Promise<void> {
  try {
    const session = await requireSession(["PARTNER"]);
    if (!session.partnerId || !popupEventId) return;
    await recordPopupDisplayed(popupEventId, session.partnerId);
  } catch {
    // Non-blocking telemetry
  }
}

export async function dismissPartnerPopupAction(
  popupEventId: string,
  clicked: boolean = false,
): Promise<void> {
  try {
    const session = await requireSession(["PARTNER"]);
    if (!session.partnerId || !popupEventId) return;
    await recordPopupDismissed(popupEventId, session.partnerId, clicked);
  } catch {
    // Non-blocking telemetry
  }
}
