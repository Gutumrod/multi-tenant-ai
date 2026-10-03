import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const authState = vi.hoisted(() => ({
  tenantId: 'tenant-a' as string | undefined,
  userId: 'user-a',
}));

const providerStub = vi.hoisted(() => ({
  getConfiguredProvider: vi.fn(),
  generateText: vi.fn(),
}));

const paymentStub = vi.hoisted(() => ({
  getConfiguredPaymentCore: vi.fn(),
  createPayment: vi.fn(),
  getStripeAdapter: vi.fn(() => null),
}));

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: authState.userId,
            email: 'tenant-a@example.test',
            role: 'authenticated',
            app_metadata: {
              tenant_id: authState.tenantId,
              roles: ['member'],
              permissions: [],
            },
            user_metadata: {},
          },
        },
        error: null,
      })),
    },
  },
}));

vi.mock('../src/lib/ai.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/ai.js')>();
  return {
    ...actual,
    getConfiguredProvider: providerStub.getConfiguredProvider,
  };
});

vi.mock('../src/lib/payments.js', () => ({
  getConfiguredPaymentCore: paymentStub.getConfiguredPaymentCore,
  getStripeAdapter: paymentStub.getStripeAdapter,
}));

const managedKeys = [
  'DATABASE_URL',
  'DEMO_AUTH',
  'NODE_ENV',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY',
] as const;

const savedEnv = new Map<string, string | undefined>();
for (const key of managedKeys) savedEnv.set(key, process.env[key]);

for (const key of managedKeys) delete process.env[key];
process.env.NODE_ENV = 'test';

let server: Server;
let baseUrl: string;
let subscriptionCore: typeof import('../src/lib/subscriptions.js').subscriptionCore;
let usageCounterRepository: typeof import('../src/lib/subscriptions.js').usageCounterRepository;
let AI_REQUESTS_PER_MONTH: string;
let PAYMENTS_PER_MONTH: string;

let seq = 0;
const nextId = (label: string) => `phase_b_${label}_${Date.now()}_${seq++}`;

async function json(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestAs(params: {
  authTenant: string;
  requestedTenant: string;
  path: string;
  method?: string;
  body?: unknown;
}) {
  authState.tenantId = params.authTenant;
  return fetch(`${baseUrl}${params.path}`, {
    method: params.method ?? 'GET',
    headers: {
      Authorization: 'Bearer test-token',
      'x-tenant-id': params.requestedTenant,
      ...(params.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(params.body === undefined ? {} : { body: JSON.stringify(params.body) }),
  });
}

async function seedFree(accountId: string) {
  await subscriptionCore.createSubscription({ accountId, planId: 'free' });
  const sub = await subscriptionCore.getSubscription(accountId);
  if (!sub) throw new Error('failed to seed subscription');
  return sub;
}

beforeAll(async () => {
  providerStub.generateText.mockResolvedValue({
    success: true,
    text: 'should-not-run-cross-tenant',
    provider: 'stub',
    model: 'stub-model',
  });
  providerStub.getConfiguredProvider.mockImplementation(() => ({
    generateText: providerStub.generateText,
  }));

  paymentStub.createPayment.mockResolvedValue({
    success: true,
    paymentId: 'pay_should_not_run',
    status: 'requires_action',
    amount: 500,
    currency: 'USD',
    provider: 'stub',
  });
  paymentStub.getConfiguredPaymentCore.mockImplementation(() => ({
    createPayment: paymentStub.createPayment,
  }));

  const { createApp } = await import('../src/app.js');
  ({
    subscriptionCore,
    usageCounterRepository,
    AI_REQUESTS_PER_MONTH,
    PAYMENTS_PER_MONTH,
  } = await import('../src/lib/subscriptions.js'));

  const app = createApp();
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  providerStub.getConfiguredProvider.mockClear();
  providerStub.generateText.mockClear();
  paymentStub.getConfiguredPaymentCore.mockClear();
  paymentStub.createPayment.mockClear();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  for (const key of managedKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('Phase B B-HIGH-001: requested tenant must be bound to trusted principal', () => {
  it('GET /me denies Tenant-A principal selecting Tenant-B', async () => {
    const tenantA = nextId('me_a');
    const tenantB = nextId('me_b');
    const response = await requestAs({
      authTenant: tenantA,
      requestedTenant: tenantB,
      path: '/me',
    });
    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('denies a valid principal whose trusted tenant claim is missing', async () => {
    const requestedTenant = nextId('missing_claim_requested');
    authState.tenantId = undefined;

    const response = await fetch(`${baseUrl}/me`, {
      headers: {
        Authorization: 'Bearer test-token',
        'x-tenant-id': requestedTenant,
      },
    });

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('GET /subscription/status denies cross-tenant read', async () => {
    const tenantA = nextId('status_a');
    const tenantB = nextId('status_b');
    await seedFree(tenantB);

    const response = await requestAs({
      authTenant: tenantA,
      requestedTenant: tenantB,
      path: '/subscription/status',
    });
    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
  });

  it('POST /subscription/subscribe denies cross-tenant write and leaves Tenant-B unchanged', async () => {
    const tenantA = nextId('subscribe_a');
    const tenantB = nextId('subscribe_b');

    expect(await subscriptionCore.getSubscription(tenantB)).toBeNull();

    const response = await requestAs({
      authTenant: tenantA,
      requestedTenant: tenantB,
      path: '/subscription/subscribe',
      method: 'POST',
      body: { planId: 'free' },
    });

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    expect(await subscriptionCore.getSubscription(tenantB)).toBeNull();
  });

  it('POST /ai/demo denies before quota/provider side effects', async () => {
    const tenantA = nextId('ai_a');
    const tenantB = nextId('ai_b');
    const sub = await seedFree(tenantB);

    expect(
      await usageCounterRepository.getUsage(
        tenantB,
        AI_REQUESTS_PER_MONTH,
        sub.currentPeriodStart
      )
    ).toBe(0);

    const response = await requestAs({
      authTenant: tenantA,
      requestedTenant: tenantB,
      path: '/ai/demo',
      method: 'POST',
      body: { prompt: 'cross-tenant attempt' },
    });

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    expect(providerStub.getConfiguredProvider).not.toHaveBeenCalled();
    expect(providerStub.generateText).not.toHaveBeenCalled();
    expect(
      await usageCounterRepository.getUsage(
        tenantB,
        AI_REQUESTS_PER_MONTH,
        sub.currentPeriodStart
      )
    ).toBe(0);
  });

  it('POST /payment/demo-charge denies before quota/provider side effects', async () => {
    const tenantA = nextId('payment_a');
    const tenantB = nextId('payment_b');
    const sub = await seedFree(tenantB);

    expect(
      await usageCounterRepository.getUsage(
        tenantB,
        PAYMENTS_PER_MONTH,
        sub.currentPeriodStart
      )
    ).toBe(0);

    const response = await requestAs({
      authTenant: tenantA,
      requestedTenant: tenantB,
      path: '/payment/demo-charge',
      method: 'POST',
      body: { amountMinorUnits: 500, currency: 'USD' },
    });

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    expect(paymentStub.getConfiguredPaymentCore).not.toHaveBeenCalled();
    expect(paymentStub.createPayment).not.toHaveBeenCalled();
    expect(
      await usageCounterRepository.getUsage(
        tenantB,
        PAYMENTS_PER_MONTH,
        sub.currentPeriodStart
      )
    ).toBe(0);
  });

  it('concurrent mismatched requests remain denied', async () => {
    const tenantA = nextId('concurrent_a');
    const tenantB = nextId('concurrent_b');
    await seedFree(tenantB);

    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        requestAs({
          authTenant: tenantA,
          requestedTenant: tenantB,
          path: '/subscription/status',
        })
      )
    );

    expect(responses.map((response) => response.status)).toEqual(
      Array.from({ length: 12 }, () => 403)
    );
    for (const response of responses) {
      expect(await json(response)).toMatchObject({ code: 'TENANT_ACCESS_DENIED' });
    }
  });
});

describe('Phase B B-HIGH-002: normal users cannot self-activate paid entitlement', () => {
  it('denies direct pro activation and creates no subscription', async () => {
    const tenant = nextId('paid_denied');

    const response = await requestAs({
      authTenant: tenant,
      requestedTenant: tenant,
      path: '/subscription/subscribe',
      method: 'POST',
      body: { planId: 'pro' },
    });

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({
      code: 'PAID_PLAN_REQUIRES_TRUSTED_ACTIVATION',
    });
    expect(await subscriptionCore.getSubscription(tenant)).toBeNull();
  });

  it('preserves direct activation for an explicitly free plan', async () => {
    const tenant = nextId('free_allowed');

    const response = await requestAs({
      authTenant: tenant,
      requestedTenant: tenant,
      path: '/subscription/subscribe',
      method: 'POST',
      body: { planId: 'free' },
    });

    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body).toMatchObject({
      accountId: tenant,
      planId: 'free',
      status: 'active',
    });
  });
});
