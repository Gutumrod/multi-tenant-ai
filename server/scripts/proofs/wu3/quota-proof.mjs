#!/usr/bin/env node
/**
 * HOUSE-SWARM-7 WU-3 quota proof harness (standalone Node ESM).
 *
 * Connects with `pg` to the database in DATABASE_URL and prints one
 * machine-readable line per check:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * Checks: over-quota-is-refused-before-provider, in-quota-allows-and-increments,
 * failed-paid-call-does-not-consume, counter-survives-reconnect,
 * concurrent-increments-are-atomic, usage-counter-is-single-statement.
 *
 * The first two checks that involve the HTTP handler drive the REAL route
 * handler (src/routes/ai-demo.ts) with the REAL quota gate
 * (src/lib/quota.ts) over the REAL Postgres repositories. `globalThis.fetch` is
 * replaced with a counting stub for the duration, so "the provider was not
 * called" is observed as "no outbound provider request was attempted" and the
 * stub doubles as the failing paid call in
 * failed-paid-call-does-not-consume. No request leaves this process.
 *
 * This harness never starts or stops the database, never prints the connection
 * string or any credential (the API key it sets is a non-secret placeholder
 * that is never printed), and exits non-zero if any check fails or if
 * DATABASE_URL is unset.
 *
 * Usage:  DATABASE_URL=... node scripts/proofs/wu3/quota-proof.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { tsImport } from 'tsx/esm/api';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '../../..');

const DATABASE_URL = process.env.DATABASE_URL;
const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

/** Load a TypeScript module of the reference server from this .mjs harness. */
function loadTs(relativePath) {
  return tsImport(pathToFileURL(join(SERVER_DIR, relativePath)).href, import.meta.url);
}

function makePool(max = 10) {
  return new pg.Pool({ connectionString: DATABASE_URL, max });
}

/** Minimal Express Response stand-in: records status + JSON body. */
function makeRes() {
  const res = {
    statusCode: 200,
    payload: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.payload = body;
      return res;
    },
  };
  return res;
}

function makeReq(body, tenantId) {
  return { body, headers: {}, tenantContext: { tenantId, metadata: { resolvedVia: 'proof' } } };
}

/** Provider fetch stub: counts calls and always fails, like an unreachable provider. */
const fetchStub = { calls: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = async () => {
  fetchStub.calls += 1;
  throw new Error('proof-harness: outbound call blocked (no network request was made)');
};

const LIMIT = 50; // free plan ai_requests_per_month
const FREE_PAYMENTS_LIMIT = 5; // free plan payments_per_month
const createdAccountIds = [];

async function main() {
  if (!DATABASE_URL) {
    console.log('CHECK harness FAIL DATABASE_URL is not set (no credential printed)');
    process.exitCode = 1;
    return;
  }

  // The handler only reaches its provider path when one is "configured"; this is
  // a placeholder, never printed, and the fetch stub above blocks any real call.
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'proof-harness-placeholder-key';

  const { runMigrations } = await loadTs('src/lib/persistence/migrate.ts');
  const { getPgPool } = await loadTs('src/lib/persistence/pg.ts');
  const { createPostgresRepositories } = await loadTs('src/lib/persistence/pg-repositories.ts');
  const { quotaGate } = await loadTs('src/lib/quota.ts');
  const { aiDemoHandler } = await loadTs('src/routes/ai-demo.ts');

  const serverPool = getPgPool();
  if (!serverPool) {
    console.log('CHECK harness FAIL no Postgres pool configured (no credential printed)');
    process.exitCode = 1;
    return;
  }

  const repositories = createPostgresRepositories(serverPool);
  const seedRepositories = createPostgresRepositories(serverPool);

  // Migrations are what create usage_counters; running the real runner here also
  // re-proves that 0002_usage.sql is re-runnable.
  const migration = await runMigrations(serverPool);

  const stamp = Date.now();
  let seq = 0;

  /**
   * Inserts a subscription row directly (like the WU-2 integration test) so the
   * counter period is deterministic, and returns the period start the quota gate
   * will derive from it.
   */
  async function seedSubscription(label, planId = 'free') {
    const accountId = `wu3proof_${label}_${stamp}_${seq++}`;
    createdAccountIds.push(accountId);
    const periodStart = new Date(Date.now() - 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await serverPool.query(
      `INSERT INTO subscriptions (
         id, account_id, plan_id, status,
         current_period_start, current_period_end, cancel_at_period_end, updated_at
       ) VALUES ($1, $2, $3, 'active', $4, $5, false, now())`,
      [`sub_${accountId}`, accountId, planId, periodStart, periodEnd]
    );
    return { accountId, periodStart };
  }

  // --- check 1: over-quota-is-refused-before-provider ----------------------
  let check1Account;
  try {
    const { accountId, periodStart } = await seedSubscription('over_quota');
    check1Account = accountId;
    await repositories.usageCounters.increment(accountId, 'ai_requests_per_month', periodStart, LIMIT);

    fetchStub.calls = 0;
    const res = makeRes();
    await aiDemoHandler(makeReq({ prompt: 'proof prompt' }, accountId), res);

    const usageAfter = await repositories.usageCounters.getUsage(
      accountId,
      'ai_requests_per_month',
      periodStart
    );

    const ok =
      res.statusCode === 429 &&
      res.payload?.code === 'QUOTA_EXCEEDED' &&
      res.payload?.featureKey === 'ai_requests_per_month' &&
      res.payload?.limit === LIMIT &&
      res.payload?.usage === LIMIT &&
      fetchStub.calls === 0 &&
      usageAfter === LIMIT;

    record(
      'over-quota-is-refused-before-provider',
      ok,
      `http_status=${res.statusCode} code=${res.payload?.code} feature_key=${res.payload?.featureKey} ` +
        `limit=${res.payload?.limit} usage=${res.payload?.usage} provider_fetch_attempts=${fetchStub.calls} ` +
        `counter_after_refusal=${usageAfter} (account=${accountId}, seed_usage=${LIMIT})`
    );
  } catch (error) {
    record('over-quota-is-refused-before-provider', false, `error=${error.message}`);
  }

  // --- check 2: in-quota-allows-and-increments -----------------------------
  try {
    const { accountId, periodStart } = await seedSubscription('in_quota');

    const before = await repositories.usageCounters.getUsage(accountId, 'ai_requests_per_month', periodStart);
    const decision = await quotaGate.assertAndConsumeQuota({
      accountId,
      featureKey: 'ai_requests_per_month',
    });

    // Read the counter back on a second, independent connection with raw SQL so
    // the increment is proven durable rather than only visible to the repository.
    const other = makePool(2);
    let readBack;
    try {
      const { rows } = await other.query(
        `SELECT usage_count FROM usage_counters
          WHERE account_id = $1 AND feature_key = $2 AND period_start = $3`,
        [accountId, 'ai_requests_per_month', periodStart]
      );
      readBack = rows.length > 0 ? Number(rows[0].usage_count) : 0;
    } finally {
      await other.end();
    }

    const ok =
      before === 0 &&
      decision.allowed === true &&
      decision.usage === 1 &&
      decision.limit === LIMIT &&
      readBack === 1;

    record(
      'in-quota-allows-and-increments',
      ok,
      `allowed=${decision.allowed} decision_usage=${decision.usage} limit=${decision.limit} ` +
        `counter_before=${before} counter_read_back_independent_connection=${readBack} ` +
        `(account=${accountId})`
    );
  } catch (error) {
    record('in-quota-allows-and-increments', false, `error=${error.message}`);
  }

  // --- check 3: failed-paid-call-does-not-consume --------------------------
  try {
    const { accountId, periodStart } = await seedSubscription('provider_fails');

    fetchStub.calls = 0;
    const res = makeRes();
    await aiDemoHandler(makeReq({ prompt: 'proof prompt' }, accountId), res);

    const usageAfter = await repositories.usageCounters.getUsage(
      accountId,
      'ai_requests_per_month',
      periodStart
    );

    // fetchStub.calls === 1 proves the handler really reached the paid call, so
    // "the counter is unchanged" is a real release and not a vacuous no-op.
    const ok = fetchStub.calls === 1 && usageAfter === 0;

    record(
      'failed-paid-call-does-not-consume',
      ok,
      `provider_fetch_attempts=${fetchStub.calls} provider_result=${res.payload?.success} ` +
        `provider_error_code=${res.payload?.error?.code} http_status=${res.statusCode} ` +
        `counter_after_failure=${usageAfter} (account=${accountId}, expected 0 = released)`
    );
  } catch (error) {
    record('failed-paid-call-does-not-consume', false, `error=${error.message}`);
  }

  // --- check 4: counter-survives-reconnect --------------------------------
  try {
    const { accountId, periodStart } = await seedSubscription('reconnect');
    const written = await repositories.usageCounters.increment(
      accountId,
      'ai_requests_per_month',
      periodStart,
      7
    );

    // New pooled connection: nothing is shared with the writing client.
    const reread = makePool(2);
    let readBack;
    try {
      const { rows } = await reread.query(
        `SELECT usage_count FROM usage_counters
          WHERE account_id = $1 AND feature_key = $2 AND period_start = $3`,
        [accountId, 'ai_requests_per_month', periodStart]
      );
      readBack = rows.length > 0 ? Number(rows[0].usage_count) : 0;
    } finally {
      await reread.end();
    }
    // And again through the repository on the server pool.
    const viaRepository = await repositories.usageCounters.getUsage(
      accountId,
      'ai_requests_per_month',
      periodStart
    );

    const ok = written === 7 && readBack === 7 && viaRepository === 7;

    record(
      'counter-survives-reconnect',
      ok,
      `increment_returned=${written} read_back_new_connection=${readBack} ` +
        `read_back_via_repository=${viaRepository} (account=${accountId})`
    );
  } catch (error) {
    record('counter-survives-reconnect', false, `error=${error.message}`);
  }

  // --- check 5: concurrent-increments-are-atomic --------------------------
  const CONCURRENT = 16;
  try {
    const { accountId, periodStart } = await seedSubscription('concurrent');
    const poolA = makePool(CONCURRENT);
    const poolB = makePool(CONCURRENT);
    try {
      const repoA = createPostgresRepositories(poolA).usageCounters;
      const repoB = createPostgresRepositories(poolB).usageCounters;

      const calls = Array.from({ length: CONCURRENT }, (_unused, index) =>
        (index % 2 === 0 ? repoA : repoB).increment(
          accountId,
          'ai_requests_per_month',
          periodStart
        )
      );
      const returned = await Promise.all(calls);

      const { rows } = await serverPool.query(
        `SELECT usage_count FROM usage_counters
          WHERE account_id = $1 AND feature_key = $2 AND period_start = $3`,
        [accountId, 'ai_requests_per_month', periodStart]
      );
      const finalCount = rows.length > 0 ? Number(rows[0].usage_count) : 0;

      // Every concurrent increment must have returned a distinct value: that is
      // what a lost update would break.
      const distinctReturned = new Set(returned).size;

      const ok =
        returned.length === CONCURRENT &&
        finalCount === CONCURRENT &&
        distinctReturned === CONCURRENT;

      record(
        'concurrent-increments-are-atomic',
        ok,
        `increments_fired=${CONCURRENT} distinct_values_returned=${distinctReturned} ` +
          `final_counter=${finalCount} expected_final=${CONCURRENT} ` +
          `returned_values=[${returned.slice().sort((a, b) => a - b).join(',')}] (account=${accountId})`
      );
    } finally {
      await poolA.end();
      await poolB.end();
    }
  } catch (error) {
    record('concurrent-increments-are-atomic', false, `error=${error.message}`);
  }

  // --- check 6: usage-counter-is-single-statement -------------------------
  try {
    const repositorySource = readFileSync(
      join(SERVER_DIR, 'src/lib/persistence/pg-repositories.ts'),
      'utf8'
    );
    const migrationSource = readFileSync(join(SERVER_DIR, 'migrations/0002_usage.sql'), 'utf8');

    const incrementStart = repositorySource.indexOf('async increment(');
    const decrementStart = repositorySource.indexOf('async decrement(');
    const incrementSource = repositorySource.slice(incrementStart, decrementStart);
    const normalized = incrementSource.replace(/\s+/g, ' ');

    // Counts statement-issuing calls in the increment path. The call shape is
    // `this.pool.query<{ usage_count: number }>(...)` — a generic type argument
    // between `query` and `(` — so the pattern must allow an optional `<...>`
    // (round-1 matched only the bare `this.pool.query(` form and therefore
    // reported 0 statements while every other check in this section was true).
    const queryCalls = (
      incrementSource.match(/this\.pool\.query\s*(?:<[^>]*>)?\s*\(/g) || []
    ).length;
    const hasOnConflict = /ON CONFLICT \(account_id, feature_key, period_start\)/.test(normalized);
    // The updated value must be the target table's OWN column plus the proposed
    // row: `usage_counters.usage_count + EXCLUDED.usage_count`. The table
    // qualifier is required, not optional — a bare `usage_count` here is the
    // ambiguous-column bug PostgreSQL 16.4 rejects (SQLSTATE 42702).
    const hasDoUpdate =
      /DO UPDATE SET usage_count = usage_counters\.usage_count \+ EXCLUDED\.usage_count/.test(
        normalized
      );
    const hasReturning = /RETURNING usage_count/.test(normalized);
    // No read-then-write: the increment issues exactly one statement and never
    // reads the counter first.
    const hasNoSelect = !/SELECT/i.test(incrementSource);
    const hasNoReadHelper = !/getUsage/.test(incrementSource);
    // It is the same statement the migration documents as the conflict target.
    const migrationHasKey = /PRIMARY KEY \(account_id, feature_key, period_start\)/.test(
      migrationSource
    );

    const ok =
      incrementStart !== -1 &&
      decrementStart > incrementStart &&
      queryCalls === 1 &&
      hasOnConflict &&
      hasDoUpdate &&
      hasReturning &&
      hasNoSelect &&
      hasNoReadHelper &&
      migrationHasKey;

    record(
      'usage-counter-is-single-statement',
      ok,
      `query_statements_in_increment=${queryCalls} has_ON_CONFLICT=${hasOnConflict} ` +
        `has_DO_UPDATE=${hasDoUpdate} has_RETURNING=${hasReturning} contains_SELECT=${!hasNoSelect} ` +
        `reads_counter_first=${!hasNoReadHelper} migration_primary_key=${migrationHasKey}`
    );
  } catch (error) {
    record('usage-counter-is-single-statement', false, `error=${error.message}`);
  }

  // --- cleanup: leave no proof rows behind --------------------------------
  for (const accountId of createdAccountIds) {
    await serverPool.query('DELETE FROM usage_counters WHERE account_id = $1', [accountId]);
    await serverPool.query('DELETE FROM subscriptions WHERE account_id = $1', [accountId]);
  }

  globalThis.fetch = realFetch;

  const failed = results.filter((result) => !result.passed);
  console.log(
    `SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length}` +
      ` migrations_first_run_applied=[${migration.applied.join(',')}]` +
      ` migrations_skipped=[${migration.skipped.join(',')}]` +
      (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
  );
  if (failed.length > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.log(`CHECK harness FAIL unexpected_error=${error.message}`);
  process.exitCode = 1;
} finally {
  globalThis.fetch = realFetch;
}
