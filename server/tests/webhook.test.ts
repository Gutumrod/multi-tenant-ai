import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { subscriptionCore } from '../src/lib/subscriptions.js';

const SECRET = 'whsec_multi_tenant_test_secret';

function stripeSignature(body: string, timestamp: number): string {
  const signed = `${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', SECRET).update(signed).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function makeEvent(id: string, type: string, accountId: string): string {
  return JSON.stringify({
    id,
    type,
    data: {
      object: {
        id: `sub_${id}`,
        metadata: { account_id: accountId },
        current_period_end: Math.floor(Date.now() / 1000) + 2592000, // +30d
        plan: { id: 'pro' },
      },
    },
  });
}

describe('stripe webhook -> subscription state (multi-tenant-ai)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    // paymentWebhookHandler calls getStripeAdapter() up-front and returns 503 if
    // STRIPE_SECRET_KEY is unset. Verification itself uses the webhook-receiver
    // (STRIPE_WEBHOOK_SECRET), so a placeholder secret is enough here.
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_for_webhook_test';
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('rejects a webhook with no signature header (401)', async () => {
    const res = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: makeEvent('evt_no_sig', 'invoice.paid', 'acct_no_sig'),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a webhook with a wrong signature (401)', async () => {
    const body = makeEvent('evt_bad_sig', 'invoice.paid', 'acct_bad');
    const res = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`,
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  it('applies a verified payment event to subscription state', async () => {
    const accountId = `acct_apply_${Date.now()}`;
    // Seed a subscription via the core directly (HTTP subscribe is auth-gated
    // and the test env has no auth configured). createSubscription starts active.
    await subscriptionCore.createSubscription({ accountId, planId: 'pro' });
    let sub = await subscriptionCore.getSubscription(accountId);
    expect(sub?.status).toBe('active');

    // Fire a cancellation event with a valid signature.
    const now = Math.floor(Date.now() / 1000);
    const body = makeEvent('evt_apply_1', 'customer.subscription.deleted', accountId);
    const res = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': stripeSignature(body, now),
      },
      body,
    });
    expect(res.status).toBe(200);

    sub = await subscriptionCore.getSubscription(accountId);
    expect(sub?.status).toBe('cancelled');
  });

  it('does not re-apply a replayed event (idempotency)', async () => {
    const accountId = `acct_replay_${Date.now()}`;
    await subscriptionCore.createSubscription({ accountId, planId: 'pro' });

    const now = Math.floor(Date.now() / 1000);
    const body = makeEvent('evt_replay_1', 'invoice.paid', accountId);

    // First delivery: valid signature, applies state (active -> renewed keeps active).
    const first = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': stripeSignature(body, now),
      },
      body,
    });
    expect(first.status).toBe(200);

    // Replay the SAME event id: idempotency store dedupes it. Stripe expects a
    // 2xx for duplicates (not 401, which would trigger endless retries), but the
    // event must NOT be re-applied to subscription state.
    const replay = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': stripeSignature(body, now),
      },
      body,
    });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ received: true, duplicate: true });

    // State must be unchanged by the replay (no double-apply).
    const sub = await subscriptionCore.getSubscription(accountId);
    expect(sub?.status).toBe('active');
  });
});
