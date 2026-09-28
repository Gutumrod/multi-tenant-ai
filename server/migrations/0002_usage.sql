-- 0002_usage.sql — durable usage counter (HOUSE-SWARM-7 WU-3)
--
-- Versioned, re-runnable DDL for the paid-resource usage counter that the
-- quota gate (server/src/lib/quota.ts) reads and consumes. One row per
-- (account, feature, billing period); the row is the durable record of how
-- much of a paid resource an account has already consumed in that period.
--
-- Every statement in this file is safe to run more than once
-- (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / ON CONFLICT
-- upsert). Version bookkeeping is the runner's job
-- (server/src/lib/persistence/migrate.ts), which records this file's version in
-- schema_migrations inside the same transaction.

-- ---------------------------------------------------------------------------
-- Usage counters (mirrors the UsageCounterRepository contract added to
-- modules/subscription/core/repository.ts by WU-3)
--
-- The PRIMARY KEY (account_id, feature_key, period_start) is what makes the
-- increment a single atomic statement: it is the conflict target of
--
--   INSERT INTO usage_counters (account_id, feature_key, period_start,
--                               usage_count, updated_at)
--   VALUES ($1, $2, $3, $4, now())
--   ON CONFLICT (account_id, feature_key, period_start)
--   DO UPDATE SET usage_count = usage_counters.usage_count + EXCLUDED.usage_count,
--                 updated_at  = now()
--   RETURNING usage_count;
--
-- (usage_counters.usage_count on the right-hand side of DO UPDATE is the
-- stored/counter row; EXCLUDED.usage_count is the increment in the VALUES
-- clause. The table qualifier on the target's own column is REQUIRED, not
-- cosmetic: with a bare `usage_count` the right-hand side is ambiguous between
-- the target table's column and EXCLUDED's, and PostgreSQL 16.4 rejects the
-- whole statement with SQLSTATE 42702 `column reference "usage_count" is
-- ambiguous`.) The statement
-- itself lives in
-- server/src/lib/persistence/pg-repositories.ts (PostgresUsageCounterRepository)
-- so the counter path is one round trip with no read-then-write window.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_counters (
  account_id    text NOT NULL,
  feature_key   text NOT NULL,
  period_start  timestamptz NOT NULL,
  usage_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, feature_key, period_start),
  CONSTRAINT usage_counters_usage_count_check CHECK (usage_count >= 0)
);

CREATE INDEX IF NOT EXISTS usage_counters_account_id_idx
  ON usage_counters (account_id);

CREATE INDEX IF NOT EXISTS usage_counters_account_feature_idx
  ON usage_counters (account_id, feature_key);

-- ---------------------------------------------------------------------------
-- WU-3 entitlement re-assert.
--
-- WU-3 adds payments_per_month to both seeded plans. 0001_persistence.sql is
-- already recorded in schema_migrations on any database created before WU-3, so
-- its seed upsert will never run again there; this idempotent upsert re-asserts
-- the WU-3 entitlement values so those databases converge without wiping data.
--
-- These numbers MUST stay identical to
--   * the seed upsert in 0001_persistence.sql, and
--   * SEED_PLANS in server/src/lib/subscriptions.ts.
-- ---------------------------------------------------------------------------
INSERT INTO plans (id, name, billing_interval, price_minor_units, currency, entitlements)
VALUES
  (
    'free',
    'Free Tier',
    'month',
    0,
    'USD',
    '{"ai_requests_per_month": 50, "payments_per_month": 5}'::jsonb
  ),
  (
    'pro',
    'Pro Tier',
    'month',
    2900,
    'USD',
    '{"ai_requests_per_month": 1000, "payments_per_month": 100}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  entitlements = EXCLUDED.entitlements,
  updated_at   = now();
