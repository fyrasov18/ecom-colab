import { NextResponse } from "next/server";
import {
  checkRateLimit,
  clientIpFrom,
} from "@/lib/rate-limit";
import {
  applyAnswer,
  createProductDraft,
  finishSession,
  getActiveSession,
  isAuthorized,
  recordUpdate,
  startSession,
} from "@/modules/telegram/service";
import {
  parseCommand,
  parseCompactProduct,
  validateProductEconomics,
} from "@/modules/telegram/parser";

/**
 * Telegram webhook.
 *
 * Security model:
 *  - the bot token and webhook secret live server-side only (env);
 *  - every delivery is authenticated with the X-Telegram-Bot-Api-Secret-Token
 *    header Telegram was configured with;
 *  - `TelegramUpdate.updateId` is unique, so a retried delivery is a no-op;
 *  - an update from an unauthorised user is recorded and ignored — never parsed.
 *
 * The bot NEVER publishes a product: it only ever creates a DRAFT.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramMessage = {
  from?: { id?: number; first_name?: string };
  text?: string;
};

type TelegramUpdateBody = {
  update_id?: number;
  message?: TelegramMessage;
};

const WIZARD_PROMPTS: Record<string, string> = {
  NAME: "Nom du produit ?",
  DESCRIPTION: "Description courte du produit ?",
  PURCHASE_COST: "Coût d'achat (DT) ?",
  SELLING_PRICE: "Prix de vente (DT) ?",
  STOCK: "Stock disponible ?",
  SKU: "SKU / référence (optionnel) ?",
  CATEGORY: "Catégorie (optionnel) ?",
  SUPPLIER_REF: "Référence fournisseur (optionnel) ?",
  CONFIRM:
    "Récapitulatif : /done pour valider, /cancel pour abandonner. Vous pouvez aussi envoyer le message complet « Nom: … / Cost: … / Prix: … / Stock: … ».",
};

const HELP_TEXT = [
  "Commandes disponibles :",
  "/start — menu",
  "/newproduct — créer un produit (assistant pas à pas)",
  "/cancel — annuler la saisie en cours",
  "/help — cette aide",
  "",
  "Saisie rapide : Nom: … / Cost: … / Prix: … / Stock: … / Description: …",
].join("\n");

/** Minimal send helper. Failures are swallowed: never 500 the webhook. */
async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Delivery failure must not roll back the ingest: the draft is already saved.
  }
}

async function createDraftAndReply(
  chatId: number,
  telegramUserId: string,
  product: Parameters<typeof createProductDraft>[0],
  sessionId: string | null,
) {
  const economics = validateProductEconomics(product);
  if (!economics.ok) {
    await sendMessage(chatId, economics.error);
    return NextResponse.json({ ok: false, error: economics.error });
  }
  const created = await createProductDraft(product, { telegramUserId, sessionId });
  await sendMessage(
    chatId,
    `Produit « ${created.name} » enregistré en brouillon. Un administrateur doit le valider avant publication.`,
  );
  return NextResponse.json({ ok: true, action: "draft", productId: created.id });
}
export async function POST(request: Request) {
  // 0. Rate limit by IP, before any parsing or DB work.
  const ip = clientIpFrom(request.headers);
  const limit = await checkRateLimit("TELEGRAM_WEBHOOK", ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  // 1. Authenticate the delivery with the configured secret token.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: TelegramUpdateBody;
  try {
    body = (await request.json()) as TelegramUpdateBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const updateId = body.update_id;
  const message = body.message;
  if (typeof updateId !== "number" || !message?.from?.id) {
    return NextResponse.json({ ok: true, skipped: "no message" });
  }

  const telegramUserId = String(message.from.id);
  const chatId = message.from.id;

  // 2. Idempotency: Telegram retries deliveries; a retry must be a no-op.
  const isNew = await recordUpdate({
    updateId: String(updateId),
    telegramUserId,
    kind: "message",
  });
  if (!isNew) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 3. Authorisation: unknown / revoked users are recorded, never processed.
  if (!(await isAuthorized(telegramUserId))) {
    await sendMessage(
      chatId,
      "Accès non autorisé. Demandez à un administrateur d'autoriser votre compte Telegram.",
    );
    return NextResponse.json({ ok: true, unauthorized: true });
  }

  const text = (message.text ?? "").trim();
  const command = parseCommand(text);

  try {
    if (command?.command === "start") {
      await sendMessage(
        chatId,
        "Bienvenue. Commandes : /newproduct, /cancel, /help. Ou envoyez « Nom: … / Cost: … / Prix: … / Stock: … ».",
      );
      return NextResponse.json({ ok: true, action: "start" });
    }

    if (command?.command === "help") {
      await sendMessage(chatId, HELP_TEXT);
      return NextResponse.json({ ok: true, action: "help" });
    }

    if (command?.command === "cancel") {
      const open = await getActiveSession(telegramUserId);
      if (open) await finishSession(open.id, "CANCELLED");
      await sendMessage(chatId, "Saisie annulée.");
      return NextResponse.json({ ok: true, action: "cancel" });
    }

    const session = await getActiveSession(telegramUserId);
    const compact = parseCompactProduct(command?.args || text);

    // Compact message (alone, or sent mid-wizard) creates the draft directly.
    if (compact.ok) {
      return createDraftAndReply(
        chatId,
        telegramUserId,
        compact.product,
        session?.id ?? null,
      );
    }

    if (command?.command === "newproduct" || !session) {
      await startSession(telegramUserId);
      await sendMessage(chatId, WIZARD_PROMPTS.NAME);
      return NextResponse.json({ ok: true, action: "wizard_started" });
    }

    // Only a non-empty free-text answer advances the wizard.
    if (text === "") {
      await sendMessage(chatId, WIZARD_PROMPTS[session.step] ?? HELP_TEXT);
      return NextResponse.json({ ok: true, step: session.step });
    }

    const advanced = await applyAnswer(session, text);
    if (!advanced.ok) {
      await sendMessage(chatId, advanced.error);
      return NextResponse.json({ ok: false, error: advanced.error });
    }

    await sendMessage(chatId, WIZARD_PROMPTS[advanced.step] ?? HELP_TEXT);
    return NextResponse.json({ ok: true, step: advanced.step });
  } catch (err) {
    // Never leak internals. The update is already recorded, so a retry is a no-op.
    console.error("[telegram] update failed", err);
    await sendMessage(
      chatId,
      "Une erreur est survenue. Réessayez avec /newproduct ou contactez un administrateur.",
    );
    return NextResponse.json({ ok: false });
  }
}
