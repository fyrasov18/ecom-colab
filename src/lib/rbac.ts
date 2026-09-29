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

// Ownership (a partner may only reach their own resources) is enforced where it
// cannot be bypassed: every partner-facing query scopes by the `partnerId` read
// from the session, never by an id coming from the URL. A standalone assertion
// helper would only duplicate that guarantee, so none is exported here.
