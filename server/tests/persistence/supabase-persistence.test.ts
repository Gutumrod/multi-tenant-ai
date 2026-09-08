import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/persistence/supabase/database.types.js';
import type { Mt01SupabaseClient } from '../../src/persistence/supabase/client.js';
import { createSupabasePersistenceClient } from '../../src/persistence/supabase/client.js';
import { PersistenceError, toPersistenceError } from '../../src/persistence/supabase/errors.js';
import { createSupabaseIdempotencyStore } from '../../src/persistence/supabase/idempotency.js';
import { planFromRow, subscriptionFromRow } from '../../src/persistence/supabase/mappers.js';
import { createSupabaseWebhookEventRepository } from '../../src/persistence/supabase/webhook-events.js';

type PlanRow = Database['mt01']['Tables']['plans']['Row'];
type SubscriptionRow = Database['mt01']['Tables']['subscriptions']['Row'];

describe('MT-MP-02 persistence security boundary', () => {
  it('does not create a privileged client without a server secret', () => {
    const client = createSupabasePersistenceClient({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    });
    expect(client).toBeNull();
  });

  it('rejects a publishable key supplied in the secret-key slot', () => {
    expect(() => createSupabasePersistenceClient({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_publishable_not-a-server-secret',
    })).toThrowError(PersistenceError);
  });

  it('does not expose raw database error text in the public error message', () => {
    const raw = { code: '23505', message: 'secret table details should stay internal' };
    const error = toPersistenceError('claim webhook', raw);
    expect(error.code).toBe('PERSISTENCE_DUPLICATE_CLAIM');
    expect(error.message).not.toContain(raw.message);
    expect(error.cause).toBe(raw);
  });
});

describe('database row mapping', () => {
  const planRow: PlanRow = {
    id: 'pro',
    name: 'Pro',
    billing_interval: 'month',
    price_minor_units: 2900,
    currency: 'USD',
    entitlements: { ai_requests_per_month: 1000 },
    active: true,
    created_at: '2026-09-08T00:00:00.000Z',
    updated_at: '2026-09-08T00:00:00.000Z',
  };

  it('maps a valid persisted plan into the subscription module contract', () => {
    expect(planFromRow(planRow)).toEqual({
      id: 'pro',
      name: 'Pro',
      billingInterval: 'month',
      priceMinorUnits: 2900,
      currency: 'USD',
      entitlements: { ai_requests_per_month: 1000 },
    });
  });

  it('fails closed on nested entitlement values outside the module contract', () => {
    expect(() => planFromRow({
      ...planRow,
      entitlements: { unsafe: { nested: true } },
    })).toThrowError(PersistenceError);
  });

  const subscriptionRow: SubscriptionRow = {
    id: 'sub_test',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    plan_id: 'pro',
    status: 'active',
    current_period_start: '2026-09-01T00:00:00.000Z',
    current_period_end: '2026-10-01T00:00:00.000Z',
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    metadata: { source: 'test' },
    last_processed_event_id: null,
    provider: null,
    provider_customer_id: null,
    provider_subscription_id: null,
    created_at: '2026-09-08T00:00:00.000Z',
    updated_at: '2026-09-08T00:00:00.000Z',
  };

  it('maps a valid persisted subscription into the existing module contract', () => {
    const mapped = subscriptionFromRow(subscriptionRow);
    expect(mapped.accountId).toBe(subscriptionRow.tenant_id);
    expect(mapped.status).toBe('active');
    expect(mapped.currentPeriodStart.toISOString()).toBe(subscriptionRow.current_period_start);
    expect(mapped.metadata).toEqual({ source: 'test' });
  });

  it('fails closed when the database contains an unknown subscription status', () => {
    expect(() => subscriptionFromRow({
      ...subscriptionRow,
      status: 'not-a-real-status',
    })).toThrowError(PersistenceError);
  });
});

describe('atomic persistence adapters', () => {
  it('calls the database atomic idempotency claim RPC instead of has/set', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      async rpc(name: string, args: unknown) {
        calls.push({ name, args });
        return { data: true, error: null };
      },
    } as unknown as Mt01SupabaseClient;

    const store = createSupabaseIdempotencyStore(client, 'stripe-webhook');
    await expect(store.claim('evt_123', 300)).resolves.toBe(true);
    expect(calls).toEqual([{
      name: 'claim_idempotency_key',
      args: {
        p_scope: 'stripe-webhook',
        p_key: 'evt_123',
        p_ttl_seconds: 300,
      },
    }]);
  });

  it('returns false when the database reports a webhook event was already claimed', async () => {
    const client = {
      async rpc(name: string) {
        expect(name).toBe('claim_webhook_event');
        return { data: false, error: null };
      },
    } as unknown as Mt01SupabaseClient;

    const repo = createSupabaseWebhookEventRepository(client);
    await expect(repo.claim({ provider: 'stripe', eventId: 'evt_dup' })).resolves.toBe(false);
  });
});
