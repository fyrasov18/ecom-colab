import { NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { globalSearch, type SearchScope } from "@/modules/search/service";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

/**
 * GET /api/search?q=…
 *
 * The scope comes from the SESSION, never from the query string: a client
 * cannot ask for a different scope than the one it is authenticated for.
 */
export const dynamic = "force-dynamic";

const MAX_LENGTH = 80;

export async function GET(request: Request) {
  const user = await requireSession(["SUPER_ADMIN", "ADMIN", "PARTNER"]);

  // Keyed by user id, not just IP: search hits the database on every keystroke,
  // so a shared office IP must not exhaust the budget of one operator.
  const limit = await checkRateLimit(
    "SEARCH",
    `${user.id}:${clientIpFrom(request.headers)}`,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const trimmed = q.trim().slice(0, MAX_LENGTH);

  const scope: SearchScope =
    user.role === "PARTNER"
      ? { role: "partner", partnerId: user.partnerId ?? "" }
      : { role: "admin" };

  // A partner without a linked partner account can never search anything.
  if (scope.role === "partner" && !scope.partnerId) {
    return NextResponse.json({ query: trimmed, groups: [], total: 0 });
  }

  const results = await globalSearch(scope, trimmed);
  return NextResponse.json(results);
}
