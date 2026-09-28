import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  EntitlementValue,
  Plan,
  Subscription,
  SubscriptionStatus,
} from '../../../../modules/subscription/core/types.js';
import type { TenantInfo } from '../../../../modules/tenant-context/core/types.js';

/**
 * Postgres implementation of the module contracts in
 * modules/subscription/core/repository.ts, plus a tenant repository and the
 * durable billing-event claim.
 *
 * The module contract addresses a subscription by `accountId` (one current
 * subscription per account), so `subscriptions.account_id` is the upsert
 * conflict target and `billing_event_ledger.event_id` is the ledger's primary
 * key.
 */

export interface TenantRepository {
  getById(tenantId: string): Promise<TenantInfo | null>;
  getBySlug(slug: string): Promise<TenantInfo | null>;
  listAll(): Promise<TenantInfo[]>;
  save(tenant: TenantInfo): Promise<void>;
}

/**
 * The billing-event idempotency boundary. `claim` inserts the event id into
 * billing_event_ledger and returns false when it was already claimed.
 */
export interface BillingEventLedger {
  claim(params: {
    eventId: string;
    accountId: string;
    eventType?: string;
    subscriptionId?: string;
  }): Promise<boolean>;
  has(eventId: string): Promise<boolean>;
}

export interface PostgresRepositories {
  subscriptions: PostgresSubscriptionRepository;
  plans: PostgresPlanRepository;
  tenants: TenantRepository;
  billingEvents: BillingEventLedger;
}

type SubscriptionRow = QueryResultRow & {
  id: string;
  account_id: string;
  plan_id: string;
  status: string;
  current_period_start: Date;
  current_period_end: Date;
  trial_end: Date | null;
  grace_period_end: Date | null;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  metadata: Record<string, string> | null;
  last_processed_event_id: string | null;
};

type PlanRow = QueryResultRow & {
  id: string;
  name: string;
  billing_interval: 'month' | 'year' | null;
  price_minor_units: number | null;
  currency: string | null;
  entitlements: Record<string, EntitlementValue> | null;
};

type TenantRow = QueryResultRow & {
  id: string;
  slug: string;
  name: string;
  tier: string;
  metadata: Record<string, unknown> | null;
};

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    accountId: row.account_id,
    planId: row.plan_id,
    status: row.status as SubscriptionStatus,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEnd: row.trial_end ?? undefined,
    gracePeriodEnd: row.grace_period_end ?? undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at ?? undefined,
    metadata: row.metadata ?? undefined,
    lastProcessedEventId: row.last_processed_event_id ?? undefined,
  };
}

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    billingInterval: row.billing_interval ?? undefined,
    priceMinorUnits: row.price_minor_units ?? undefined,
    currency: row.currency ?? undefined,
    entitlements: row.entitlements ?? {},
  };
}

function toTenant(row: TenantRow): TenantInfo {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tier: row.tier as TenantInfo['tier'],
    metadata: row.metadata ?? undefined,
  };
}

async function upsertSubscription(client: PoolClient, subscription: Subscription): Promise<void> {
  await client.query(
    `INSERT INTO subscriptions (
       id, account_id, tenant_id, plan_id, status,
       current_period_start, current_period_end, trial_end, grace_period_end,
       cancel_at_period_end, canceled_at, metadata, last_processed_event_id, updated_at
     ) VALUES (
       $1, $2, (SELECT id FROM tenants WHERE id = $2), $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11::jsonb, $12, now()
     )
     ON CONFLICT (account_id) DO UPDATE SET
       id = EXCLUDED.id,
       tenant_id = EXCLUDED.tenant_id,
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       trial_end = EXCLUDED.trial_end,
       grace_period_end = EXCLUDED.grace_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       canceled_at = EXCLUDED.canceled_at,
       metadata = EXCLUDED.metadata,
       last_processed_event_id = EXCLUDED.last_processed_event_id,
       updated_at = now()`,
    [
      subscription.id,
      subscription.accountId,
      subscription.planId,
      subscription.status,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.trialEnd ?? null,
      subscription.gracePeriodEnd ?? null,
      subscription.cancelAtPeriodEnd,
      subscription.canceledAt ?? null,
      subscription.metadata ? JSON.stringify(subscription.metadata) : null,
      subscription.lastProcessedEventId ?? null,
    ]
  );
}

async function withTransaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class PostgresSubscriptionRepository {
  constructor(private readonly pool: Pool) {}

  async getByAccountId(accountId: string): Promise<Subscription | null> {
    const { rows } = await this.pool.query<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE account_id = $1',
      [accountId]
    );
    return rows.length > 0 ? toSubscription(rows[0]) : null;
  }

  async save(subscription: Subscription): Promise<void> {
    await withTransaction(this.pool, (client) => upsertSubscription(client, subscription));
  }

  /**
   * Atomically claim `eventId` in billing_event_ledger and persist the
   * subscription in one transaction. Returns false — leaving state untouched —
   * when the event id was already claimed, so a replayed event is applied at
   * most once even across process restarts.
   */
  async saveForBillingEvent(subscription: Subscription, eventId: string): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      const claim = await client.query(
        `INSERT INTO billing_event_ledger (event_id, account_id, subscription_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, subscription.accountId, subscription.id]
      );
      if (claim.rowCount === 0) return false;
      await upsertSubscription(client, subscription);
      return true;
    });
  }

  async updateStatus(
    accountId: string,
    status: SubscriptionStatus,
    extra?: Partial<Subscription>
  ): Promise<void> {
    await this.pool.query(
      `UPDATE subscriptions SET
         status = $2,
         plan_id = COALESCE($3, plan_id),
         current_period_end = COALESCE($4, current_period_end),
         trial_end = COALESCE($5, trial_end),
         grace_period_end = COALESCE($6, grace_period_end),
         cancel_at_period_end = COALESCE($7, cancel_at_period_end),
         canceled_at = COALESCE($8, canceled_at),
         metadata = COALESCE($9::jsonb, metadata),
         last_processed_event_id = COALESCE($10, last_processed_event_id),
         updated_at = now()
       WHERE account_id = $1`,
      [
        accountId,
        status,
        extra?.planId ?? null,
        extra?.currentPeriodEnd ?? null,
        extra?.trialEnd ?? null,
        extra?.gracePeriodEnd ?? null,
        extra?.cancelAtPeriodEnd ?? null,
        extra?.canceledAt ?? null,
        extra?.metadata ? JSON.stringify(extra.metadata) : null,
        extra?.lastProcessedEventId ?? null,
      ]
    );
  }
}

export class PostgresPlanRepository {
  constructor(private readonly pool: Pool) {}

  async getById(planId: string): Promise<Plan | null> {
    const { rows } = await this.pool.query<PlanRow>('SELECT * FROM plans WHERE id = $1', [planId]);
    return rows.length > 0 ? toPlan(rows[0]) : null;
  }

  async listAll(): Promise<Plan[]> {
    const { rows } = await this.pool.query<PlanRow>('SELECT * FROM plans ORDER BY id');
    return rows.map(toPlan);
  }

  async save(plan: Plan): Promise<void> {
    await this.pool.query(
      `INSERT INTO plans (
         id, name, billing_interval, price_minor_units, currency, entitlements, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         billing_interval = EXCLUDED.billing_interval,
         price_minor_units = EXCLUDED.price_minor_units,
         currency = EXCLUDED.currency,
         entitlements = EXCLUDED.entitlements,
         updated_at = now()`,
      [
        plan.id,
        plan.name,
        plan.billingInterval ?? null,
        plan.priceMinorUnits ?? null,
        plan.currency ?? null,
        JSON.stringify(plan.entitlements),
      ]
    );
  }
}

export class PostgresTenantRepository implements TenantRepository {
  constructor(private readonly pool: Pool) {}

  async getById(tenantId: string): Promise<TenantInfo | null> {
    const { rows } = await this.pool.query<TenantRow>('SELECT * FROM tenants WHERE id = $1', [
      tenantId,
    ]);
    return rows.length > 0 ? toTenant(rows[0]) : null;
  }

  async getBySlug(slug: string): Promise<TenantInfo | null> {
    const { rows } = await this.pool.query<TenantRow>('SELECT * FROM tenants WHERE slug = $1', [
      slug,
    ]);
    return rows.length > 0 ? toTenant(rows[0]) : null;
  }

  async listAll(): Promise<TenantInfo[]> {
    const { rows } = await this.pool.query<TenantRow>('SELECT * FROM tenants ORDER BY id');
    return rows.map(toTenant);
  }

  async save(tenant: TenantInfo): Promise<void> {
    await this.pool.query(
      `INSERT INTO tenants (id, slug, name, tier, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug,
         name = EXCLUDED.name,
         tier = EXCLUDED.tier,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [
        tenant.id,
        tenant.slug,
        tenant.name,
        tenant.tier,
        tenant.metadata ? JSON.stringify(tenant.metadata) : null,
      ]
    );
  }
}

export class PostgresBillingEventLedger implements BillingEventLedger {
  constructor(private readonly pool: Pool) {}

  async claim(params: {
    eventId: string;
    accountId: string;
    eventType?: string;
    subscriptionId?: string;
  }): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO billing_event_ledger (event_id, account_id, event_type, subscription_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [params.eventId, params.accountId, params.eventType ?? null, params.subscriptionId ?? null]
    );
    return result.rowCount === 1;
  }

  async has(eventId: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM billing_event_ledger WHERE event_id = $1',
      [eventId]
    );
    return rows.length > 0;
  }
}

export function createPostgresRepositories(pool: Pool): PostgresRepositories {
  return {
    subscriptions: new PostgresSubscriptionRepository(pool),
    plans: new PostgresPlanRepository(pool),
    tenants: new PostgresTenantRepository(pool),
    billingEvents: new PostgresBillingEventLedger(pool),
  };
}
