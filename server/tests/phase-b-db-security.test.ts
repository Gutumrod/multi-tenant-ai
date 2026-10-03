import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { runMigrations } from '../src/lib/persistence/migrate.js';
import { createPostgresRepositories } from '../src/lib/persistence/pg-repositories.js';

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

const NORMAL_TENANT = 'phaseb_db_normal_tenant';
const INJECTION_ACCOUNT = "phaseb_db_account_' OR '1'='1";
const INJECTION_EVENT = "phaseb_evt_'; DROP TABLE plans; --";
const FEATURE = "ai_requests_' OR '1'='1";
const PERIOD = new Date('2026-10-01T00:00:00.000Z');

suite('Phase B PostgreSQL adversarial security', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await runMigrations(pool);
    await pool.query('DELETE FROM billing_event_ledger WHERE event_id = $1', [INJECTION_EVENT]);
    await pool.query(
      'DELETE FROM usage_counters WHERE account_id = ANY($1::text[])',
      [[NORMAL_TENANT, INJECTION_ACCOUNT]]
    );
    await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [NORMAL_TENANT]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [NORMAL_TENANT]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM billing_event_ledger WHERE event_id = $1', [INJECTION_EVENT]);
    await pool.query(
      'DELETE FROM usage_counters WHERE account_id = ANY($1::text[])',
      [[NORMAL_TENANT, INJECTION_ACCOUNT]]
    );
    await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [NORMAL_TENANT]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [NORMAL_TENANT]);
    await pool.end();
  });

  it('treats SQL-injection-shaped selectors as literal values', async () => {
    const repositories = createPostgresRepositories(pool);

    await repositories.tenants.save({
      id: NORMAL_TENANT,
      slug: NORMAL_TENANT,
      name: 'Phase B DB tenant',
      tier: 'free',
      metadata: { source: 'phase-b-db-security' },
    });

    await expect(
      repositories.tenants.getById(`${NORMAL_TENANT}' OR '1'='1`)
    ).resolves.toBeNull();
    await expect(
      repositories.tenants.getBySlug(`${NORMAL_TENANT}' OR '1'='1`)
    ).resolves.toBeNull();
    await expect(repositories.plans.getById("free' OR '1'='1")).resolves.toBeNull();

    const normal = await repositories.tenants.getById(NORMAL_TENANT);
    expect(normal?.id).toBe(NORMAL_TENANT);

    const plans = await repositories.plans.listAll();
    expect(plans.map((plan) => plan.id)).toEqual(expect.arrayContaining(['free', 'pro']));
  });

  it('stores injection-shaped event ids literally without altering schema', async () => {
    const repositories = createPostgresRepositories(pool);

    await expect(
      repositories.billingEvents.claim({
        eventId: INJECTION_EVENT,
        accountId: NORMAL_TENANT,
        eventType: 'phase-b-security',
      })
    ).resolves.toBe(true);

    await expect(repositories.billingEvents.has(INJECTION_EVENT)).resolves.toBe(true);
    await expect(
      repositories.billingEvents.claim({
        eventId: INJECTION_EVENT,
        accountId: NORMAL_TENANT,
        eventType: 'phase-b-security',
      })
    ).resolves.toBe(false);

    const plansTable = await pool.query(
      "SELECT to_regclass('public.plans')::text AS table_name"
    );
    expect(plansTable.rows[0].table_name).toBe('plans');
  });

  it('keeps usage counters isolated for injection-shaped account/feature keys', async () => {
    const repositories = createPostgresRepositories(pool);

    await repositories.usageCounters.increment(INJECTION_ACCOUNT, FEATURE, PERIOD);
    await repositories.usageCounters.increment(NORMAL_TENANT, 'ai_requests_per_month', PERIOD);

    await expect(
      repositories.usageCounters.getUsage(INJECTION_ACCOUNT, FEATURE, PERIOD)
    ).resolves.toBe(1);
    await expect(
      repositories.usageCounters.getUsage(NORMAL_TENANT, 'ai_requests_per_month', PERIOD)
    ).resolves.toBe(1);
    await expect(
      repositories.usageCounters.getUsage(
        `${NORMAL_TENANT}' OR '1'='1`,
        'ai_requests_per_month',
        PERIOD
      )
    ).resolves.toBe(0);
  });

  it('preserves the exact quota count under concurrent PostgreSQL increments', async () => {
    const repositories = createPostgresRepositories(pool);
    const featureKey = 'phase_b_concurrency';
    const claims = 32;

    await pool.query(
      'DELETE FROM usage_counters WHERE account_id = $1 AND feature_key = $2 AND period_start = $3',
      [NORMAL_TENANT, featureKey, PERIOD]
    );

    await Promise.all(
      Array.from({ length: claims }, () =>
        repositories.usageCounters.increment(NORMAL_TENANT, featureKey, PERIOD)
      )
    );

    await expect(
      repositories.usageCounters.getUsage(NORMAL_TENANT, featureKey, PERIOD)
    ).resolves.toBe(claims);

    await pool.query(
      'DELETE FROM usage_counters WHERE account_id = $1 AND feature_key = $2 AND period_start = $3',
      [NORMAL_TENANT, featureKey, PERIOD]
    );
  });

  it('survives a fresh client reconnect and keeps migrations idempotent', async () => {
    const first = new Pool({ connectionString: databaseUrl });
    const firstRun = await runMigrations(first);
    const before = await first.query('SELECT count(*)::int AS count FROM schema_migrations');
    await first.end();

    const second = new Pool({ connectionString: databaseUrl });
    const secondRun = await runMigrations(second);
    const after = await second.query('SELECT count(*)::int AS count FROM schema_migrations');
    const plan = await second.query('SELECT id FROM plans WHERE id = $1', ['pro']);
    await second.end();

    expect(firstRun.applied).toEqual([]);
    expect(secondRun.applied).toEqual([]);
    expect(after.rows[0].count).toBe(before.rows[0].count);
    expect(plan.rows[0]?.id).toBe('pro');
  });
});
