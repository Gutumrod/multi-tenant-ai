/**
 * Host-side wiring for the vendored `rate-limit` module (H7-FU-RATELIMIT).
 *
 * This file is the Host half of the reuse. The module's declared boundary
 * (`modules/rate-limit/MODULE.md`, §Architectural boundary) forbids the module
 * from doing any of the three things this file exists to do, so they live here
 * and not in the copy:
 *
 *   1. resolving the identity KEY      — the module never infers identity;
 *   2. reading the environment         — the module never touches process.env;
 *   3. mapping a refusal to HTTP       — the module returns/throws, the Host
 *                                        renders the response.
 *
 * ---------------------------------------------------------------------------
 * THE KEY, AND WHY THIS ONE
 * ---------------------------------------------------------------------------
 * `POST /payment/webhook` is called by Stripe, not by a logged-in user, so
 * there is no tenant id and no session to key on. The two candidates were:
 *
 *   (a) the caller's IP address. Rejected. This server sets no `trust proxy`,
 *       so `req.ip` is the socket address and `X-Forwarded-For` is
 *       caller-controlled: an attacker varies one header and the limiter is
 *       defeated. It also fails in the other direction, because Stripe
 *       delivers from many addresses, so an IP-keyed limiter would spread one
 *       attacker's flood across many buckets and throttle none of it.
 *   (b) an API key or a signature component from the request. Rejected.
 *       Stripe does not send an API key on deliveries, and deriving the key
 *       from the signature would mean doing the HMAC work the limiter exists
 *       to avoid.
 *
 * The honest answer for this endpoint is that the thing being protected is the
 * ENDPOINT, not the caller, so the key is a single constant per route:
 *
 *     WEBHOOK_RATE_LIMIT_KEY = 'route:POST /payment/webhook'
 *
 * A constant cannot be varied per request by an attacker, which is exactly the
 * property (a) lacks. The cost, stated plainly and not hidden: one bucket means
 * a burst of LEGITIMATE Stripe deliveries is throttled together with an
 * attacker's flood, and this limiter cannot tell them apart. Stripe treats a
 * 429 as a delivery failure and retries with backoff (and the handler's
 * idempotency ledger still makes a retried event apply at most once), so the
 * failure mode is delayed delivery rather than lost events — but the delay is
 * real and this is a process-protection limit, not a per-caller quota.
 *
 * ---------------------------------------------------------------------------
 * MISCONFIGURATION: CLAMPED, NEVER DISABLED
 * ---------------------------------------------------------------------------
 * The module raises `RateLimitConfigError` for `limit <= 0` or `windowMs <= 0`,
 * so a bad value must be resolved here. The choice made is to CLAMP a rejected
 * value to this file's safe default and log one warning line, rather than to
 * fail closed on the endpoint. Reasoning: failing closed on a typo would take
 * the payment webhook down completely — every Stripe delivery refused — which
 * is a worse outcome than "the documented default limit applies". What matters
 * for the work unit's rule is that a bad value can never SILENTLY disable the
 * limiter, and it cannot: a rejected value is replaced with a positive limit
 * and a positive window, so the limiter is always armed; the replacement is
 * logged; and `resolveWebhookRateLimit` reports what it rejected.
 *
 * If the limiter itself fails for any other reason (the store throws), the
 * middleware FAILS CLOSED: the request is refused with 503
 * `RATE_LIMIT_UNAVAILABLE` rather than passed through unlimited. A limiter that
 * cannot count must not become a limiter that allows everything silently.
 */
import type { NextFunction, Request, Response } from 'express';
import {
  RateLimitError,
  createMemoryStore,
  createRateLimiter,
} from '../../../modules/rate-limit/index.js';
import type { RateLimitStore } from '../../../modules/rate-limit/index.js';

/** Environment variable holding the request ceiling for one window. */
export const WEBHOOK_RATE_LIMIT_MAX_ENV = 'WEBHOOK_RATE_LIMIT_MAX';

/** Environment variable holding the window length, in MILLISECONDS. */
export const WEBHOOK_RATE_LIMIT_WINDOW_MS_ENV = 'WEBHOOK_RATE_LIMIT_WINDOW_MS';

/**
 * Safe defaults, applied when the variable is absent AND when it is rejected.
 * 60 requests per 60 s (one per second on average) is generous for webhook
 * deliveries to a single endpoint while still bounding a flood of them.
 */
export const WEBHOOK_RATE_LIMIT_DEFAULT_MAX = 60;
export const WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS = 60_000;

/** The single key this route is limited under. See the file header. */
export const WEBHOOK_RATE_LIMIT_KEY = 'route:POST /payment/webhook';

/** Code carried by a refusal, from the module's own error contract. */
export const RATE_LIMITED_CODE = 'RATE_LIMITED';

/** Code carried when the limiter itself failed and the request was refused. */
export const RATE_LIMIT_UNAVAILABLE_CODE = 'RATE_LIMIT_UNAVAILABLE';

export const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  'Rate limiter is unavailable on this server instance, so the request was refused rather than served unlimited';

export type WebhookRateLimitRejection = {
  /** The variable whose value was rejected. */
  name: string;
  /** The rejected value, as it will appear in the warning line. */
  value: string;
  /** Why it was rejected. */
  reason: string;
  /** The safe default that is used instead. */
  usedInstead: number;
};

export type ResolvedWebhookRateLimit = {
  /** Requests allowed per window. Always a positive integer. */
  limit: number;
  /** Window length in milliseconds. Always a positive number. */
  windowMs: number;
  /** Values that were rejected and clamped. Empty when the environment was clean. */
  rejected: WebhookRateLimitRejection[];
};

/**
 * Reads one environment variable as a positive integer.
 *
 * An ABSENT (or empty) variable is not a misconfiguration: it selects the
 * documented default silently. A PRESENT but invalid value (zero, negative,
 * non-numeric, fractional) is a misconfiguration: it is recorded in `rejected`
 * and clamped so that the limiter is always armed with a positive limit.
 */
function readPositiveInteger(
  raw: string | undefined,
  name: string,
  fallback: number,
  rejected: WebhookRateLimitRejection[]
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const trimmed = raw.trim();
  const parsed = Number(trimmed);
  const reason = !/^\d+$/.test(trimmed)
    ? 'not a non-negative integer'
    : !Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0
      ? 'must be greater than zero'
      : null;

  if (reason) {
    rejected.push({ name, value: trimmed, reason, usedInstead: fallback });
    return fallback;
  }

  return parsed;
}

/**
 * Resolves the two settings from the environment. Pure and side-effect free,
 * so a test or a deployment preflight can ask what the current environment
 * resolves to without starting a server.
 */
export function resolveWebhookRateLimit(
  env: NodeJS.ProcessEnv = process.env
): ResolvedWebhookRateLimit {
  const rejected: WebhookRateLimitRejection[] = [];
  const limit = readPositiveInteger(
    env[WEBHOOK_RATE_LIMIT_MAX_ENV],
    WEBHOOK_RATE_LIMIT_MAX_ENV,
    WEBHOOK_RATE_LIMIT_DEFAULT_MAX,
    rejected
  );
  const windowMs = readPositiveInteger(
    env[WEBHOOK_RATE_LIMIT_WINDOW_MS_ENV],
    WEBHOOK_RATE_LIMIT_WINDOW_MS_ENV,
    WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS,
    rejected
  );
  return { limit, windowMs, rejected };
}

/** True for the module's own refusal error, however it crossed the boundary. */
function isRateLimited(error: unknown): error is RateLimitError {
  if (error instanceof RateLimitError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === RATE_LIMITED_CODE
  );
}

/** Renders the module's refusal contract as an HTTP 429, quota.ts style. */
function refuse(res: Response, error: RateLimitError): void {
  // `Math.max(1, …)` keeps the header a positive number of seconds: a refusal
  // that resolved to less than one second would otherwise advertise
  // `Retry-After: 0`, which invites an immediate retry loop.
  const retryAfterSeconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(error.status).json({
    error: error.message,
    code: error.code,
    limit: error.limit,
    windowMs: error.windowMs,
    remaining: 0,
    resetAt: error.resetAt,
    retryAfterMs: error.retryAfterMs,
    // The module's own details object, passed through unchanged.
    details: error.details,
  });
}

export type WebhookRateLimitMiddlewareOptions = {
  /** Resolved settings. Defaults to reading the environment. */
  settings?: ResolvedWebhookRateLimit;
  /** The rate limit key. Defaults to the route constant. */
  key?: string;
  /** The store. Defaults to a fresh single-process memory store. */
  store?: RateLimitStore;
  /** Injected clock, in ms. Defaults to `Date.now`. */
  now?: () => number;
};

/**
 * Builds the limiter middleware.
 *
 * It does NOT read or alter the request body, so it can be mounted ahead of
 * `express.raw()` without breaking the raw buffer the HMAC verification needs,
 * and it does no signature, provider or database work — it only counts.
 */
export function createWebhookRateLimitMiddleware(
  options: WebhookRateLimitMiddlewareOptions = {}
) {
  const settings = options.settings ?? resolveWebhookRateLimit();
  const key = options.key ?? WEBHOOK_RATE_LIMIT_KEY;
  const store = options.store ?? createMemoryStore();
  const now = options.now ?? (() => Date.now());
  const limiter = createRateLimiter({ store, throwOnLimitExceeded: true });

  for (const rejection of settings.rejected) {
    console.warn(
      `[rate-limit] ${rejection.name}=${JSON.stringify(rejection.value)} is invalid (${rejection.reason}); ` +
        `clamped to the safe default ${rejection.usedInstead} rather than disabling the limiter.`
    );
  }

  return async function webhookRateLimitMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await limiter.checkOrThrow({
        key,
        limit: settings.limit,
        windowMs: settings.windowMs,
        now: now(),
      });
      next();
    } catch (error: unknown) {
      if (isRateLimited(error)) {
        refuse(res, error);
        return;
      }
      // The limiter could not count. Fail closed: refuse rather than allow.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[rate-limit] limiter failure on ${key}: ${message}`);
      res.status(503).json({
        error: RATE_LIMIT_UNAVAILABLE_MESSAGE,
        code: RATE_LIMIT_UNAVAILABLE_CODE,
      });
    }
  };
}

/**
 * The process-wide store for the webhook limiter. Exported so a host that
 * mounts more than one limited route can share (or deliberately separate) the
 * counters, and so a test can drive the same bucket the HTTP route uses.
 */
export const webhookRateLimitStore: RateLimitStore = createMemoryStore();

/** The settings this process resolved at import time. */
export const webhookRateLimitSettings: ResolvedWebhookRateLimit = resolveWebhookRateLimit();

/**
 * The limiter mounted on `POST /payment/webhook`, and on no other route.
 *
 * SINGLE-PROCESS ONLY: `webhookRateLimitStore` is the module's in-memory
 * adapter (`modules/rate-limit/MODULE.md`, §Known limitation), so the counter
 * lives in this process's `Map`. Two instances of this server share no counter.
 */
export const webhookRateLimitMiddleware = createWebhookRateLimitMiddleware({
  settings: webhookRateLimitSettings,
  store: webhookRateLimitStore,
});
