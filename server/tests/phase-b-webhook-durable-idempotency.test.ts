import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { Subscription } from '../../modules/subscription/core/types.js';
import { runMigrations } from '../src/lib/persistence/migrate.js';
import { createPostgresRepositories } from '../src/lib/persistence/pg-repositories.js';

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

const ACCOUNT_ID = 'phaseb_webhook_durable_account';
const EVENT_ID = 'phaseb_webhook_durable_event';

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'phaseb_webhook_durable_sub',
    accountId: ACCOUNT_ID,
    planId: 'pro',
    status: 'active',
    currentPeriodStart: new Date('2026-10-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    metadata: { source: 'phase-b-durable-webhook-proof' },
    ...overrides,
  };
}

suite('Phase B durable webhook state idempotency', () => {
  let admin: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    await runMigrations(admin);
    await admin.query('DELETE FROM billing_event_ledger WHERE event_id = $1', [EVENT_ID]);
    await admin.query('DELETE FROM subscriptions WHERE account_id = $1', [ACCOUNT_ID]);
  });

  afterAll(async () => {
    await admin.query('DELETE FROM billing_event_ledger WHERE event_id = $1', [EVENT_ID]);
    await admin.query('DELETE FROM subscriptions WHERE account_id = $1', [ACCOUNT_ID]);
    await admin.end();
  });

  it('applies a verified billing event at most once across instances and restart', async () => {
    const poolA = new Pool({ connectionString: databaseUrl });
    const poolB = new Pool({ connectionString: databaseUrl });
    const repoA = createPostgresRepositories(poolA).subscriptions;
    const repoB = createPostgresRepositories(poolB).subscriptions;

    await repoA.save(makeSubscription());

    const firstState = makeSubscription({
      status: 'grace_period',
      gracePeriodEnd: new Date('2026-10-04T00:00:00.000Z'),
      lastProcessedEventId: EVENT_ID,
    });

    const concurrent = await Promise.all([
      repoA.saveForBillingEvent(firstState, EVENT_ID),
      repoB.saveForBillingEvent(firstState, EVENT_ID),
    ]);

    expect(concurrent.filter(Boolean)).toHaveLength(1);
    expect(concurrent.filter((claimed) => !claimed)).toHaveLength(1);

    await poolA.end();
    await poolB.end();

    // A new Pool/repository represents a restarted or separate process whose
    // in-memory webhook replay cache is empty. The durable ledger must still
    // prevent a second state transition for the same verified event id.
    const restartedPool = new Pool({ connectionString: databaseUrl });
    const restartedRepo = createPostgresRepositories(restartedPool).subscriptions;

    const conflictingReplayState = makeSubscription({
      status: 'cancelled',
      canceledAt: new Date('2026-10-05T00:00:00.000Z'),
      lastProcessedEventId: EVENT_ID,
    });

    await expect(
      restartedRepo.saveForBillingEvent(conflictingReplayState, EVENT_ID)
    ).resolves.toBe(false);

    const persisted = await restartedRepo.getByAccountId(ACCOUNT_ID);
    expect(persisted?.status).toBe('grace_period');
    expect(persisted?.canceledAt).toBeUndefined();
    expect(persisted?.lastProcessedEventId).toBe(EVENT_ID);

    const ledger = await restartedPool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM billing_event_ledger WHERE event_id = $1',
      [EVENT_ID]
    );
    expect(ledger.rows[0].count).toBe(1);

    await restartedPool.end();
  });
});
