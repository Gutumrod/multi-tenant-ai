#!/usr/bin/env node
/**
 * HOUSE-SWARM-7 WU-2 evidence script: exercises the REAL TypeScript migration
 * runner (server/src/lib/persistence/migrate.ts) and the reference-server wiring
 * (server/src/lib/subscriptions.ts) against the database in DATABASE_URL.
 *
 * Prints one line per observation. Never prints the connection string.
 *
 *   npx tsx scripts/proofs/wu2/migrate-runner-proof.mts            (existing state)
 *   npx tsx scripts/proofs/wu2/migrate-runner-proof.mts --fresh    (drop first)
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { getPgPool } from '../../../src/lib/persistence/pg.js';
import { runMigrations } from '../../../src/lib/persistence/migrate.js';
import { createPostgresRepositories } from '../../../src/lib/persistence/pg-repositories.js';
import { initSubscriptionRepositories, subscriptionCore } from '../../../src/lib/subscriptions.js';

const fresh = process.argv.includes('--fresh');

async function count(pool: Pool, table: string): Promise<number> {
  const { rows } = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return rows[0].count;
}

async function main(): Promise<void> {
  const pool = getPgPool();

  if (!pool) {
    // DB-less host: prove the reference server still selects the in-memory path.
    const wired = await initSubscriptionRepositories();
    console.log(
      `OBSERVATION wiring persistent=${wired.persistent} subscriptionRepo=${
        wired.subscriptionRepo.constructor.name
      } planRepo=${wired.planRepo.constructor.name} hasSaveForBillingEvent=${
        typeof wired.subscriptionRepo.saveForBillingEvent === 'function'
      }`
    );
    console.log('OBSERVATION DATABASE_URL unset: migration/wiring proof requires a database');
    return;
  }

  if (fresh) {
    await pool.query(
      'DROP TABLE IF EXISTS billing_event_ledger, subscriptions, plans, tenants, schema_migrations'
    );
    console.log('OBSERVATION fresh_drop done');
  }

  const run1 = await runMigrations(pool);
  const rows1 = await count(pool, 'schema_migrations');
  const run2 = await runMigrations(pool);
  const rows2 = await count(pool, 'schema_migrations');
  const run3 = await runMigrations(pool);
  const rows3 = await count(pool, 'schema_migrations');

  console.log(
    `OBSERVATION run1 applied=[${run1.applied.join(',')}] skipped=[${run1.skipped.join(',')}] schema_migrations_rows=${rows1}`
  );
  console.log(
    `OBSERVATION run2 applied=[${run2.applied.join(',')}] skipped=[${run2.skipped.join(',')}] schema_migrations_rows=${rows2}`
  );
  console.log(
    `OBSERVATION run3 applied=[${run3.applied.join(',')}] skipped=[${run3.skipped.join(',')}] schema_migrations_rows=${rows3}`
  );
  console.log(
    `OBSERVATION schema_migrations_versions=${JSON.stringify(
      (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(
        (row) => row.version
      )
    )}`
  );
  console.log(
    `OBSERVATION tables=${JSON.stringify(
      (
        await pool.query(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
        )
      ).rows.map((row) => row.tablename)
    )}`
  );
  console.log(
    `OBSERVATION plans_rows=${await count(pool, 'plans')} tenants_rows=${await count(
      pool,
      'tenants'
    )} subscriptions_rows=${await count(pool, 'subscriptions')} ledger_rows=${await count(
      pool,
      'billing_event_ledger'
    )}`
  );

  const wired = await initSubscriptionRepositories();
  console.log(
    `OBSERVATION wiring persistent=${wired.persistent} subscriptionRepo=${
      wired.subscriptionRepo.constructor.name
    } planRepo=${wired.planRepo.constructor.name} hasSaveForBillingEvent=${
      typeof wired.subscriptionRepo.saveForBillingEvent === 'function'
    }`
  );

  // Prove the reference server's own `subscriptionCore` (module-level export of
  // server/src/lib/subscriptions.ts) is backed by the Postgres repositories: a
  // subscription created through the core must be readable as a row.
  const accountId = 'wireproof_account';
  await subscriptionCore.createSubscription({ accountId, planId: 'pro' });
  const storedRow = await pool.query('SELECT account_id, plan_id, status FROM subscriptions WHERE account_id = $1', [
    accountId,
  ]);
  const viaCore = await subscriptionCore.getSubscription(accountId);
  console.log(
    `OBSERVATION core_backed_by_postgres rows_in_db=${storedRow.rowCount} row=${JSON.stringify(
      storedRow.rows[0]
    )} core_reads_back=${JSON.stringify({
      accountId: viaCore?.accountId,
      planId: viaCore?.planId,
      status: viaCore?.status,
    })}`
  );
  await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [accountId]);
  await pool.query("DELETE FROM billing_event_ledger WHERE account_id = $1", [accountId]);

  await pool.end();

  const idempotent = run2.applied.length === 0 && run3.applied.length === 0 && rows1 === rows2 && rows2 === rows3;
  console.log(`OBSERVATION migration_runner_idempotent=${idempotent}`);
  if (!idempotent) process.exitCode = 1;
}

await main();
