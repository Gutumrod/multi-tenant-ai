import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations');

// Stable, project-specific PostgreSQL advisory-lock key for migration startup.
// The two-int form keeps the key explicit and avoids relying on process-local
// coordination. All app instances sharing the same database serialize here.
const MIGRATION_LOCK_CLASS = 129737041;
const MIGRATION_LOCK_OBJECT = 1;

export type MigrationResult = {
  /** Versions applied by this run (empty on a second, no-op run). */
  applied: string[];
  /** Versions already recorded in schema_migrations before this run. */
  skipped: string[];
};

/**
 * Reads the versioned SQL files. Returns [] when a deployment ships without the
 * migrations directory rather than throwing at import time.
 */
function listMigrationFiles(): { version: string; file: string }[] {
  try {
    return readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => ({ version: name.replace(/\.sql$/, ''), file: join(migrationsDir, name) }));
  } catch {
    return [];
  }
}

/**
 * Bookkeeping table for the runner. `0001_persistence.sql` also creates it, so
 * this statement only matters for the very first run, and it must be safe to
 * repeat once concurrent startup is serialized by the advisory lock.
 */
async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version     text PRIMARY KEY,
       applied_at  timestamptz NOT NULL DEFAULT now()
     )`
  );
}

/**
 * Idempotent migration runner.
 *
 * A session-scoped PostgreSQL advisory lock serializes the entire bootstrap and
 * migration pass across processes/instances that share a database. The same
 * dedicated client is used for each per-migration transaction, preserving the
 * existing one-transaction-per-migration semantics while avoiding bootstrap
 * races on a fresh database.
 *
 * The dedicated client is destroyed rather than returned to the pool. Closing
 * the PostgreSQL session releases the advisory lock even if migration SQL or
 * explicit cleanup fails, making lock release exception-safe.
 */
export async function runMigrations(pool: Pool): Promise<MigrationResult> {
  const applied: string[] = [];
  const skipped: string[] = [];

  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1::integer, $2::integer)', [
      MIGRATION_LOCK_CLASS,
      MIGRATION_LOCK_OBJECT,
    ]);

    await ensureMigrationsTable(client);
    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const done = new Set(rows.map((row) => row.version));

    for (const migration of listMigrationFiles()) {
      if (done.has(migration.version)) {
        skipped.push(migration.version);
        continue;
      }

      const sql = readFileSync(migration.file, 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          migration.version,
        ]);
        await client.query('COMMIT');
        applied.push(migration.version);
        done.add(migration.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    // Never return a session-scoped advisory lock to the pool. Destroying the
    // session guarantees PostgreSQL releases the lock on every exit path.
    client.release(true);
  }

  return { applied, skipped };
}
