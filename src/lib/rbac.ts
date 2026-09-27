import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ADMIN_ROLES, ALL_ROLES, ROLE_HOME, isAdminRole } from "@/lib/roles";

export { ADMIN_ROLES, ALL_ROLES, ROLE_HOME, isAdminRole };

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  partnerId?: string | null;
};


/** Server-side auth + RBAC gate for pages/layouts. Redirects on failure. */
export async function requireSession(roles?: Role[]): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;
  if (roles && !roles.includes(user.role)) {
    redirect(ROLE_HOME[user.role]);
  }
  return user;
}

/**
 * Server-side ownership guard: a partner may only access resources
 * belonging to them. Never trust IDs coming from the URL.
 */
export function assertPartnerOwnership(
  resourcePartnerId: string,
  user: SessionUser,
): void {
  if (user.role === "PARTNER" && resourcePartnerId !== user.partnerId) {
    throw new Error("FORBIDDEN");
  }
}
