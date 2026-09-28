#!/usr/bin/env node
/**
 * WU-4 scratch DB probe (NOT an acceptance proof): prints the tables, applied
 * migrations and seeded plans so the WU-4 work can confirm the local database is
 * reachable and the WU-2/WU-3 schema is present. Prints no credential.
 *
 * Usage:  DATABASE_URL=... node scripts/proofs/wu4/db-probe.mjs
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('PROBE FAIL DATABASE_URL is not set (no credential printed)');
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 });
  try {
    const version = await pool.query('select version()');
    console.log(`PROBE server ${version.rows[0].version}`);
    const tables = await pool.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name"
    );
    console.log(`PROBE tables ${tables.rows.map((row) => row.table_name).join(',')}`);
    const migrations = await pool.query('select version from schema_migrations order by version');
    console.log(`PROBE migrations ${migrations.rows.map((row) => row.version).join(',')}`);
    const plans = await pool.query('select id, name, entitlements from plans order by id');
    console.log(`PROBE plans ${JSON.stringify(plans.rows)}`);
  } catch (error) {
    console.log(`PROBE FAIL ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
