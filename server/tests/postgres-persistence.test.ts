import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { Subscription } from '../../modules/subscription/core/types.js';
import { getPgPool } from '../src/lib/persistence/pg.js';
import { runMigrations } from '../src/lib/persistence/migrate.js';
import { createPostgresRepositories } from '../src/lib/persistence/pg-repositories.js';

/**
 * Integration test against a real PostgreSQL database.
 *
 * Skipped automatically when DATABASE_URL is unset, so the hermetic suite (and
 * any DB-less checkout) is unchanged. Point DATABASE_URL at a scratch database
 * — this test creates and removes its own rows; it never starts or stops the
 * database and never prints the connection string.
 *
 * Run with:  npm run test:db
 */

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

const ACCOUNT_ID = 'itest_account_wu2';
const EVENT_ID = 'itest_event_wu2_atomic';
const SECOND_EVENT_ID = 'itest_event_wu2_second';
const CONCURRENT_CLAIMS = 5;

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'itest_sub_wu2',
    accountId: ACCOUNT_ID,
    planId: 'pro',
    status: 'active',
    currentPeriodStart: new Date('2026-03-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-04-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    metadata: { source: 'wu2-integration' },
    ...overrides,
  };
}

suite('Postgres persistence (integration, needs DATABASE_URL)', () => {
  let pool: Pool;

  beforeAll(async () => {
    const configuredPool = getPgPool();
    expect(configuredPool).not.toBeNull();
    pool = configuredPool as Pool;

    await runMigrations(pool);

    // Start from a clean slate for this test's own rows.
    await pool.query('DELETE FROM billing_event_ledger WHERE account_id = $1', [ACCOUNT_ID]);
    await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [ACCOUNT_ID]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM billing_event_ledger WHERE account_id = $1', [ACCOUNT_ID]);
    await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [ACCOUNT_ID]);
    await pool.end();
  });

  it('round-trips a subscription through the repositories', async () => {
    const repositories = createPostgresRepositories(pool);

    await repositories.subscriptions.save(
      makeSubscription({
        status: 'grace_period',
        gracePeriodEnd: new Date('2026-03-04T00:00:00.000Z'),
        lastProcessedEventId: 'itest_event_wu2_seed',
      })
    );

    const loaded = await repositories.subscriptions.getByAccountId(ACCOUNT_ID);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('itest_sub_wu2');
    expect(loaded?.accountId).toBe(ACCOUNT_ID);
    expect(loaded?.planId).toBe('pro');
    expect(loaded?.status).toBe('grace_period');
    expect(loaded?.currentPeriodStart).toEqual(new Date('2026-03-01T00:00:00.000Z'));
    expect(loaded?.currentPeriodEnd).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(loaded?.gracePeriodEnd).toEqual(new Date('2026-03-04T00:00:00.000Z'));
    expect(loaded?.cancelAtPeriodEnd).toBe(false);
    expect(loaded?.metadata).toEqual({ source: 'wu2-integration' });
    expect(loaded?.lastProcessedEventId).toBe('itest_event_wu2_seed');

    // save() upserts on accountId, so a second write updates the same row.
    await repositories.subscriptions.save(
      makeSubscription({ status: 'cancelled', canceledAt: new Date('2026-03-02T00:00:00.000Z') })
    );
    const updated = await repositories.subscriptions.getByAccountId(ACCOUNT_ID);
    expect(updated?.status).toBe('cancelled');
    expect(updated?.canceledAt).toEqual(new Date('2026-03-02T00:00:00.000Z'));

    const { rows } = await pool.query(
      'SELECT count(*)::int AS count FROM subscriptions WHERE account_id = $1',
      [ACCOUNT_ID]
    );
    expect(rows[0].count).toBe(1);
  });

  it('reads the seeded plans back through the plan repository', async () => {
    const repositories = createPostgresRepositories(pool);

    const free = await repositories.plans.getById('free');
    const pro = await repositories.plans.getById('pro');
    expect(free?.entitlements).toEqual({ ai_requests_per_month: 50 });
    expect(pro?.entitlements).toEqual({ ai_requests_per_month: 1000 });
    expect(pro?.priceMinorUnits).toBe(2900);

    const all = await repositories.plans.listAll();
    expect(all.map((plan) => plan.id)).toEqual(expect.arrayContaining(['free', 'pro']));
  });

  it('round-trips a tenant through the tenant repository', async () => {
    const repositories = createPostgresRepositories(pool);

    await repositories.tenants.save({
      id: ACCOUNT_ID,
      slug: ACCOUNT_ID,
      name: 'WU-2 Integration Tenant',
      tier: 'pro',
      metadata: { source: 'wu2-integration' },
    });

    const loaded = await repositories.tenants.getById(ACCOUNT_ID);
    expect(loaded?.slug).toBe(ACCOUNT_ID);
    expect(loaded?.tier).toBe('pro');
    expect(loaded?.metadata).toEqual({ source: 'wu2-integration' });
    expect((await repositories.tenants.getBySlug(ACCOUNT_ID))?.id).toBe(ACCOUNT_ID);

    await pool.query('DELETE FROM tenants WHERE id = $1', [ACCOUNT_ID]);
  });

  it('applies concurrent deliveries of the same billing event exactly once (atomic claim)', async () => {
    const repositories = createPostgresRepositories(pool);
    const subscription = makeSubscription({ status: 'grace_period', gracePeriodEnd: new Date('2026-03-04T00:00:00.000Z') });

    await repositories.subscriptions.save(subscription);

    const outcomes = await Promise.all(
      Array.from({ length: CONCURRENT_CLAIMS }, () =>
        repositories.subscriptions.saveForBillingEvent(subscription, EVENT_ID)
      )
    );

    expect(outcomes.filter((claimed) => claimed === true)).toHaveLength(1);
    expect(outcomes.filter((claimed) => claimed === false)).toHaveLength(CONCURRENT_CLAIMS - 1);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS count FROM billing_event_ledger WHERE event_id = $1',
      [EVENT_ID]
    );
    expect(rows[0].count).toBe(1);

    // A later sequential replay of the same event id is also rejected.
    await expect(
      repositories.subscriptions.saveForBillingEvent(subscription, EVENT_ID)
    ).resolves.toBe(false);

    // A different event id is still claimable.
    await expect(
      repositories.subscriptions.saveForBillingEvent(subscription, SECOND_EVENT_ID)
    ).resolves.toBe(true);

    expect(await repositories.billingEvents.has(EVENT_ID)).toBe(true);
    await expect(repositories.billingEvents.claim({ eventId: EVENT_ID, accountId: ACCOUNT_ID })).resolves.toBe(
      false
    );
  });

  it('is a no-op when the migration runner is invoked again', async () => {
    const before = await pool.query('SELECT count(*)::int AS count FROM schema_migrations');
    const result = await runMigrations(pool);
    const after = await pool.query('SELECT count(*)::int AS count FROM schema_migrations');

    expect(result.applied).toEqual([]);
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });
});
