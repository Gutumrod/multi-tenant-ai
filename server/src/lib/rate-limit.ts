/**
 * Host-side wiring for the vendored `rate-limit` module (H7-FU-RATELIMIT,
 * re-keyed by MT01-PRESALE-P3A for review finding LOW-2).
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
 * WHAT THIS FILE DID BEFORE, AND WHY IT CHANGED
 * ---------------------------------------------------------------------------
 * The previous revision limited `POST /payment/webhook` under ONE constant key
 * for the whole route (`WEBHOOK_RATE_LIMIT_KEY`) and charged that bucket with
 * EVERY request, before anything had been verified. The independent review of
 * the merged revision recorded what that costs, as finding LOW-2:
 *
 *   > key เป็นค่าคงที่ต่อ route → ผู้โจมตีที่ไม่ต้อง auth ยิง ≥60 req/นาที ทำให้
 *   > Stripe ของจริงโดน 429 ต่อเนื่องได้ (DoS ของ webhook) … ถ้า flood ยาวกว่า
 *   > ช่วง retry ของ Stripe (~3 วัน) หรือ endpoint ถูกปิดจากความล้มเหลวสะสม
 *   > เหตุการณ์จ่ายเงินหายได้
 *
 * In other words: an outsider with no credentials could send 60 junk requests a
 * minute, fill the single bucket, and a REAL Stripe delivery would then be
 * refused 429 — repeatedly, for as long as the flood lasted. "A refusal only
 * delays delivery" is true for a short flood, not for one that outlives
 * Stripe's retry schedule. That is a denial of service on the payment webhook,
 * and it is what this file now removes.
 *
 * ---------------------------------------------------------------------------
 * THE ORDER, AND WHY IT IS THIS ORDER
 * ---------------------------------------------------------------------------
 * The middleware is mounted ahead of `express.raw()` and the handler (see
 * `server/src/app.ts`), and it works in three steps:
 *
 *   1. BACKSTOP — one coarse, generous fixed-window bucket under the constant
 *      route key `WEBHOOK_RATE_LIMIT_KEY`, charged with EVERY request. This is
 *      what keeps total work bounded, because step 2 costs an HMAC.
 *   2. VERIFY — the same real Stripe signature verification the handler would
 *      perform, against the same secret (`STRIPE_WEBHOOK_SECRET`), on the same
 *      raw body. The verdict is one of: valid / invalid / unavailable.
 *   3. PER-SOURCE — charged ONLY with the requests whose signature was INVALID,
 *      under a key derived from the request's source address.
 *
 * A request whose signature is VALID is therefore never charged to any bucket
 * except the backstop, and can never be refused because of an attacker's
 * flood: the attacker can only fill buckets the attacker's own requests are
 * charged to. That is the property the Owner's acceptance test states, and it
 * holds by construction rather than by luck:
 *
 *   ยิง flood ลายเซ็นผิด แล้ว webhook ลายเซ็นถูกยังผ่าน
 *
 * ---------------------------------------------------------------------------
 * THE PER-SOURCE KEY, AND THE LIMITS OF IT
 * ---------------------------------------------------------------------------
 * The key is `source:<address>`, where `<address>` is
 * `req.socket.remoteAddress` — the address the TCP connection really came from.
 * Two reasons for that, and one honest shortfall:
 *
 *   * It is not caller-controlled. No header changes it. `X-Forwarded-For` is
 *     ignored, deliberately: this server sets no `trust proxy`, so a header
 *     would be an attacker-controlled input, and keying on one would let a
 *     single attacker mint unlimited buckets.
 *   * It is per-caller. One source's wrong-signature flood fills that source's
 *     bucket and no other source's, so a second source — including Stripe —
 *     starts from its own full allowance.
 *
 * The shortfall: behind a reverse proxy or a load balancer, every request
 * arrives from the SAME address (the proxy's), so all callers share one source
 * bucket. The limit then degrades to the old behaviour — one flood can exhaust
 * it for everybody — without the old behaviour's other defect, because a
 * correctly-signed delivery is still never counted into it. This is a real
 * residual, it is the reason an edge/proxy limit remains the answer in a
 * multi-instance deployment, and it is why an operator fronted by a proxy is
 * told to keep the limit generous or to do this at the proxy.
 *
 * The address is a socket fact, never a parsed header, so no request can choose
 * its own bucket key.
 *
 * ---------------------------------------------------------------------------
 * THE BACKSTOP, AND THE RESIDUAL IT CANNOT COVER
 * ---------------------------------------------------------------------------
 * Step 2 costs HMAC work, and step 2 runs BEFORE the tight per-source limit, so
 * a flood now costs HMAC work that the previous ordering avoided. That is the
 * deliberate trade: bounded real work in exchange for never refusing a real
 * delivery. The backstop is what bounds it — a fixed-window bucket charged with
 * every request that reaches the route, whatever its signature.
 *
 * It must be materially larger than the per-source limit or it would simply
 * become the old route-wide limit again (it would refuse a legitimate Stripe
 * burst at the same point). Its default is
 * `WEBHOOK_RATE_LIMIT_DEFAULT_BACKSTOP_MAX` = 1000 requests per window, i.e.
 * ~16.7 requests/second over the default 60 s window: far above any plausible
 * legitimate delivery rate for one endpoint, and cheap to serve — 1000 HMACs
 * per minute is negligible work for one process.
 *
 * THE RESIDUAL, stated plainly: a flood large enough to exhaust the backstop
 * (more than 1000 requests in one window, by default) IS refused, and while it
 * lasts, a real delivery arriving in that window would be refused too. The
 * redesign narrows that to "the endpoint is saturated", from the previous
 * "60 junk requests a minute are enough", but it does not remove it, and it
 * cannot: a per-process counter cannot tell a saturated endpoint from a
 * legitimate burst without knowing who is calling, and the caller is only known
 * after the verification the backstop exists to bound. Two further limits are
 * inherent and also stated:
 *
 *   * the counter is THIS PROCESS's memory only (`webhookRateLimitStore`), so
 *     N instances multiply every limit by N;
 *   * the whole mechanism is a backstop for the process, not a quota for the
 *     caller.
 *
 * An edge/reverse-proxy/WAF limit is still the real answer for a deployment
 * that must survive a determined flood, exactly as `docs/CURRENT_STATUS.md`
 * and `docs/house-swarm-7/WU5-DEPLOY.md` already say. This file does not
 * pretend otherwise, in code or in this comment.
 *
 * ---------------------------------------------------------------------------
 * WHEN THE SECRET IS ABSENT: NOT COUNTED, AND WHY
 * ---------------------------------------------------------------------------
 * Step 2 needs `STRIPE_WEBHOOK_SECRET`. When it is unset, no signature can be
 * judged — and this endpoint already refuses EVERY request with 503 (the
 * handler's own gate, asserted by the suite), so there is no real delivery to
 * protect and nothing a per-source counter could usefully separate. The
 * middleware therefore keeps the backstop armed (work stays bounded) and
 * charges no per-source bucket, letting the handler answer its documented 503
 * unchanged. A wrong count is not better than no count.
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
 * and a positive window, so both the per-source limiter and the backstop are
 * always armed; the replacement is logged; and `resolveWebhookRateLimit`
 * reports what it rejected.
 *
 * If the limiter itself fails for any other reason (the store throws), the
 * middleware FAILS CLOSED: the request is refused with 503
 * `RATE_LIMIT_UNAVAILABLE` rather than passed through unlimited. A limiter that
 * cannot count must not become a limiter that allows everything silently.
 *
 * ---------------------------------------------------------------------------
 * ENVIRONMENT VARIABLES READ HERE
 * ---------------------------------------------------------------------------
 *   WEBHOOK_RATE_LIMIT_MAX                 per-source wrong-signature limit
 *                                          per window; default 60
 *   WEBHOOK_RATE_LIMIT_WINDOW_MS           window length in ms; default 60000
 *   WEBHOOK_RATE_LIMIT_BACKSTOP_MAX        every-request backstop limit per
 *                                          window; default 1000
 *   STRIPE_WEBHOOK_SECRET                  the secret step 2 verifies against
 *
 * All three are clamped rather than trusted; a rejected value is replaced by
 * the named default and logged. The first two are documented in
 * `server/.env.example` and in the deployment manual. The third is NOT yet
 * listed there: documenting it belongs to deployment lane P3b, and
 * `deploy-preflight` compares the example against the code, so that check is
 * expected to be red for this variable until P3b lands. Reported, not hidden.
 */
import type { NextFunction, Request, Response } from 'express';
import {
  RateLimitError,
  createMemoryStore,
  createRateLimiter,
} from '../../../modules/rate-limit/index.js';
import type { RateLimitStore } from '../../../modules/rate-limit/index.js';
import { StripeWebhookVerifier } from '../../../modules/webhook-receiver/providers/stripe/index.js';

/** Environment variable holding the per-source request ceiling for one window. */
export const WEBHOOK_RATE_LIMIT_MAX_ENV = 'WEBHOOK_RATE_LIMIT_MAX';

/** Environment variable holding the window length, in MILLISECONDS. */
export const WEBHOOK_RATE_LIMIT_WINDOW_MS_ENV = 'WEBHOOK_RATE_LIMIT_WINDOW_MS';

/** Environment variable holding the every-request backstop ceiling per window. */
export const WEBHOOK_RATE_LIMIT_BACKSTOP_MAX_ENV = 'WEBHOOK_RATE_LIMIT_BACKSTOP_MAX';

/**
 * Safe defaults, applied when the variable is absent AND when it is rejected.
 * 60 requests per 60 s (one per second on average) is generous for the requests
 * ONE SOURCE sends with a WRONG signature — the bucket a forged flood fills —
 * while still bounding it.
 */
export const WEBHOOK_RATE_LIMIT_DEFAULT_MAX = 60;
export const WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS = 60_000;

/**
 * Safe default for the coarse backstop, in requests per window. 1000 per 60 s
 * (≈16.7 req/s) is a bound on the endpoint's total work, not a rate any
 * legitimate Stripe destination is expected to approach; it is deliberately an
 * order of magnitude above the per-source default so that it cannot collapse
 * back into a route-wide limit.
 */
export const WEBHOOK_RATE_LIMIT_DEFAULT_BACKSTOP_MAX = 1_000;

/**
 * The constant route key, now the BACKSTOP's key: it is charged with every
 * request that reaches the route, and is the only bucket an attacker can fill
 * that is also used by correctly-signed deliveries.
 */
export const WEBHOOK_RATE_LIMIT_KEY = 'route:POST /payment/webhook';

/** Prefix of the per-source keys. Exported so a test can assert the shape. */
export const WEBHOOK_RATE_LIMIT_SOURCE_KEY_PREFIX = 'source:';

/** The source key used when the socket reports no address at all. */
export const WEBHOOK_RATE_LIMIT_UNKNOWN_SOURCE = 'unknown';

/** The per-source bucket key for one observed source address. */
export function webhookSourceKey(source: string): string {
  return `${WEBHOOK_RATE_LIMIT_SOURCE_KEY_PREFIX}${source}`;
}

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
  /** Requests allowed per window PER SOURCE, counting only wrong signatures. */
  limit: number;
  /** Window length in milliseconds. Always a positive number. */
  windowMs: number;
  /** Requests allowed per window across the route, counting every request. */
  backstopLimit: number;
  /** Values that were rejected and clamped. Empty when the environment was clean. */
  rejected: WebhookRateLimitRejection[];
};

/**
 * Reads one environment variable as a positive integer.
 *
 * An ABSENT (or empty) variable is not a misconfiguration: it selects the
 * documented default silently. A PRESENT but invalid value (zero, negative,
 * non-numeric, fractional) is a misconfiguration: it is recorded in `rejected`
 * and clamped so that every limiter is always armed with a positive limit.
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
 * Resolves the three settings from the environment. Pure and side-effect free,
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
  const backstopLimit = readPositiveInteger(
    env[WEBHOOK_RATE_LIMIT_BACKSTOP_MAX_ENV],
    WEBHOOK_RATE_LIMIT_BACKSTOP_MAX_ENV,
    WEBHOOK_RATE_LIMIT_DEFAULT_BACKSTOP_MAX,
    rejected
  );
  return { limit, windowMs, backstopLimit, rejected };
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

/**
 * The `stripe-signature` header as the verifier wants it: one string.
 *
 * Only that one header is consulted, and it is single-valued on real Stripe
 * deliveries. A repeated header is joined exactly as the webhook receiver's own
 * header normalisation joins it, so the two agree on the input they verify.
 */
function signatureHeaderValue(req: Request): string | undefined {
  const value = req.headers['stripe-signature'];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return undefined;
}

/** The raw request body, byte-for-byte, as the verifier needs it. */
function rawBodyOf(req: Request): string {
  return Buffer.isBuffer(req.body)
    ? req.body.toString('utf-8')
    : typeof req.body === 'string'
      ? req.body
      : '';
}

/** `valid` — a real, correctly-signed delivery. `invalid` — a forged/absent one. */
type SignatureVerdict = 'valid' | 'invalid' | 'unavailable';

export type WebhookRateLimitMiddlewareOptions = {
  /** Resolved settings. Defaults to reading the environment. */
  settings?: ResolvedWebhookRateLimit;
  /** The store. Defaults to a fresh single-process memory store. */
  store?: RateLimitStore;
  /** Injected clock, in ms. Defaults to `Date.now`. */
  now?: () => number;
  /**
   * The webhook secret to verify against. Defaults to reading
   * `STRIPE_WEBHOOK_SECRET` on every request, so a deployment can rotate it.
   */
  secret?: () => string | undefined;
  /**
   * Injected source resolver, for a test that must drive two sources without
   * two listeners. Defaults to the socket's peer address — the production path.
   */
  source?: (req: Request) => string | undefined;
};

/**
 * Builds the limiter middleware.
 *
 * It does NOT read or alter the request body, so it can run after
 * `express.raw()` without breaking the raw buffer the HMAC verification needs.
 * It performs the signature verification itself (step 2) rather than leaving it
 * to the handler, because the counting rule depends on its verdict; the handler
 * then repeats it, on the same body and the same secret, which is why the
 * verdict here and the answer there cannot disagree.
 */
export function createWebhookRateLimitMiddleware(
  options: WebhookRateLimitMiddlewareOptions = {}
) {
  const settings = options.settings ?? resolveWebhookRateLimit();
  const store = options.store ?? createMemoryStore();
  const now = options.now ?? (() => Date.now());
  const readSecret = options.secret ?? (() => process.env.STRIPE_WEBHOOK_SECRET);
  const readSource =
    options.source ?? ((req: Request) => req.socket?.remoteAddress ?? undefined);
  const limiter = createRateLimiter({ store, throwOnLimitExceeded: true });

  // One verifier per secret value, so the HMAC key is imported once per secret
  // rather than once per request. Keyed by the secret itself, so a rotated
  // secret gets a new verifier instead of a stale one.
  const verifiers = new Map<string, StripeWebhookVerifier>();
  const verifierFor = (secret: string): StripeWebhookVerifier => {
    const existing = verifiers.get(secret);
    if (existing) {
      return existing;
    }
    const created = new StripeWebhookVerifier({ secret });
    verifiers.set(secret, created);
    return created;
  };

  for (const rejection of settings.rejected) {
    console.warn(
      `[rate-limit] ${rejection.name}=${JSON.stringify(rejection.value)} is invalid (${rejection.reason}); ` +
        `clamped to the safe default ${rejection.usedInstead} rather than disabling the limiter.`
    );
  }

  /**
   * Step 2. `unavailable` means no secret is configured, which is a
   * configuration state rather than a verdict about this request: see the file
   * header. An error thrown by the verifier is also `unavailable` — it must not
   * be mistaken for a forged signature, which would spend a real caller's
   * allowance on our own fault.
   */
  async function classifySignature(req: Request): Promise<SignatureVerdict> {
    const secret = readSecret();
    if (!secret) {
      return 'unavailable';
    }
    try {
      const result = await verifierFor(secret).verify({
        rawBody: rawBodyOf(req),
        headers: headersForVerifier(req),
      });
      return result.valid ? 'valid' : 'invalid';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[rate-limit] signature verification failed to run: ${message}`);
      return 'unavailable';
    }
  }

  return async function webhookRateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Step 1 — the coarse backstop, charged with every request, so the HMAC
      // work below is bounded even when every request is forged.
      await limiter.checkOrThrow({
        key: WEBHOOK_RATE_LIMIT_KEY,
        limit: settings.backstopLimit,
        windowMs: settings.windowMs,
        now: now(),
      });

      // Step 2 — verify, so that what follows can tell a real delivery from a
      // forged one.
      const verdict = await classifySignature(req);

      // A real delivery is never counted against any bucket an attacker fills.
      if (verdict === 'valid') {
        next();
        return;
      }

      // No secret configured: the handler refuses every request with its own
      // 503 gate, so there is nothing to separate. Leave the answer to it.
      if (verdict === 'unavailable') {
        next();
        return;
      }

      // Step 3 — the request's signature is wrong, so it is charged to the
      // bucket of the source it came from, and to no other bucket.
      const source = readSource(req) ?? WEBHOOK_RATE_LIMIT_UNKNOWN_SOURCE;
      await limiter.checkOrThrow({
        key: webhookSourceKey(source),
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
      console.error(`[rate-limit] limiter failure on ${WEBHOOK_RATE_LIMIT_KEY}: ${message}`);
      res.status(503).json({
        error: RATE_LIMIT_UNAVAILABLE_MESSAGE,
        code: RATE_LIMIT_UNAVAILABLE_CODE,
      });
    }
  };
}

/**
 * The headers the verifier is given. The verifier reads exactly one of them,
 * `stripe-signature`, and it is single-valued on real deliveries.
 */
function headersForVerifier(req: Request): Record<string, string> {
  const signature = signatureHeaderValue(req);
  return signature === undefined ? {} : { 'stripe-signature': signature };
}

/**
 * The process-wide store for the webhook limiter. Exported so a host that
 * mounts more than one limited route can share (or deliberately separate) the
 * counters, and so a test can drive the same buckets the HTTP route uses.
 */
export const webhookRateLimitStore: RateLimitStore = createMemoryStore();

/** The settings this process resolved at import time. */
export const webhookRateLimitSettings: ResolvedWebhookRateLimit = resolveWebhookRateLimit();

/**
 * The limiter mounted on `POST /payment/webhook`, and on no other route.
 *
 * SINGLE-PROCESS ONLY: `webhookRateLimitStore` is the module's in-memory
 * adapter (`modules/rate-limit/MODULE.md`, §Known limitation), so the counters
 * live in this process's `Map`. Two instances of this server share no counter.
 */
export const webhookRateLimitMiddleware = createWebhookRateLimitMiddleware({
  settings: webhookRateLimitSettings,
  store: webhookRateLimitStore,
});
