import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { getPartnerStatus } from "@/modules/partners/queries";
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
  // PENDING/REJECTED partners must not reach the partner area, even with a
  // valid session (User stays ACTIVE so Admin can still approve them).
  if (user.role === "PARTNER" && user.partnerId) {
    const status = await getPartnerStatus(user.partnerId);
    if (status !== "ACTIVE") {
      redirect("/login?error=pending");
    }
  }
  return user;
}

// Ownership (a partner may only reach their own resources) is enforced where it
// cannot be bypassed: every partner-facing query scopes by the `partnerId` read
// from the session, never by an id coming from the URL. A standalone assertion
// helper would only duplicate that guarantee, so none is exported here.
