import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const authStub = vi.hoisted(() => ({
  tenantId: 'phase_b_auth_tenant_a',
  userId: 'phase_b_user_a',
}));

const aiStub = vi.hoisted(() => ({
  getConfiguredProvider: vi.fn(),
  generateText: vi.fn(),
}));

const paymentStub = vi.hoisted(() => ({
  getConfiguredPaymentCore: vi.fn(),
  createPayment: vi.fn(),
}));

vi.mock('../src/middleware/auth.js', () => ({
  authMiddleware: async (req: any, _res: any, next: any) => {
    req.authContext = {
      userId: authStub.userId,
      tenantId: authStub.tenantId,
      roles: [],
      permissions: [],
      metadata: { source: 'phase-b-test-trusted-principal' },
    };
    next();
  },
}));

vi.mock('../src/lib/ai.js', () => ({
  tracer: {
    startSpan: () => ({
      setAttribute: () => undefined,
      end: () => undefined,
    }),
  },
  aiCircuitBreaker: {
    execute: async (operation: () => Promise<unknown>) => await operation(),
  },
  getConfiguredProvider: aiStub.getConfiguredProvider,
}));

vi.mock('../src/lib/payments.js', () => ({
  getConfiguredPaymentCore: paymentStub.getConfiguredPaymentCore,
  getStripeAdapter: () => null,
}));

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDemoAuth = process.env.DEMO_AUTH;
const originalNodeEnv = process.env.NODE_ENV;

delete process.env.DATABASE_URL;
delete process.env.DEMO_AUTH;
process.env.NODE_ENV = 'test';

describe('Phase B high-severity tenant and entitlement negative controls', () => {
  let server: Server;
  let baseUrl: string;
  let subscriptionCore: typeof import('../src/lib/subscriptions.js').subscriptionCore;
  let usageCounterRepository: typeof import('../src/lib/subscriptions.js').usageCounterRepository;
  let AI_REQUESTS_PER_MONTH: string;
  let PAYMENTS_PER_MONTH: string;
  let seq = 0;

  const nextTenant = (label: string) =>
    'phase_b_' + label + '_' + Date.now() + '_' + seq++;

  async function readBody(response: Response): Promise<Record<string, any>> {
    return (await response.json()) as Record<string, any>;
  }

  async function seedFreeSubscription(accountId: string): Promise<Date> {
    await subscriptionCore.createSubscription({ accountId, planId: 'free' });
    const subscription = await subscriptionCore.getSubscription(accountId);
    if (!subscription) throw new Error('test setup failed to create subscription');
    return subscription.currentPeriodStart;
  }

  beforeAll(async () => {
    aiStub.getConfiguredProvider.mockImplementation(() => ({
      generateText: aiStub.generateText,
    }));
    aiStub.generateText.mockResolvedValue({
      success: true,
      text: 'phase-b-stub',
      provider: 'stub',
      model: 'stub-model',
    });

    paymentStub.getConfiguredPaymentCore.mockImplementation(() => ({
      createPayment: paymentStub.createPayment,
    }));
    paymentStub.createPayment.mockResolvedValue({
      success: true,
      provider: 'stub',
      paymentId: 'phase-b-payment',
      status: 'succeeded',
    });

    const [{ createApp }, subscriptions] = await Promise.all([
      import('../src/app.js'),
      import('../src/lib/subscriptions.js'),
    ]);

    subscriptionCore = subscriptions.subscriptionCore;
    usageCounterRepository = subscriptions.usageCounterRepository;
    AI_REQUESTS_PER_MONTH = subscriptions.AI_REQUESTS_PER_MONTH;
    PAYMENTS_PER_MONTH = subscriptions.PAYMENTS_PER_MONTH;

    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = 'http://127.0.0.1:' + address.port;
  });

  beforeEach(() => {
    aiStub.getConfiguredProvider.mockClear();
    aiStub.generateText.mockClear();
    paymentStub.getConfiguredPaymentCore.mockClear();
    paymentStub.createPayment.mockClear();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }

    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;

    if (originalDemoAuth === undefined) delete process.env.DEMO_AUTH;
    else process.env.DEMO_AUTH = originalDemoAuth;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('denies Tenant-A principal reading /me under Tenant-B selector', async () => {
    const tenantB = nextTenant('me_b');
    authStub.tenantId = nextTenant('me_a');

    const response = await fetch(baseUrl + '/me', {
      headers: {
        authorization: 'Bearer phase-b-test-token',
        'x-tenant-id': tenantB,
      },
    });
    const body = await readBody(response);

    expect({ status: response.status, code: body.code }).toEqual({
      status: 403,
      code: 'TENANT_ACCESS_DENIED',
    });
  });

  it('denies Tenant-A principal reading Tenant-B subscription status', async () => {
    const tenantB = nextTenant('status_b');
    authStub.tenantId = nextTenant('status_a');

    const response = await fetch(baseUrl + '/subscription/status', {
      headers: {
        authorization: 'Bearer phase-b-test-token',
        'x-tenant-id': tenantB,
      },
    });
    const body = await readBody(response);

    expect({ status: response.status, code: body.code }).toEqual({
      status: 403,
      code: 'TENANT_ACCESS_DENIED',
    });
  });

  it('denies cross-tenant subscription write and leaves Tenant-B unchanged', async () => {
    const tenantB = nextTenant('subscribe_b');
    authStub.tenantId = nextTenant('subscribe_a');

    const response = await fetch(baseUrl + '/subscription/subscribe', {
      method: 'POST',
      headers: {
        authorization: 'Bearer phase-b-test-token',
        'content-type': 'application/json',
        'x-tenant-id': tenantB,
      },
      body: JSON.stringify({ planId: 'free' }),
    });
    const body = await readBody(response);
    const tenantBSubscription = await subscriptionCore.getSubscription(tenantB);

    expect({
      status: response.status,
      code: body.code,
      tenantBSubscription,
    }).toEqual({
      status: 403,
      code: 'TENANT_ACCESS_DENIED',
      tenantBSubscription: null,
    });
  });

  it('denies cross-tenant AI use before quota/provider side effects', async () => {
    const tenantB = nextTenant('ai_b');
    authStub.tenantId = nextTenant('ai_a');
    const periodStart = await seedFreeSubscription(tenantB);

    const response = await fetch(baseUrl + '/ai/demo', {
      method: 'POST',
      headers: {
        authorization: 'Bearer phase-b-test-token',
        'content-type': 'application/json',
        'x-tenant-id': tenantB,
      },
      body: JSON.stringify({ prompt: 'must not execute' }),
    });
    const body = await readBody(response);
    const usage = await usageCounterRepository.getUsage(
      tenantB,
      AI_REQUESTS_PER_MONTH,
      periodStart
    );

    expect({
      status: response.status,
      code: body.code,
      usage,
      providerResolved: aiStub.getConfiguredProvider.mock.calls.length,
      providerCalled: aiStub.generateText.mock.calls.length,
    }).toEqual({
      status: 403,
      code: 'TENANT_ACCESS_DENIED',
      usage: 0,
      providerResolved: 0,
      providerCalled: 0,
    });
  });

  it('denies cross-tenant payment use before quota/provider side effects', async () => {
    const tenantB = nextTenant('payment_b');
    authStub.tenantId = nextTenant('payment_a');
    const periodStart = await seedFreeSubscription(tenantB);

    const response = await fetch(baseUrl + '/payment/demo-charge', {
      method: 'POST',
      headers: {
        authorization: 'Bearer phase-b-test-token',
        'content-type': 'application/json',
        'x-tenant-id': tenantB,
      },
      body: JSON.stringify({ amountMinorUnits: 500, currency: 'USD' }),
    });
    const body = await readBody(response);
    const usage = await usageCounterRepository.getUsage(
      tenantB,
      PAYMENTS_PER_MONTH,
      periodStart
    );

    expect({
      status: response.status,
      code: body.code,
      usage,
      paymentCoreResolved: paymentStub.getConfiguredPaymentCore.mock.calls.length,
      paymentCalled: paymentStub.createPayment.mock.calls.length,
    }).toEqual({
      status: 403,
      code: 'TENANT_ACCESS_DENIED',
      usage: 0,
      paymentCoreResolved: 0,
      paymentCalled: 0,
    });
  });

  it('denies concurrent cross-tenant AI requests without a race or side effect', async () => {
    const tenantB = nextTenant('concurrent_b');
    authStub.tenantId = nextTenant('concurrent_a');
    const periodStart = await seedFreeSubscription(tenantB);

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(baseUrl + '/ai/demo', {
          method: 'POST',
          headers: {
            authorization: 'Bearer phase-b-test-token',
            'content-type': 'application/json',
            'x-tenant-id': tenantB,
          },
          body: JSON.stringify({ prompt: 'must not execute concurrently' }),
        })
      )
    );
    const bodies = await Promise.all(responses.map((response) => readBody(response)));
    const usage = await usageCounterRepository.getUsage(
      tenantB,
      AI_REQUESTS_PER_MONTH,
      periodStart
    );

    expect({
      statuses: responses.map((response) => response.status),
      codes: bodies.map((body) => body.code),
      usage,
      providerResolved: aiStub.getConfiguredProvider.mock.calls.length,
      providerCalled: aiStub.generateText.mock.calls.length,
    }).toEqual({
      statuses: Array(8).fill(403),
      codes: Array(8).fill('TENANT_ACCESS_DENIED'),
      usage: 0,
      providerResolved: 0,
      providerCalled: 0,
    });
  });

  it('refuses direct authenticated activation of a paid plan', async () => {
    const tenant = nextTenant('paid_self_escalation');
    authStub.tenantId = tenant;

    const response = await fetch(baseUrl + '/subscription/subscribe', {
      method: 'POST',
      headers: {
        authorization: 'Bearer phase-b-test-token',
        'content-type': 'application/json',
        'x-tenant-id': tenant,
      },
      body: JSON.stringify({ planId: 'pro' }),
    });
    const body = await readBody(response);
    const subscription = await subscriptionCore.getSubscription(tenant);

    expect({
      status: response.status,
      code: body.code,
      subscription,
    }).toEqual({
      status: 403,
      code: 'PAID_PLAN_REQUIRES_BILLING',
      subscription: null,
    });
  });

  it('preserves self-service activation of the free plan for the authenticated tenant', async () => {
    const tenant = nextTenant('free_self_service');
    authStub.tenantId = tenant;

    const response = await fetch(baseUrl + '/subscription/subscribe', {
      method: 'POST',
      headers: {
        authorization: 'Bearer phase-b-test-token',
        'content-type': 'application/json',
        'x-tenant-id': tenant,
      },
      body: JSON.stringify({ planId: 'free' }),
    });
    const body = await readBody(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      accountId: tenant,
      planId: 'free',
      status: 'active',
    });
  });
});
