import {
  createStripeAdapter,
  type StripeAdapterExtensions,
} from '../../../modules/payment/adapters/stripe-adapter.js';
import {
  createPaymentCore,
  type PaymentCore,
} from '../../../modules/payment/core/service.js';
import type { PaymentProvider } from '../../../modules/payment/core/types.js';

export type StripePaymentAdapter = PaymentProvider & StripeAdapterExtensions;

export function getStripeAdapter(): StripePaymentAdapter | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }
  return createStripeAdapter({
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  });
}

export function getConfiguredPaymentCore(): PaymentCore | null {
  const adapter = getStripeAdapter();
  if (!adapter) {
    return null;
  }
  return createPaymentCore({}, adapter);
}
