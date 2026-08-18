import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getConfiguredPaymentCore, getStripeAdapter } from '../lib/payments.js';
import { PaymentError } from '../../../modules/payment/core/error.js';

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

  const paymentCore = getConfiguredPaymentCore();
  if (!paymentCore) {
    res.status(503).json({
      error:
        'No payment provider configured on this server instance (set STRIPE_SECRET_KEY)',
    });
    return;
  }

  const idempotencyKey = crypto.randomUUID();
  const referenceId = `demo_charge_${crypto.randomUUID()}`;
  const tenantId = req.tenantContext?.tenantId;

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
      const err = result.error;
      const status =
        err?.status ||
        (err?.code === 'INVALID_AMOUNT' ||
        err?.code === 'UNSUPPORTED_CURRENCY' ||
        err?.code === 'MISSING_IDEMPOTENCY_KEY'
          ? 400
          : 502);
      res.status(status).json({
        error: err?.message || 'Payment processing failed',
        code: err?.code,
        provider: err?.provider,
      });
      return;
    }

    res.json(result);
  } catch (error: unknown) {
    if (error instanceof PaymentError) {
      res.status(error.status || 400).json({
        error: error.message,
        code: error.code,
        provider: error.provider,
      });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: message });
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

  let rawPayload: unknown = req.body;

  if (Buffer.isBuffer(rawPayload)) {
    try {
      rawPayload = JSON.parse(rawPayload.toString('utf-8'));
    } catch {
      res.status(400).json({ error: 'Invalid JSON body in webhook payload' });
      return;
    }
  } else if (typeof rawPayload === 'string') {
    try {
      rawPayload = JSON.parse(rawPayload);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body in webhook payload' });
      return;
    }
  }

  try {
    const parseResult = stripeAdapter.parsePaymentEvent(rawPayload);
    if (!parseResult.success) {
      res.status(400).json({
        error: parseResult.error?.message || 'Failed to parse webhook event',
        code: parseResult.error?.code,
      });
      return;
    }

    res.status(200).json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
};
