import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const authStub = vi.hoisted(() => ({
  tenantId: 'phase_b_surface_tenant',
  userId: 'phase_b_surface_user',
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
      metadata: { source: 'phase-b-surface-test' },
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

describe('Phase B HTTP/provider surface negative controls', () => {
  let server: Server;
  let baseUrl: string;
  let subscriptionCore: typeof import('../src/lib/subscriptions.js').subscriptionCore;
  let usageCounterRepository: typeof import('../src/lib/subscriptions.js').usageCounterRepository;
  let AI_REQUESTS_PER_MONTH: string;
  let PAYMENTS_PER_MONTH: string;

  beforeAll(async () => {
    const [{ createApp }, subscriptions] = await Promise.all([
      import('../src/app.js'),
      import('../src/lib/subscriptions.js'),
    ]);

    subscriptionCore = subscriptions.subscriptionCore;
    usageCounterRepository = subscriptions.usageCounterRepository;
    AI_REQUESTS_PER_MONTH = subscriptions.AI_REQUESTS_PER_MONTH;
    PAYMENTS_PER_MONTH = subscriptions.PAYMENTS_PER_MONTH;

    await subscriptionCore.createSubscription({
      accountId: authStub.tenantId,
      planId: 'free',
    });

    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = 'http://127.0.0.1:' + address.port;
  });

  beforeEach(() => {
    aiStub.getConfiguredProvider.mockReset();
    aiStub.generateText.mockReset();
    paymentStub.getConfiguredPaymentCore.mockReset();
    paymentStub.createPayment.mockReset();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );

    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;

    if (originalDemoAuth === undefined) delete process.env.DEMO_AUTH;
    else process.env.DEMO_AUTH = originalDemoAuth;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  const protectedHeaders = () => ({
    authorization: 'Bearer phase-b-surface-token',
    'content-type': 'application/json',
    'x-tenant-id': authStub.tenantId,
  });

  it('sets baseline security headers and does not enable permissive CORS', async () => {
    const response = await fetch(baseUrl + '/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('returns a sanitized JSON error for malformed JSON', async () => {
    const response = await fetch(baseUrl + '/ai/demo', {
      method: 'POST',
      headers: protectedHeaders(),
      body: '{"prompt":',
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(text).toContain('INVALID_JSON');
    expect(text).not.toContain('SyntaxError');
    expect(text).not.toContain('node_modules');
  });

  it('rejects an oversized JSON request with a sanitized 413', async () => {
    const response = await fetch(baseUrl + '/ai/demo', {
      method: 'POST',
      headers: protectedHeaders(),
      body: JSON.stringify({ prompt: 'x'.repeat(70 * 1024) }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(413);
    expect(body.code).toBe('REQUEST_BODY_TOO_LARGE');
  });

  it('rejects an oversized AI prompt before quota/provider side effects', async () => {
    aiStub.getConfiguredProvider.mockReturnValue({ generateText: aiStub.generateText });

    const subscription = await subscriptionCore.getSubscription(authStub.tenantId);
    if (!subscription) throw new Error('missing test subscription');

    const usageBefore = await usageCounterRepository.getUsage(
      authStub.tenantId,
      AI_REQUESTS_PER_MONTH,
      subscription.currentPeriodStart
    );

    const response = await fetch(baseUrl + '/ai/demo', {
      method: 'POST',
      headers: protectedHeaders(),
      body: JSON.stringify({ prompt: 'p'.repeat(33_000) }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    const usageAfter = await usageCounterRepository.getUsage(
      authStub.tenantId,
      AI_REQUESTS_PER_MONTH,
      subscription.currentPeriodStart
    );

    expect(response.status).toBe(413);
    expect(body.code).toBe('PROMPT_TOO_LARGE');
    expect(usageAfter).toBe(usageBefore);
    expect(aiStub.getConfiguredProvider).not.toHaveBeenCalled();
    expect(aiStub.generateText).not.toHaveBeenCalled();
  });

  it('does not leak thrown AI provider errors and releases quota', async () => {
    const secret = 'sk-phase-b-should-never-leak';
    aiStub.generateText.mockRejectedValue(new Error('provider exploded with ' + secret));
    aiStub.getConfiguredProvider.mockReturnValue({ generateText: aiStub.generateText });

    const subscription = await subscriptionCore.getSubscription(authStub.tenantId);
    if (!subscription) throw new Error('missing test subscription');
    const usageBefore = await usageCounterRepository.getUsage(
      authStub.tenantId,
      AI_REQUESTS_PER_MONTH,
      subscription.currentPeriodStart
    );

    const response = await fetch(baseUrl + '/ai/demo', {
      method: 'POST',
      headers: protectedHeaders(),
      body: JSON.stringify({ prompt: 'safe prompt' }),
    });
    const text = await response.text();

    const usageAfter = await usageCounterRepository.getUsage(
      authStub.tenantId,
      AI_REQUESTS_PER_MONTH,
      subscription.currentPeriodStart
    );

    expect(response.status).toBe(502);
    expect(text).toContain('AI_PROVIDER_REQUEST_FAILED');
    expect(text).not.toContain(secret);
    expect(usageAfter).toBe(usageBefore);
  });

  it('does not leak structured AI provider failure details', async () => {
    const secret = 'anthropic-secret-detail-should-not-leak';
    aiStub.generateText.mockResolvedValue({
      success: false,
      provider: 'stub',
      model: 'stub-model',
      error: { code: 'NETWORK_ERROR', message: secret },
    });
    aiStub.getConfiguredProvider.mockReturnValue({ generateText: aiStub.generateText });

    const response = await fetch(baseUrl + '/ai/demo', {
      method: 'POST',
      headers: protectedHeaders(),
      body: JSON.stringify({ prompt: 'safe prompt' }),
    });
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).toContain('AI_PROVIDER_REQUEST_FAILED');
    expect(text).not.toContain(secret);
  });

  it('does not leak payment provider exceptions and releases quota', async () => {
    const secret = 'stripe-secret-detail-should-not-leak';
    paymentStub.createPayment.mockRejectedValue(new Error('stripe exploded ' + secret));
    paymentStub.getConfiguredPaymentCore.mockReturnValue({
      createPayment: paymentStub.createPayment,
    });

    const subscription = await subscriptionCore.getSubscription(authStub.tenantId);
    if (!subscription) throw new Error('missing test subscription');
    const usageBefore = await usageCounterRepository.getUsage(
      authStub.tenantId,
      PAYMENTS_PER_MONTH,
      subscription.currentPeriodStart
    );

    const response = await fetch(baseUrl + '/payment/demo-charge', {
      method: 'POST',
      headers: protectedHeaders(),
      body: JSON.stringify({ amountMinorUnits: 500, currency: 'USD' }),
    });
    const text = await response.text();

    const usageAfter = await usageCounterRepository.getUsage(
      authStub.tenantId,
      PAYMENTS_PER_MONTH,
      subscription.currentPeriodStart
    );

    expect(response.status).toBe(502);
    expect(text).toContain('PAYMENT_PROVIDER_REQUEST_FAILED');
    expect(text).not.toContain(secret);
    expect(usageAfter).toBe(usageBefore);
  });
});
