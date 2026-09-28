import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * HOUSE-SWARM-7 WU-3 — quota enforcement (hermetic).
 *
 * This suite is deliberately DB-less: DATABASE_URL is cleared before any server
 * module is imported (the modules are imported dynamically in beforeAll), so
 * server/src/lib/subscriptions.ts resolves the in-memory repositories and the
 * whole suite runs against them. That makes the assertions independent of any
 * database, and it is the reason the imports below are dynamic.
 *
 * The AI provider is replaced with a stub (vi.mock of src/lib/ai.ts) so the
 * "the provider was never called" assertions are about real code paths in
 * src/routes/ai-demo.ts, not about a network call.
 *
 * Run with:  npm run test:quota
 */

const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

const providerStub = vi.hoisted(() => ({
  getConfiguredProvider: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('../src/lib/ai.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/ai.js')>();
  return { ...actual, getConfiguredProvider: providerStub.getConfiguredProvider };
});

const FREE_AI_LIMIT = 50;
const FREE_PAYMENTS_LIMIT = 5;

/** Minimal Express Response stand-in that records status and JSON body. */
function makeRes() {
  const res = {
    // Express starts a response at 200; the handler only calls status() for
    // non-200 outcomes, so this default is what the success path sees.
    statusCode: 200,
    payload: undefined as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.payload = body;
      return res;
    },
  };
  // The handler only uses status()/json(); the cast keeps the stub honest about
  // everything it does NOT implement.
  return res as unknown as import('express').Response & { statusCode: number; payload: any };
}

function makeReq(body: unknown, tenantId: string) {
  return {
    body,
    headers: {},
    tenantContext: { tenantId, metadata: { resolvedVia: 'test' } },
  } as any;
}

describe('quota enforcement (hermetic, in-memory repositories)', () => {
  let quotaGate: typeof import('../src/lib/quota.js').quotaGate;
  let quotaRefusalResponse: typeof import('../src/lib/quota.js').quotaRefusalResponse;
  let subscriptionCore: typeof import('../src/lib/subscriptions.js').subscriptionCore;
  let usageCounterRepository: typeof import('../src/lib/subscriptions.js').usageCounterRepository;
  let AI_REQUESTS_PER_MONTH: string;
  let PAYMENTS_PER_MONTH: string;
  let aiDemoHandler: typeof import('../src/routes/ai-demo.js').aiDemoHandler;
  let demoChargeHandler: typeof import('../src/routes/payment-demo.js').demoChargeHandler;
  let CircuitBreakerError: typeof import('../../modules/enterprise-features/index.js').CircuitBreakerError;

  let seq = 0;
  const nextAccountId = (label: string) => `hermetic_${label}_${Date.now()}_${seq++}`;

  /** Creates an active 'free' subscription and returns its counter period key. */
  async function seedFreeSubscription(accountId: string): Promise<Date> {
    await subscriptionCore.createSubscription({ accountId, planId: 'free' });
    const subscription = await subscriptionCore.getSubscription(accountId);
    expect(subscription).not.toBeNull();
    return subscription!.currentPeriodStart;
  }

  beforeAll(async () => {
    ({ quotaGate, quotaRefusalResponse } = await import('../src/lib/quota.js'));
    ({ subscriptionCore, usageCounterRepository, AI_REQUESTS_PER_MONTH, PAYMENTS_PER_MONTH } =
      await import('../src/lib/subscriptions.js'));
    ({ aiDemoHandler } = await import('../src/routes/ai-demo.js'));
    ({ demoChargeHandler } = await import('../src/routes/payment-demo.js'));
    ({ CircuitBreakerError } = await import('../../modules/enterprise-features/index.js'));

    providerStub.getConfiguredProvider.mockImplementation(() => ({
      generateText: providerStub.generateText,
    }));
  });

  afterAll(() => {
    if (originalDatabaseUrl !== undefined) process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('is hermetic: no database is configured for this suite', () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it('refuses when there is no subscription (NO_SUBSCRIPTION)', async () => {
    const accountId = nextAccountId('no_sub');
    const decision = await quotaGate.assertAndConsumeQuota({
      accountId,
      featureKey: AI_REQUESTS_PER_MONTH,
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.reason).toBe('NO_SUBSCRIPTION');
    expect(decision.usage).toBe(0);
    expect(decision.limit).toBe(0);

    const refusal = quotaRefusalResponse(decision);
    expect(refusal.status).toBe(402);
    expect(refusal.body.code).toBe('QUOTA_NOT_ENTITLED');
    expect(refusal.body.featureKey).toBe(AI_REQUESTS_PER_MONTH);
  });

  it('refuses at the limit and does not consume (QUOTA_EXCEEDED)', async () => {
    const accountId = nextAccountId('at_limit');
    const periodStart = await seedFreeSubscription(accountId);

    await usageCounterRepository.increment(
      accountId,
      AI_REQUESTS_PER_MONTH,
      periodStart,
      FREE_AI_LIMIT
    );

    const decision = await quotaGate.assertAndConsumeQuota({
      accountId,
      featureKey: AI_REQUESTS_PER_MONTH,
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.reason).toBe('QUOTA_EXCEEDED');
    expect(decision.limit).toBe(FREE_AI_LIMIT);
    expect(decision.usage).toBe(FREE_AI_LIMIT);

    const refusal = quotaRefusalResponse(decision);
    expect(refusal.status).toBe(429);
    expect(refusal.body.code).toBe('QUOTA_EXCEEDED');
    expect(refusal.body.featureKey).toBe(AI_REQUESTS_PER_MONTH);
    expect(refusal.body.limit).toBe(FREE_AI_LIMIT);
    expect(refusal.body.usage).toBe(FREE_AI_LIMIT);

    // A refusal must not burn quota.
    await expect(
      usageCounterRepository.getUsage(accountId, AI_REQUESTS_PER_MONTH, periodStart)
    ).resolves.toBe(FREE_AI_LIMIT);
  });

  it('allows under the limit and increments the counter', async () => {
    const accountId = nextAccountId('under_limit');
    const periodStart = await seedFreeSubscription(accountId);

    await usageCounterRepository.increment(
      accountId,
      AI_REQUESTS_PER_MONTH,
      periodStart,
      FREE_AI_LIMIT - 1
    );

    const decision = await quotaGate.assertAndConsumeQuota({
      accountId,
      featureKey: AI_REQUESTS_PER_MONTH,
    });

    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error('unreachable');
    expect(decision.limit).toBe(FREE_AI_LIMIT);
    expect(decision.usage).toBe(FREE_AI_LIMIT);

    await expect(
      usageCounterRepository.getUsage(accountId, AI_REQUESTS_PER_MONTH, periodStart)
    ).resolves.toBe(FREE_AI_LIMIT);

    // The next request is now over the limit.
    const next = await quotaGate.assertAndConsumeQuota({
      accountId,
      featureKey: AI_REQUESTS_PER_MONTH,
    });
    expect(next.allowed).toBe(false);
    if (next.allowed) throw new Error('unreachable');
    expect(next.reason).toBe('QUOTA_EXCEEDED');
  });

  it('refuses a feature the plan does not carry (FEATURE_NOT_ENTITLED)', async () => {
    const accountId = nextAccountId('no_entitlement');
    await seedFreeSubscription(accountId);

    const decision = await quotaGate.assertAndConsumeQuota({
      accountId,
      featureKey: 'not_a_plan_feature',
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.reason).toBe('FEATURE_NOT_ENTITLED');
    expect(decision.limit).toBe(0);
    expect(quotaRefusalResponse(decision).status).toBe(402);
  });

  it('release restores the counter after a failed downstream call', async () => {
    const accountId = nextAccountId('release');
    const periodStart = await seedFreeSubscription(accountId);

    const consumed = await quotaGate.assertAndConsumeQuota({
      accountId,
      featureKey: AI_REQUESTS_PER_MONTH,
    });
    expect(consumed.allowed).toBe(true);
    await expect(
      usageCounterRepository.getUsage(accountId, AI_REQUESTS_PER_MONTH, periodStart)
    ).resolves.toBe(1);

    const released = await quotaGate.releaseQuota({
      accountId,
      featureKey: AI_REQUESTS_PER_MONTH,
    });
    expect(released).toBe(0);
    await expect(
      usageCounterRepository.getUsage(accountId, AI_REQUESTS_PER_MONTH, periodStart)
    ).resolves.toBe(0);
  });

  it('POST /ai/demo returns 402 QUOTA_NOT_ENTITLED without reaching the provider', async () => {
    providerStub.getConfiguredProvider.mockClear();
    providerStub.generateText.mockClear();

    const accountId = nextAccountId('handler_402');
    const req = makeReq({ prompt: 'hello' }, accountId);
    const res = makeRes();

    await aiDemoHandler(req, res);

    expect(res.statusCode).toBe(402);
    expect(res.payload).toMatchObject({
      code: 'QUOTA_NOT_ENTITLED',
      featureKey: AI_REQUESTS_PER_MONTH,
      limit: 0,
    });
    expect(providerStub.getConfiguredProvider).not.toHaveBeenCalled();
    expect(providerStub.generateText).not.toHaveBeenCalled();
  });

  it('POST /ai/demo returns 429 QUOTA_EXCEEDED without reaching the provider', async () => {
    providerStub.getConfiguredProvider.mockClear();
    providerStub.generateText.mockClear();

    const accountId = nextAccountId('handler_429');
    const periodStart = await seedFreeSubscription(accountId);
    await usageCounterRepository.increment(
      accountId,
      AI_REQUESTS_PER_MONTH,
      periodStart,
      FREE_AI_LIMIT
    );

    const req = makeReq({ prompt: 'hello' }, accountId);
    const res = makeRes();

    await aiDemoHandler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.payload).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      featureKey: AI_REQUESTS_PER_MONTH,
      limit: FREE_AI_LIMIT,
      usage: FREE_AI_LIMIT,
    });
    expect(providerStub.getConfiguredProvider).not.toHaveBeenCalled();
    expect(providerStub.generateText).not.toHaveBeenCalled();
  });

  it('POST /ai/demo keeps 400 for a missing prompt and does not consume', async () => {
    const accountId = nextAccountId('handler_400');
    const periodStart = await seedFreeSubscription(accountId);

    const res = makeRes();
    await aiDemoHandler(makeReq({}, accountId), res);

    expect(res.statusCode).toBe(400);
    await expect(
      usageCounterRepository.getUsage(accountId, AI_REQUESTS_PER_MONTH, periodStart)
    ).resolves.toBe(0);
  });

  it('POST /ai/demo returns usage/limit on success and preserves the provider payload', async () => {
    providerStub.getConfiguredProvider.mockClear();
    providerStub.generateText.mockClear();
    providerStub.generateText.mockResolvedValue({
      success: true,
      text: 'stubbed completion',
      provider: 'stub',
      model: 'stub-model',
      usage: { inputTokens: 3, outputTokens: 4 },
    });

    const accountId = nextAccountId('handler_ok');
    await seedFreeSubscription(accountId);
    const res = makeRes();
    await aiDemoHandler(makeReq({ prompt: 'hello' }, accountId), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      text: 'stubbed completion',
      provider: 'stub',
      model: 'stub-model',
      usage: 1,
      limit: FREE_AI_LIMIT,
    });
    // The provider's own token counters are preserved, not dropped.
    expect(res.payload.tokenUsage).toEqual({ inputTokens: 3, outputTokens: 4 });
    expect(providerStub.generateText).toHaveBeenCalledTimes(1);
  });

  it('POST /ai/demo releases the consumed unit when the provider call throws (circuit open)', async () => {
    providerStub.generateText.mockReset();
    providerStub.generateText.mockRejectedValue(
      new CircuitBreakerError('CIRCUIT_OPEN', 'Circuit breaker is open')
    );

    const accountId = nextAccountId('handler_release');
    const periodStart = await seedFreeSubscription(accountId);

    const res = makeRes();
    await aiDemoHandler(makeReq({ prompt: 'hello' }, accountId), res);

    expect(res.statusCode).toBe(503);
    // Consumed before the provider call, given back because the call failed.
    await expect(
      usageCounterRepository.getUsage(accountId, AI_REQUESTS_PER_MONTH, periodStart)
    ).resolves.toBe(0);
  });

  it('POST /payment/demo-charge carries the same gate on the payments_per_month key', async () => {
    // No subscription -> 402 QUOTA_NOT_ENTITLED with the payments feature key.
    const unentitled = nextAccountId('pay_402');
    const res402 = makeRes();
    await demoChargeHandler(
      makeReq({ amountMinorUnits: 500, currency: 'USD' }, unentitled),
      res402
    );
    expect(res402.statusCode).toBe(402);
    expect(res402.payload).toMatchObject({
      code: 'QUOTA_NOT_ENTITLED',
      featureKey: PAYMENTS_PER_MONTH,
    });

    // Entitled but over the payments limit -> 429 QUOTA_EXCEEDED.
    const atLimit = nextAccountId('pay_429');
    const periodStart = await seedFreeSubscription(atLimit);
    await usageCounterRepository.increment(
      atLimit,
      PAYMENTS_PER_MONTH,
      periodStart,
      FREE_PAYMENTS_LIMIT
    );
    const res429 = makeRes();
    await demoChargeHandler(
      makeReq({ amountMinorUnits: 500, currency: 'USD' }, atLimit),
      res429
    );
    expect(res429.statusCode).toBe(429);
    expect(res429.payload).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      featureKey: PAYMENTS_PER_MONTH,
      limit: FREE_PAYMENTS_LIMIT,
      usage: FREE_PAYMENTS_LIMIT,
    });

    // Entitled and under the limit, but no Stripe key in this env: the handler
    // must answer 503 and give the consumed unit back.
    const unconfigured = nextAccountId('pay_503');
    const unconfiguredPeriod = await seedFreeSubscription(unconfigured);
    const res503 = makeRes();
    await demoChargeHandler(
      makeReq({ amountMinorUnits: 500, currency: 'USD' }, unconfigured),
      res503
    );
    expect(res503.statusCode).toBe(503);
    await expect(
      usageCounterRepository.getUsage(unconfigured, PAYMENTS_PER_MONTH, unconfiguredPeriod)
    ).resolves.toBe(0);
  });
});
