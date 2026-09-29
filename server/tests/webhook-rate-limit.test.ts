import express from 'express';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitStore } from '../../modules/rate-limit/index.js';
import { createMemoryStore } from '../../modules/rate-limit/index.js';

/**
 * H7-FU-RATELIMIT — the rate limit on `POST /payment/webhook`.
 *
 * Every scenario below boots the REAL express app (`server/src/app.ts`) on an
 * ephemeral port and drives it with REAL `fetch` calls, so the limiter is
 * observed through express's real middleware chain in the real order rather
 * than by calling a middleware function with a hand-built request.
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
 * SAME production handler in the SAME mount order as `server/src/app.ts`
 * (limiter, then `express.raw`, then the handler) and drives it over real HTTP.
 * That is stated plainly rather than presented as a `createApp()` observation.
 */

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
];
const savedEnv = new Map<string, string | undefined>();
for (const key of MANAGED_KEYS) savedEnv.set(key, process.env[key]);

// Cleared before the first dynamic import so no scenario can pick up a database.
delete process.env.DATABASE_URL;

type Booted = { server: Server; baseUrl: string };

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
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function shutdown(target: Booted | null): Promise<void> {
  if (!target) return;
  await new Promise<void>((resolve, reject) => {
    target.server.close((error) => (error ? reject(error) : resolve()));
  });
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

async function postWebhook(
  baseUrl: string,
  options: { signed?: boolean; body?: string } = {}
): Promise<ObservedResponse> {
  const body = options.body ?? makeEvent();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.signed) {
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
    booted = await bootApp({ ...CONFIGURED, WEBHOOK_RATE_LIMIT_MAX: '2' });

    const first = await postWebhook(booted.baseUrl, { signed: true });
    const second = await postWebhook(booted.baseUrl, { signed: true });
    const third = await postWebhook(booted.baseUrl, { signed: true });

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({
      code: 'RATE_LIMITED',
      limit: 2,
      windowMs: 60_000,
      remaining: 0,
    });
    expect((third.body as { retryAfterMs: number }).retryAfterMs).toBeGreaterThan(0);
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

    await postWebhook(booted.baseUrl, { signed: true });
    const refused = await postWebhook(booted.baseUrl, { signed: true });

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
      key: 'route:POST /payment/webhook',
      limit: 1,
      windowMs: 2000,
      remaining: 0,
      resetAt: body.resetAt,
      retryAfterMs: body.retryAfterMs,
    });
  });

  // -------------------------------------------------------------------------
  // REQUIRED: webhook-refusal-happens-before-signature-verification
  // -------------------------------------------------------------------------
  it('webhook-refusal-happens-before-signature-verification', async () => {
    // Proof of ORDER, not an assertion about order. The three requests below
    // walk the SAME bucket, so the only thing that differs between the 401 and
    // the 429 is the bucket's state:
    //
    //   request 1 — no signature, within the limit  -> 401 WEBHOOK_MISSING_SIGNATURE
    //   request 2 — valid signature, within limit   -> 200
    //   request 3 — no signature, OVER the limit    -> 429 RATE_LIMITED
    //
    // Request 3 carries the same missing signature as request 1. If signature
    // verification ran first, request 3 would answer 401 exactly like request 1.
    // It answers 429, which is only reachable when the limiter ran first.
    // Request 1 is what makes this a proof rather than a coincidence: it shows
    // the 401 path is live on this route in this very scenario.
    booted = await bootApp({ ...CONFIGURED, WEBHOOK_RATE_LIMIT_MAX: '2' });

    const unsignedWithinLimit = await postWebhook(booted.baseUrl, { signed: false });
    expect(unsignedWithinLimit.status).toBe(401);

    const signedWithinLimit = await postWebhook(booted.baseUrl, { signed: true });
    expect(signedWithinLimit.status).toBe(200);

    const unsignedOverLimit = await postWebhook(booted.baseUrl, { signed: false });
    expect(unsignedOverLimit.status).toBe(429);
    expect(unsignedOverLimit.body).toMatchObject({ code: 'RATE_LIMITED' });
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
      settings: { limit: LIMIT, windowMs: WINDOW_MS, rejected: [] },
      store,
      now: () => clock,
    });

    // The SAME mount order as server/src/app.ts: limiter, raw body, handler.
    const app = express();
    app.post('/payment/webhook', limiter, express.raw({ type: 'application/json' }), paymentWebhookHandler);

    const server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    booted = { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };

    clock = base;
    const first = await postWebhook(booted.baseUrl, { signed: true });
    clock = base + 100;
    const second = await postWebhook(booted.baseUrl, { signed: true });
    clock = base + 200;
    const third = await postWebhook(booted.baseUrl, { signed: true });

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(third.status).toBe(429);

    // Advance the injected clock into the NEXT window. The counter resets, so
    // the full quota is available again — with no sleep anywhere in this test.
    clock = base + WINDOW_MS;
    const afterReset = await postWebhook(booted.baseUrl, { signed: true });
    expect(afterReset.status).toBe(200);
    expect(afterReset.retryAfter).toBeNull();

    clock = base + WINDOW_MS + 100;
    const secondAfterReset = await postWebhook(booted.baseUrl, { signed: true });
    clock = base + WINDOW_MS + 200;
    const overAgain = await postWebhook(booted.baseUrl, { signed: true });

    expect(secondAfterReset.status).toBe(200);
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

    // The SAME mount order as server/src/app.ts: limiter, raw body, handler.
    const app = express();
    app.post(
      '/payment/webhook',
      limiter,
      express.raw({ type: 'application/json' }),
      paymentWebhookHandler
    );

    const server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    booted = {
      server,
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    };

    // The burst. `clock` does not move, so every request below lands in the SAME
    // window and the counter cannot reset underneath the assertions.
    clock = base;
    const accepted: number[] = [];
    for (let i = 0; i < resolved.limit; i += 1) {
      accepted.push((await postWebhook(booted.baseUrl, { signed: true })).status);
    }
    const overTheLimit = await postWebhook(booted.baseUrl, { signed: true });

    expect(accepted).toHaveLength(60);
    expect(accepted).not.toContain(429);
    expect(overTheLimit.status).toBe(429);
    expect(overTheLimit.body).toMatchObject({ code: 'RATE_LIMITED', limit: 60 });
    expect(warn).toHaveBeenCalled();

    // The substitution that ARMED this limiter is the substitution that was
    // logged: arming the production factory with the clamped settings named
    // every rejected variable.
    for (const rejection of resolved.rejected) {
      expect(armingWarnings).toContain(rejection.name);
    }

    // -----------------------------------------------------------------------
    // Boundary proof — the part the wall clock made impossible to assert. The
    // refusal above is pinned to the WINDOW, not to the process: one
    // millisecond before the window ends the counter is still exhausted, and at
    // the window end it resets and the whole quota is available again.
    // -----------------------------------------------------------------------
    clock = base + WINDOW_MS - 1;
    const oneMillisecondBeforeRollover = await postWebhook(booted.baseUrl, { signed: true });
    expect(oneMillisecondBeforeRollover.status).toBe(429);
    expect(oneMillisecondBeforeRollover.body).toMatchObject({ code: 'RATE_LIMITED', limit: 60 });

    clock = base + WINDOW_MS;
    const afterRollover = await postWebhook(booted.baseUrl, { signed: true });
    expect(afterRollover.status).toBe(200);
    expect(afterRollover.retryAfter).toBeNull();

    // The rollover restored the FULL quota, not a single exempt request: the
    // rest of the new window is accepted and the request after it is refused.
    for (let i = 1; i < resolved.limit; i += 1) {
      expect((await postWebhook(booted.baseUrl, { signed: true })).status).toBe(200);
    }
    const overTheLimitAgain = await postWebhook(booted.baseUrl, { signed: true });
    expect(overTheLimitAgain.status).toBe(429);
    expect(overTheLimitAgain.body).toMatchObject({ code: 'RATE_LIMITED', limit: 60 });
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
    booted = await bootApp({ STRIPE_WEBHOOK_SECRET: SIGNATURE_SECRET });

    const noAdapter = await postWebhook(booted.baseUrl, { signed: true });
    expect(noAdapter.status).toBe(503);
    expect(noAdapter.body).toEqual({
      error: 'Stripe adapter not configured on this server instance (set STRIPE_SECRET_KEY)',
    });

    // And the second gate: adapter configured, webhook secret absent.
    await shutdown(booted);
    booted = await bootApp({ STRIPE_SECRET_KEY: STRIPE_SECRET_PLACEHOLDER });

    const noSecret = await postWebhook(booted.baseUrl, { signed: true });
    expect(noSecret.status).toBe(503);
    expect(noSecret.body).toEqual({
      error:
        'Stripe webhook secret not configured on this server instance (set STRIPE_WEBHOOK_SECRET)',
    });
  });
});
