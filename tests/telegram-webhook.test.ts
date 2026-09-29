import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Webhook security tests (spec §25, §60).
 *
 * The handler's guards are the important part: secret-token auth, webhook
 * idempotency, and authorisation must all hold before any input is parsed or
 * any product is created. Prisma, the Telegram service and `fetch` are mocked
 * so these stay fast unit tests; real DB behaviour is covered by the
 * integration suite.
 */

const prismaMock = {
  telegramUpdate: { create: vi.fn() },
  telegramSession: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  telegramAuthorizedUser: { findUnique: vi.fn() },
};

const serviceMock = {
  isAuthorized: vi.fn(),
  getActiveSession: vi.fn(),
  startSession: vi.fn(),
  finishSession: vi.fn(),
  applyAnswer: vi.fn(),
  createProductDraft: vi.fn(),
};

// `vi.mock` is hoisted above these consts, so the factories reference the mocks
// lazily (inside the returned methods) instead of capturing them at hoist time.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    telegramUpdate: { create: (...a: unknown[]) => prismaMock.telegramUpdate.create(...a) },
    telegramSession: {
      findFirst: (...a: unknown[]) => prismaMock.telegramSession.findFirst(...a),
      updateMany: (...a: unknown[]) => prismaMock.telegramSession.updateMany(...a),
      create: (...a: unknown[]) => prismaMock.telegramSession.create(...a),
      update: (...a: unknown[]) => prismaMock.telegramSession.update(...a),
    },
    telegramAuthorizedUser: {
      findUnique: (...a: unknown[]) =>
        prismaMock.telegramAuthorizedUser.findUnique(...a),
    },
  },
}));

vi.mock("@/modules/telegram/service", () => ({
  isAuthorized: (...a: unknown[]) => serviceMock.isAuthorized(...a),
  getActiveSession: (...a: unknown[]) => serviceMock.getActiveSession(...a),
  startSession: (...a: unknown[]) => serviceMock.startSession(...a),
  finishSession: (...a: unknown[]) => serviceMock.finishSession(...a),
  applyAnswer: (...a: unknown[]) => serviceMock.applyAnswer(...a),
  createProductDraft: (...a: unknown[]) => serviceMock.createProductDraft(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 100,
    retryAfterSeconds: 1,
  })),
  clientIpFrom: vi.fn(() => "1.2.3.4"),
  rateLimitMessage: vi.fn(() => "Trop de tentatives."),
}));

vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));

import { POST } from "@/app/api/telegram/webhook/route";

const SECRET = "wh-secret";

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://app.test/api/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function update(id: number, text: string, userId = 555) {
  return { update_id: id, message: { from: { id: userId }, text } };
}

const authed = { "x-telegram-bot-api-secret-token": SECRET };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  delete process.env.TELEGRAM_BOT_TOKEN;
  prismaMock.telegramUpdate.create.mockResolvedValue({ id: "u1" });
  serviceMock.isAuthorized.mockResolvedValue(true);
  serviceMock.getActiveSession.mockResolvedValue(null);
  serviceMock.startSession.mockResolvedValue({ id: "s1" });
  serviceMock.finishSession.mockResolvedValue({ id: "s1" });
  serviceMock.createProductDraft.mockResolvedValue({
    id: "prod1",
    name: "Lampe",
  });
});

describe("Telegram webhook — authentication", () => {
  it("rejects a delivery with no secret header", async () => {
    expect((await POST(req(update(1, "/start")))).status).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    const res = await POST(
      req(update(2, "/start"), {
        "x-telegram-bot-api-secret-token": "wrong",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects when the server has no secret configured", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await POST(req(update(3, "/start"), authed));
    expect(res.status).toBe(401);
  });

  it("accepts the correct secret", async () => {
    expect((await POST(req(update(4, "/start"), authed))).status).toBe(200);
  });

  it("returns 400 on malformed JSON (before any DB write)", async () => {
    const res = await POST(req("{not json", authed));
    expect(res.status).toBe(400);
    expect(prismaMock.telegramUpdate.create).not.toHaveBeenCalled();
  });
});
describe("Telegram webhook — idempotency", () => {
  it("treats a repeated update_id as a duplicate and does nothing else", async () => {
    prismaMock.telegramUpdate.create.mockRejectedValueOnce(
      new Error("Unique constraint failed"),
    );
    const res = await POST(req(update(99, "/newproduct"), authed));
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    // Critically: a retry must not create a second product.
    expect(serviceMock.createProductDraft).not.toHaveBeenCalled();
    expect(serviceMock.startSession).not.toHaveBeenCalled();
  });

  it("records the update before processing", async () => {
    await POST(req(update(100, "/start"), authed));
    expect(prismaMock.telegramUpdate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ updateId: "100", telegramUserId: "555" }),
    });
  });
});

describe("Telegram webhook — authorization", () => {
  it("refuses an unauthorised user and never parses their input", async () => {
    serviceMock.isAuthorized.mockResolvedValue(false);
    const res = await POST(
      req(update(200, "Nom: X\nCost: 1\nPrix: 2\nStock: 3"), authed),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).unauthorized).toBe(true);
    expect(serviceMock.createProductDraft).not.toHaveBeenCalled();
    expect(serviceMock.startSession).not.toHaveBeenCalled();
  });
});

describe("Telegram webhook — commands", () => {
  it("answers /help without creating anything", async () => {
    const res = await POST(req(update(300, "/help"), authed));
    expect((await res.json()).action).toBe("help");
    expect(serviceMock.createProductDraft).not.toHaveBeenCalled();
  });

  it("cancels an open session on /cancel", async () => {
    serviceMock.getActiveSession.mockResolvedValue({ id: "s9", step: "NAME" });
    const res = await POST(req(update(301, "/cancel"), authed));
    expect((await res.json()).action).toBe("cancel");
    expect(serviceMock.finishSession).toHaveBeenCalledWith(
      expect.anything(),
      "s9",
      "CANCELLED",
    );
  });
});

describe("Telegram webhook — product creation", () => {
  it("creates a DRAFT from a compact message (never publishes)", async () => {
    const res = await POST(
      req(update(400, "Nom: Lampe\nCost: 20\nPrix: 50\nStock: 5"), authed),
    );
    const body = await res.json();
    expect(body.action).toBe("draft");
    expect(body.productId).toBe("prod1");
    expect(serviceMock.createProductDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lampe",
        purchaseCost: 20,
        sellingPrice: 50,
      }),
      expect.objectContaining({ telegramUserId: "555" }),
    );
  });

  it("rejects a compact message whose price is below the cost", async () => {
    const res = await POST(
      req(update(401, "Nom: X\nCost: 90\nPrix: 10\nStock: 1"), authed),
    );
    expect((await res.json()).ok).toBe(false);
    expect(serviceMock.createProductDraft).not.toHaveBeenCalled();
  });

  it("starts the wizard for a bare /newproduct", async () => {
    const res = await POST(req(update(402, "/newproduct"), authed));
    expect((await res.json()).action).toBe("wizard_started");
    expect(serviceMock.startSession).toHaveBeenCalled();
  });

  it("feeds a free-text answer to the open wizard", async () => {
    serviceMock.getActiveSession.mockResolvedValue({
      id: "s2",
      step: "NAME",
      data: null,
    });
    serviceMock.applyAnswer.mockResolvedValue({
      ok: true,
      step: "DESCRIPTION",
    });
    const res = await POST(req(update(403, "Lampe LED"), authed));
    expect((await res.json()).step).toBe("DESCRIPTION");
    expect(serviceMock.applyAnswer).toHaveBeenCalled();
  });
});
