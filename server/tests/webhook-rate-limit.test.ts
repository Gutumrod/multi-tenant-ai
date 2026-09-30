import express from 'express';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitStore } from '../../modules/rate-limit/index.js';
import { createMemoryStore } from '../../modules/rate-limit/index.js';

/**
 * H7-FU-RATELIMIT / MT01-PRESALE-P3A — the rate limit on `POST /payment/webhook`.
 *
 * Every scenario below boots the REAL express app (`server/src/app.ts`) on an
 * ephemeral port and drives it with REAL `fetch` calls, so the limiter is
 * observed through express's real middleware chain in the real order rather
 * than by calling a middleware function with a hand-built request.
 *
 * ORDERING, WHICH THIS FILE'S SCENARIOS NOW ENCODE (P3A, review finding LOW-2).
 * The limiter no longer counts a request before it knows what the request is.
 * The production order is
 *
 *     express.raw()  ->  webhookRateLimitMiddleware  ->  paymentWebhookHandler
 *
 * and inside the limiter: a coarse route-level BACKSTOP runs first, counting
 * every request so that total work stays bounded; then the request's
 * `stripe-signature` is verified against the real webhook secret; and ONLY a
 * request whose signature FAILS is charged to that request's own per-source
 * bucket. A correctly-signed delivery is therefore never counted into a bucket
 * an attacker can fill, and can never be refused because of one. Those two
 * properties are what `webhook-forged-flood-does-not-refuse-a-signed-delivery`
 * observes over real HTTP, and `webhook-per-source-allowance-is-independent`
 * observes the third (one source's flood does not spend another's allowance).
 *
 * Hermetic by construction: `DATABASE_URL` is deleted before the first dynamic
 * import, so the process resolves the in-memory repositories and this suite
 * touches no database. `vi.resetModules()` before each import is what makes the
 * per-scenario environment a real observation — `server/src/lib/rate-limit.ts`
 * reads its two settings once, at module evaluation, so the module graph must be
 * re-evaluated after the environment changes rather than reused.
 *
 * On determinism, and what is NOT done here: the window-reset scenario
 * (`webhook-limit-window-resets`) uses the module's `now` parameter — an
 * injected clock — so it never sleeps and never depends on wall-clock timing.
 * Doing that through `createApp()` is not possible, because the app mounts a
 * limiter whose clock is `Date.now`; the scenario therefore composes the SAME
 * production middleware factory (`createWebhookRateLimitMiddleware`) with the
 * SAME production handler in the SAME production mount order as
 * `server/src/app.ts` (`express.raw`, then the limiter, then the handler) and
 * drives it over real HTTP. That is stated plainly rather than presented as a
 * `createApp()` observation.
 *
 * The ONE scenario that cannot use an injected clock is the acceptance
 * scenario, because it must drive the app that the app really mounts. It
 * handles the wall clock honestly instead of pretending it is absent: it waits
 * for a window boundary, opens a fresh window, and checks after its flood that
 * the window has not moved (a moved window is reported, never hidden). A
 * correctly-signed delivery is refused neither within a window nor across a
 * boundary, because it is never counted at all.
 */

/** The key prefix the per-source buckets use. Asserted, so a rename is caught. */
const SOURCE_KEY_PREFIX = 'source:';

/** The IPv4 loopback literal, so a per-source key can be asserted exactly. */
const SOURCE_IPV4 = '127.0.0.1';
/** The IPv6 loopback literal: a SECOND, genuinely distinct source address. */
const SOURCE_IPV6 = '::1';

/** A signature that is well-formed and wrong: the shape an attacker can forge. */
function forgedSignature(body: string, timestamp: number): string {
  const sig = crypto
    .createHmac('sha256', `${SIGNATURE_SECRET}-not-the-real-secret`)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

const SIGNATURE_SECRET = 'whsec_h7_fu_rate_limit_test_secret';
const STRIPE_SECRET_PLACEHOLDER = 'sk_test_fake_placeholder';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

/** Environment keys this suite rewrites; restored after every scenario. */
const MANAGED_KEYS = [
  'DEMO_AUTH',
  'NODE_ENV',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'WEBHOOK_RATE_LIMIT_MAX',
  'WEBHOOK_RATE_LIMIT_WINDOW_MS',
  'WEBHOOK_RATE_LIMIT_BACKSTOP_MAX',
];
const savedEnv = new Map<string, string | undefined>();
for (const key of MANAGED_KEYS) savedEnv.set(key, process.env[key]);

// Cleared before the first dynamic import so no scenario can pick up a database.
delete process.env.DATABASE_URL;

type Booted = { server: Server; baseUrl: string; app: express.Express };

let booted: Booted | null = null;

function applyEnv(env: Record<string, string | undefined>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
}

/** Boots the real app under `env` on an ephemeral port. */
async function bootApp(env: Record<string, string | undefined>): Promise<Booted> {
  applyEnv(env);
  vi.resetModules();

  const { createApp } = await import('../src/app.js');
  const app = createApp();

  const server = await new Promise<Server>((resolve) => {
    // Bound to the IPv4 loopback ADDRESS rather than to every interface: the
    // suite must not listen on anything but loopback. It also makes the source
    // address the middleware sees a literal (`127.0.0.1`) instead of the
    // IPv4-mapped form (`::ffff:127.0.0.1`) a dual-stack `::` socket reports,
    // so `bindSecondSource` below can assert the two source keys exactly.
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, app };
}

/**
 * Additional listeners this test has bound, beyond `booted.server`. They are
 * tracked separately so `shutdown` can close every one of them: a listener left
 * bound would keep a port open after the suite.
 */
const extraListeners: Server[] = [];

/**
 * Makes the SAME express app reachable at a SECOND source address: the very
 * same port, bound on `::1` (IPv6 loopback) in addition to the `127.0.0.1`
 * (IPv4 loopback) listener `bootApp` created.
 *
 * Why this is the second source, and why it is a real one. The whole point of a
 * per-source rule is that two callers are counted separately, and a test that
 * merely hands a different key to a factory has not shown that. Two loopback
 * ADDRESSES are genuinely distinct TCP sources: the kernel reports
 * `req.socket.remoteAddress` as `127.0.0.1` for the first and `::1` for the
 * second, so a limiter keyed on the socket address produces two independent
 * buckets from two real network paths into ONE app instance. The app instance is
 * shared deliberately — that is the harder case, because the flood and the later
 * traffic meet in one process's memory, which is exactly the case the old
 * constant key failed.
 */
async function bindSecondSource(target: Booted): Promise<string> {
  const { port } = new URL(target.baseUrl);
  const second = await new Promise<Server>((resolve, reject) => {
    const listener = target.app.listen(Number(port), '::1', () => resolve(listener));
    listener.on('error', reject);
  });
  extraListeners.push(second);
  // The `::1` listener is bound and listening before the returned URL is used;
  // the callback above is the `listening` event, so the first request cannot
  // race the bind.
  if (!second.listening) {
    throw new Error('the second-source listener did not reach the listening state');
  }
  return `http://[::1]:${port}`;
}

async function shutdown(target: Booted | null): Promise<void> {
  const listeners = [...extraListeners.splice(0, extraListeners.length)];
  if (target) listeners.push(target.server);
  for (const listener of listeners) {
    await new Promise<void>((resolve, reject) => {
      listener.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

afterEach(async () => {
  await shutdown(booted);
  booted = null;
  vi.restoreAllMocks();
  for (const key of MANAGED_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

let eventSeq = 0;

/** A Stripe-shaped event body. The event id is unique per call. */
function makeEvent(type = 'invoice.paid'): string {
  eventSeq += 1;
  return JSON.stringify({
    id: `evt_h7fulimit_${Date.now()}_${eventSeq}`,
    type,
    data: {
      object: {
        id: `pi_h7fulimit_${eventSeq}`,
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
      },
    },
  });
}

/** The exact `stripe-signature` header the real verifier accepts. */
function stripeSignature(body: string, timestamp: number): string {
  const sig = crypto
    .createHmac('sha256', SIGNATURE_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

type ObservedResponse = {
  status: number;
  retryAfter: string | null;
  body: unknown;
};

/**
 * One real HTTP POST to `/payment/webhook`.
 *
 * `signature` is passed through verbatim when supplied, which is how the flood
 * scenarios send a WRONG signature; `signed` computes a correct one.
 */
async function postWebhook(
  baseUrl: string,
  options: { signed?: boolean; signature?: string; body?: string } = {}
): Promise<ObservedResponse> {
  const body = options.body ?? makeEvent();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.signature !== undefined) {
    headers['stripe-signature'] = options.signature;
  } else if (options.signed) {
    headers['stripe-signature'] = stripeSignature(body, Math.floor(Date.now() / 1000));
  }
  const response = await fetch(`${baseUrl}/payment/webhook`, { method: 'POST', headers, body });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep the raw text so a non-JSON body is reported rather than hidden */
  }
  return {
    status: response.status,
    retryAfter: response.headers.get('retry-after'),
    body: parsed,
  };
}

/** The module's own `details.key` on a refusal, or null when there is none. */
function refusalKey(body: unknown): string | null {
  const details = (body as { details?: { key?: unknown } } | null)?.details;
  return details && typeof details.key === 'string' ? details.key : null;
}

/**
 * Waits until the current rate-limit window has at least `needMs` left in it, so
 * a burst of requests fits inside ONE window instead of straddling a boundary.
 * If the room is already there it returns immediately.
 *
 * The production limiter's clock is `Date.now` and this scenario deliberately
 * drives the production app rather than a hand-composed one, so the window
 * cannot be injected away. Making room first is what makes the counting
 * deterministic without pretending the clock is absent; the window index is
 * compared again after the burst, so a window that still moved is reported by an
 * assertion rather than hidden. At most one wait is ever taken, and it is always
 * a positive one, so this cannot spin.
 */
async function ensureWindowRoom(windowMs: number, needMs: number): Promise<number> {
  const sinceBoundary = Date.now() % windowMs;
  const remaining = windowMs - sinceBoundary;
  if (remaining < needMs) {
    await new Promise((resolve) => setTimeout(resolve, remaining + 5));
  }
  return Math.floor(Date.now() / windowMs);
}

/** How much of a window must be left before a burst may start in it. */
const MIN_WINDOW_REMAINING_MS = 5_000;

/**
 * Aligns to the START of the current fixed window and returns it, so that a
 * burst launched straight afterwards cannot straddle a window rollover.
 *
 * WHY THE ALIGNMENT EXISTS. `modules/rate-limit/adapters/memory-store.ts` gives
 * each bucket the window `Math.floor(now / windowMs) * windowMs`. The window is
 * therefore NOT a rolling timer that starts with the first request: it is a
 * multiple of `windowMs` on the wall clock, so it rolls over whenever the clock
 * crosses that multiple — including in the middle of the burst below. A
 * rollover resets the counter, and the scenario this helper serves would then
 * fail for the wrong reason: `expect(elapsedMs).toBeLessThan(WINDOW_MS)` would
 * fail because the window MOVED, which is a different failure from the one that
 * scenario is about (the backstop failing to bound total work). Aligning first
 * takes the rollover out of the burst's path.
 *
 * HOW. If less than `MIN_WINDOW_REMAINING_MS` of the current window is left,
 * the tail is waited out with one `setTimeout` and the window is recomputed;
 * otherwise it returns immediately. The wait is bounded by
 * `MIN_WINDOW_REMAINING_MS`, so it is never a whole window and the scenario
 * stays fast. The caller measures its elapsed time against the returned start.
 */
async function alignToWindowBoundary(windowMs: number): Promise<number> {
  let windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const remainingMs = windowStart + windowMs - Date.now();
  if (remainingMs < MIN_WINDOW_REMAINING_MS) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs + 5));
    windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  }
  return windowStart;
}

/** The environment a scenario needs for the handler to run past its 503 gates. */
const CONFIGURED: Record<string, string> = {
  STRIPE_SECRET_KEY: STRIPE_SECRET_PLACEHOLDER,
  STRIPE_WEBHOOK_SECRET: SIGNATURE_SECRET,
};

// ---------------------------------------------------------------------------
// REQUIRED: webhook-allows-up-to-the-limit
// ---------------------------------------------------------------------------
describe('webhook rate limit — allowed requests', () => {
  it('webhook-allows-up-to-the-limit', async () => {
    booted = await bootApp({ ...CONFIGURED, WEBHOOK_RATE_LIMIT_MAX: '3' });

    const observed: ObservedResponse[] = [];
    for (let i = 0; i < 3; i += 1) {
      observed.push(await postWebhook(booted.baseUrl, { signed: true }));
    }

    const statuses = observed.map((r) => r.status);
    // The handler's own answer (200 for a verified event) is what an allowed
    // request gets; the point of this check is that none of the three was a 429.
    expect(statuses).toEqual([200, 200, 200]);
    expect(statuses).not.toContain(429);
    expect(observed.every((r) => r.retryAfter === null)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // REQUIRED: webhook-refuses-over-the-limit-with-429-rate-limited
  // -------------------------------------------------------------------------
  it('webhook-refuses-over-the-limit-with-429-rate-limited', async () => {
    // The bucket under test is the PER-SOURCE one, so every request here must
    // be charged to it: they all carry a FORGED signature. (Under the new rule a
    // correctly-signed request is charged to no per-source bucket at all, so a
    // signed flood could never demonstrate this refusal.)
    booted = await bootApp({ ...CONFIGURED, WEBHOOK_RATE_LIMIT_MAX: '2' });

    const body1 = makeEvent();
    const body2 = makeEvent();
    const body3 = makeEvent();
    const nowSeconds = Math.floor(Date.now() / 1000);

    const first = await postWebhook(booted.baseUrl, {
      body: body1,
      signature: forgedSignature(body1, nowSeconds),
    });
    const second = await postWebhook(booted.baseUrl, {
      body: body2,
      signature: forgedSignature(body2, nowSeconds),
    });
    const third = await postWebhook(booted.baseUrl, {
      body: body3,
      signature: forgedSignature(body3, nowSeconds),
    });

    // The two inside the limit reach the handler, which answers 401 for the
    // forged signature; the point of this check is that neither was a 429.
    expect([first.status, second.status]).toEqual([401, 401]);
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({
      code: 'RATE_LIMITED',
      limit: 2,
      windowMs: 60_000,
      remaining: 0,
    });
    expect((third.body as { retryAfterMs: number }).retryAfterMs).toBeGreaterThan(0);
    // The refusal names the bucket that was exhausted: this source's.
    expect(refusalKey(third.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);
  });

  // -------------------------------------------------------------------------
  // REQUIRED: webhook-refusal-carries-retry-after-header
  // -------------------------------------------------------------------------
  it('webhook-refusal-carries-retry-after-header', async () => {
    booted = await bootApp({
      ...CONFIGURED,
      WEBHOOK_RATE_LIMIT_MAX: '1',
      WEBHOOK_RATE_LIMIT_WINDOW_MS: '2000',
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    // Two FORGED requests from one source: the first spends the source's single
    // unit, the second is the refusal whose contract this scenario asserts.
    const firstBody = makeEvent();
    const first = await postWebhook(booted.baseUrl, {
      body: firstBody,
      signature: forgedSignature(firstBody, nowSeconds),
    });
    expect(first.status).toBe(401);

    const secondBody = makeEvent();
    const refused = await postWebhook(booted.baseUrl, {
      body: secondBody,
      signature: forgedSignature(secondBody, nowSeconds),
    });

    expect(refused.status).toBe(429);

    // The header is present and numeric.
    expect(refused.retryAfter).not.toBeNull();
    expect(refused.retryAfter).toMatch(/^\d+$/);
    const headerSeconds = Number(refused.retryAfter);
    expect(Number.isInteger(headerSeconds)).toBe(true);
    // Never less than one second: a refusal must not invite an immediate retry.
    expect(headerSeconds).toBeGreaterThanOrEqual(1);

    const body = refused.body as {
      retryAfterMs: number;
      resetAt: number;
      limit: number;
      windowMs: number;
      remaining: number;
      details: Record<string, unknown>;
    };
    // The header is derived from the module's retryAfterMs, so the two agree.
    expect(headerSeconds).toBe(Math.max(1, Math.ceil(body.retryAfterMs / 1000)));
    // Both the response body and the module's own details carry the contract.
    expect(body.limit).toBe(1);
    expect(body.windowMs).toBe(2000);
    expect(body.remaining).toBe(0);
    expect(body.resetAt).toBeGreaterThan(0);
    expect(body.retryAfterMs).toBeGreaterThan(0);
    expect(body.details).toMatchObject({
      // REWORDED (P3A). Old form, which asserted the route-wide constant:
      //     details: { key: 'route:POST /payment/webhook', limit: 1, … }
      // New form: the exhausted bucket is the SOURCE's, because that is the
      // bucket a forged flood fills; the constant route key is now the
      // backstop's, and it is not what this refusal reports.
      key: `${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`,
      limit: 1,
      windowMs: 2000,
      remaining: 0,
      resetAt: body.resetAt,
      retryAfterMs: body.retryAfterMs,
    });
  });

  // -------------------------------------------------------------------------
  // REWORDED for P3A:
  //   old name: webhook-refusal-happens-before-signature-verification
  //   new name: webhook-refusal-is-per-source-and-only-for-wrong-signatures
  //
  // The old scenario asserted the ORDER the review found defective — that the
  // refusal happened BEFORE signature verification, so an UNSIGNED flood could
  // exhaust one route-wide bucket. The new rule inverts that, so the assertion
  // had to change with it. This scenario asserts the same observable contract
  // from the other side: every request's answer (401, 200, 429) and the bucket
  // each was charged to.
  // -------------------------------------------------------------------------
  it('webhook-refusal-is-per-source-and-only-for-wrong-signatures', async () => {
    // Three requests walk ONE bucket — the 429 is only reachable when that
    // bucket is exhausted — and the bucket is this source's wrong-signature
    // bucket:
    //
    //   request 1 — WRONG signature, within the limit -> 401 (and is counted)
    //   request 2 — VALID signature, within the limit -> 200 (and is NOT counted)
    //   request 3 — WRONG signature, OVER the limit   -> 429 RATE_LIMITED
    //
    // Request 3 carries a request-1-shaped forged signature. If the limiter
    // counted every request, or counted the correctly-signed one, request 3
    // would answer 401/200 instead of 429. It answers 429, which is only
    // reachable when the forged requests were counted and the good one was not.
    booted = await bootApp({ ...CONFIGURED, WEBHOOK_RATE_LIMIT_MAX: '2' });

    const nowSeconds = Math.floor(Date.now() / 1000);

    const forgedBody1 = makeEvent();
    const forgedWithinLimit = await postWebhook(booted.baseUrl, {
      body: forgedBody1,
      signature: forgedSignature(forgedBody1, nowSeconds),
    });
    expect(forgedWithinLimit.status).toBe(401);

    const signedWithinLimit = await postWebhook(booted.baseUrl, { signed: true });
    expect(signedWithinLimit.status).toBe(200);

    // A valid signature between the two forgeries, and one more forgery to
    // spend the second and last unit of the source's allowance. If the signed
    // request (or either refused one) had been charged, this next forgery would
    // already be over the limit.
    const forgedBody2 = makeEvent();
    const forgedAtTheLimit = await postWebhook(booted.baseUrl, {
      body: forgedBody2,
      signature: forgedSignature(forgedBody2, nowSeconds),
    });
    expect(forgedAtTheLimit.status).toBe(401);

    const forgedBody3 = makeEvent();
    const forgedOverLimit = await postWebhook(booted.baseUrl, {
      body: forgedBody3,
      signature: forgedSignature(forgedBody3, nowSeconds),
    });
    expect(forgedOverLimit.status).toBe(429);
    expect(forgedOverLimit.body).toMatchObject({ code: 'RATE_LIMITED', limit: 2 });
    expect(refusalKey(forgedOverLimit.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);
  });
});

// ---------------------------------------------------------------------------
// REQUIRED: webhook-limit-window-resets
//
// Deterministic: the module's `now` parameter is supplied by an injected clock,
// so there is no sleep and no dependence on wall-clock timing.
// ---------------------------------------------------------------------------
describe('webhook rate limit — window reset (injected clock)', () => {
  it('webhook-limit-window-resets', async () => {
    vi.resetModules();
    applyEnv({ ...CONFIGURED });

    const { createWebhookRateLimitMiddleware } = await import('../src/lib/rate-limit.js');
    const { paymentWebhookHandler } = await import('../src/routes/payment-demo.js');

    const WINDOW_MS = 1000;
    const LIMIT = 2;
    // A fixed, window-aligned base so every request lands where the test says.
    const base = 1_700_000_000_000;
    let clock = base;

    const store: RateLimitStore = createMemoryStore();
    const limiter = createWebhookRateLimitMiddleware({
      // A generous backstop, so this scenario measures the PER-SOURCE window and
      // not the backstop: the bucket this walks is the forged-signature bucket.
      settings: { limit: LIMIT, windowMs: WINDOW_MS, backstopLimit: 1000, rejected: [] },
      store,
      now: () => clock,
    });

    // The SAME production mount order as server/src/app.ts: raw body, limiter,
    // handler.
    const app = express();
    app.post('/payment/webhook', express.raw({ type: 'application/json' }), limiter, paymentWebhookHandler);

    const server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    booted = { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, app };

    // Every request below carries a FORGED signature, because only those are
    // charged to the per-source bucket whose window this scenario resets.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const forge = (): { body: string; signature: string } => {
      const body = makeEvent();
      return { body, signature: forgedSignature(body, nowSeconds) };
    };

    clock = base;
    const first = await postWebhook(booted.baseUrl, forge());
    clock = base + 100;
    const second = await postWebhook(booted.baseUrl, forge());
    clock = base + 200;
    const third = await postWebhook(booted.baseUrl, forge());

    expect([first.status, second.status]).toEqual([401, 401]);
    expect(third.status).toBe(429);

    // Advance the injected clock into the NEXT window. The counter resets, so
    // the full quota is available again — with no sleep anywhere in this test.
    clock = base + WINDOW_MS;
    const afterReset = await postWebhook(booted.baseUrl, forge());
    expect(afterReset.status).toBe(401);
    expect(afterReset.retryAfter).toBeNull();

    clock = base + WINDOW_MS + 100;
    const secondAfterReset = await postWebhook(booted.baseUrl, forge());
    clock = base + WINDOW_MS + 200;
    const overAgain = await postWebhook(booted.baseUrl, forge());

    expect(secondAfterReset.status).toBe(401);
    expect(overAgain.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// REQUIRED: webhook-bad-limit-config-never-silently-disables-limiting
// ---------------------------------------------------------------------------
describe('webhook rate limit — misconfiguration', () => {
  it('webhook-bad-limit-config-never-silently-disables-limiting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // Every one of these is refused by the module (`RateLimitConfigError` for
    // limit <= 0 / windowMs <= 0), so the Host must resolve it. It clamps to the
    // documented default and logs — the limiter stays ARMED.
    vi.resetModules();
    applyEnv({
      ...CONFIGURED,
      WEBHOOK_RATE_LIMIT_MAX: '0',
      WEBHOOK_RATE_LIMIT_WINDOW_MS: 'not-a-number',
    });
    const { resolveWebhookRateLimit, WEBHOOK_RATE_LIMIT_DEFAULT_MAX, WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS } =
      await import('../src/lib/rate-limit.js');

    const resolved = resolveWebhookRateLimit();
    expect(resolved.limit).toBe(WEBHOOK_RATE_LIMIT_DEFAULT_MAX);
    expect(resolved.windowMs).toBe(WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS);
    expect(resolved.limit).toBeGreaterThan(0);
    expect(resolved.windowMs).toBeGreaterThan(0);
    // Both rejected values are reported, so the substitution is not silent.
    expect(resolved.rejected.map((r) => r.name).sort()).toEqual([
      'WEBHOOK_RATE_LIMIT_MAX',
      'WEBHOOK_RATE_LIMIT_WINDOW_MS',
    ]);

    // -----------------------------------------------------------------------
    // The HTTP phase. Same bad values, same production machinery — but the
    // limiter's window clock is INJECTED and held FIXED for the whole burst.
    //
    // Why this is not the weaker thing it might look like: `resolved` above is
    // the settings the Host really resolved from THIS bad environment, and the
    // HTTP phase is armed with that object — not with numbers this test picked.
    // The burst is still the full default quota (60) in real HTTP requests and
    // the 61st is still required to be refused. What changes is only WHO owns
    // the window. Before, the wall clock did: the burst takes ~1 s against a
    // 60_000 ms window, so on a loaded machine the window rolled over mid-loop,
    // the counter reset, and the 61st request was answered 200. Now the window
    // cannot roll unless this test rolls it, so a failure here means the
    // limiter did not refuse — which is what the test is about.
    //
    // The clock is aligned to the window before use, so "one millisecond before
    // the window ends" and "at the window end" below mean exactly that, for
    // whatever the clamped window turns out to be.
    //
    // These imports re-use the module instance the clamp assertions above were
    // resolved from: no second `vi.resetModules()` here, so the factory below is
    // the same production code under the same environment as `resolved`.
    const { createWebhookRateLimitMiddleware } = await import('../src/lib/rate-limit.js');
    const { paymentWebhookHandler } = await import('../src/routes/payment-demo.js');

    const WINDOW_MS = resolved.windowMs;
    const base = Math.floor(1_700_000_000_000 / WINDOW_MS) * WINDOW_MS;
    let clock = base;

    const store: RateLimitStore = createMemoryStore();
    // Constructing the production factory with `resolved` is what emits one
    // warning per rejected variable; the store and the clock are the only things
    // this test supplies. The warnings raised by this construction are captured
    // separately, so the assertion below is about THIS limiter's settings.
    const warnsBefore = warn.mock.calls.length;
    const limiter = createWebhookRateLimitMiddleware({
      settings: resolved,
      store,
      now: () => clock,
    });
    const armingWarnings = warn.mock.calls
      .slice(warnsBefore)
      .map((call) => String(call[0]))
      .join('\n');

    // The SAME production mount order as server/src/app.ts: raw body, limiter,
    // handler.
    const app = express();
    app.post(
      '/payment/webhook',
      express.raw({ type: 'application/json' }),
      limiter,
      paymentWebhookHandler
    );

    const server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    booted = {
      server,
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      app,
    };

    // The burst. `clock` does not move, so every request below lands in the SAME
    // window and the counter cannot reset underneath the assertions. Every
    // request carries a FORGED signature, because the bucket being driven is the
    // per-source one — the bucket the clamped limit arms.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const forge = async (): Promise<number> => {
      const body = makeEvent();
      const observed = await postWebhook(booted!.baseUrl, {
        body,
        signature: forgedSignature(body, nowSeconds),
      });
      return observed.status;
    };

    clock = base;
    const accepted: number[] = [];
    for (let i = 0; i < resolved.limit; i += 1) {
      accepted.push(await forge());
    }
    const overTheLimit = await postWebhook(booted.baseUrl, (() => {
      const body = makeEvent();
      return { body, signature: forgedSignature(body, nowSeconds) };
    })());

    expect(accepted).toHaveLength(60);
    expect(accepted).not.toContain(429);
    expect(accepted.every((status) => status === 401)).toBe(true);
    expect(overTheLimit.status).toBe(429);
    expect(overTheLimit.body).toMatchObject({ code: 'RATE_LIMITED', limit: 60 });
    expect(refusalKey(overTheLimit.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);
    expect(warn).toHaveBeenCalled();

    // The substitution that ARMED this limiter is the substitution that was
    // logged: arming the production factory with the clamped settings named
    // every rejected variable.
    for (const rejection of resolved.rejected) {
      expect(armingWarnings).toContain(rejection.name);
    }

    // -----------------------------------------------------------------------
    // The BACKSTOP is a SEPARATE bucket from the per-source limit, and it did not
    // refuse at 60 requests: the refusal below still names the SOURCE key, while
    // every request in this scenario has been charged to the backstop too. The
    // backstop's own ceiling being the (much larger) documented default is what
    // `webhook-backstop-bounds-total-work-even-for-valid-signatures` drives
    // directly.
    // -----------------------------------------------------------------------
    const backstopBody = makeEvent();
    const backstopObserved = await postWebhook(booted.baseUrl, {
      body: backstopBody,
      signature: forgedSignature(backstopBody, nowSeconds),
    });
    expect(backstopObserved.status).toBe(429);
    expect(refusalKey(backstopObserved.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);

    // -----------------------------------------------------------------------
    // Boundary proof — the part the wall clock made impossible to assert. The
    // refusal above is pinned to the WINDOW, not to the process: one
    // millisecond before the window ends the counter is still exhausted, and at
    // the window end it resets and the whole quota is available again.
    // -----------------------------------------------------------------------
    clock = base + WINDOW_MS - 1;
    const oneMillisecondBeforeRollover = await forge();
    expect(oneMillisecondBeforeRollover).toBe(429);

    clock = base + WINDOW_MS;
    // At the window end the per-source counter resets, so this forged request is
    // back inside the limit and reaches the handler (401) — and, because a
    // correctly-signed delivery is never counted, the same window also serves it
    // (200) with the source's whole allowance still spent by no one.
    const forgedAfterRolloverBody = makeEvent();
    const afterRollover = await postWebhook(booted.baseUrl, {
      body: forgedAfterRolloverBody,
      signature: forgedSignature(forgedAfterRolloverBody, nowSeconds),
    });
    expect(afterRollover.status).toBe(401);
    expect(afterRollover.retryAfter).toBeNull();

    const signedInTheSameWindow = await postWebhook(booted.baseUrl, { signed: true });
    expect(signedInTheSameWindow.status).toBe(200);
    expect(signedInTheSameWindow.retryAfter).toBeNull();

    // The rollover restored the FULL quota, not a single exempt request: the
    // rest of the new window is accepted and the request after it is refused.
    for (let i = 1; i < resolved.limit; i += 1) {
      expect(await forge()).toBe(401);
    }
    const overTheLimitAgainBody = makeEvent();
    const overTheLimitAgain = await postWebhook(booted.baseUrl, {
      body: overTheLimitAgainBody,
      signature: forgedSignature(overTheLimitAgainBody, nowSeconds),
    });
    expect(overTheLimitAgain.status).toBe(429);
    expect(overTheLimitAgain.body).toMatchObject({ code: 'RATE_LIMITED', limit: 60 });
    expect(refusalKey(overTheLimitAgain.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);
  });
});

// ---------------------------------------------------------------------------
// REQUIRED: webhook-not-configured-still-answers-503-as-before
// ---------------------------------------------------------------------------
describe('webhook rate limit — unconfigured provider is unchanged', () => {
  it('webhook-not-configured-still-answers-503-as-before', async () => {
    // No STRIPE_SECRET_KEY: the handler's first gate answers 503, exactly as it
    // did before the limiter was mounted. The limiter is in front of it and must
    // not change the answer.
    booted = await bootApp({
      STRIPE_WEBHOOK_SECRET: SIGNATURE_SECRET,
      WEBHOOK_RATE_LIMIT_MAX: '2',
    });

    const noAdapter = await postWebhook(booted.baseUrl, { signed: true });
    expect(noAdapter.status).toBe(503);
    expect(noAdapter.body).toEqual({
      error: 'Stripe adapter not configured on this server instance (set STRIPE_SECRET_KEY)',
    });

    // And the second gate: adapter configured, webhook secret absent.
    await shutdown(booted);
    booted = await bootApp({
      STRIPE_SECRET_KEY: STRIPE_SECRET_PLACEHOLDER,
      WEBHOOK_RATE_LIMIT_MAX: '2',
    });

    const noSecret = await postWebhook(booted.baseUrl, { signed: true });
    expect(noSecret.status).toBe(503);
    expect(noSecret.body).toEqual({
      error:
        'Stripe webhook secret not configured on this server instance (set STRIPE_WEBHOOK_SECRET)',
    });

    // A forged FLOOD in this state is still answered 503, never 429: with no
    // secret there is no way to tell a forged delivery from a real one, the
    // endpoint already refuses every request, so nothing is charged to a
    // per-source bucket. The backstop stays armed (that is what bounds work);
    // the answer the route gives is unchanged.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const forgedStatuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const body = makeEvent();
      forgedStatuses.push(
        (await postWebhook(booted.baseUrl, { body, signature: forgedSignature(body, nowSeconds) }))
          .status
      );
    }
    expect(forgedStatuses).toEqual([503, 503, 503, 503, 503]);
    expect(forgedStatuses).not.toContain(429);
  });
});

// ---------------------------------------------------------------------------
// REQUIRED (P3A acceptance): webhook-forged-flood-does-not-refuse-a-signed-delivery
//
// THE OWNER'S ACCEPTANCE TEST, as a test:
//
//   ยิง flood ลายเซ็นผิด แล้ว webhook ลายเซ็นถูกยังผ่าน
//   (flood the endpoint with WRONG signatures, then a correctly-signed webhook
//    must still pass)
//
// Driven over real HTTP against the REAL app (`createApp()`), one process, no
// database: a short flood of forged signatures from one source is fired until
// refusals are observed, and then a correctly-signed delivery is sent. Under the
// OLD design — one constant key charged with every request — that delivery was
// refused 429, which is the defect this scenario exists to keep out.
// ---------------------------------------------------------------------------
describe("webhook rate limit — the Owner's flood acceptance test", () => {
  it('webhook-forged-flood-does-not-refuse-a-signed-delivery', async () => {
    const WINDOW_MS = 10_000;
    // Small, so a short flood is enough to have exhausted the bucket under the
    // old design (which is what the base-revision run showed).
    const LIMIT = 3;
    // The backstop is set well above the flood, so this scenario measures the
    // per-source rule and not the backstop.
    const BACKSTOP = 500;
    // The flood plus the signed deliveries must fit inside the window whose
    // index is asserted at the end, so room is made for this much work first.
    const NEED_MS = 2_000;

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    booted = await bootApp({
      ...CONFIGURED,
      WEBHOOK_RATE_LIMIT_MAX: String(LIMIT),
      WEBHOOK_RATE_LIMIT_BACKSTOP_MAX: String(BACKSTOP),
      WEBHOOK_RATE_LIMIT_WINDOW_MS: String(WINDOW_MS),
    });
    warn.mockRestore();

    // Make room inside one window before anything is sent.
    const windowIndex = await ensureWindowRoom(WINDOW_MS, NEED_MS);
    const nowSeconds = Math.floor(Date.now() / 1000);

    // --- 1. the flood: WRONG signatures, from one source -------------------
    let accepted = 0;
    let refused = 0;
    let sent = 0;
    let firstRefusalBody: unknown = null;
    const MAX_FLOOD = LIMIT * 5;
    for (let i = 0; i < MAX_FLOOD; i += 1) {
      const body = makeEvent();
      const observed = await postWebhook(booted.baseUrl, {
        body,
        signature: forgedSignature(body, nowSeconds),
      });
      sent += 1;
      if (observed.status === 429) {
        refused += 1;
        firstRefusalBody ??= observed.body;
        // A few refusals are enough to show the flood is over its allowance.
        if (refused >= 3) break;
      } else {
        accepted += 1;
      }
    }

    // --- 2. the flood was itself refused: the limiter is armed -------------
    // (The bucket the refusal names is asserted below, after the acceptance
    // assertion, so that a failure on the OLD design lands on the acceptance
    // property rather than on a key-shape detail.)
    expect(accepted).toBeGreaterThanOrEqual(LIMIT);
    expect(refused).toBeGreaterThanOrEqual(1);

    // The flood stayed inside one window, so "accepted then refused" is a
    // statement about the allowance and not about the window rolling over. If
    // the window had moved, this scenario would be measuring the wrong thing, so
    // it is asserted rather than assumed.
    const floodElapsedMs = Date.now() % WINDOW_MS;
    expect(Math.floor(Date.now() / WINDOW_MS)).toBe(windowIndex);

    // --- 3. THE ACCEPTANCE: a correctly-signed delivery is NOT refused -----
    const signedDelivery = await postWebhook(booted.baseUrl, { signed: true });
    expect(signedDelivery.status).not.toBe(429);
    expect(signedDelivery.status).toBe(200);
    expect(signedDelivery.retryAfter).toBeNull();

    // Not a one-shot exemption: the handler's answer keeps coming, because a
    // valid signature is never charged to any bucket the flood filled.
    const secondSignedDelivery = await postWebhook(booted.baseUrl, { signed: true });
    expect(secondSignedDelivery.status).toBe(200);
    expect(secondSignedDelivery.retryAfter).toBeNull();

    // Neither of the two deliveries crossed a window boundary either, so they
    // were answered in the very window the flood exhausted.
    expect(Math.floor(Date.now() / WINDOW_MS)).toBe(windowIndex);

    // The flood's refusals named the SOURCE's bucket — the bucket the forged
    // requests filled, and the only bucket they filled.
    expect(refusalKey(firstRefusalBody)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);

    // ... and the flood is STILL refused afterwards, so the two assertions above
    // were not bought by turning the limiter off.
    const forgedAfterTheGoodDeliveryBody = makeEvent();
    const forgedAfterTheGoodDelivery = await postWebhook(booted.baseUrl, {
      body: forgedAfterTheGoodDeliveryBody,
      signature: forgedSignature(forgedAfterTheGoodDeliveryBody, nowSeconds),
    });
    expect(forgedAfterTheGoodDelivery.status).toBe(429);
    expect(refusalKey(forgedAfterTheGoodDelivery.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);

    // The numbers, so the observation is quotable from the test log.
    // eslint-disable-next-line no-console
    console.log(
      `[P3A acceptance] flood: requests_sent=${sent} accepted=${accepted} refused=${refused} ` +
        `limit=${LIMIT} backstop=${BACKSTOP} windowMs=${WINDOW_MS} elapsedMs=${floodElapsedMs} ` +
        `signed_delivery_status=${signedDelivery.status} ` +
        `second_signed_delivery_status=${secondSignedDelivery.status} ` +
        `forged_after_good_status=${forgedAfterTheGoodDelivery.status}`
    );
  });
});

// ---------------------------------------------------------------------------
// REQUIRED (P3A): webhook-per-source-allowance-is-independent
//
// One source's flood must not consume another source's allowance. The second
// source is a REAL one: the same app reached on the same port at `[::1]`, so
// the kernel reports a different `req.socket.remoteAddress` and the limiter
// derives a different key. A test that merely passed a different key to the
// factory would not have shown this.
// ---------------------------------------------------------------------------
describe('webhook rate limit — per-source allowance is independent', () => {
  it('webhook-per-source-allowance-is-independent', async () => {
    const WINDOW_MS = 10_000;
    const LIMIT = 2;
    const NEED_MS = 2_000;

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    booted = await bootApp({
      ...CONFIGURED,
      WEBHOOK_RATE_LIMIT_MAX: String(LIMIT),
      WEBHOOK_RATE_LIMIT_BACKSTOP_MAX: '500',
      WEBHOOK_RATE_LIMIT_WINDOW_MS: String(WINDOW_MS),
    });
    warn.mockRestore();

    const secondSourceBaseUrl = await bindSecondSource(booted);
    const windowIndex = await ensureWindowRoom(WINDOW_MS, NEED_MS);
    const nowSeconds = Math.floor(Date.now() / 1000);

    const forgeAt = async (baseUrl: string): Promise<ObservedResponse> => {
      const body = makeEvent();
      return postWebhook(baseUrl, { body, signature: forgedSignature(body, nowSeconds) });
    };

    // --- source A (127.0.0.1) floods until it is refused --------------------
    const sourceAStatuses: number[] = [];
    let sourceARefusal: ObservedResponse | null = null;
    for (let i = 0; i < LIMIT * 4 && sourceARefusal === null; i += 1) {
      const observed = await forgeAt(booted.baseUrl);
      sourceAStatuses.push(observed.status);
      if (observed.status === 429) sourceARefusal = observed;
    }
    expect(sourceARefusal).not.toBeNull();
    expect(refusalKey(sourceARefusal!.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);

    // --- source B ([::1]) has spent nothing ---------------------------------
    const sourceBForgedStatuses: number[] = [];
    for (let i = 0; i < LIMIT; i += 1) {
      sourceBForgedStatuses.push((await forgeAt(secondSourceBaseUrl)).status);
    }
    expect(sourceBForgedStatuses).toEqual([401, 401]);
    expect(sourceBForgedStatuses).not.toContain(429);

    // A correctly-signed delivery is served from EITHER source, including the
    // one whose forged-signature bucket is exhausted.
    const signedFromB = await postWebhook(secondSourceBaseUrl, { signed: true });
    expect(signedFromB.status).toBe(200);
    const signedFromA = await postWebhook(booted.baseUrl, { signed: true });
    expect(signedFromA.status).toBe(200);

    // --- B is refused only when ITS OWN allowance is gone -------------------
    const sourceBRefusal = await forgeAt(secondSourceBaseUrl);
    expect(sourceBRefusal.status).toBe(429);
    expect(refusalKey(sourceBRefusal.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV6}`);

    // ... and A does not come back to life because B was spent: the two buckets
    // are independent in both directions.
    const sourceAStillRefused = await forgeAt(booted.baseUrl);
    expect(sourceAStillRefused.status).toBe(429);
    expect(refusalKey(sourceAStillRefused.body)).toBe(`${SOURCE_KEY_PREFIX}${SOURCE_IPV4}`);

    // Every observation above belongs to ONE window, so the independence shown
    // is the buckets' and not an artefact of a window rolling over mid-scenario.
    expect(Math.floor(Date.now() / WINDOW_MS)).toBe(windowIndex);

    // eslint-disable-next-line no-console
    console.log(
      `[P3A per-source] source_a=127.0.0.1 statuses=[${sourceAStatuses.join(',')}] ` +
        `source_b=::1 forged_statuses=[${sourceBForgedStatuses.join(',')}] ` +
        `source_b_refusal_key=${refusalKey(sourceBRefusal.body)} ` +
        `signed_from_a=${signedFromA.status} signed_from_b=${signedFromB.status} ` +
        `limit=${LIMIT} windowMs=${WINDOW_MS}`
    );
  });
});

// ---------------------------------------------------------------------------
// REQUIRED (P3C, independent review HIGH): a forged flood that exhausts the
// BACKSTOP must still not refuse a correctly-signed delivery.
//
// THE DEFECT THIS SCENARIO EXISTS TO KEEP OUT. The pre-P3C revision charged the
// route-level backstop with EVERY request BEFORE the signature was verified and
// refused at that point. A refusal decided before the verdict cannot tell an
// attacker's junk from a real Stripe delivery, so an unauthenticated flood could
// fill the shared bucket and a correctly-signed delivery arriving in the same
// window was then refused 429. It was reproduced with the DOCUMENTED DEFAULTS:
// 60 x 401, the rest 429, and the signed delivery after the flood = 429.
//
// WHY THE NUMBERS HERE ARE THE DOCUMENTED DEFAULTS, not test-sized ones. The
// harness that missed the defect set `WEBHOOK_RATE_LIMIT_BACKSTOP_MAX=5000`, so
// its six-request flood never reached the backstop and the check passed on
// defective code. This scenario therefore sets NO rate-limit variable at all and
// asserts the resolved settings against the module's own exported defaults
// (`60` per source, `1000` per window), then floods PAST the backstop.
//
// The clock is injected and held fixed, for the same reason the window-reset
// scenario injects one: 1003 requests take seconds, the default window is 60 s,
// and the fixed-window store resets at a wall-clock boundary. A rollover would
// reset the counters mid-flood and the bound being measured would disappear.
// What is injected is the clock only — the settings, the limiter factory, the
// handler and the mount order are all the production ones, driven over real HTTP.
// ---------------------------------------------------------------------------
describe('webhook rate limit — a flood past the backstop cannot consume the delivery path', () => {
  it('webhook-forged-flood-over-the-backstop-does-not-refuse-a-signed-delivery', async () => {
    applyEnv({ ...CONFIGURED });
    vi.resetModules();

    const {
      resolveWebhookRateLimit,
      createWebhookRateLimitMiddleware,
      WEBHOOK_RATE_LIMIT_DEFAULT_BACKSTOP_MAX,
      WEBHOOK_RATE_LIMIT_DEFAULT_MAX,
      WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS,
    } = await import('../src/lib/rate-limit.js');
    const { paymentWebhookHandler } = await import('../src/routes/payment-demo.js');

    // Resolved from an EMPTY environment: the documented defaults, read from the
    // module's own exported constants rather than restated here.
    const resolved = resolveWebhookRateLimit({});
    expect(resolved.limit).toBe(WEBHOOK_RATE_LIMIT_DEFAULT_MAX);
    expect(resolved.limit).toBe(60);
    expect(resolved.backstopLimit).toBe(WEBHOOK_RATE_LIMIT_DEFAULT_BACKSTOP_MAX);
    expect(resolved.backstopLimit).toBe(1000);
    expect(resolved.windowMs).toBe(WEBHOOK_RATE_LIMIT_DEFAULT_WINDOW_MS);

    const store: RateLimitStore = createMemoryStore();
    const base = Math.floor(1_700_000_000_000 / resolved.windowMs) * resolved.windowMs;
    let clock = base;
    const limiter = createWebhookRateLimitMiddleware({
      settings: resolved,
      store,
      now: () => clock,
    });

    // The SAME production mount order as server/src/app.ts: raw body, limiter,
    // handler.
    const app = express();
    app.post(
      '/payment/webhook',
      express.raw({ type: 'application/json' }),
      limiter,
      paymentWebhookHandler
    );

    const server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    booted = {
      server,
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      app,
    };

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ROUTE_KEY = 'route:POST /payment/webhook';

    // --- 1. the flood: forged signatures, PAST the backstop ------------------
    let accepted = 0;
    let refusedBySource = 0;
    let refusedByBackstop = 0;
    const FLOOD = resolved.backstopLimit + 3;
    for (let i = 0; i < FLOOD; i += 1) {
      const body = makeEvent();
      const observed = await postWebhook(booted.baseUrl, {
        body,
        signature: forgedSignature(body, nowSeconds),
      });
      if (observed.status === 429) {
        if (refusalKey(observed.body) === ROUTE_KEY) refusedByBackstop += 1;
        else refusedBySource += 1;
      } else {
        accepted += 1;
      }
    }

    // The per-source rule refused the forged flood after its own allowance, and
    // the backstop refused what came after that — so both limiter stages are
    // demonstrably armed and the backstop really was exhausted.
    expect(accepted).toBe(resolved.limit);
    expect(refusedBySource).toBe(resolved.backstopLimit - resolved.limit);
    expect(refusedByBackstop).toBe(3);

    // --- 2. THE ACCEPTANCE: the signed delivery is NOT refused ---------------
    // On the pre-P3C revision this request was refused 429 at the backstop,
    // because the backstop was charged before the signature was verified.
    const signedDelivery = await postWebhook(booted.baseUrl, { signed: true });
    expect(signedDelivery.status).not.toBe(429);
    expect(signedDelivery.status).toBe(200);
    expect(signedDelivery.retryAfter).toBeNull();

    // Not a one-shot exemption: a second signed delivery is served too.
    const secondSignedDelivery = await postWebhook(booted.baseUrl, { signed: true });
    expect(secondSignedDelivery.status).toBe(200);
    expect(secondSignedDelivery.retryAfter).toBeNull();

    // ... and the limiter is still armed for junk, so the two 200s were not
    // bought by disabling it.
    const forgedAfterBody = makeEvent();
    const forgedAfter = await postWebhook(booted.baseUrl, {
      body: forgedAfterBody,
      signature: forgedSignature(forgedAfterBody, nowSeconds),
    });
    expect(forgedAfter.status).toBe(429);
    expect(refusalKey(forgedAfter.body)).toBe(ROUTE_KEY);

    // Every observation belongs to ONE window, so the numbers above are the
    // allowances and not a window rollover.
    expect(clock).toBe(base);

    // eslint-disable-next-line no-console
    console.log(
      `[P3C backstop-vs-delivery] flood=${FLOOD} accepted=${accepted} ` +
        `refused_by_source=${refusedBySource} refused_by_backstop=${refusedByBackstop} ` +
        `limit=${resolved.limit} backstop=${resolved.backstopLimit} windowMs=${resolved.windowMs} ` +
        `signed_delivery_status=${signedDelivery.status} ` +
        `second_signed_delivery_status=${secondSignedDelivery.status} ` +
        `forged_after_good_status=${forgedAfter.status}`
    );
  }, 120_000);
});

// ---------------------------------------------------------------------------
// REQUIRED (P3A, restated by P3C): the coarse backstop bounds non-valid traffic
//
// The scenario below was named `…-even-for-valid-signatures` while the backstop
// was charged with every request. Under the P3C order a correctly-signed
// delivery is charged to NO bucket, so that name is no longer true and is not
// kept: what the backstop bounds is the traffic it can see — the requests whose
// signature is wrong, and the UNJUDGEABLE ones (no secret configured), which is
// the case driven here because it needs no per-source stage at all.
//
// The cost, and the reason this scenario spends real time: with no secret there
// is no allowance to separate, so the backstop must be the binding limit. That
// needs a window longer than the flood, because the fixed-window store resets at
// a boundary, and a flood cannot be spread across a boundary and still bound
// anything.
// ---------------------------------------------------------------------------
describe('webhook rate limit — the coarse backstop bounds unjudgeable traffic', () => {
  it('webhook-backstop-bounds-unjudgeable-traffic-when-no-secret-is-configured', async () => {
    const WINDOW_MS = 120_000;
    const BACKSTOP = 40;

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Deliberately NO webhook secret: no signature verdict is possible, so the
    // per-source stage is skipped and the backstop is the only limiter left.
    booted = await bootApp({
      STRIPE_SECRET_KEY: STRIPE_SECRET_PLACEHOLDER,
      WEBHOOK_RATE_LIMIT_BACKSTOP_MAX: String(BACKSTOP),
      WEBHOOK_RATE_LIMIT_WINDOW_MS: String(WINDOW_MS),
    });
    warn.mockRestore();

    const windowStart = await alignToWindowBoundary(WINDOW_MS);

    const statuses: number[] = [];
    const codes: unknown[] = [];
    for (let i = 0; i < BACKSTOP + 2; i += 1) {
      const observed = await postWebhook(booted.baseUrl, { signed: true });
      statuses.push(observed.status);
      codes.push((observed.body as { code?: unknown }).code);
    }

    const refused = statuses.filter((status) => status === 429);
    const served = statuses.filter((status) => status === 503);

    // Exactly the backstop's worth got through, and everything after it was
    // refused — with the 503 the handler answers when no secret is configured,
    // which is what proves the requests that got through reached the handler.
    expect(served).toHaveLength(BACKSTOP);
    expect(refused).toHaveLength(2);
    expect(statuses[BACKSTOP]).toBe(429);
    expect(statuses[BACKSTOP + 1]).toBe(429);

    // The refusal is the ROUTE's bucket, not a source's: the backstop protects
    // the process, whichever caller is responsible.
    const refusalBody = (await postWebhook(booted.baseUrl, { signed: true })).body;
    expect(refusalBody).toMatchObject({ code: 'RATE_LIMITED', limit: BACKSTOP });
    expect(refusalKey(refusalBody)).toBe('route:POST /payment/webhook');

    // The clock check: the bound above is the backstop's own allowance, not the
    // window rolling over mid-flood.
    const elapsedMs = Date.now() - windowStart;
    expect(elapsedMs).toBeLessThan(WINDOW_MS);

    // eslint-disable-next-line no-console
    console.log(
      `[P3A backstop] requests=${statuses.length} served=${served.length} refused=${refused.length} ` +
        `backstop=${BACKSTOP} windowMs=${WINDOW_MS} elapsedMs=${elapsedMs} ` +
        `first_refusal_status=${statuses[BACKSTOP]} refusal_code=${codes[BACKSTOP]} ` +
        `refusal_key=${refusalKey(refusalBody)}`
    );
  }, 180_000);
});
