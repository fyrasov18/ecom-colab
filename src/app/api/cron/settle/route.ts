import { NextResponse } from "next/server";
import { settleDueEarnings } from "@/modules/finance/ledger";

export const dynamic = "force-dynamic";

/**
 * Settlement cron endpoint.
 *
 * Guarded by CRON_SECRET (query `?key=…` or `Authorization: Bearer …`).
 * Idempotent: only PENDING ledger entries whose frozen settlement date has
 * passed are released, so overlapping runs (or a manual run from /finance)
 * can never double-credit a partner.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const key = new URL(request.url).searchParams.get("key");
  if (key && key === secret) return true;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  return bearer === secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET non configuré." },
      { status: 500 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await settleDueEarnings();
    return NextResponse.json({
      ok: true,
      settled: result.settled,
      partners: result.partners.length,
      ranAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Settlement impossible." },
      { status: 500 },
    );
  }
}
