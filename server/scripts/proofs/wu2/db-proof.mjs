#!/usr/bin/env node
/**
 * HOUSE-SWARM-7 WU-2 database proof harness (standalone Node ESM).
 *
 * Connects with `pg` to the database in DATABASE_URL and prints one
 * machine-readable line per check:
 *
 *   CHECK <name> PASS|FAIL <detail>
 *
 * Checks: migrations-apply-twice-idempotent, write-then-read-back,
 * ledger-dedupes-second-event, subscription-row-survives-reconnect,
 * seed-plans-present.
 *
 * This harness never starts or stops the database, never prints the connection
 * string or any credential, and exits non-zero if any check fails or if
 * DATABASE_URL is unset.
 *
 * Usage:  DATABASE_URL=... node scripts/proofs/wu2/db-proof.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '../../../migrations');

const DATABASE_URL = process.env.DATABASE_URL;
const results = [];

function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`CHECK ${name} ${passed ? 'PASS' : 'FAIL'} ${detail}`);
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ version: name.replace(/\.sql$/, ''), file: join(MIGRATIONS_DIR, name) }));
}

async function runMigrations(pool) {
  const applied = [];
  const skipped = [];
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`
    );
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const done = new Set(rows.map((row) => row.version));

    for (const migration of migrationFiles()) {
      if (done.has(migration.version)) {
        skipped.push(migration.version);
        continue;
      }
      const sql = readFileSync(migration.file, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          migration.version,
        ]);
        await client.query('COMMIT');
        applied.push(migration.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
  return { applied, skipped };
}

function makePool() {
  return new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
}

async function countRows(pool, sql) {
  const { rows } = await pool.query(sql);
  return Number(rows[0].count);
}

async function main() {
  if (!DATABASE_URL) {
    console.log('CHECK harness FAIL DATABASE_URL is not set (no credential printed)');
    process.exitCode = 1;
    return;
  }

  // --- check 1: migrations-apply-twice-idempotent -------------------------
  let pool = makePool();
  let firstRun;
  let secondRun;
  let migrationsRowCount = -1;
  try {
    firstRun = await runMigrations(pool);
    migrationsRowCount = await countRows(pool, 'SELECT count(*)::int AS count FROM schema_migrations');
    secondRun = await runMigrations(pool);
    const afterSecond = await countRows(pool, 'SELECT count(*)::int AS count FROM schema_migrations');
    const expected = migrationFiles().length;
    const ok =
      secondRun.applied.length === 0 &&
      afterSecond === migrationsRowCount &&
      migrationsRowCount === expected;
    record(
      'migrations-apply-twice-idempotent',
      ok,
      `first_run_applied=[${firstRun.applied.join(',')}] first_run_skipped=[${firstRun.skipped.join(',')}] ` +
        `rows_after_first=${migrationsRowCount} second_run_applied=[${secondRun.applied.join(',')}] ` +
        `second_run_skipped=[${secondRun.skipped.join(',')}] rows_after_second=${afterSecond} sql_files=${expected}`
    );
  } catch (error) {
    record('migrations-apply-twice-idempotent', false, `error=${error.message}`);
  }

  // --- check 5: seed-plans-present ---------------------------------------
  try {
    const { rows } = await pool.query(
      `SELECT id, name, billing_interval, price_minor_units, currency, entitlements
         FROM plans WHERE id IN ('free', 'pro') ORDER BY id`
    );
    const ids = rows.map((row) => row.id);
    const ok = ids.length === 2 && ids.includes('free') && ids.includes('pro');
    record(
      'seed-plans-present',
      ok,
      `rows=${JSON.stringify(rows)}`
    );
  } catch (error) {
    record('seed-plans-present', false, `error=${error.message}`);
  }

  // --- check 2: write-then-read-back --------------------------------------
  const accountId = `proof_account_${Date.now()}`;
  const subscriptionId = `proof_sub_${Date.now()}`;
  const periodStart = new Date('2026-01-01T00:00:00.000Z');
  const periodEnd = new Date('2026-02-01T00:00:00.000Z');
  try {
    await pool.query(
      `INSERT INTO subscriptions (
         id, account_id, plan_id, status,
         current_period_start, current_period_end, trial_end, grace_period_end,
         cancel_at_period_end, canceled_at, metadata, last_processed_event_id, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12, now())
       ON CONFLICT (account_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
      [
        subscriptionId,
        accountId,
        'pro',
        'grace_period',
        periodStart,
        periodEnd,
        null,
        new Date('2026-01-04T00:00:00.000Z'),
        false,
        null,
        JSON.stringify({ proof: 'wu2' }),
        null,
      ]
    );
    const { rows } = await pool.query('SELECT * FROM subscriptions WHERE account_id = $1', [
      accountId,
    ]);
    const row = rows[0];
    const ok =
      rows.length === 1 &&
      row.id === subscriptionId &&
      row.plan_id === 'pro' &&
      row.status === 'grace_period' &&
      row.metadata?.proof === 'wu2' &&
      new Date(row.grace_period_end).toISOString() === '2026-01-04T00:00:00.000Z' &&
      new Date(row.current_period_end).toISOString() === periodEnd.toISOString();
    record(
      'write-then-read-back',
      ok,
      `account_id=${accountId} rows=${rows.length} id=${row?.id} plan_id=${row?.plan_id} ` +
        `status=${row?.status} grace_period_end=${row?.grace_period_end?.toISOString?.() ?? row?.grace_period_end} ` +
        `current_period_end=${row?.current_period_end?.toISOString?.() ?? row?.current_period_end} metadata=${JSON.stringify(row?.metadata)}`
    );
  } catch (error) {
    record('write-then-read-back', false, `error=${error.message}`);
  }

  // --- check 3: ledger-dedupes-second-event --------------------------------
  const eventId = `proof_evt_${Date.now()}`;
  try {
    const claim = async () =>
      pool.query(
        `INSERT INTO billing_event_ledger (event_id, account_id, subscription_id)
         VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING`,
        [eventId, accountId, subscriptionId]
      );
    const first = await claim();
    const second = await claim();
    const ledgerRows = await countRows(
      pool,
      `SELECT count(*)::int AS count FROM billing_event_ledger WHERE event_id = '${eventId.replace(/'/g, "''")}'`
    );
    const ok = first.rowCount === 1 && second.rowCount === 0 && ledgerRows === 1;
    record(
      'ledger-dedupes-second-event',
      ok,
      `event_id=${eventId} first_claim_rowcount=${first.rowCount} second_claim_rowcount=${second.rowCount} ledger_rows_for_event=${ledgerRows}`
    );
  } catch (error) {
    record('ledger-dedupes-second-event', false, `error=${error.message}`);
  }

  // --- check 4: subscription-row-survives-reconnect ------------------------
  try {
    await pool.end();
    pool = makePool();
    const { rows } = await pool.query('SELECT * FROM subscriptions WHERE account_id = $1', [
      accountId,
    ]);
    const ok = rows.length === 1 && rows[0].id === subscriptionId && rows[0].plan_id === 'pro';
    record(
      'subscription-row-survives-reconnect',
      ok,
      `account_id=${accountId} rows_after_reconnect=${rows.length} id=${rows[0]?.id} plan_id=${rows[0]?.plan_id} ` +
        `status=${rows[0]?.status}`
    );

    // Leave no proof data behind so repeated runs stay clean.
    await pool.query('DELETE FROM billing_event_ledger WHERE event_id = $1', [eventId]);
    await pool.query('DELETE FROM subscriptions WHERE account_id = $1', [accountId]);
  } catch (error) {
    record('subscription-row-survives-reconnect', false, `error=${error.message}`);
  } finally {
    await pool.end();
  }

  const failed = results.filter((result) => !result.passed);
  console.log(
    `SUMMARY checks=${results.length} passed=${results.length - failed.length} failed=${failed.length}` +
      (failed.length > 0 ? ` failed_names=[${failed.map((f) => f.name).join(',')}]` : '')
  );
  if (failed.length > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.log(`CHECK harness FAIL unexpected_error=${error.message}`);
  process.exitCode = 1;
}
