import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations');

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
 * repeat.
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
 * Idempotent migration runner: reads server/migrations/*.sql in lexical order,
 * skips versions already present in schema_migrations, and runs each remaining
 * file inside its own transaction together with the version insert. Running it
 * twice applies nothing the second time.
 */
export async function runMigrations(pool: Pool): Promise<MigrationResult> {
  const applied: string[] = [];
  const skipped: string[] = [];

  const setup = await pool.connect();
  try {
    await ensureMigrationsTable(setup);
    const { rows } = await setup.query<{ version: string }>('SELECT version FROM schema_migrations');
    const done = new Set(rows.map((row) => row.version));

    for (const migration of listMigrationFiles()) {
      if (done.has(migration.version)) {
        skipped.push(migration.version);
        continue;
      }

      const sql = readFileSync(migration.file, 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          migration.version,
        ]);
        await client.query('COMMIT');
        applied.push(migration.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    setup.release();
  }

  return { applied, skipped };
}
