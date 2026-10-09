import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth-config";
import { recordAudit, type AuditEntry } from "@/modules/audit/service";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

export class PendingPartnerError extends CredentialsSignin {
  code = "pending";
}

const credentialsSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

/**
 * Sign-in events are audited so operators can see who accessed the back office
 * and spot brute-force attempts. Logging is best-effort on purpose: an audit
 * failure must never turn a valid sign-in into a failed one.
 */
async function auditAuthEvent(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(prisma, entry);
  } catch {
    // Intentionally swallowed — see above.
  }
}

export async function authorizeCredentials(
  credentials: unknown,
  request?: { headers?: Headers | { get(name: string): string | null } },
) {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Brute-force brake (spec §46). Two independent buckets so one noisy IP
  // and one targeted account are each throttled. The IP is read from the
  // request, never from the submitted credentials.
  const ip = clientIpFrom(request?.headers);
  const [ipLimit, accountLimit] = await Promise.all([
    checkRateLimit("LOGIN", ip ?? "unknown"),
    checkRateLimit("LOGIN_ACCOUNT", `${ip ?? "unknown"}:${normalizedEmail}`),
  ]);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    await auditAuthEvent({
      actorId: null,
      action: "LOGIN_THROTTLED",
      entityType: "User",
      entityId: null,
      after: { email: normalizedEmail, reason: "RATE_LIMITED" },
      ip,
      userAgent: request?.headers.get("user-agent") ?? null,
    });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { partner: true },
  });

  const userAgent = request?.headers.get("user-agent") ?? null;

  if (!user || user.status !== "ACTIVE") {
    await auditAuthEvent({
      actorId: user?.id ?? null,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id ?? null,
      after: {
        email: normalizedEmail,
        reason: user ? "USER_DISABLED" : "UNKNOWN_EMAIL",
      },
      ip,
      userAgent,
    });
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await auditAuthEvent({
      actorId: user.id,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      after: { email: normalizedEmail, reason: "INVALID_PASSWORD" },
      ip,
      userAgent,
    });
    return null;
  }

  // Prevent 307 redirect loop: unapproved/pending partners must not obtain a session
  if (user.role === "PARTNER") {
    const partnerStatus = user.partner?.status;
    if (!partnerStatus || partnerStatus !== "ACTIVE") {
      await auditAuthEvent({
        actorId: user.id,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        after: {
          email: normalizedEmail,
          reason: user.partner ? `PARTNER_${user.partner.status}` : "PARTNER_RECORD_MISSING",
        },
        ip,
        userAgent,
      });

      if (partnerStatus === "PENDING") {
        throw new PendingPartnerError();
      }
      return null;
    }
  }

  await auditAuthEvent({
    actorId: user.id,
    action: "LOGIN_SUCCEEDED",
    entityType: "User",
    entityId: user.id,
    after: { email: normalizedEmail, role: user.role, partnerId: user.partner?.id ?? null },
    ip,
    userAgent,
  });

  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    partnerId: user.partner?.id ?? null,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: authorizeCredentials,
    }),
  ],
});
