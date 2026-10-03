import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getPgPool } from '../src/lib/persistence/pg.js';
import { subscriptionCore } from '../src/lib/subscriptions.js';

const SECRET = 'whsec_multi_tenant_test_secret';

// The two billing-event ids this file posts are FIXED (they name the scenario,
// not the run), while the account ids carry a timestamp and are therefore unique
// per run. All of them are identifiers THIS FILE writes; the teardown below
// removes exactly those rows again so the suite can be run repeatedly against
// the same database. The ledger's event_id is its primary key, so a fixed event
// id left behind by an earlier run of this same file is what makes a second run
// fail (`evt_apply_1` already claimed -> that delivery is deduped -> the
// subscription never reaches `cancelled`).
const APPLY_EVENT_ID = 'evt_apply_1';
const REPLAY_EVENT_ID = 'evt_replay_1';
const FIXED_EVENT_IDS = [APPLY_EVENT_ID, REPLAY_EVENT_ID];

/** Account ids created by this run, so teardown deletes exactly those rows. */
const createdAccountIds = new Set<string>();

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

/**
 * A per-run account id. The timestamp and suffix keep it unique between runs of
 * this file; the id is recorded so teardown deletes exactly the rows this run
 * created.
 */
function newAccountId(prefix: string): string {
  const accountId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  createdAccountIds.add(accountId);
  return accountId;
}

/**
 * Removes the rows this file created: the subscriptions for the account ids it
 * generated, and the two ledger entries it claimed under its fixed event ids.
 * Scoped to those identifiers only — no table is truncated (the identifiers are
 * the only rows this file could have overwritten), and no row this file did not
 * create is touched. Never throws: a cleanup failure must not turn a passing
 * behavioural run into a failure, so it reports and continues.
 */
async function cleanupOwnRows(): Promise<void> {
  const pool = getPgPool();
  if (!pool) return; // Hermetic run: nothing was written, nothing to remove.

  const accountIds = [...createdAccountIds];
  try {
    if (accountIds.length > 0) {
      await pool.query('DELETE FROM billing_event_ledger WHERE account_id = ANY($1::text[])', [
        accountIds,
      ]);
      await pool.query('DELETE FROM subscriptions WHERE account_id = ANY($1::text[])', [accountIds]);
    }
    await pool.query('DELETE FROM billing_event_ledger WHERE event_id = ANY($1::text[])', [
      FIXED_EVENT_IDS,
    ]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[webhook.test] row cleanup failed: ${message}`);
  }
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
    // Delete the rows this run wrote so the suite is repeatable against the same
    // database. See cleanupOwnRows above for exactly what is removed.
    await cleanupOwnRows();
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

  it('rejects a correctly signed but stale webhook timestamp (401)', async () => {
    const body = makeEvent('evt_stale', 'invoice.paid', 'acct_stale');
    const stale = Math.floor(Date.now() / 1000) - 601;
    const res = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': stripeSignature(body, stale),
      },
      body,
    });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ code: 'WEBHOOK_EXPIRED_TIMESTAMP' });
  });

  it('rejects a correctly signed malformed JSON webhook without leaking parser detail', async () => {
    const body = '{not-json';
    const now = Math.floor(Date.now() / 1000);
    const res = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': stripeSignature(body, now),
      },
      body,
    });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Webhook signature verification failed',
      code: 'WEBHOOK_MALFORMED_JSON',
    });
  });

  it('rejects an oversized webhook body with a sanitized 413', async () => {
    const body = JSON.stringify({ id: 'evt_big', type: 'invoice.paid', pad: 'x'.repeat(300 * 1024) });
    const now = Math.floor(Date.now() / 1000);
    const res = await fetch(`${baseUrl}/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': stripeSignature(body, now),
      },
      body,
    });
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toMatchObject({ code: 'REQUEST_BODY_TOO_LARGE' });
  });

  it('applies a verified payment event to subscription state', async () => {
    const accountId = newAccountId('acct_apply');
    // Seed a subscription via the core directly (HTTP subscribe is auth-gated
    // and the test env has no auth configured). createSubscription starts active.
    await subscriptionCore.createSubscription({ accountId, planId: 'pro' });
    let sub = await subscriptionCore.getSubscription(accountId);
    expect(sub?.status).toBe('active');

    // Fire a cancellation event with a valid signature.
    const now = Math.floor(Date.now() / 1000);
    const body = makeEvent(APPLY_EVENT_ID, 'customer.subscription.deleted', accountId);
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
    const accountId = newAccountId('acct_replay');
    await subscriptionCore.createSubscription({ accountId, planId: 'pro' });

    const now = Math.floor(Date.now() / 1000);
    const body = makeEvent(REPLAY_EVENT_ID, 'invoice.paid', accountId);

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
