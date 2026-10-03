import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { runMigrations } from '../src/lib/persistence/migrate.js';

const databaseUrl = process.env.DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite('Phase B concurrent migration startup negative control', () => {
  let admin: Pool;
  let schema: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    schema = `phaseb_migration_${randomUUID().replace(/-/g, '')}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
  });

  afterAll(async () => {
    if (admin && schema) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });

  it('serializes concurrent startup migrations on one fresh schema', async () => {
    const pools = Array.from(
      { length: 8 },
      () =>
        new Pool({
          connectionString: databaseUrl,
          options: `-c search_path=${schema}`,
          max: 2,
        })
    );

    try {
      const results = await Promise.all(pools.map((pool) => runMigrations(pool)));

      expect(results).toHaveLength(8);

      const verification = await pools[0].query<{
        migrations: number;
        plans: string | null;
        usage: string | null;
      }>(
        `SELECT
           (SELECT count(*)::int FROM schema_migrations) AS migrations,
           to_regclass('plans')::text AS plans,
           to_regclass('usage_counters')::text AS usage`
      );

      expect(verification.rows[0].migrations).toBeGreaterThan(0);
      expect(verification.rows[0].plans).toBe('plans');
      expect(verification.rows[0].usage).toBe('usage_counters');
    } finally {
      await Promise.all(pools.map((pool) => pool.end()));
    }
  });
});
