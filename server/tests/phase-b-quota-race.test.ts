import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite('Phase B quota race negative control', () => {
  let quotaGate: typeof import('../src/lib/quota.js').quotaGate;
  let subscriptionCore: typeof import('../src/lib/subscriptions.js').subscriptionCore;
  let usageCounterRepository: typeof import('../src/lib/subscriptions.js').usageCounterRepository;
  let AI_REQUESTS_PER_MONTH: string;
  let periodStart: Date;
  const accountId = 'phaseb_quota_race_account';

  beforeAll(async () => {
    ({ quotaGate } = await import('../src/lib/quota.js'));
    ({ subscriptionCore, usageCounterRepository, AI_REQUESTS_PER_MONTH } =
      await import('../src/lib/subscriptions.js'));

    // Ensure a clean account before creating the subscription.
    const { getPgPool } = await import('../src/lib/persistence/pg.js');
    const pool = getPgPool();
    if (!pool) throw new Error('DATABASE_URL is required');
    await pool.query('DELETE FROM usage_counters WHERE account_id = $1', [accountId]);
    await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [accountId]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [accountId]);

    await subscriptionCore.createSubscription({ accountId, planId: 'free' });
    const sub = await subscriptionCore.getSubscription(accountId);
    if (!sub) throw new Error('subscription seed failed');
    periodStart = sub.currentPeriodStart;

    // Free plan limit is 50. Leave exactly one unit available.
    await usageCounterRepository.increment(accountId, AI_REQUESTS_PER_MONTH, periodStart, 49);
  });

  afterAll(async () => {
    const { getPgPool } = await import('../src/lib/persistence/pg.js');
    const pool = getPgPool();
    if (!pool) return;
    await pool.query('DELETE FROM usage_counters WHERE account_id = $1', [accountId]);
    await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [accountId]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [accountId]);
  });

  it('allows exactly one concurrent consume when one finite quota unit remains', async () => {
    const decisions = await Promise.all(
      Array.from({ length: 16 }, () =>
        quotaGate.assertAndConsumeQuota({
          accountId,
          featureKey: AI_REQUESTS_PER_MONTH,
        })
      )
    );

    const allowed = decisions.filter((decision) => decision.allowed);
    const refused = decisions.filter((decision) => !decision.allowed);
    const finalUsage = await usageCounterRepository.getUsage(
      accountId,
      AI_REQUESTS_PER_MONTH,
      periodStart
    );

    expect(allowed).toHaveLength(1);
    expect(refused).toHaveLength(15);
    expect(finalUsage).toBe(50);
    for (const refusal of refused) {
      if (refusal.allowed) throw new Error('unreachable');
      expect(refusal.reason).toBe('QUOTA_EXCEEDED');
    }
  });
});
