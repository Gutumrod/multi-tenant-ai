import { createSupabasePersistenceClient, type PersistenceEnvironment } from './client.js';
import { createSupabasePlanRepository, createSupabaseSubscriptionRepository } from './repositories.js';
import { createSupabaseTenancyRepository } from './tenancy.js';
import { createSupabaseIdempotencyStore } from './idempotency.js';
import { createSupabaseWebhookEventRepository } from './webhook-events.js';

export function createSupabasePersistence(
  env: PersistenceEnvironment = process.env
) {
  const client = createSupabasePersistenceClient(env);
  if (!client) return null;

  return Object.freeze({
    client,
    plans: createSupabasePlanRepository(client),
    subscriptions: createSupabaseSubscriptionRepository(client),
    tenancy: createSupabaseTenancyRepository(client),
    webhookIdempotency: createSupabaseIdempotencyStore(client, 'stripe-webhook'),
    webhookEvents: createSupabaseWebhookEventRepository(client),
  });
}

export * from './client.js';
export * from './errors.js';
export * from './idempotency.js';
export * from './repositories.js';
export * from './tenancy.js';
export * from './webhook-events.js';
