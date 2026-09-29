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
 * EVERY CHECK IS NAMED AFTER THE STEP THAT RAN IT. That is the rule this file
 * now follows, and it is the whole point of the four names below:
 *
 *   connection        — opening the connection. This is the ONLY name that may
 *                       ever report a failure here, and it does so only when
 *                       the connection could not be established at all
 *                       (unreachable host, refused port, rejected credentials).
 *   migration-tables  — listing the tables the migrations create.
 *   seed-plans        — reading the two seed plan rows. The query behind it
 *                       reads `plans`, so it is NOT run before that table
 *                       exists: when the schema is missing this check is
 *                       reported as FAIL "not run: ..." rather than being
 *                       attempted, and it is never reported under the name
 *                       "connection". (An earlier revision ran it anyway and
 *                       sent the resulting "relation \"plans\" does not exist"
 *                       error to its single catch block, which recorded it as
 *                       `CHECK connection FAIL` directly underneath a
 *                       `CHECK connection PASS` line on a database that was
 *                       perfectly reachable. The reader was told the database
 *                       had a connection problem when the connection had
 *                       succeeded and the schema did not exist yet.)
 *
 * THIS FILE REPORTS WHAT IT OBSERVES; IT DOES NOT CLASSIFY. There is no
 * "PENDING" concept here. A reachable database whose schema is not created yet
 * produces failing checks and a non-zero exit, and `scripts/house-swarm-7/setup.sh`
 * decides what that combination means.
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

/** A failure message safe to print, from anything a catch block received. */
function reason(error) {
  return redact(error instanceof Error ? error.message : String(error));
}

if (!process.env.DATABASE_URL) {
  record('database-url-present', false, 'DATABASE_URL is not set in the process environment');
} else {
  record('database-url-present', true, 'DATABASE_URL is set in the process environment, value not printed');

  const pg = require('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  // -------------------------------------------------------------------------
  // 1. connection. The only step whose failure may be called a connection
  //    failure, and the only one that can produce `CHECK connection FAIL`.
  //    Nothing after it reports under this name.
  // -------------------------------------------------------------------------
  let connected = false;
  try {
    await client.connect();
    connected = true;
    record('connection', true, 'connected to the database in DATABASE_URL');
  } catch (error) {
    record('connection', false, reason(error));
  }

  // -------------------------------------------------------------------------
  // 2. the migration tables. Skipped entirely when the connection never
  //    opened: nothing could be observed, so nothing is reported, and the
  //    `connection` line above is the only failure in the output.
  // -------------------------------------------------------------------------
  let tablesWereListed = false;
  let schemaIsComplete = false;

  if (connected) {
    try {
      const { rows } = await client.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' ORDER BY table_name`
      );
      const present = rows.map((row) => row.table_name);
      const missing = TABLES_CREATED_BY_THE_MIGRATIONS.filter((name) => !present.includes(name));

      tablesWereListed = true;
      schemaIsComplete = missing.length === 0;

      record(
        'migration-tables',
        schemaIsComplete,
        schemaIsComplete
          ? `all ${TABLES_CREATED_BY_THE_MIGRATIONS.length} expected tables present`
          : `missing: ${missing.join(', ')}; start the server once so the migrations run`
      );
    } catch (error) {
      // Not a connection failure: the connection is already established, so
      // this is reported under the name of the step that failed.
      record('migration-tables', false, `could not list the tables in the database: ${reason(error)}`);
    }
  }

  // -------------------------------------------------------------------------
  // 3. the seed plans. Its query reads `plans`, so it runs only once that table
  //    is known to exist. When the schema is not there yet the check is
  //    reported as not run, in its own name, with the reason in the detail —
  //    never as a connection failure, and never as a silent pass.
  // -------------------------------------------------------------------------
  if (connected) {
    if (!tablesWereListed) {
      record(
        'seed-plans',
        false,
        'not run: the migration-table check above could not list the tables, so the seed-plan query was not attempted'
      );
    } else if (!schemaIsComplete) {
      record(
        'seed-plans',
        false,
        'not run: the schema is not created yet, so there is no plans table to read; start the server once so the migrations run'
      );
    } else {
      try {
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
        record('seed-plans', false, `could not read the seed plans: ${reason(error)}`);
      }
    }
  }

  try {
    await client.end();
  } catch {
    // Closing a connection that never opened is not itself a failure.
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
