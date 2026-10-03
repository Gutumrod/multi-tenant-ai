import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getConfiguredPaymentCore, getStripeAdapter } from '../lib/payments.js';
import { quotaGate, quotaRefusalResponse } from '../lib/quota.js';
import { subscriptionCore, PAYMENTS_PER_MONTH } from '../lib/subscriptions.js';
import { PaymentError } from '../../../modules/payment/core/error.js';
import { createWebhookReceiver } from '../../../modules/webhook-receiver/core/index.js';
import type { IdempotencyStore } from '../../../modules/webhook-receiver/core/types.js';
import { StripeWebhookVerifier } from '../../../modules/webhook-receiver/providers/stripe/index.js';
import type { SubscriptionBillingEvent } from '../../../modules/subscription/core/types.js';

// In-memory idempotency store: dedupes replayed webhook events by event id so a
// verified event is applied to subscription state at most once. (Persistent
// store would be required for multi-instance deployments.)
const processedEvents = new Set<string>();

const idempotencyStore: IdempotencyStore = {
  async has(key: string): Promise<boolean> {
    return processedEvents.has(key);
  },
  async set(key: string): Promise<void> {
    processedEvents.add(key);
  },
};

function getWebhookReceiver() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return null;
  }
  return createWebhookReceiver({
    verifier: new StripeWebhookVerifier({ secret }),
    idempotencyStore,
  });
}

// Map a verified Stripe webhook event into a SubscriptionBillingEvent and apply
// it to subscription state. accountId comes from the tenant-scoped metadata set
// on the Stripe checkout/customer object (client_reference_id or metadata).
function mapStripeEventToBilling(payload: unknown): SubscriptionBillingEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const event = payload as Record<string, any>;
  const type: string = event.type || '';
  const obj: Record<string, any> = event.data?.object || {};

  const accountId: string | undefined =
    obj.metadata?.account_id ||
    obj.metadata?.tenantId ||
    event.client_reference_id ||
    obj.client_reference_id ||
    obj.metadata?.shop_id;

  if (!accountId) return null;

  let eventType: SubscriptionBillingEvent['eventType'] | null = null;
  switch (type) {
    case 'customer.subscription.created':
    case 'checkout.session.completed':
      eventType = 'subscription.started';
      break;
    case 'invoice.paid':
      eventType = 'subscription.renewed';
      break;
    case 'invoice.payment_failed':
      eventType = 'subscription.payment_failed';
      break;
    case 'customer.subscription.deleted':
      eventType = 'subscription.cancelled';
      break;
    case 'customer.subscription.updated':
      eventType = 'subscription.renewed';
      break;
    default:
      return null;
  }

  const currentPeriodEnd = obj.current_period_end
    ? new Date(obj.current_period_end * 1000)
    : undefined;

  return {
    eventType,
    accountId,
    planId: obj.plan?.id,
    currentPeriodEnd,
    eventId: event.id,
    rawEvent: payload,
  };
}

export const demoChargeHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { amountMinorUnits, currency } = req.body || {};

  if (
    typeof amountMinorUnits !== 'number' ||
    !Number.isInteger(amountMinorUnits) ||
    amountMinorUnits <= 0
  ) {
    res.status(400).json({
      error: 'Missing or invalid amountMinorUnits (must be a positive integer in minor units, e.g. cents)',
    });
    return;
  }

  if (!currency || typeof currency !== 'string' || currency.trim().length !== 3) {
    res.status(400).json({
      error: 'Missing or invalid currency (must be a 3-letter ISO code, e.g. USD)',
    });
    return;
  }

  const accountId = req.tenantContext?.tenantId;
  if (!accountId) {
    res.status(400).json({ error: 'Missing tenant context' });
    return;
  }

  // Quota gate: creating a Stripe payment is a paid resource (an outbound
  // Stripe API call), so the entitlement is checked and the unit consumed
  // BEFORE the payment core is resolved or used.
  const featureKey = PAYMENTS_PER_MONTH;
  const quota = await quotaGate.assertAndConsumeQuota({ accountId, featureKey });
  if (!quota.allowed) {
    const refusal = quotaRefusalResponse(quota);
    res.status(refusal.status).json(refusal.body);
    return;
  }

  const paymentCore = getConfiguredPaymentCore();
  if (!paymentCore) {
    // Nothing was sent to Stripe, so give the consumed unit back.
    await quotaGate.releaseQuota({ accountId, featureKey });
    res.status(503).json({
      error:
        'No payment provider configured on this server instance (set STRIPE_SECRET_KEY)',
    });
    return;
  }

  const idempotencyKey = crypto.randomUUID();
  const referenceId = `demo_charge_${crypto.randomUUID()}`;
  const tenantId = req.tenantContext?.tenantId;

  /**
   * The Stripe call itself failed (thrown, or a non-success result): release the
   * consumed unit so an error never burns the payments quota. Returns the
   * refusal-adjusted payload fields the caller merges into its response.
   */
  const releaseConsumed = async (): Promise<{ usage: number; limit: number | null }> => {
    const usage = await quotaGate.releaseQuota({ accountId, featureKey });
    return { usage, limit: quota.limit };
  };

  try {
    const result = await paymentCore.createPayment({
      amount: amountMinorUnits,
      currency: currency.trim().toUpperCase(),
      referenceId,
      idempotencyKey,
      description: 'Multi-tenant AI demo charge',
      metadata: tenantId ? { tenantId } : undefined,
    });

    if (!result.success) {
      const released = await releaseConsumed();
      const err = result.error;
      const status =
        err?.status ||
        (err?.code === 'INVALID_AMOUNT' ||
        err?.code === 'UNSUPPORTED_CURRENCY' ||
        err?.code === 'MISSING_IDEMPOTENCY_KEY'
          ? 400
          : 502);
      res.status(status).json({
        error: status >= 500 ? 'Payment processing failed' : (err?.message || 'Payment request rejected'),
        code: err?.code,
        provider: err?.provider,
        ...released,
      });
      return;
    }

    res.json({ ...result, usage: quota.usage, limit: quota.limit });
  } catch (error: unknown) {
    const released = await releaseConsumed();
    if (error instanceof PaymentError) {
      const status = error.status || 400;
      res.status(status).json({
        error: status >= 500 ? 'Payment processing failed' : error.message,
        code: error.code,
        provider: error.provider,
        ...released,
      });
      return;
    }
    res.status(502).json({
      error: 'Payment provider request failed',
      code: 'PAYMENT_PROVIDER_REQUEST_FAILED',
      ...released,
    });
  }
};

export const paymentWebhookHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const stripeAdapter = getStripeAdapter();
  if (!stripeAdapter) {
    res.status(503).json({
      error:
        'Stripe adapter not configured on this server instance (set STRIPE_SECRET_KEY)',
    });
    return;
  }

  const receiver = getWebhookReceiver();
  if (!receiver) {
    res.status(503).json({
      error:
        'Stripe webhook secret not configured on this server instance (set STRIPE_WEBHOOK_SECRET)',
    });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf-8')
    : typeof req.body === 'string'
      ? req.body
      : '';

  const result = await receiver.verify({
    rawBody,
    headers: req.headers,
  });

  if (!result.valid) {
    // A replayed event (same event id already processed) is NOT a signature
    // failure. Stripe expects a 2xx for duplicates ("received, stop resending");
    // returning 401 would make Stripe retry forever and eventually auto-disable
    // the endpoint. We still do NOT re-apply the event (idempotency store
    // already deduped it) — only the status code differs.
    if (result.error?.code === 'WEBHOOK_REPLAY_DETECTED') {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    res.status(401).json({
      error: 'Webhook signature verification failed',
      code: result.error?.code,
    });
    return;
  }

  try {
    const parseResult = stripeAdapter.parsePaymentEvent(result.payload);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Failed to parse webhook event',
        code: parseResult.error?.code,
      });
      return;
    }

    // Apply the verified, mapped event to subscription state. This is the step
    // that was previously missing: a verified webhook event now actually moves
    // the subscription (trial -> paid, cancellation, etc.) via handleBillingEvent.
    const billingEvent = mapStripeEventToBilling(result.payload);
    if (billingEvent) {
      await subscriptionCore.handleBillingEvent(billingEvent);
    }

    res.status(200).json({ received: true });
  } catch (_error: unknown) {
    res.status(400).json({
      error: 'Webhook event could not be processed',
      code: 'WEBHOOK_PROCESSING_FAILED',
    });
  }
};

