import type { Plan, Subscription, SubscriptionStatus } from '../../../../modules/subscription/core/types.js';
import type { Database, Json } from './database.types.js';
import { PersistenceError } from './errors.js';

type PlanRow = Database['mt01']['Tables']['plans']['Row'];
type SubscriptionRow = Database['mt01']['Tables']['subscriptions']['Row'];

const subscriptionStatuses = new Set<SubscriptionStatus>([
  'trialing', 'active', 'past_due', 'grace_period',
  'cancel_at_period_end', 'cancelled', 'expired',
]);

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PersistenceError('PERSISTENCE_INVALID_DATA', `Invalid persisted ${field}`);
  }
  return date;
}

function primitiveEntitlements(value: Json): Record<string, boolean | number | string | null> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new PersistenceError('PERSISTENCE_INVALID_DATA', 'Persisted plan entitlements must be an object');
  }
  const result: Record<string, boolean | number | string | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== null && !['boolean', 'number', 'string'].includes(typeof entry)) {
      throw new PersistenceError('PERSISTENCE_INVALID_DATA', `Unsupported entitlement value for ${key}`);
    }
    result[key] = entry as boolean | number | string | null;
  }
  return result;
}

function stringMetadata(value: Json): Record<string, string> | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
  const entries = Object.entries(value);
  if (entries.length === 0) return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (typeof entry !== 'string') {
      throw new PersistenceError('PERSISTENCE_INVALID_DATA', `Subscription metadata ${key} must be a string`);
    }
    result[key] = entry;
  }
  return result;
}

export function planFromRow(row: PlanRow): Plan {
  if (row.billing_interval !== null && row.billing_interval !== 'month' && row.billing_interval !== 'year') {
    throw new PersistenceError('PERSISTENCE_INVALID_DATA', 'Persisted billing interval is invalid');
  }

  return {
    id: row.id,
    name: row.name,
    billingInterval: row.billing_interval ?? undefined,
    priceMinorUnits: row.price_minor_units ?? undefined,
    currency: row.currency ?? undefined,
    entitlements: primitiveEntitlements(row.entitlements),
  };
}

export function subscriptionFromRow(row: SubscriptionRow): Subscription {
  if (!subscriptionStatuses.has(row.status as SubscriptionStatus)) {
    throw new PersistenceError('PERSISTENCE_INVALID_DATA', 'Persisted subscription status is invalid');
  }

  return {
    id: row.id,
    accountId: row.tenant_id,
    planId: row.plan_id,
    status: row.status as SubscriptionStatus,
    currentPeriodStart: parseDate(row.current_period_start, 'current_period_start'),
    currentPeriodEnd: parseDate(row.current_period_end, 'current_period_end'),
    trialEnd: row.trial_end ? parseDate(row.trial_end, 'trial_end') : undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at ? parseDate(row.canceled_at, 'canceled_at') : undefined,
    metadata: stringMetadata(row.metadata),
    lastProcessedEventId: row.last_processed_event_id ?? undefined,
  };
}
