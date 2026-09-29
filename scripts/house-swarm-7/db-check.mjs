#!/usr/bin/env node
/**
 * HOUSE-SWARM-7 WU-5 — database connectivity and schema check.
 *
 * The setup script's only job for this probe is to run it. It is a separate
 * file, and not a `node -e` one-liner, on purpose: a shell one-liner that
 * embeds SQL is hard to read, hard to quote correctly across `sh` and Git-Bash,
 * and impossible to check with the project's own typechecker.
 *
 * It reads DATABASE_URL from the PROCESS ENVIRONMENT only. It never reads a
 * file (this project has no dotenv — see docs/house-swarm-7/WU5-DEPLOY.md §3.3),
 * it never writes anything, and it never prints the connection string or the
 * password inside it.
 *
 * It uses the `pg` package that `server/node_modules` already provides, so it
 * adds no dependency.
 *
 * Prints one machine-readable line per check: "CHECK <name> PASS|FAIL <detail>",
 * exactly like the other harnesses in server/scripts/proofs/. Exits non-zero if
 * any check fails.
 *
 * Usage:  node scripts/house-swarm-7/db-check.mjs
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(HERE, '..', '..', 'server');

// Resolve `pg` from the server package so this runs from any working directory.
const require = createRequire(join(SERVER_DIR, 'package.json'));

const TABLES_CREATED_BY_THE_MIGRATIONS = [
  'billing_event_ledger',
  'plans',
  'schema_migrations',
  'subscriptions',
  'tenants',
  'usage_counters',
];

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

/** Never let the connection string reach the output. */
function redact(text) {
  return String(text).replace(/:\/\/([^:@/]+):[^@/]*@/g, '://$1:***@');
}

if (!process.env.DATABASE_URL) {
  record('database-url-present', false, 'DATABASE_URL is not set in the process environment');
} else {
  record('database-url-present', true, 'DATABASE_URL is set in the process environment, value not printed');

  const pg = require('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    record('connection', true, 'connected to the database in DATABASE_URL');

    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`
    );
    const present = rows.map((row) => row.table_name);
    const missing = TABLES_CREATED_BY_THE_MIGRATIONS.filter((name) => !present.includes(name));

    if (missing.length === 0) {
      record(
        'migration-tables',
        true,
        `all ${TABLES_CREATED_BY_THE_MIGRATIONS.length} expected tables present`
      );
    } else {
      record(
        'migration-tables',
        false,
        `missing: ${missing.join(', ')}; start the server once so the migrations run`
      );
    }

    const { rows: planRows } = await client.query(
      'SELECT id FROM plans WHERE id IN ($1, $2) ORDER BY id',
      ['free', 'pro']
    );
    const planIds = planRows.map((row) => row.id);
    record(
      'seed-plans',
      planIds.length === 2,
      planIds.length === 2
        ? 'both seed plans present: free, pro'
        : `expected the seed plans free and pro, found: ${planIds.length === 0 ? 'none' : planIds.join(', ')}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record('connection', false, redact(message));
  } finally {
    try {
      await client.end();
    } catch {
      // Closing a connection that never opened is not itself a failure.
    }
  }
}

for (const result of results) {
  console.log(`CHECK ${result.name} ${result.passed ? 'PASS' : 'FAIL'} ${result.detail}`);
}

const failed = results.filter((result) => !result.passed);
if (failed.length > 0) {
  console.error(`db-check: ${failed.length} of ${results.length} checks FAILED`);
  process.exit(1);
}

console.log(`db-check: all ${results.length} checks PASSED`);
