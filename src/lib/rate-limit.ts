/**
 * Fixed-window rate limiter for the platform's sensitive entry points
 * (sign-in, Telegram webhook, withdrawal requests).
 *
 * SCOPE — read this before relying on it:
 *  - In-process, in-memory. There is NO Redis/distributed store in this project,
 *    so limits are per Node process: a multi-instance deployment would multiply
 *    the effective limit by the instance count. That is an accepted MVP
 *    limitation (spec §46: do not build a distributed system for the MVP), and
 *    the swap point is `RateLimitStore` below.
 *  - State resets on deploy/restart. Acceptable: it is a brake on abuse, not a
 *    security boundary — auth, RBAC and validation remain the real controls.
 *
 * Pure decision logic is separated from the store so it is unit-testable.
 */

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
};

export type RateLimitRule = {
  /** Maximum calls allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

/** Named rules so limits are defined in one auditable place. */
export const RATE_LIMITS = {
  /** Per IP: blunt brake against credential stuffing. */
  LOGIN: { limit: 10, windowSeconds: 300 },
  /** Per IP+email: tighter, so one account cannot be hammered from a pool. */
  LOGIN_ACCOUNT: { limit: 5, windowSeconds: 900 },
  /** Per IP on the Telegram webhook (Telegram itself retries). */
  TELEGRAM_WEBHOOK: { limit: 120, windowSeconds: 60 },
  /** Per partner: withdrawal spam. */
  WITHDRAWAL_REQUEST: { limit: 5, windowSeconds: 3600 },
  /** Per IP: global search is read-heavy and hits the DB on every keystroke. */
  SEARCH: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitKind = keyof typeof RATE_LIMITS;

/**
 * Storage seam. Swap this for Redis (or a DB table) to make limits global.
 * Kept deliberately tiny so the swap is mechanical.
 */
export interface RateLimitStore {
  /** Current window key → hit count. */
  hit(key: string, windowStart: number): Promise<number>;
  reset(): void;
}

type Bucket = { count: number; windowStart: number };

/** Default in-memory store. Not shared across processes (see SCOPE note). */
export function createMemoryStore(): RateLimitStore & { size(): number } {
  const buckets = new Map<string, Bucket>();
  return {
    async hit(key, windowStart) {
      const existing = buckets.get(key);
      if (!existing || existing.windowStart !== windowStart) {
        buckets.set(key, { count: 1, windowStart });
        return 1;
      }
      existing.count += 1;
      return existing.count;
    },
    reset() {
      buckets.clear();
    },
    size() {
      return buckets.size;
    },
  };
}

let store: RateLimitStore = createMemoryStore();

/** Test seam — never call this from application code. */
export function __setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

/**
 * Read-only description of the limiter's configuration and live state.
 *
 * Deliberately non-mutating: it inspects `store` and never calls `hit()` or
 * `reset()`. The system-health page calls this on every render, so a mutating
 * probe would wipe in-flight counters (letting an attacker reset a login
 * throttle just by opening the back-office health screen).
 */
export function describeRateLimits(): {
  rules: number;
  /** Buckets currently tracked, when the store exposes `size()`. */
  trackedBuckets: number | null;
  /** Rules with a non-positive limit or window — these would disable the brake. */
  invalidRules: string[];
} {
  const entries = Object.entries(RATE_LIMITS) as [RateLimitKind, RateLimitRule][];
  const invalidRules = entries
    .filter(([, r]) => !(r.limit > 0) || !(r.windowSeconds > 0))
    .map(([kind]) => kind);

  const sized = store as RateLimitStore & { size?: () => number };
  const trackedBuckets =
    typeof sized.size === "function" ? sized.size() : null;

  return { rules: entries.length, trackedBuckets, invalidRules };
}

export function __resetRateLimit(): void {
  store.reset();
}

/** Stable bucket key: kind + the caller-supplied identity. */
export function rateLimitKey(kind: RateLimitKind, identity: string): string {
  return `${kind}:${identity}`;
}

/**
 * Fixed-window check. Counts the call, then decides.
 * `identity` should be an IP, an IP+email pair, a user id — never a raw secret.
 */
export async function checkRateLimit(
  kind: RateLimitKind,
  identity: string,
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  const rule = RATE_LIMITS[kind];
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
  const count = await store.hit(rateLimitKey(kind, identity), windowStart);

  const resetAt = windowStart + windowMs;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt - now.getTime()) / 1000),
  );

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds,
  };
}

/** First hop of x-forwarded-for (proxy-aware), falling back to x-real-ip. */
export function clientIpFrom(headers: Headers | undefined): string {
  const forwarded = headers?.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers?.get("x-real-ip") ?? "unknown";
}

/** French, user-facing throttle message. */
export function rateLimitMessage(decision: RateLimitDecision): string {
  const minutes = Math.ceil(decision.retryAfterSeconds / 60);
  if (minutes <= 1) {
    return `Trop de tentatives. Réessayez dans ${decision.retryAfterSeconds} secondes.`;
  }
  return `Trop de tentatives. Réessayez dans environ ${minutes} minute(s).`;
}
