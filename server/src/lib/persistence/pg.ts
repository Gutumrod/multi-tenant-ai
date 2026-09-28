import pg from 'pg';
import type { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

/**
 * Postgres connection pool for the real-database persistence path.
 * Mirrors server/src/lib/supabase.ts: the resource is built from the
 * environment and the export is `null` (rather than throwing) when the
 * deployment has not configured it, so callers can fall back to the in-memory
 * repositories.
 */
export const pgPool: Pool | null = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      // Keeps a restarted/idle database from killing the process; the pool
      // surfaces the error instead of crashing.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

export function getPgPool(): Pool | null {
  return pgPool;
}
