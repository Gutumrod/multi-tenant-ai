import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  EntitlementValue,
  Plan,
  Subscription,
  SubscriptionStatus,
} from '../../../../modules/subscription/core/types.js';
import type { UsageCounterRepository } from '../../../../modules/subscription/core/repository.js';
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
  usageCounters: PostgresUsageCounterRepository;
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

/**
 * Durable paid-resource usage counters (WU-3).
 *
 * Implements the `UsageCounterRepository` contract added to
 * modules/subscription/core/repository.ts. `increment` and `decrement` are each
 * ONE statement with a RETURNING clause: there is no read-then-write window, so
 * concurrent increments from any number of processes cannot lose a write (the
 * (account_id, feature_key, period_start) primary key serializes them inside
 * Postgres). decrement is guarded with GREATEST(..., 0) so the counter can
 * never go negative.
 *
 * Both `DO UPDATE SET` clauses qualify the target table's own column as
 * `usage_counters.usage_count`: a bare `usage_count` there is ambiguous between
 * the target table and the EXCLUDED pseudo-relation, and PostgreSQL 16.4 refuses
 * the whole statement with SQLSTATE 42702 `column reference "usage_count" is
 * ambiguous`.
 */
export class PostgresUsageCounterRepository implements UsageCounterRepository {
  constructor(private readonly pool: Pool) {}

  async getUsage(accountId: string, featureKey: string, periodStart: Date): Promise<number> {
    const { rows } = await this.pool.query<{ usage_count: number }>(
      `SELECT usage_count FROM usage_counters
        WHERE account_id = $1 AND feature_key = $2 AND period_start = $3`,
      [accountId, featureKey, periodStart]
    );
    return rows.length > 0 ? Number(rows[0].usage_count) : 0;
  }

  /**
   * Single atomic upsert; returns the counter value after the increment.
   *
   * The right-hand side of `DO UPDATE SET` must qualify the target table's own
   * column as `usage_counters.usage_count`: in `DO UPDATE`, a bare
   * `usage_count` is ambiguous between the target table's column and the
   * `EXCLUDED` pseudo-relation's column, and PostgreSQL 16.4 rejects the whole
   * statement with SQLSTATE 42702 `column reference "usage_count" is
   * ambiguous`. `EXCLUDED.usage_count` needs no qualification.
   */
  async increment(
    accountId: string,
    featureKey: string,
    periodStart: Date,
    by: number = 1
  ): Promise<number> {
    const { rows } = await this.pool.query<{ usage_count: number }>(
      `INSERT INTO usage_counters (account_id, feature_key, period_start, usage_count, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (account_id, feature_key, period_start)
       DO UPDATE SET usage_count = usage_counters.usage_count + EXCLUDED.usage_count,
                     updated_at  = now()
       RETURNING usage_count`,
      [accountId, featureKey, periodStart, by]
    );
    return Number(rows[0].usage_count);
  }

  /**
   * Atomically consume only when the resulting count is <= `limit`.
   *
   * The INSERT path is guarded by a SELECT predicate and the conflict UPDATE has
   * its own WHERE predicate. PostgreSQL serializes conflicting rows, so concurrent
   * callers racing for the final unit cannot all pass a stale pre-check.
   */
  async tryIncrementWithinLimit(
    accountId: string,
    featureKey: string,
    periodStart: Date,
    limit: number,
    by: number = 1
  ): Promise<number | null> {
    const { rows } = await this.pool.query<{ usage_count: number }>(
      `INSERT INTO usage_counters (account_id, feature_key, period_start, usage_count, updated_at)
       SELECT $1::text, $2::text, $3::timestamptz, $4::integer, now()
       WHERE $4::integer <= $5::integer
       ON CONFLICT (account_id, feature_key, period_start)
       DO UPDATE SET usage_count = usage_counters.usage_count + EXCLUDED.usage_count,
                     updated_at = now()
       WHERE usage_counters.usage_count + EXCLUDED.usage_count <= $5::integer
       RETURNING usage_count`,
      [accountId, featureKey, periodStart, by, limit]
    );
    return rows.length > 0 ? Number(rows[0].usage_count) : null;
  }

  /**
   * Single atomic compensating statement for the rollback path (a consumed unit
   * is given back when the downstream paid call fails). Returns the counter
   * value after the decrement.
   *
   * Same qualification rule as `increment`: the target table's own column is
   * written `usage_counters.usage_count` so the reference is not ambiguous with
   * `EXCLUDED.usage_count` (PostgreSQL 16.4 otherwise rejects the statement with
   * SQLSTATE 42702).
   *
   * The statement is ONE `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` with
   * no preceding read, exactly like `increment`. To subtract `by` on the conflict
   * branch through `EXCLUDED.usage_count`, the VALUES clause has to carry `by`, so
   * this is also what the INSERT branch stores: calling `decrement` for a counter
   * row that does not exist yet creates it at `by` rather than at 0. That corner
   * is unreachable from `quotaGate.releaseQuota` (release is only ever called
   * after a successful consume created the row), so it does not affect the
   * rollback path; GREATEST(..., 0) keeps every reachable result non-negative.
   */
  async decrement(
    accountId: string,
    featureKey: string,
    periodStart: Date,
    by: number = 1
  ): Promise<number> {
    const { rows } = await this.pool.query<{ usage_count: number }>(
      `INSERT INTO usage_counters (account_id, feature_key, period_start, usage_count, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (account_id, feature_key, period_start)
       DO UPDATE SET usage_count = GREATEST(usage_counters.usage_count - EXCLUDED.usage_count, 0),
                     updated_at  = now()
       RETURNING usage_count`,
      [accountId, featureKey, periodStart, by]
    );
    return Number(rows[0].usage_count);
  }
}

export function createPostgresRepositories(pool: Pool): PostgresRepositories {
  return {
    subscriptions: new PostgresSubscriptionRepository(pool),
    plans: new PostgresPlanRepository(pool),
    tenants: new PostgresTenantRepository(pool),
    billingEvents: new PostgresBillingEventLedger(pool),
    usageCounters: new PostgresUsageCounterRepository(pool),
  };
}
