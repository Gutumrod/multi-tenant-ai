import { describe, it, expect, vi } from 'vitest';
import { createStripeAdapter } from '../../adapters/stripe-adapter.js';
import { PaymentError } from '../../core/error.js';

/**
 * WU-1 correctness regression tests.
 *
 * Checkout mode is the default payment flow (`useCheckoutSession ?? true`), so
 * `createPayment` returns a Checkout Session id (`cs_...`). Stripe's refund API
 * requires a PaymentIntent id (`pi_...`). `refundPayment` must therefore resolve
 * the session to its payment_intent before calling `/refunds`, and must fail
 * closed (clear error, no `/refunds` call) when it cannot.
 */
type CapturedCall = { url: string; method: string; body?: string };

function bodyOf(call: CapturedCall): string {
  return decodeURIComponent(call.body || '');
}

function makeFetchStub(
  routes: Array<{ label: string; method: string; path: string; status?: number; json: unknown }>
) {
  const calls: CapturedCall[] = [];
  const fetchImpl = vi.fn(async (url: string, init: any) => {
    const target = String(url);
    const method = (init?.method as string) || 'GET';
    calls.push({ url: target, method, body: init?.body });
    const route = routes.find((r) => r.method === method && target.endsWith(r.path));
    if (!route) {
      throw new Error(`unexpected Stripe request: ${method} ${target}`);
    }
    const status = route.status ?? 200;
    return {
      ok: status < 400,
      status,
      json: async () => route.json,
    } as unknown as Response;
  });
  // Structural cast: the adapter only calls fetch(url, init) and reads response.ok/status/json.
  const fetchStub = fetchImpl as unknown as typeof globalThis.fetch;
  return { fetchStub, calls };
}

describe('stripe adapter — refund of a checkout session resolves payment_intent first', () => {
  it('resolves cs_ session id to pi_ id before calling /refunds', async () => {
    const { fetchStub, calls } = makeFetchStub([
      {
        label: 'session lookup',
        method: 'GET',
        path: '/checkout/sessions/cs_test_1',
        json: {
          id: 'cs_test_1',
          object: 'checkout.session',
          status: 'complete',
          payment_status: 'paid',
          payment_intent: 'pi_test_1',
          amount_total: 20000,
          currency: 'usd',
        },
      },
      {
        label: 'refund',
        method: 'POST',
        path: '/refunds',
        json: { id: 're_test_1', amount: 20000, currency: 'usd' },
      },
    ]);

    const adapter = createStripeAdapter({ secretKey: 'sk_test_mock', fetch: fetchStub });
    const result = await adapter.refundPayment({
      paymentId: 'cs_test_1',
      idempotencyKey: 'idem-refund-1',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('refunded');

    // 1) session must be looked up first
    expect(calls[0]).toMatchObject({ method: 'GET' });
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions/cs_test_1');

    // 2) the refund call must carry the PaymentIntent id, never the cs_ id
    const refundCall = calls[1];
    expect(refundCall.method).toBe('POST');
    expect(refundCall.url).toBe('https://api.stripe.com/v1/refunds');
    expect(bodyOf(refundCall)).toContain('payment_intent=pi_test_1');
    expect(bodyOf(refundCall)).not.toContain('cs_test_1');
    expect(calls).toHaveLength(2);
  });

  it('fails closed when a checkout session has no payment_intent (no /refunds call)', async () => {
    const { fetchStub, calls } = makeFetchStub([
      {
        label: 'session lookup',
        method: 'GET',
        path: '/checkout/sessions/cs_test_2',
        json: {
          id: 'cs_test_2',
          object: 'checkout.session',
          status: 'open',
          payment_status: 'unpaid',
          payment_intent: null,
          amount_total: 5000,
          currency: 'usd',
        },
      },
    ]);

    const adapter = createStripeAdapter({ secretKey: 'sk_test_mock', fetch: fetchStub });

    await expect(
      adapter.refundPayment({ paymentId: 'cs_test_2', idempotencyKey: 'idem-refund-2' })
    ).rejects.toThrow(PaymentError);

    const refundAttempts = calls.filter((c) => c.url.endsWith('/refunds'));
    expect(refundAttempts).toHaveLength(0);
    expect(calls).toHaveLength(1);
  });

  it('rejects an unresolvable session (Stripe 404) without ever calling /refunds', async () => {
    const { fetchStub, calls } = makeFetchStub([
      {
        label: 'session lookup missing',
        method: 'GET',
        path: '/checkout/sessions/cs_test_missing',
        status: 404,
        json: { error: { code: 'resource_missing', message: 'No such checkout session' } },
      },
    ]);

    const adapter = createStripeAdapter({ secretKey: 'sk_test_mock', fetch: fetchStub });

    await expect(
      adapter.refundPayment({ paymentId: 'cs_test_missing', idempotencyKey: 'idem-refund-3' })
    ).rejects.toThrow(PaymentError);

    expect(calls.filter((c) => c.url.endsWith('/refunds'))).toHaveLength(0);
  });

  it('still refunds directly when the caller already passes a payment_intent id (no regression)', async () => {
    const { fetchStub, calls } = makeFetchStub([
      {
        label: 'refund',
        method: 'POST',
        path: '/refunds',
        json: { id: 're_test_2', amount: 15000, currency: 'thb' },
      },
    ]);

    const adapter = createStripeAdapter({ secretKey: 'sk_test_mock', fetch: fetchStub });
    const result = await adapter.refundPayment({
      paymentId: 'pi_test_9',
      idempotencyKey: 'idem-refund-4',
      amount: 15000,
    });

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(bodyOf(calls[0])).toContain('payment_intent=pi_test_9');
    expect(bodyOf(calls[0])).toContain('amount=15000');
  });
});
